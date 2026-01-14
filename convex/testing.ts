import { mutation } from "./_generated/server";
import { v } from "convex/values";

// WARNING: These functions are for testing only. Do not use in production.
// They bypass normal auth checks.

export const seedTestOrganization = mutation({
  args: {
    orgName: v.string(),
    ownerEmail: v.string(),
    ownerName: v.string(),
    ownerPassword: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if org already exists
    const existingOrg = await ctx.db
      .query("organizations")
      .filter((q) => q.eq(q.field("name"), args.orgName))
      .first();

    if (existingOrg) {
      // Return existing data
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) => q.eq("organizationId", existingOrg._id))
        .filter((q) => q.eq(q.field("email"), args.ownerEmail.toLowerCase()))
        .first();
      return {
        organizationId: existingOrg._id,
        userId: existingUser?._id,
      };
    }

    // Create organization
    const organizationId = await ctx.db.insert("organizations", {
      name: args.orgName,
      abn: "12345678901",
      createdAt: Date.now(),
    });

    // Hash password (same as auth.ts)
    const encoder = new TextEncoder();
    const data = encoder.encode(args.ownerPassword);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Create owner user
    const userId = await ctx.db.insert("users", {
      email: args.ownerEmail.toLowerCase(),
      name: args.ownerName,
      role: "owner",
      organizationId,
      passwordHash,
      createdAt: Date.now(),
    });

    // Create company chat channel
    await ctx.db.insert("chatChannels", {
      organizationId,
      type: "company",
      name: "General",
      participants: [userId],
      createdAt: Date.now(),
    });

    return { organizationId, userId };
  },
});

export const seedTestBuilder = mutation({
  args: {
    organizationId: v.id("organizations"),
    companyName: v.string(),
    contactName: v.string(),
    contactEmail: v.string(),
    contactPhone: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if builder exists
    const existingBuilder = await ctx.db
      .query("builders")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("companyName"), args.companyName))
      .first();

    if (existingBuilder) {
      return { builderId: existingBuilder._id };
    }

    const builderId = await ctx.db.insert("builders", {
      organizationId: args.organizationId,
      companyName: args.companyName,
      abn: "98765432109",
      paymentTerms: 30,
      status: "active",
      createdAt: Date.now(),
    });

    await ctx.db.insert("builderContacts", {
      builderId,
      name: args.contactName,
      email: args.contactEmail,
      phone: args.contactPhone,
      role: "Project Manager",
      isPrimary: true,
      createdAt: Date.now(),
    });

    return { builderId };
  },
});

export const seedTestWorker = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    password: v.string(),
    payRate: v.number(),
    chargeOutRate: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if worker exists
    const existingWorker = await ctx.db
      .query("workers")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("email"), args.email.toLowerCase()))
      .first();

    if (existingWorker) {
      const existingUser = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("workerId"), existingWorker._id))
        .first();
      return { workerId: existingWorker._id, userId: existingUser?._id };
    }

    // Hash password
    const encoder = new TextEncoder();
    const data = encoder.encode(args.password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // Create user account first (to get userId for worker)
    const userId = await ctx.db.insert("users", {
      email: args.email.toLowerCase(),
      name: args.name,
      role: "worker",
      organizationId: args.organizationId,
      passwordHash,
      createdAt: Date.now(),
    });

    // Create worker profile
    const workerId = await ctx.db.insert("workers", {
      organizationId: args.organizationId,
      userId,
      name: args.name,
      phone: args.phone,
      email: args.email.toLowerCase(),
      emergencyContact: {
        name: "Emergency Contact",
        phone: "0400000000",
        relationship: "Spouse",
      },
      employmentType: "employee",
      tradeClassification: "qualified",
      payRate: args.payRate,
      chargeOutRate: args.chargeOutRate,
      startDate: Date.now(),
      status: "active",
      createdAt: Date.now(),
    });

    // Update user with workerId
    await ctx.db.patch(userId, { workerId });

    // Add to company chat
    const companyChannel = await ctx.db
      .query("chatChannels")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("type"), "company"))
      .first();

    if (companyChannel) {
      await ctx.db.patch(companyChannel._id, {
        participants: [...companyChannel.participants, userId],
      });
    }

    return { workerId, userId };
  },
});

export const seedTestJob = mutation({
  args: {
    organizationId: v.id("organizations"),
    builderId: v.id("builders"),
    name: v.string(),
    siteAddress: v.string(),
    jobType: v.union(v.literal("contract"), v.literal("labourHire")),
    quotedPrice: v.optional(v.number()),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("onHold"),
      v.literal("completed"),
      v.literal("invoiced")
    )),
  },
  handler: async (ctx, args) => {
    // Check if job exists
    const existingJob = await ctx.db
      .query("jobs")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existingJob) {
      return { jobId: existingJob._id };
    }

    const jobId = await ctx.db.insert("jobs", {
      organizationId: args.organizationId,
      builderId: args.builderId,
      name: args.name,
      siteAddress: args.siteAddress,
      jobType: args.jobType,
      quotedPrice: args.quotedPrice,
      status: args.status ?? "active",
      startDate: Date.now(),
      createdAt: Date.now(),
    });

    // Create job chat channel
    await ctx.db.insert("chatChannels", {
      organizationId: args.organizationId,
      type: "job",
      name: args.name,
      jobId,
      participants: [],
      createdAt: Date.now(),
    });

    return { jobId };
  },
});

export const cleanupTestData = mutation({
  args: {
    orgName: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .filter((q) => q.eq(q.field("name"), args.orgName))
      .first();

    if (!org) return { deleted: false };

    // Delete all related data in order (respecting foreign keys)
    const users = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    const workers = await ctx.db
      .query("workers")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    const builders = await ctx.db
      .query("builders")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    const channels = await ctx.db
      .query("chatChannels")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    const invites = await ctx.db
      .query("workerInvites")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .collect();

    // Delete messages in channels
    for (const channel of channels) {
      const messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
        .collect();
      for (const msg of messages) {
        await ctx.db.delete(msg._id);
      }
      await ctx.db.delete(channel._id);
    }

    // Delete certifications
    for (const worker of workers) {
      const certs = await ctx.db
        .query("certifications")
        .withIndex("by_worker", (q) => q.eq("workerId", worker._id))
        .collect();
      for (const cert of certs) {
        await ctx.db.delete(cert._id);
      }
    }

    // Delete builder contacts
    for (const builder of builders) {
      const contacts = await ctx.db
        .query("builderContacts")
        .withIndex("by_builder", (q) => q.eq("builderId", builder._id))
        .collect();
      for (const contact of contacts) {
        await ctx.db.delete(contact._id);
      }
    }

    // Delete allocations and timesheets for jobs
    for (const job of jobs) {
      const allocations = await ctx.db
        .query("allocations")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();
      for (const alloc of allocations) {
        await ctx.db.delete(alloc._id);
      }

      const timesheets = await ctx.db
        .query("timesheets")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();
      for (const ts of timesheets) {
        await ctx.db.delete(ts._id);
      }

      const expenses = await ctx.db
        .query("expenses")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();
      for (const exp of expenses) {
        await ctx.db.delete(exp._id);
      }

      await ctx.db.delete(job._id);
    }

    // Delete invites
    for (const invite of invites) {
      await ctx.db.delete(invite._id);
    }

    // Delete workers, builders, users
    for (const worker of workers) {
      await ctx.db.delete(worker._id);
    }
    for (const builder of builders) {
      await ctx.db.delete(builder._id);
    }
    for (const user of users) {
      await ctx.db.delete(user._id);
    }

    // Delete organization
    await ctx.db.delete(org._id);

    return { deleted: true };
  },
});
