import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List all workers for organization
export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    const workers = await ctx.db
      .query("workers")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    // Get certifications for each worker
    const workersWithCerts = await Promise.all(
      workers.map(async (worker) => {
        const certifications = await ctx.db
          .query("certifications")
          .withIndex("by_worker", (q) => q.eq("workerId", worker._id))
          .collect();

        return { ...worker, certifications };
      })
    );

    return workersWithCerts;
  },
});

// Get single worker
export const get = query({
  args: { userId: v.id("users"), workerId: v.id("workers") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const worker = await ctx.db.get(args.workerId);
    if (!worker || worker.organizationId !== user.organizationId) {
      return null;
    }

    const certifications = await ctx.db
      .query("certifications")
      .withIndex("by_worker", (q) => q.eq("workerId", worker._id))
      .collect();

    return { ...worker, certifications };
  },
});

// Create worker (by owner)
export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    phone: v.string(),
    email: v.string(),
    emergencyContact: v.object({
      name: v.string(),
      phone: v.string(),
      relationship: v.string(),
    }),
    employmentType: v.union(v.literal("employee"), v.literal("subcontractor")),
    tradeClassification: v.union(
      v.literal("apprentice"),
      v.literal("qualified"),
      v.literal("leadingHand"),
      v.literal("foreman")
    ),
    payRate: v.number(),
    chargeOutRate: v.number(),
    startDate: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can create workers");
    }

    const { userId, ...workerData } = args;

    const workerId = await ctx.db.insert("workers", {
      ...workerData,
      email: args.email.toLowerCase(),
      organizationId: user.organizationId,
      status: "active",
      createdAt: Date.now(),
    });

    return workerId;
  },
});

// Quick create worker (for temp/casual workers with minimal info)
export const createQuick = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    phone: v.string(),
    payRate: v.number(),
    chargeOutRate: v.number(),
    tradeClassification: v.optional(
      v.union(
        v.literal("apprentice"),
        v.literal("qualified"),
        v.literal("leadingHand"),
        v.literal("foreman")
      )
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can create workers");
    }

    const workerId = await ctx.db.insert("workers", {
      name: args.name,
      phone: args.phone,
      email: "", // Not required for temp workers
      emergencyContact: {
        name: "N/A",
        phone: "N/A",
        relationship: "N/A",
      },
      employmentType: "subcontractor",
      tradeClassification: args.tradeClassification || "qualified",
      payRate: args.payRate,
      chargeOutRate: args.chargeOutRate,
      startDate: Date.now(),
      organizationId: user.organizationId,
      status: "active",
      createdAt: Date.now(),
    });

    return workerId;
  },
});

// Update worker
export const update = mutation({
  args: {
    userId: v.id("users"),
    workerId: v.id("workers"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    emergencyContact: v.optional(
      v.object({
        name: v.string(),
        phone: v.string(),
        relationship: v.string(),
      })
    ),
    employmentType: v.optional(
      v.union(v.literal("employee"), v.literal("subcontractor"))
    ),
    tradeClassification: v.optional(
      v.union(
        v.literal("apprentice"),
        v.literal("qualified"),
        v.literal("leadingHand"),
        v.literal("foreman")
      )
    ),
    payRate: v.optional(v.number()),
    chargeOutRate: v.optional(v.number()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can update workers");
    }

    const worker = await ctx.db.get(args.workerId);
    if (!worker || worker.organizationId !== user.organizationId) {
      throw new Error("Worker not found");
    }

    const { userId, workerId, ...updates } = args;

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (filteredUpdates.email) {
      filteredUpdates.email = (filteredUpdates.email as string).toLowerCase();
    }

    await ctx.db.patch(args.workerId, filteredUpdates);
    return { success: true };
  },
});

// Add certification to worker
export const addCertification = mutation({
  args: {
    userId: v.id("users"),
    workerId: v.id("workers"),
    name: v.string(),
    expiryDate: v.number(),
    documentUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const worker = await ctx.db.get(args.workerId);
    if (!worker || worker.organizationId !== user.organizationId) {
      throw new Error("Worker not found");
    }

    // Workers can add their own certifications, owners can add for anyone
    if (user.role !== "owner" && user.workerId !== args.workerId) {
      throw new Error("Not authorized to add certification");
    }

    const certId = await ctx.db.insert("certifications", {
      workerId: args.workerId,
      name: args.name,
      expiryDate: args.expiryDate,
      documentUrl: args.documentUrl,
      createdAt: Date.now(),
    });

    return certId;
  },
});

// Delete certification
export const deleteCertification = mutation({
  args: {
    userId: v.id("users"),
    certificationId: v.id("certifications"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const cert = await ctx.db.get(args.certificationId);
    if (!cert) {
      throw new Error("Certification not found");
    }

    const worker = await ctx.db.get(cert.workerId);
    if (!worker || worker.organizationId !== user.organizationId) {
      throw new Error("Not authorized");
    }

    // Workers can delete their own certifications, owners can delete for anyone
    if (user.role !== "owner" && user.workerId !== cert.workerId) {
      throw new Error("Not authorized to delete certification");
    }

    await ctx.db.delete(args.certificationId);
    return { success: true };
  },
});

// Get workers with expiring certifications
export const getExpiringCertifications = query({
  args: { userId: v.id("users"), daysAhead: v.number() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") return [];

    const workers = await ctx.db
      .query("workers")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const cutoffDate = Date.now() + args.daysAhead * 24 * 60 * 60 * 1000;
    const results: Array<{
      worker: typeof workers[0];
      certification: {
        _id: string;
        name: string;
        expiryDate: number;
      };
      daysUntilExpiry: number;
    }> = [];

    for (const worker of workers) {
      const certifications = await ctx.db
        .query("certifications")
        .withIndex("by_worker", (q) => q.eq("workerId", worker._id))
        .collect();

      for (const cert of certifications) {
        if (cert.expiryDate <= cutoffDate) {
          const daysUntilExpiry = Math.ceil(
            (cert.expiryDate - Date.now()) / (24 * 60 * 60 * 1000)
          );
          results.push({
            worker,
            certification: {
              _id: cert._id,
              name: cert.name,
              expiryDate: cert.expiryDate,
            },
            daysUntilExpiry,
          });
        }
      }
    }

    return results.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  },
});
