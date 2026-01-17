import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

// Query span table with filters
// OPTIMIZED: Use Convex query filters instead of collect + in-memory filtering
export const querySpanTable = internalQuery({
  args: {
    memberType: v.optional(v.string()),
    timberType: v.optional(v.string()),
    species: v.optional(v.string()),
    size: v.optional(v.string()),
    minSpan: v.optional(v.number()),
    spacing: v.optional(v.number()),
    loadType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // OPTIMIZATION: Use index-based query for the most selective filter
    // then apply server-side .filter() for remaining conditions
    // This avoids loading entire collection into memory

    // Build and execute query based on which index to use
    const buildQuery = () => {
      const baseQuery = ctx.db.query("spanTables");

      // Use index if memberType is specified (most common query pattern)
      if (args.memberType) {
        return baseQuery.withIndex("by_member_type", (q) =>
          q.eq("memberType", args.memberType as any)
        );
      } else if (args.timberType) {
        // Fallback to timber type index
        return baseQuery.withIndex("by_timber_type", (q) =>
          q.eq("timberType", args.timberType as any)
        );
      } else if (args.loadType) {
        // Fallback to load type index
        return baseQuery.withIndex("by_load_type", (q) =>
          q.eq("loadType", args.loadType as any)
        );
      }
      return baseQuery;
    };

    // Apply remaining filters server-side (not in-memory)
    const results = await buildQuery()
      .filter((q) => {
        const conditions = [];

        // Add filters for args not used in withIndex
        if (args.timberType && !args.memberType) {
          // timberType was used in index, skip
        } else if (args.timberType) {
          conditions.push(q.eq(q.field("timberType"), args.timberType));
        }
        if (args.species) {
          conditions.push(q.eq(q.field("species"), args.species));
        }
        if (args.size) {
          conditions.push(q.eq(q.field("size"), args.size));
        }
        if (args.minSpan !== undefined) {
          conditions.push(q.gte(q.field("maxSpan"), args.minSpan));
        }
        if (args.spacing !== undefined) {
          conditions.push(q.eq(q.field("spacing"), args.spacing));
        }
        if (args.loadType) {
          conditions.push(q.eq(q.field("loadType"), args.loadType));
        }

        // Combine all conditions with AND
        if (conditions.length === 0) return true;
        if (conditions.length === 1) return conditions[0];
        return conditions.reduce((acc, cond) => q.and(acc, cond));
      })
      .collect();

    // Sort by maxSpan ascending (smallest suitable size first)
    results.sort((a, b) => a.maxSpan - b.maxSpan);

    return results;
  },
});

// Insert a span table entry
export const insertSpanEntry = internalMutation({
  args: {
    memberType: v.string(),
    timberType: v.string(),
    species: v.optional(v.string()),
    stressGrade: v.optional(v.string()),
    size: v.string(),
    width: v.number(),
    depth: v.number(),
    loadType: v.string(),
    spacing: v.number(),
    maxSpan: v.number(),
    continuous: v.boolean(),
    loadWidth: v.optional(v.number()),
    roofLoad: v.optional(v.string()),
    source: v.string(),
    sourcePage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if entry already exists (include species for hardwood uniqueness)
    const existing = await ctx.db
      .query("spanTables")
      .filter(q =>
        q.and(
          q.eq(q.field("memberType"), args.memberType),
          q.eq(q.field("timberType"), args.timberType),
          q.eq(q.field("size"), args.size),
          q.eq(q.field("loadType"), args.loadType),
          q.eq(q.field("spacing"), args.spacing),
          q.eq(q.field("species"), args.species)
        )
      )
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, args as any);
      return existing._id;
    }

    return await ctx.db.insert("spanTables", args as any);
  },
});

// Insert timber grade entry
export const insertTimberGrade = internalMutation({
  args: {
    grade: v.string(),
    species: v.optional(v.string()),
    stressGrade: v.string(),
    bendingStrength: v.optional(v.number()),
    durabilityClass: v.optional(v.number()),
    commonUses: v.array(v.string()),
    treatmentRequired: v.string(),
    inGroundOk: v.boolean(),
    density: v.optional(v.number()),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if entry already exists
    const existing = await ctx.db
      .query("timberGrades")
      .filter(q => q.eq(q.field("grade"), args.grade))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }

    return await ctx.db.insert("timberGrades", args);
  },
});

// Get timber grade info
// OPTIMIZED: Use indexes instead of collect + filter
export const getTimberGrade = internalQuery({
  args: {
    grade: v.optional(v.string()),
    species: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Use index-based lookup for better performance
    const baseQuery = ctx.db.query("timberGrades");

    // Apply remaining filter if both grade and species specified
    if (args.grade && args.species) {
      return await baseQuery
        .withIndex("by_grade", (q) => q.eq("grade", args.grade!))
        .filter((q) => q.eq(q.field("species"), args.species!))
        .collect();
    }

    if (args.grade) {
      return await baseQuery.withIndex("by_grade", (q) => q.eq("grade", args.grade!)).collect();
    }

    if (args.species) {
      return await baseQuery.withIndex("by_species", (q) => q.eq("species", args.species!)).collect();
    }

    return await baseQuery.collect();
  },
});

// Public query for span tables (for testing/debugging)
export const listSpanTables = query({
  args: {},
  handler: async (ctx) => {
    const results = await ctx.db.query("spanTables").collect();
    return {
      total: results.length,
      byMemberType: {
        bearer: results.filter(r => r.memberType === "bearer").length,
        joist: results.filter(r => r.memberType === "joist").length,
        rafter: results.filter(r => r.memberType === "rafter").length,
      },
      byTimberType: {
        LVL: results.filter(r => r.timberType === "LVL").length,
        MGP10: results.filter(r => r.timberType === "MGP10").length,
        MGP12: results.filter(r => r.timberType === "MGP12").length,
        hardwood: results.filter(r => r.timberType === "hardwood").length,
      },
    };
  },
});

// Clear all span data (for reseeding)
export const clearSpanData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const spans = await ctx.db.query("spanTables").collect();
    for (const span of spans) {
      await ctx.db.delete(span._id);
    }

    const grades = await ctx.db.query("timberGrades").collect();
    for (const grade of grades) {
      await ctx.db.delete(grade._id);
    }

    return { deletedSpans: spans.length, deletedGrades: grades.length };
  },
});
