import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

// Query span table with filters
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
    let results = await ctx.db.query("spanTables").collect();

    // Filter by member type
    if (args.memberType) {
      const memberType = args.memberType;
      results = results.filter(r => r.memberType === memberType);
    }

    // Filter by timber type
    if (args.timberType) {
      const timberType = args.timberType;
      results = results.filter(r => r.timberType === timberType);
    }

    // Filter by species (for hardwood)
    if (args.species) {
      const species = args.species;
      results = results.filter(r => r.species === species);
    }

    // Filter by size
    if (args.size) {
      const size = args.size;
      results = results.filter(r => r.size === size);
    }

    // Filter by minimum span (find sizes that CAN span this distance)
    if (args.minSpan) {
      const minSpan = args.minSpan;
      results = results.filter(r => r.maxSpan >= minSpan);
    }

    // Filter by spacing (with some tolerance)
    if (args.spacing) {
      const spacing = args.spacing;
      results = results.filter(r => r.spacing === spacing);
    }

    // Filter by load type
    if (args.loadType) {
      const loadType = args.loadType;
      results = results.filter(r => r.loadType === loadType);
    }

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
export const getTimberGrade = internalQuery({
  args: {
    grade: v.optional(v.string()),
    species: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let results = await ctx.db.query("timberGrades").collect();

    if (args.grade) {
      const grade = args.grade;
      results = results.filter(r => r.grade === grade);
    }

    if (args.species) {
      const species = args.species;
      results = results.filter(r => r.species === species);
    }

    return results;
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
