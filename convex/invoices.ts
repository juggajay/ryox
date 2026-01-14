import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate invoice number
function generateInvoiceNumber(orgName: string, count: number): string {
  const prefix = orgName.substring(0, 3).toUpperCase();
  const year = new Date().getFullYear().toString().slice(-2);
  const num = (count + 1).toString().padStart(4, "0");
  return `${prefix}-${year}-${num}`;
}

// Create invoice from job
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

    if (timesheets.length === 0) {
      throw new Error("No approved timesheets to invoice");
    }

    // Calculate amount based on job type
    let amount = 0;

    if (job.jobType === "contract") {
      // For contract jobs, use quoted price
      amount = job.quotedPrice || 0;
    } else {
      // For labour hire, calculate from timesheets
      for (const ts of timesheets) {
        const worker = await ctx.db.get(ts.workerId);
        if (worker) {
          amount += ts.totalHours * worker.chargeOutRate;
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
