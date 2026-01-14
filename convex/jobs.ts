import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List all jobs for organization
export const list = query({
  args: {
    userId: v.id("users"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("onHold"),
        v.literal("completed"),
        v.literal("invoiced")
      )
    ),
    builderId: v.optional(v.id("builders")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    let jobsQuery = ctx.db
      .query("jobs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      );

    const jobs = await jobsQuery.collect();

    // Filter by status and builder if provided
    let filteredJobs = jobs;
    if (args.status) {
      filteredJobs = filteredJobs.filter((j) => j.status === args.status);
    }
    if (args.builderId) {
      filteredJobs = filteredJobs.filter((j) => j.builderId === args.builderId);
    }

    // Get related data for each job
    const jobsWithDetails = await Promise.all(
      filteredJobs.map(async (job) => {
        const builder = await ctx.db.get(job.builderId);

        const allocations = await ctx.db
          .query("allocations")
          .withIndex("by_job", (q) => q.eq("jobId", job._id))
          .collect();

        const workerIds = allocations.map((a) => a.workerId);
        const workers = await Promise.all(
          workerIds.map((id) => ctx.db.get(id))
        );

        const timesheets = await ctx.db
          .query("timesheets")
          .withIndex("by_job", (q) => q.eq("jobId", job._id))
          .collect();

        const expenses = await ctx.db
          .query("expenses")
          .withIndex("by_job", (q) => q.eq("jobId", job._id))
          .collect();

        // Calculate totals
        const totalHours = timesheets.reduce((sum, t) => sum + t.totalHours, 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

        // Calculate labour cost and revenue
        let labourCost = 0;
        let labourRevenue = 0;

        for (const ts of timesheets) {
          const worker = workers.find((w) => w?._id === ts.workerId);
          if (worker) {
            labourCost += ts.totalHours * worker.payRate;
            labourRevenue += ts.totalHours * worker.chargeOutRate;
          }
        }

        return {
          ...job,
          builder: builder
            ? { _id: builder._id, companyName: builder.companyName }
            : null,
          allocatedWorkers: workers.filter(Boolean).map((w) => ({
            _id: w!._id,
            name: w!.name,
          })),
          stats: {
            totalHours,
            totalExpenses,
            labourCost,
            labourRevenue,
            timesheetCount: timesheets.length,
            pendingTimesheets: timesheets.filter(
              (t) => t.status === "submitted"
            ).length,
          },
        };
      })
    );

    return jobsWithDetails;
  },
});

// Get single job with full details
export const get = query({
  args: { userId: v.id("users"), jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const job = await ctx.db.get(args.jobId);
    if (!job || job.organizationId !== user.organizationId) {
      return null;
    }

    const builder = await ctx.db.get(job.builderId);

    const allocations = await ctx.db
      .query("allocations")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    const workers = await Promise.all(
      allocations.map(async (a) => {
        const worker = await ctx.db.get(a.workerId);
        return worker ? { ...worker, allocation: a } : null;
      })
    );

    const timesheets = await ctx.db
      .query("timesheets")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    // Calculate profitability
    const totalHours = timesheets.reduce((sum, t) => sum + t.totalHours, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    let labourCost = 0;
    let labourRevenue = 0;

    for (const ts of timesheets) {
      const worker = workers.find((w) => w?._id === ts.workerId);
      if (worker) {
        labourCost += ts.totalHours * worker.payRate;
        labourRevenue += ts.totalHours * worker.chargeOutRate;
      }
    }

    const totalCost = labourCost + totalExpenses;
    const revenue =
      job.jobType === "contract" ? job.quotedPrice || 0 : labourRevenue;
    const grossProfit = revenue - totalCost;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

    return {
      ...job,
      builder,
      allocatedWorkers: workers.filter(Boolean),
      timesheets,
      expenses,
      financials: {
        totalHours,
        labourCost,
        labourRevenue,
        totalExpenses,
        totalCost,
        revenue,
        grossProfit,
        grossMargin,
      },
    };
  },
});

// Create job
export const create = mutation({
  args: {
    userId: v.id("users"),
    builderId: v.id("builders"),
    name: v.string(),
    siteAddress: v.string(),
    jobType: v.union(v.literal("contract"), v.literal("labourHire")),
    supervisorId: v.optional(v.id("builderContacts")),
    quotedPrice: v.optional(v.number()),
    estimatedHours: v.optional(v.number()),
    materialsBudget: v.optional(v.number()),
    startDate: v.number(),
    expectedEndDate: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can create jobs");
    }

    const builder = await ctx.db.get(args.builderId);
    if (!builder || builder.organizationId !== user.organizationId) {
      throw new Error("Builder not found");
    }

    const { userId, ...jobData } = args;

    const jobId = await ctx.db.insert("jobs", {
      ...jobData,
      organizationId: user.organizationId,
      status: "pending",
      createdAt: Date.now(),
    });

    // Create job chat channel
    await ctx.db.insert("chatChannels", {
      organizationId: user.organizationId,
      type: "job",
      name: args.name,
      jobId,
      participants: [args.userId],
      createdAt: Date.now(),
    });

    return jobId;
  },
});

// Update job
export const update = mutation({
  args: {
    userId: v.id("users"),
    jobId: v.id("jobs"),
    name: v.optional(v.string()),
    siteAddress: v.optional(v.string()),
    supervisorId: v.optional(v.id("builderContacts")),
    quotedPrice: v.optional(v.number()),
    estimatedHours: v.optional(v.number()),
    materialsBudget: v.optional(v.number()),
    startDate: v.optional(v.number()),
    expectedEndDate: v.optional(v.number()),
    actualEndDate: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("onHold"),
        v.literal("completed"),
        v.literal("invoiced")
      )
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can update jobs");
    }

    const job = await ctx.db.get(args.jobId);
    if (!job || job.organizationId !== user.organizationId) {
      throw new Error("Job not found");
    }

    const { userId, jobId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(args.jobId, filteredUpdates);
    return { success: true };
  },
});

// Allocate worker to job
export const allocateWorker = mutation({
  args: {
    userId: v.id("users"),
    jobId: v.id("jobs"),
    workerId: v.id("workers"),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    allocationType: v.union(v.literal("fullTime"), v.literal("partial")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can allocate workers");
    }

    const job = await ctx.db.get(args.jobId);
    if (!job || job.organizationId !== user.organizationId) {
      throw new Error("Job not found");
    }

    const worker = await ctx.db.get(args.workerId);
    if (!worker || worker.organizationId !== user.organizationId) {
      throw new Error("Worker not found");
    }

    // Check for existing allocation
    const existingAllocation = await ctx.db
      .query("allocations")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .filter((q) => q.eq(q.field("workerId"), args.workerId))
      .first();

    if (existingAllocation) {
      throw new Error("Worker is already allocated to this job");
    }

    const allocationId = await ctx.db.insert("allocations", {
      jobId: args.jobId,
      workerId: args.workerId,
      startDate: args.startDate,
      endDate: args.endDate,
      allocationType: args.allocationType,
      notes: args.notes,
      createdAt: Date.now(),
    });

    // Add worker to job chat channel
    if (worker.userId) {
      const jobChannel = await ctx.db
        .query("chatChannels")
        .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
        .first();

      if (jobChannel && !jobChannel.participants.includes(worker.userId)) {
        await ctx.db.patch(jobChannel._id, {
          participants: [...jobChannel.participants, worker.userId],
        });
      }
    }

    return allocationId;
  },
});

// Remove allocation
export const removeAllocation = mutation({
  args: {
    userId: v.id("users"),
    allocationId: v.id("allocations"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can remove allocations");
    }

    const allocation = await ctx.db.get(args.allocationId);
    if (!allocation) {
      throw new Error("Allocation not found");
    }

    const job = await ctx.db.get(allocation.jobId);
    if (!job || job.organizationId !== user.organizationId) {
      throw new Error("Not authorized");
    }

    await ctx.db.delete(args.allocationId);
    return { success: true };
  },
});

// Get jobs for worker (their assigned jobs)
export const getWorkerJobs = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.workerId) return [];

    const allocations = await ctx.db
      .query("allocations")
      .withIndex("by_worker", (q) => q.eq("workerId", user.workerId!))
      .collect();

    const jobs = await Promise.all(
      allocations.map(async (allocation) => {
        const job = await ctx.db.get(allocation.jobId);
        if (!job) return null;

        const builder = await ctx.db.get(job.builderId);

        return {
          ...job,
          allocation,
          builder: builder
            ? { _id: builder._id, companyName: builder.companyName }
            : null,
        };
      })
    );

    return jobs.filter(Boolean);
  },
});
