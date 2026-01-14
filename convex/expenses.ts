import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Add expense to a job
export const add = mutation({
  args: {
    userId: v.id("users"),
    jobId: v.id("jobs"),
    description: v.string(),
    amount: v.number(),
    category: v.union(
      v.literal("materials"),
      v.literal("equipment"),
      v.literal("transport"),
      v.literal("other")
    ),
    receiptUrl: v.optional(v.string()),
    date: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (job.organizationId !== user.organizationId) {
      throw new Error("Unauthorized");
    }

    const expenseId = await ctx.db.insert("expenses", {
      jobId: args.jobId,
      description: args.description,
      amount: args.amount,
      category: args.category,
      receiptUrl: args.receiptUrl,
      date: args.date,
      createdBy: args.userId,
      createdAt: Date.now(),
    });

    return expenseId;
  },
});

// List expenses for a job
export const listByJob = query({
  args: {
    userId: v.id("users"),
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    const job = await ctx.db.get(args.jobId);
    if (!job || job.organizationId !== user.organizationId) return [];

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    // Enrich with creator info
    const enriched = await Promise.all(
      expenses.map(async (exp) => {
        const creator = await ctx.db.get(exp.createdBy);
        return {
          ...exp,
          creatorName: creator?.name || "Unknown",
        };
      })
    );

    // Sort by date descending
    enriched.sort((a, b) => b.date - a.date);

    return enriched;
  },
});

// List all expenses for organization
export const list = query({
  args: {
    userId: v.id("users"),
    category: v.optional(
      v.union(
        v.literal("materials"),
        v.literal("equipment"),
        v.literal("transport"),
        v.literal("other")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];
    if (user.role !== "owner") return [];

    // Get all jobs for org
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    const jobIds = jobs.map((j) => j._id);

    // Get all expenses for these jobs
    let allExpenses: Array<{
      _id: any;
      jobId: any;
      description: string;
      amount: number;
      category: string;
      receiptUrl?: string;
      date: number;
      createdBy: any;
      createdAt: number;
      job?: { _id: any; name: string } | null;
      creatorName: string;
    }> = [];

    for (const jobId of jobIds) {
      const expenses = await ctx.db
        .query("expenses")
        .withIndex("by_job", (q) => q.eq("jobId", jobId))
        .collect();

      const job = jobs.find((j) => j._id === jobId);

      for (const exp of expenses) {
        const creator = await ctx.db.get(exp.createdBy);
        allExpenses.push({
          ...exp,
          job: job ? { _id: job._id, name: job.name } : null,
          creatorName: creator?.name || "Unknown",
        });
      }
    }

    // Filter by category
    if (args.category) {
      allExpenses = allExpenses.filter((e) => e.category === args.category);
    }

    // Sort by date descending
    allExpenses.sort((a, b) => b.date - a.date);

    // Limit results
    if (args.limit) {
      allExpenses = allExpenses.slice(0, args.limit);
    }

    return allExpenses;
  },
});

// Update expense
export const update = mutation({
  args: {
    userId: v.id("users"),
    expenseId: v.id("expenses"),
    description: v.optional(v.string()),
    amount: v.optional(v.number()),
    category: v.optional(
      v.union(
        v.literal("materials"),
        v.literal("equipment"),
        v.literal("transport"),
        v.literal("other")
      )
    ),
    date: v.optional(v.number()),
    receiptUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error("Expense not found");

    const job = await ctx.db.get(expense.jobId);
    if (!job || job.organizationId !== user.organizationId) {
      throw new Error("Unauthorized");
    }

    const { userId, expenseId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(args.expenseId, filteredUpdates);
    return { success: true };
  },
});

// Delete expense
export const remove = mutation({
  args: {
    userId: v.id("users"),
    expenseId: v.id("expenses"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error("Expense not found");

    const job = await ctx.db.get(expense.jobId);
    if (!job || job.organizationId !== user.organizationId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.expenseId);
    return { success: true };
  },
});

// Get expense summary for organization
export const getSummary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Get all jobs for org
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    const jobIds = jobs.map((j) => j._id);

    // Get all expenses
    let allExpenses: Array<{ amount: number; category: string; date: number }> = [];
    for (const jobId of jobIds) {
      const expenses = await ctx.db
        .query("expenses")
        .withIndex("by_job", (q) => q.eq("jobId", jobId))
        .collect();
      allExpenses.push(...expenses);
    }

    // Calculate totals by category
    const byCategory: Record<string, number> = {
      materials: 0,
      equipment: 0,
      transport: 0,
      other: 0,
    };

    let total = 0;
    for (const exp of allExpenses) {
      byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
      total += exp.amount;
    }

    // This month's total
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const thisMonthTotal = allExpenses
      .filter((e) => e.date >= startOfMonth)
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      total,
      thisMonth: thisMonthTotal,
      byCategory,
      count: allExpenses.length,
    };
  },
});

// Generate upload URL for receipt
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
