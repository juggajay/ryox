import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List all builders for organization
export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    const builders = await ctx.db
      .query("builders")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    // Get contacts and job stats for each builder
    const buildersWithDetails = await Promise.all(
      builders.map(async (builder) => {
        const contacts = await ctx.db
          .query("builderContacts")
          .withIndex("by_builder", (q) => q.eq("builderId", builder._id))
          .collect();

        const jobs = await ctx.db
          .query("jobs")
          .withIndex("by_builder", (q) => q.eq("builderId", builder._id))
          .collect();

        const activeJobs = jobs.filter(
          (j) => j.status === "active" || j.status === "pending"
        ).length;
        const completedJobs = jobs.filter(
          (j) => j.status === "completed" || j.status === "invoiced"
        ).length;

        return {
          ...builder,
          contacts,
          stats: { activeJobs, completedJobs, totalJobs: jobs.length },
        };
      })
    );

    return buildersWithDetails;
  },
});

// Get single builder with full details
export const get = query({
  args: { userId: v.id("users"), builderId: v.id("builders") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const builder = await ctx.db.get(args.builderId);
    if (!builder || builder.organizationId !== user.organizationId) {
      return null;
    }

    const contacts = await ctx.db
      .query("builderContacts")
      .withIndex("by_builder", (q) => q.eq("builderId", builder._id))
      .collect();

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_builder", (q) => q.eq("builderId", builder._id))
      .collect();

    return { ...builder, contacts, jobs };
  },
});

// Create builder
export const create = mutation({
  args: {
    userId: v.id("users"),
    companyName: v.string(),
    abn: v.string(),
    paymentTerms: v.number(),
    notes: v.optional(v.string()),
    // Primary contact (optional, can be added later)
    primaryContact: v.optional(
      v.object({
        name: v.string(),
        phone: v.string(),
        email: v.string(),
        role: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can create builders");
    }

    const builderId = await ctx.db.insert("builders", {
      organizationId: user.organizationId,
      companyName: args.companyName,
      abn: args.abn,
      paymentTerms: args.paymentTerms,
      notes: args.notes,
      status: "active",
      createdAt: Date.now(),
    });

    // Add primary contact if provided
    if (args.primaryContact) {
      await ctx.db.insert("builderContacts", {
        builderId,
        name: args.primaryContact.name,
        phone: args.primaryContact.phone,
        email: args.primaryContact.email.toLowerCase(),
        role: args.primaryContact.role,
        isPrimary: true,
        createdAt: Date.now(),
      });
    }

    return builderId;
  },
});

// Update builder
export const update = mutation({
  args: {
    userId: v.id("users"),
    builderId: v.id("builders"),
    companyName: v.optional(v.string()),
    abn: v.optional(v.string()),
    paymentTerms: v.optional(v.number()),
    notes: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    negotiatedRates: v.optional(
      v.object({
        defaultChargeOutRate: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can update builders");
    }

    const builder = await ctx.db.get(args.builderId);
    if (!builder || builder.organizationId !== user.organizationId) {
      throw new Error("Builder not found");
    }

    const { userId, builderId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(args.builderId, filteredUpdates);
    return { success: true };
  },
});

// Add contact to builder
export const addContact = mutation({
  args: {
    userId: v.id("users"),
    builderId: v.id("builders"),
    name: v.string(),
    phone: v.string(),
    email: v.string(),
    role: v.string(),
    isPrimary: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can add contacts");
    }

    const builder = await ctx.db.get(args.builderId);
    if (!builder || builder.organizationId !== user.organizationId) {
      throw new Error("Builder not found");
    }

    // If this is primary, unset other primary contacts
    if (args.isPrimary) {
      const existingContacts = await ctx.db
        .query("builderContacts")
        .withIndex("by_builder", (q) => q.eq("builderId", args.builderId))
        .collect();

      for (const contact of existingContacts) {
        if (contact.isPrimary) {
          await ctx.db.patch(contact._id, { isPrimary: false });
        }
      }
    }

    const contactId = await ctx.db.insert("builderContacts", {
      builderId: args.builderId,
      name: args.name,
      phone: args.phone,
      email: args.email.toLowerCase(),
      role: args.role,
      isPrimary: args.isPrimary,
      createdAt: Date.now(),
    });

    return contactId;
  },
});

// Update contact
export const updateContact = mutation({
  args: {
    userId: v.id("users"),
    contactId: v.id("builderContacts"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.optional(v.string()),
    isPrimary: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can update contacts");
    }

    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    const builder = await ctx.db.get(contact.builderId);
    if (!builder || builder.organizationId !== user.organizationId) {
      throw new Error("Not authorized");
    }

    const { userId, contactId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (filteredUpdates.email) {
      filteredUpdates.email = (filteredUpdates.email as string).toLowerCase();
    }

    // If setting as primary, unset other primary contacts
    if (filteredUpdates.isPrimary) {
      const existingContacts = await ctx.db
        .query("builderContacts")
        .withIndex("by_builder", (q) => q.eq("builderId", contact.builderId))
        .collect();

      for (const c of existingContacts) {
        if (c.isPrimary && c._id !== args.contactId) {
          await ctx.db.patch(c._id, { isPrimary: false });
        }
      }
    }

    await ctx.db.patch(args.contactId, filteredUpdates);
    return { success: true };
  },
});

// Delete contact
export const deleteContact = mutation({
  args: {
    userId: v.id("users"),
    contactId: v.id("builderContacts"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can delete contacts");
    }

    const contact = await ctx.db.get(args.contactId);
    if (!contact) {
      throw new Error("Contact not found");
    }

    const builder = await ctx.db.get(contact.builderId);
    if (!builder || builder.organizationId !== user.organizationId) {
      throw new Error("Not authorized");
    }

    await ctx.db.delete(args.contactId);
    return { success: true };
  },
});
