import { v } from "convex/values";
import { query } from "./_generated/server";

// Helper to get date range timestamps
function getDateRange(period: string): { start: number; end: number } {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const week = 7 * day;

  switch (period) {
    case "week":
      return { start: now - week, end: now };
    case "month":
      return { start: now - 30 * day, end: now };
    case "quarter":
      return { start: now - 90 * day, end: now };
    case "year":
      return { start: now - 365 * day, end: now };
    default:
      return { start: now - 30 * day, end: now };
  }
}

// Get profitability report
export const getProfitability = query({
  args: {
    userId: v.id("users"),
    period: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") return null;

    const { start, end } = getDateRange(args.period || "month");

    // Get all jobs
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    // Get timesheets in period
    const timesheets = await ctx.db
      .query("timesheets")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .filter((q) =>
        q.and(
          q.gte(q.field("date"), start),
          q.lte(q.field("date"), end),
          q.eq(q.field("status"), "approved")
        )
      )
      .collect();

    // Get expenses in period
    const allExpenses = await ctx.db.query("expenses").collect();
    const expenses = allExpenses.filter(
      (e) => e.date >= start && e.date <= end
    );

    // Get invoices in period
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    const paidInvoices = invoices.filter(
      (i) => i.status === "paid" && i.paidAt && i.paidAt >= start && i.paidAt <= end
    );

    // Calculate totals
    let totalRevenue = 0;
    let totalLabourCost = 0;
    let totalExpenses = 0;
    let totalHours = 0;

    // Get worker rates
    const workers = await ctx.db
      .query("workers")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    const workerRates = new Map(workers.map((w) => [w._id, w]));

    // Get allocations for rate lookup
    const allocations = await ctx.db
      .query("allocations")
      .filter((q) =>
        q.or(
          ...timesheets.map((ts) => q.eq(q.field("workerId"), ts.workerId))
        )
      )
      .collect();

    for (const ts of timesheets) {
      // Try to get rate from allocation first
      const allocation = allocations.find(
        (a) => a.workerId === ts.workerId
      );

      if (allocation) {
        totalLabourCost += ts.totalHours * allocation.payRate;
      } else {
        // Fallback to worker default rate
        const worker = workerRates.get(ts.workerId);
        if (worker && worker.payRate) {
          totalLabourCost += ts.totalHours * worker.payRate;
        }
      }
      totalHours += ts.totalHours;
    }

    totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    totalRevenue = paidInvoices.reduce((sum, i) => sum + i.amount, 0);

    const grossProfit = totalRevenue - totalLabourCost - totalExpenses;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Get overhead per hour
    const overheads = await ctx.db
      .query("overheads")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    const weeklyOverhead = overheads.reduce((sum, o) => {
      let weekly = o.amount;
      switch (o.frequency) {
        case "fortnightly":
          weekly = o.amount / 2;
          break;
        case "monthly":
          weekly = (o.amount * 12) / 52;
          break;
        case "quarterly":
          weekly = (o.amount * 4) / 52;
          break;
        case "annually":
          weekly = o.amount / 52;
          break;
      }
      return sum + weekly;
    }, 0);

    const activeWorkers = workers.filter((w) => w.status === "active").length;
    const teamCapacity = activeWorkers * 38; // 38 hrs/week
    const overheadPerHour = teamCapacity > 0 ? weeklyOverhead / teamCapacity : 0;
    const allocatedOverhead = totalHours * overheadPerHour;

    const netProfit = grossProfit - allocatedOverhead;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Job breakdown
    const jobProfitability = await Promise.all(
      jobs.slice(0, 10).map(async (job) => {
        const jobTimesheets = timesheets.filter((t) => t.jobId === job._id);
        const jobExpenses = expenses.filter((e) => e.jobId === job._id);

        // Get allocations for this job
        const jobAllocations = await ctx.db
          .query("allocations")
          .withIndex("by_job", (q) => q.eq("jobId", job._id))
          .collect();

        let jobHours = 0;
        let jobLabourCost = 0;

        for (const ts of jobTimesheets) {
          const allocation = jobAllocations.find((a) => a.workerId === ts.workerId);
          if (allocation) {
            jobLabourCost += ts.totalHours * allocation.payRate;
          } else {
            const worker = workerRates.get(ts.workerId);
            if (worker && worker.payRate) {
              jobLabourCost += ts.totalHours * worker.payRate;
            }
          }
          jobHours += ts.totalHours;
        }

        const jobExpenseTotal = jobExpenses.reduce((sum, e) => sum + e.amount, 0);
        const revenue = job.jobType === "contract" ? (job.quotedPrice || 0) : 0;
        const profit = revenue - jobLabourCost - jobExpenseTotal;

        return {
          _id: job._id,
          name: job.name,
          jobType: job.jobType,
          status: job.status,
          revenue,
          labourCost: jobLabourCost,
          expenses: jobExpenseTotal,
          hours: jobHours,
          profit,
          margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        };
      })
    );

    return {
      summary: {
        totalRevenue,
        totalLabourCost,
        totalExpenses,
        grossProfit,
        grossMargin,
        allocatedOverhead,
        netProfit,
        netMargin,
        totalHours,
      },
      jobProfitability: jobProfitability.sort((a, b) => b.profit - a.profit),
    };
  },
});

// Get worker utilization report
export const getUtilization = query({
  args: {
    userId: v.id("users"),
    period: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") return null;

    const { start, end } = getDateRange(args.period || "month");

    // Get workers
    const workers = await ctx.db
      .query("workers")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    // Get timesheets in period
    const timesheets = await ctx.db
      .query("timesheets")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .filter((q) =>
        q.and(
          q.gte(q.field("date"), start),
          q.lte(q.field("date"), end)
        )
      )
      .collect();

    // Calculate available hours in period
    const weeksInPeriod = (end - start) / (7 * 24 * 60 * 60 * 1000);
    const hoursPerWeek = 38; // Standard work week

    const workerUtilization = workers.map((worker) => {
      const workerTimesheets = timesheets.filter((t) => t.workerId === worker._id);
      const totalHours = workerTimesheets.reduce((sum, t) => sum + t.totalHours, 0);
      const availableHours = weeksInPeriod * hoursPerWeek;
      const utilizationRate = availableHours > 0 ? (totalHours / availableHours) * 100 : 0;
      // Use default rates if available, otherwise 0
      const revenue = totalHours * (worker.chargeOutRate || 0);
      const cost = totalHours * (worker.payRate || 0);
      const margin = revenue - cost;

      return {
        _id: worker._id,
        name: worker.name,
        tradeClassification: worker.tradeClassification,
        totalHours,
        availableHours: Math.round(availableHours),
        utilizationRate: Math.round(utilizationRate),
        revenue,
        cost,
        margin,
        timesheetCount: workerTimesheets.length,
      };
    });

    // Calculate team totals
    const teamTotalHours = workerUtilization.reduce((sum, w) => sum + w.totalHours, 0);
    const teamAvailableHours = workerUtilization.reduce((sum, w) => sum + w.availableHours, 0);
    const teamUtilization = teamAvailableHours > 0 ? (teamTotalHours / teamAvailableHours) * 100 : 0;
    const teamRevenue = workerUtilization.reduce((sum, w) => sum + w.revenue, 0);
    const teamCost = workerUtilization.reduce((sum, w) => sum + w.cost, 0);

    return {
      workers: workerUtilization.sort((a, b) => b.utilizationRate - a.utilizationRate),
      team: {
        totalHours: teamTotalHours,
        availableHours: teamAvailableHours,
        utilizationRate: Math.round(teamUtilization),
        revenue: teamRevenue,
        cost: teamCost,
        margin: teamRevenue - teamCost,
        workerCount: workers.length,
      },
    };
  },
});

// Get timesheet trends
export const getTimesheetTrends = query({
  args: {
    userId: v.id("users"),
    period: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") return null;

    const { start, end } = getDateRange(args.period || "month");

    const timesheets = await ctx.db
      .query("timesheets")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .filter((q) =>
        q.and(
          q.gte(q.field("date"), start),
          q.lte(q.field("date"), end)
        )
      )
      .collect();

    // Group by week
    const weeklyData = new Map<string, { hours: number; count: number }>();

    for (const ts of timesheets) {
      const date = new Date(ts.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      const weekKey = weekStart.toISOString().split("T")[0];

      const existing = weeklyData.get(weekKey) || { hours: 0, count: 0 };
      weeklyData.set(weekKey, {
        hours: existing.hours + ts.totalHours,
        count: existing.count + 1,
      });
    }

    const trends = Array.from(weeklyData.entries())
      .map(([week, data]) => ({
        week,
        weekLabel: new Date(week).toLocaleDateString("en-AU", {
          month: "short",
          day: "numeric",
        }),
        hours: Math.round(data.hours * 10) / 10,
        count: data.count,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    return trends;
  },
});

// Get invoice aging report
export const getInvoiceAging = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") return null;

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .filter((q) => q.eq(q.field("status"), "sent"))
      .collect();

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const aging = {
      current: { count: 0, amount: 0 },
      days30: { count: 0, amount: 0 },
      days60: { count: 0, amount: 0 },
      days90: { count: 0, amount: 0 },
      over90: { count: 0, amount: 0 },
    };

    for (const inv of invoices) {
      const daysOutstanding = Math.floor((now - (inv.sentAt || inv.createdAt)) / day);

      if (daysOutstanding <= 30) {
        aging.current.count++;
        aging.current.amount += inv.amount;
      } else if (daysOutstanding <= 60) {
        aging.days30.count++;
        aging.days30.amount += inv.amount;
      } else if (daysOutstanding <= 90) {
        aging.days60.count++;
        aging.days60.amount += inv.amount;
      } else {
        aging.over90.count++;
        aging.over90.amount += inv.amount;
      }
    }

    const builders = await ctx.db
      .query("builders")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    const builderMap = new Map(builders.map((b) => [b._id, b]));

    const overdueByBuilder = invoices
      .filter((i) => i.dueDate < now)
      .reduce((acc, inv) => {
        const builder = builderMap.get(inv.builderId);
        const name = builder?.companyName || "Unknown";
        const existing = acc.find((a) => a.name === name);
        if (existing) {
          existing.amount += inv.amount;
          existing.count++;
        } else {
          acc.push({ name, amount: inv.amount, count: 1 });
        }
        return acc;
      }, [] as Array<{ name: string; amount: number; count: number }>)
      .sort((a, b) => b.amount - a.amount);

    return { aging, overdueByBuilder };
  },
});
