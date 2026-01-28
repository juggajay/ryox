import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Generate invoice number
function generateInvoiceNumber(orgName: string, count: number): string {
  const prefix = orgName.substring(0, 3).toUpperCase();
  const year = new Date().getFullYear().toString().slice(-2);
  const num = (count + 1).toString().padStart(4, "0");
  return `${prefix}-${year}-${num}`;
}

// Create invoice for CONTRACT jobs (progress claim)
export const createContractInvoice = mutation({
  args: {
    userId: v.id("users"),
    jobId: v.id("jobs"),
    completionPercentage: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role !== "owner") throw new Error("Only owners can create invoices");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (job.organizationId !== user.organizationId) {
      throw new Error("Unauthorized");
    }
    if (job.jobType !== "contract") {
      throw new Error("This function is for contract jobs only");
    }
    if (!job.quotedPrice) {
      throw new Error("Job has no quoted price");
    }

    const builder = await ctx.db.get(job.builderId);
    if (!builder) throw new Error("Builder not found");

    const org = await ctx.db.get(user.organizationId);
    if (!org) throw new Error("Organization not found");

    // Validate completion percentage
    const previousPercentage = job.totalInvoicedPercentage || 0;
    if (args.completionPercentage <= previousPercentage) {
      throw new Error(`Completion percentage must be greater than ${previousPercentage}%`);
    }
    if (args.completionPercentage > 100) {
      throw new Error("Completion percentage cannot exceed 100%");
    }

    // Calculate invoice amount
    const previouslyInvoiced = job.totalInvoicedAmount || 0;
    const targetAmount = job.quotedPrice * (args.completionPercentage / 100);
    const amount = targetAmount - previouslyInvoiced;

    if (amount <= 0) {
      throw new Error("Calculated invoice amount must be positive");
    }

    // Get existing invoice count for number generation
    const existingInvoices = await ctx.db
      .query("invoices")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    const invoiceNumber = generateInvoiceNumber(org.name, existingInvoices.length);

    // Calculate due date from builder payment terms
    const dueDate = Date.now() + builder.paymentTerms * 24 * 60 * 60 * 1000;

    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: user.organizationId,
      jobId: args.jobId,
      builderId: job.builderId,
      invoiceNumber,
      amount,
      completionPercentage: args.completionPercentage,
      status: "draft",
      dueDate,
      createdAt: Date.now(),
    });

    // Update job with cumulative invoiced amount
    await ctx.db.patch(args.jobId, {
      totalInvoicedAmount: targetAmount,
      totalInvoicedPercentage: args.completionPercentage,
    });

    return invoiceId;
  },
});

// Create invoice for LABOUR HIRE jobs (weekly)
export const createLabourHireInvoice = mutation({
  args: {
    userId: v.id("users"),
    jobId: v.id("jobs"),
    weekStart: v.number(),
    weekEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role !== "owner") throw new Error("Only owners can create invoices");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (job.organizationId !== user.organizationId) {
      throw new Error("Unauthorized");
    }
    if (job.jobType !== "labourHire") {
      throw new Error("This function is for labour hire jobs only");
    }

    const builder = await ctx.db.get(job.builderId);
    if (!builder) throw new Error("Builder not found");

    const org = await ctx.db.get(user.organizationId);
    if (!org) throw new Error("Organization not found");

    // Get approved timesheets for this job and week
    const timesheets = await ctx.db
      .query("timesheets")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "approved"),
          q.gte(q.field("date"), args.weekStart),
          q.lte(q.field("date"), args.weekEnd)
        )
      )
      .collect();

    if (timesheets.length === 0) {
      throw new Error("No approved timesheets for this week");
    }

    // Group timesheets by worker and calculate line items
    const workerHours: Map<string, { workerId: string; workerName: string; hours: number; rate: number }> = new Map();

    for (const ts of timesheets) {
      const workerId = ts.workerId as string;

      if (!workerHours.has(workerId)) {
        // Get worker details and rate
        const worker = await ctx.db.get(ts.workerId);
        if (!worker) continue;

        // Get allocation rate or fallback to worker default
        const allocation = await ctx.db
          .query("allocations")
          .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
          .filter((q) => q.eq(q.field("workerId"), ts.workerId))
          .first();

        const rate = allocation?.chargeOutRate || worker.chargeOutRate || 0;

        workerHours.set(workerId, {
          workerId,
          workerName: worker.name,
          hours: 0,
          rate,
        });
      }

      const entry = workerHours.get(workerId)!;
      entry.hours += ts.totalHours;
    }

    // Build line items array
    const lineItems = Array.from(workerHours.values()).map((entry) => ({
      workerId: entry.workerId as any, // Will be properly typed as Id<"workers">
      workerName: entry.workerName,
      hours: entry.hours,
      rate: entry.rate,
      total: entry.hours * entry.rate,
    }));

    // Calculate total amount
    const amount = lineItems.reduce((sum, item) => sum + item.total, 0);

    if (amount <= 0) {
      throw new Error("Invoice amount must be positive. Check worker rates.");
    }

    // Get existing invoice count for number generation
    const existingInvoices = await ctx.db
      .query("invoices")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    const invoiceNumber = generateInvoiceNumber(org.name, existingInvoices.length);

    // Calculate due date from builder payment terms
    const dueDate = Date.now() + builder.paymentTerms * 24 * 60 * 60 * 1000;

    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: user.organizationId,
      jobId: args.jobId,
      builderId: job.builderId,
      invoiceNumber,
      amount,
      weekStart: args.weekStart,
      weekEnd: args.weekEnd,
      lineItems,
      status: "draft",
      dueDate,
      createdAt: Date.now(),
    });

    // Mark timesheets as invoiced
    for (const ts of timesheets) {
      await ctx.db.patch(ts._id, { status: "invoiced" });
    }

    return invoiceId;
  },
});

// Legacy create function - redirects to appropriate new function
export const create = mutation({
  args: {
    userId: v.id("users"),
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role !== "owner") throw new Error("Only owners can create invoices");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (job.organizationId !== user.organizationId) {
      throw new Error("Unauthorized");
    }

    const builder = await ctx.db.get(job.builderId);
    if (!builder) throw new Error("Builder not found");

    const org = await ctx.db.get(user.organizationId);
    if (!org) throw new Error("Organization not found");

    // Get approved timesheets for job
    const timesheets = await ctx.db
      .query("timesheets")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    if (timesheets.length === 0 && job.jobType !== "contract") {
      throw new Error("No approved timesheets to invoice");
    }

    // Calculate amount based on job type
    let amount = 0;

    if (job.jobType === "contract") {
      // For contract jobs, use quoted price (legacy behavior - full amount)
      amount = job.quotedPrice || 0;
    } else {
      // For labour hire, calculate from timesheets using allocation rates
      for (const ts of timesheets) {
        // Get the allocation for this worker on this job to find the rate
        const allocation = await ctx.db
          .query("allocations")
          .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
          .filter((q) => q.eq(q.field("workerId"), ts.workerId))
          .first();

        if (allocation) {
          amount += ts.totalHours * allocation.chargeOutRate;
        } else {
          // Fallback to worker default rate if no allocation
          const worker = await ctx.db.get(ts.workerId);
          if (worker && worker.chargeOutRate) {
            amount += ts.totalHours * worker.chargeOutRate;
          }
        }
      }
    }

    // Get existing invoice count for number generation
    const existingInvoices = await ctx.db
      .query("invoices")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    const invoiceNumber = generateInvoiceNumber(org.name, existingInvoices.length);

    // Calculate due date from builder payment terms
    const dueDate = Date.now() + builder.paymentTerms * 24 * 60 * 60 * 1000;

    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: user.organizationId,
      jobId: args.jobId,
      builderId: job.builderId,
      invoiceNumber,
      amount,
      status: "draft",
      dueDate,
      createdAt: Date.now(),
    });

    // Mark timesheets as invoiced
    for (const ts of timesheets) {
      await ctx.db.patch(ts._id, { status: "invoiced" });
    }

    return invoiceId;
  },
});

// Get available weeks for labour hire invoicing
export const getAvailableWeeks = query({
  args: {
    userId: v.id("users"),
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];
    if (user.role !== "owner") return [];

    const job = await ctx.db.get(args.jobId);
    if (!job) return [];
    if (job.organizationId !== user.organizationId) return [];
    if (job.jobType !== "labourHire") return [];

    // Get all approved timesheets for this job
    const timesheets = await ctx.db
      .query("timesheets")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    if (timesheets.length === 0) return [];

    // Get all workers for this job's allocations to get their charge-out rates
    const allocations = await ctx.db
      .query("allocations")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    const workerIds = new Set(allocations.map((a) => a.workerId));
    const workers = await Promise.all(
      Array.from(workerIds).map((id) => ctx.db.get(id))
    );
    const workerMap = new Map(
      workers.filter((w) => w !== null).map((w) => [w._id, w])
    );

    // Get allocation rates (for job-specific rates if set)
    const allocationRateMap = new Map(
      allocations
        .filter((a) => a.chargeOutRate !== undefined)
        .map((a) => [a.workerId, a.chargeOutRate as number])
    );

    // Group timesheets by week (Monday to Friday)
    const weekMap: Map<string, {
      weekStart: number;
      weekEnd: number;
      timesheetsByWorker: Map<string, { hours: number; timesheetIds: string[] }>;
    }> = new Map();

    for (const ts of timesheets) {
      // Get Monday of the week for this timesheet
      const date = new Date(ts.date);
      const day = date.getUTCDay();
      const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
      const monday = new Date(date);
      monday.setUTCDate(date.getUTCDate() + diff);
      monday.setUTCHours(0, 0, 0, 0);

      const friday = new Date(monday);
      friday.setUTCDate(monday.getUTCDate() + 4);
      friday.setUTCHours(23, 59, 59, 999);

      const weekKey = monday.getTime().toString();

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          weekStart: monday.getTime(),
          weekEnd: friday.getTime(),
          timesheetsByWorker: new Map(),
        });
      }

      const week = weekMap.get(weekKey)!;
      const workerId = ts.workerId as string;

      if (!week.timesheetsByWorker.has(workerId)) {
        week.timesheetsByWorker.set(workerId, { hours: 0, timesheetIds: [] });
      }

      const workerData = week.timesheetsByWorker.get(workerId)!;
      workerData.hours += ts.totalHours;
      workerData.timesheetIds.push(ts._id);
    }

    // Convert to array with worker breakdown and sort by week (oldest first)
    const weeks = Array.from(weekMap.values())
      .map((week) => {
        const workersArray: Array<{
          workerId: string;
          workerName: string;
          hours: number;
          rate: number;
          total: number;
        }> = [];

        let totalHours = 0;
        let totalAmount = 0;

        for (const [workerId, data] of week.timesheetsByWorker) {
          const worker = workerMap.get(workerId as Id<"workers">);
          if (!worker) continue;

          // Use allocation rate if set, otherwise use worker's default charge-out rate
          const rate = allocationRateMap.get(workerId as Id<"workers">) ?? worker.chargeOutRate ?? 0;
          const lineTotal = Math.round(data.hours * rate * 100) / 100;

          workersArray.push({
            workerId,
            workerName: worker.name,
            hours: Math.round(data.hours * 10) / 10,
            rate,
            total: lineTotal,
          });

          totalHours += data.hours;
          totalAmount += lineTotal;
        }

        return {
          weekStart: week.weekStart,
          weekEnd: week.weekEnd,
          workerCount: workersArray.length,
          totalHours: Math.round(totalHours * 10) / 10,
          totalAmount: Math.round(totalAmount * 100) / 100,
          timesheetCount: Array.from(week.timesheetsByWorker.values()).reduce(
            (sum, w) => sum + w.timesheetIds.length,
            0
          ),
          workers: workersArray,
        };
      })
      .sort((a, b) => a.weekStart - b.weekStart);

    return weeks;
  },
});

// Get job details for invoice creation (includes invoicing status)
export const getJobForInvoicing = query({
  args: {
    userId: v.id("users"),
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    if (user.role !== "owner") return null;

    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    if (job.organizationId !== user.organizationId) return null;

    const builder = await ctx.db.get(job.builderId);

    return {
      _id: job._id,
      name: job.name,
      siteAddress: job.siteAddress,
      jobType: job.jobType,
      quotedPrice: job.quotedPrice,
      totalInvoicedAmount: job.totalInvoicedAmount || 0,
      totalInvoicedPercentage: job.totalInvoicedPercentage || 0,
      builder: builder ? {
        _id: builder._id,
        companyName: builder.companyName,
        paymentTerms: builder.paymentTerms,
      } : null,
    };
  },
});

// List invoices
export const list = query({
  args: {
    userId: v.id("users"),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("sent"),
        v.literal("paid"),
        v.literal("overdue")
      )
    ),
    builderId: v.optional(v.id("builders")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];
    if (user.role !== "owner") return [];

    let invoices = await ctx.db
      .query("invoices")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    // Filter by status
    if (args.status) {
      invoices = invoices.filter((i) => i.status === args.status);
    }

    // Filter by builder
    if (args.builderId) {
      invoices = invoices.filter((i) => i.builderId === args.builderId);
    }

    // Check for overdue invoices
    const now = Date.now();
    invoices = invoices.map((inv) => ({
      ...inv,
      isOverdue: inv.status === "sent" && inv.dueDate < now,
    }));

    // Sort by created date descending
    invoices.sort((a, b) => b.createdAt - a.createdAt);

    // Limit results
    if (args.limit) {
      invoices = invoices.slice(0, args.limit);
    }

    // Enrich with job and builder details
    const enriched = await Promise.all(
      invoices.map(async (inv) => {
        const job = await ctx.db.get(inv.jobId);
        const builder = await ctx.db.get(inv.builderId);
        return {
          ...inv,
          job: job ? { _id: job._id, name: job.name, siteAddress: job.siteAddress } : null,
          builder: builder
            ? { _id: builder._id, companyName: builder.companyName }
            : null,
        };
      })
    );

    return enriched;
  },
});

// Get single invoice with details
export const get = query({
  args: {
    userId: v.id("users"),
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return null;
    if (invoice.organizationId !== user.organizationId) return null;

    const job = await ctx.db.get(invoice.jobId);
    const builder = await ctx.db.get(invoice.builderId);
    const org = await ctx.db.get(user.organizationId);

    // Get timesheets for this invoice
    const timesheets = await ctx.db
      .query("timesheets")
      .withIndex("by_job", (q) => q.eq("jobId", invoice.jobId))
      .filter((q) => q.eq(q.field("status"), "invoiced"))
      .collect();

    // Get worker details for timesheets
    const timesheetDetails = await Promise.all(
      timesheets.map(async (ts) => {
        const worker = await ctx.db.get(ts.workerId);
        return {
          ...ts,
          workerName: worker?.name || "Unknown",
          chargeOutRate: worker?.chargeOutRate || 0,
          lineTotal: ts.totalHours * (worker?.chargeOutRate || 0),
        };
      })
    );

    // Get builder contacts
    const contacts = builder
      ? await ctx.db
          .query("builderContacts")
          .withIndex("by_builder", (q) => q.eq("builderId", builder._id))
          .collect()
      : [];

    const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0];

    return {
      ...invoice,
      organization: org,
      job,
      builder,
      contact: primaryContact,
      timesheets: timesheetDetails,
    };
  },
});

// Update invoice status
export const updateStatus = mutation({
  args: {
    userId: v.id("users"),
    invoiceId: v.id("invoices"),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("overdue")
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role !== "owner") throw new Error("Only owners can update invoices");

    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.organizationId !== user.organizationId) {
      throw new Error("Unauthorized");
    }

    const updates: Record<string, unknown> = { status: args.status };

    if (args.status === "sent" && !invoice.sentAt) {
      updates.sentAt = Date.now();
    }

    if (args.status === "paid" && !invoice.paidAt) {
      updates.paidAt = Date.now();
    }

    await ctx.db.patch(args.invoiceId, updates);
    return { success: true };
  },
});

// Get invoice summary
export const getSummary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    const now = Date.now();

    const draft = invoices.filter((i) => i.status === "draft");
    const sent = invoices.filter((i) => i.status === "sent");
    const overdue = sent.filter((i) => i.dueDate < now);
    const paid = invoices.filter((i) => i.status === "paid");

    const totalOutstanding = sent.reduce((sum, i) => sum + i.amount, 0);
    const totalPaid = paid.reduce((sum, i) => sum + i.amount, 0);
    const totalOverdue = overdue.reduce((sum, i) => sum + i.amount, 0);

    return {
      draftCount: draft.length,
      sentCount: sent.length,
      overdueCount: overdue.length,
      paidCount: paid.length,
      totalOutstanding,
      totalPaid,
      totalOverdue,
    };
  },
});

// Delete draft invoice
export const remove = mutation({
  args: {
    userId: v.id("users"),
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role !== "owner") throw new Error("Only owners can delete invoices");

    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.organizationId !== user.organizationId) {
      throw new Error("Unauthorized");
    }
    if (invoice.status !== "draft") {
      throw new Error("Can only delete draft invoices");
    }

    // Revert timesheets to approved status
    const timesheets = await ctx.db
      .query("timesheets")
      .withIndex("by_job", (q) => q.eq("jobId", invoice.jobId))
      .filter((q) => q.eq(q.field("status"), "invoiced"))
      .collect();

    for (const ts of timesheets) {
      await ctx.db.patch(ts._id, { status: "approved" });
    }

    await ctx.db.delete(args.invoiceId);
    return { success: true };
  },
});

// Auto-create draft invoice for labour hire jobs on timesheet approval
export const autoCreateLabourHireInvoice = internalMutation({
  args: {
    batchId: v.id("timesheetBatches"),
  },
  handler: async (ctx, args) => {
    // Fetch the batch
    const batch = await ctx.db.get(args.batchId);
    if (!batch) return;
    if (batch.status !== "approved") return;

    // Check job is labour hire
    const job = await ctx.db.get(batch.jobId);
    if (!job) return;
    if (job.jobType !== "labourHire") return;

    // Check for existing invoice with same job + week (duplicate prevention)
    const existingInvoice = await ctx.db
      .query("invoices")
      .withIndex("by_job_week", (q) =>
        q.eq("jobId", batch.jobId).eq("weekStart", batch.weekStartDate)
      )
      .first();
    if (existingInvoice) return;

    const builder = await ctx.db.get(job.builderId);
    if (!builder) return;

    const org = await ctx.db.get(batch.organizationId);
    if (!org) return;

    // Get all approved timesheets for this job within the week
    const weekEnd = batch.weekStartDate + 7 * 24 * 60 * 60 * 1000;
    const timesheets = await ctx.db
      .query("timesheets")
      .withIndex("by_job", (q) => q.eq("jobId", batch.jobId))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "approved"),
          q.gte(q.field("date"), batch.weekStartDate),
          q.lt(q.field("date"), weekEnd)
        )
      )
      .collect();

    if (timesheets.length === 0) return;

    // Group timesheets by worker and calculate line items
    const workerHours = new Map<
      string,
      { workerId: Id<"workers">; workerName: string; hours: number; rate: number }
    >();

    for (const ts of timesheets) {
      const workerId = ts.workerId as string;

      if (!workerHours.has(workerId)) {
        const worker = await ctx.db.get(ts.workerId);
        if (!worker) continue;

        // Get allocation rate or fallback to worker default
        const allocation = await ctx.db
          .query("allocations")
          .withIndex("by_job", (q) => q.eq("jobId", batch.jobId))
          .filter((q) => q.eq(q.field("workerId"), ts.workerId))
          .first();

        const rate = allocation?.chargeOutRate || worker.chargeOutRate || 0;

        workerHours.set(workerId, {
          workerId: ts.workerId,
          workerName: worker.name,
          hours: 0,
          rate,
        });
      }

      const entry = workerHours.get(workerId)!;
      entry.hours += ts.totalHours;
    }

    // Build line items
    const lineItems = Array.from(workerHours.values()).map((entry) => ({
      workerId: entry.workerId,
      workerName: entry.workerName,
      hours: Math.round(entry.hours * 100) / 100,
      rate: entry.rate,
      total: Math.round(entry.hours * entry.rate * 100) / 100,
    }));

    // Calculate total amount
    const amount = lineItems.reduce((sum, item) => sum + item.total, 0);

    // Skip if zero amount
    if (amount <= 0) return;

    // Get existing invoice count for number generation
    const existingInvoices = await ctx.db
      .query("invoices")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", batch.organizationId)
      )
      .collect();

    const invoiceNumber = generateInvoiceNumber(org.name, existingInvoices.length);

    // Calculate due date from builder payment terms
    const dueDate = Date.now() + builder.paymentTerms * 24 * 60 * 60 * 1000;

    // Friday of the week
    const weekEndFriday = batch.weekStartDate + 4 * 24 * 60 * 60 * 1000;

    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: batch.organizationId,
      jobId: batch.jobId,
      builderId: job.builderId,
      invoiceNumber,
      amount,
      weekStart: batch.weekStartDate,
      weekEnd: weekEndFriday,
      lineItems,
      status: "draft",
      dueDate,
      createdAt: Date.now(),
    });

    // Mark timesheets as invoiced
    for (const ts of timesheets) {
      await ctx.db.patch(ts._id, { status: "invoiced" });
    }

    // If Xero is connected, schedule export
    if (org.settings?.xero?.tenantId) {
      // Find an owner user for this org to use as the userId for Xero export
      const ownerUser = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", batch.organizationId)
        )
        .filter((q) => q.eq(q.field("role"), "owner"))
        .first();

      if (ownerUser) {
        await ctx.scheduler.runAfter(0, internal.xero.exportInvoiceInternal, {
          invoiceId,
          organizationId: batch.organizationId,
          userId: ownerUser._id,
        });
      }
    }
  },
});
