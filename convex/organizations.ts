import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get organization details
export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const organization = await ctx.db.get(user.organizationId);
    return organization;
  },
});

// Update organization settings
export const update = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    abn: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    settings: v.optional(
      v.object({
        defaultPaymentTerms: v.optional(v.number()),
        timezone: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role !== "owner") throw new Error("Only owners can update organization");

    const { userId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(user.organizationId, filteredUpdates);
    return { success: true };
  },
});
