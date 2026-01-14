import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const frequencyMultipliers: Record<string, number> = {
  weekly: 1,
  fortnightly: 0.5,
  monthly: 12 / 52,
  quarterly: 4 / 52,
  annually: 1 / 52,
};

// Add overhead
export const add = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    category: v.union(
      v.literal("vehicles"),
      v.literal("insurance"),
      v.literal("communications"),
      v.literal("premises"),
      v.literal("equipment"),
      v.literal("admin"),
      v.literal("other")
    ),
    amount: v.number(),
    frequency: v.union(
      v.literal("weekly"),
      v.literal("fortnightly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("annually")
    ),
    effectiveFrom: v.number(),
    effectiveTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role !== "owner") throw new Error("Only owners can manage overheads");

    const overheadId = await ctx.db.insert("overheads", {
      organizationId: user.organizationId,
      name: args.name,
      category: args.category,
      amount: args.amount,
      frequency: args.frequency,
      effectiveFrom: args.effectiveFrom,
      effectiveTo: args.effectiveTo,
      createdAt: Date.now(),
    });

    return overheadId;
  },
});

// List overheads
export const list = query({
  args: {
    userId: v.id("users"),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];
    if (user.role !== "owner") return [];

    let overheads = await ctx.db
      .query("overheads")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    // Filter active only
    if (args.activeOnly) {
      const now = Date.now();
      overheads = overheads.filter(
        (o) => o.effectiveFrom <= now && (!o.effectiveTo || o.effectiveTo >= now)
      );
    }

    // Add weekly normalized amount
    const enriched = overheads.map((o) => ({
      ...o,
      weeklyAmount: o.amount * (frequencyMultipliers[o.frequency] || 1),
    }));

    return enriched;
  },
});

// Update overhead
export const update = mutation({
  args: {
    userId: v.id("users"),
    overheadId: v.id("overheads"),
    name: v.optional(v.string()),
    category: v.optional(
      v.union(
        v.literal("vehicles"),
        v.literal("insurance"),
        v.literal("communications"),
        v.literal("premises"),
        v.literal("equipment"),
        v.literal("admin"),
        v.literal("other")
      )
    ),
    amount: v.optional(v.number()),
    frequency: v.optional(
      v.union(
        v.literal("weekly"),
        v.literal("fortnightly"),
        v.literal("monthly"),
        v.literal("quarterly"),
        v.literal("annually")
      )
    ),
    effectiveFrom: v.optional(v.number()),
    effectiveTo: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role !== "owner") throw new Error("Only owners can manage overheads");

    const overhead = await ctx.db.get(args.overheadId);
    if (!overhead) throw new Error("Overhead not found");
    if (overhead.organizationId !== user.organizationId) {
      throw new Error("Unauthorized");
    }

    const { userId, overheadId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(args.overheadId, filteredUpdates);
    return { success: true };
  },
});

// Delete overhead
export const remove = mutation({
  args: {
    userId: v.id("users"),
    overheadId: v.id("overheads"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role !== "owner") throw new Error("Only owners can manage overheads");

    const overhead = await ctx.db.get(args.overheadId);
    if (!overhead) throw new Error("Overhead not found");
    if (overhead.organizationId !== user.organizationId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.overheadId);
    return { success: true };
  },
});

// Get overhead summary and per-hour rate
export const getSummary = query({
  args: {
    userId: v.id("users"),
    weeklyBillableHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const now = Date.now();
    const overheads = await ctx.db
      .query("overheads")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    // Filter active overheads
    const activeOverheads = overheads.filter(
      (o) => o.effectiveFrom <= now && (!o.effectiveTo || o.effectiveTo >= now)
    );

    // Calculate total weekly overhead
    let totalWeekly = 0;
    const byCategory: Record<string, number> = {};

    for (const o of activeOverheads) {
      const weeklyAmount = o.amount * (frequencyMultipliers[o.frequency] || 1);
      totalWeekly += weeklyAmount;
      byCategory[o.category] = (byCategory[o.category] || 0) + weeklyAmount;
    }

    // Default to 40 hours/week per worker, count workers
    const workers = await ctx.db
      .query("workers")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const weeklyBillableHours = args.weeklyBillableHours || workers.length * 40;
    const overheadPerHour = weeklyBillableHours > 0 ? totalWeekly / weeklyBillableHours : 0;

    return {
      totalWeekly: Math.round(totalWeekly * 100) / 100,
      totalMonthly: Math.round(totalWeekly * (52 / 12) * 100) / 100,
      totalAnnual: Math.round(totalWeekly * 52 * 100) / 100,
      byCategory,
      overheadPerHour: Math.round(overheadPerHour * 100) / 100,
      weeklyBillableHours,
      activeCount: activeOverheads.length,
      totalCount: overheads.length,
    };
  },
});
