import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate a unique invite token
function generateToken(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Create worker invite
export const createInvite = mutation({
  args: {
    createdBy: v.id("users"),
    email: v.optional(v.string()),
    payRate: v.number(),
    chargeOutRate: v.number(),
    employmentType: v.union(v.literal("employee"), v.literal("subcontractor")),
    tradeClassification: v.union(
      v.literal("apprentice"),
      v.literal("qualified"),
      v.literal("leadingHand"),
      v.literal("foreman")
    ),
  },
  handler: async (ctx, args) => {
    // Verify creator is an owner
    const creator = await ctx.db.get(args.createdBy);
    if (!creator || creator.role !== "owner") {
      throw new Error("Only owners can create worker invites");
    }

    const token = generateToken();
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

    const inviteId = await ctx.db.insert("workerInvites", {
      organizationId: creator.organizationId,
      token,
      email: args.email?.toLowerCase(),
      payRate: args.payRate,
      chargeOutRate: args.chargeOutRate,
      employmentType: args.employmentType,
      tradeClassification: args.tradeClassification,
      status: "pending",
      createdBy: args.createdBy,
      createdAt: now,
      expiresAt,
    });

    return { inviteId, token };
  },
});

// Get invite by token (for workers clicking the link)
export const getInviteByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("workerInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite) {
      return null;
    }

    // Check if expired
    if (invite.expiresAt < Date.now()) {
      return { ...invite, status: "expired" as const };
    }

    // Get organization name for display
    const organization = await ctx.db.get(invite.organizationId);

    return {
      ...invite,
      organizationName: organization?.name,
    };
  },
});

// Accept invite and create worker profile + user account
export const acceptInvite = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    password: v.string(),
    emergencyContact: v.object({
      name: v.string(),
      phone: v.string(),
      relationship: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    // Get and validate invite
    const invite = await ctx.db
      .query("workerInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite) {
      throw new Error("Invalid invite token");
    }

    if (invite.status !== "pending") {
      throw new Error("Invite has already been used or expired");
    }

    if (invite.expiresAt < Date.now()) {
      // Mark as expired
      await ctx.db.patch(invite._id, { status: "expired" });
      throw new Error("Invite has expired");
    }

    // Check if email already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (existingUser) {
      throw new Error("Email already registered");
    }

    // Hash password
    const encoder = new TextEncoder();
    const data = encoder.encode(args.password);
    const hash = await crypto.subtle.digest("SHA-256", data);
    const passwordHash = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const now = Date.now();

    // Create worker profile
    const workerId = await ctx.db.insert("workers", {
      organizationId: invite.organizationId,
      name: args.name,
      phone: args.phone,
      email: args.email.toLowerCase(),
      emergencyContact: args.emergencyContact,
      employmentType: invite.employmentType,
      tradeClassification: invite.tradeClassification,
      payRate: invite.payRate,
      chargeOutRate: invite.chargeOutRate,
      startDate: now,
      status: "active",
      createdAt: now,
    });

    // Create user account linked to worker
    const userId = await ctx.db.insert("users", {
      email: args.email.toLowerCase(),
      name: args.name,
      passwordHash,
      role: "worker",
      organizationId: invite.organizationId,
      workerId,
      createdAt: now,
      lastLoginAt: now,
    });

    // Link worker to user
    await ctx.db.patch(workerId, { userId });

    // Update invite status
    await ctx.db.patch(invite._id, {
      status: "accepted",
      acceptedAt: now,
      acceptedBy: userId,
    });

    // Add worker to company chat channel
    const companyChannel = await ctx.db
      .query("chatChannels")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", invite.organizationId)
      )
      .filter((q) => q.eq(q.field("type"), "company"))
      .first();

    if (companyChannel) {
      await ctx.db.patch(companyChannel._id, {
        participants: [...companyChannel.participants, userId],
      });
    }

    return { userId, workerId };
  },
});

// List invites for organization
export const listInvites = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") {
      return [];
    }

    const invites = await ctx.db
      .query("workerInvites")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .order("desc")
      .collect();

    // Check for expired invites and update status
    const now = Date.now();
    const updatedInvites = await Promise.all(
      invites.map(async (invite) => {
        if (invite.status === "pending" && invite.expiresAt < now) {
          return { ...invite, status: "expired" as const };
        }
        return invite;
      })
    );

    return updatedInvites;
  },
});

// Cancel/revoke invite
export const cancelInvite = mutation({
  args: {
    userId: v.id("users"),
    inviteId: v.id("workerInvites"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can cancel invites");
    }

    const invite = await ctx.db.get(args.inviteId);
    if (!invite || invite.organizationId !== user.organizationId) {
      throw new Error("Invite not found");
    }

    if (invite.status !== "pending") {
      throw new Error("Can only cancel pending invites");
    }

    await ctx.db.patch(args.inviteId, { status: "expired" });
    return { success: true };
  },
});
