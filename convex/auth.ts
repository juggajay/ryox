import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Simple password hashing (in production, use bcrypt via an action)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// Sign up - Create organization and owner
export const signUp = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    organizationName: v.string(),
    abn: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if email already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (existingUser) {
      throw new Error("Email already registered");
    }

    // Create organization
    const organizationId = await ctx.db.insert("organizations", {
      name: args.organizationName,
      abn: args.abn,
      createdAt: Date.now(),
    });

    // Hash password
    const passwordHash = await hashPassword(args.password);

    // Create user as owner
    const userId = await ctx.db.insert("users", {
      email: args.email.toLowerCase(),
      name: args.name,
      passwordHash,
      role: "owner",
      organizationId,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    });

    // Create company chat channel
    await ctx.db.insert("chatChannels", {
      organizationId,
      type: "company",
      name: "General",
      participants: [userId],
      createdAt: Date.now(),
    });

    return { userId, organizationId };
  },
});

// Sign in
export const signIn = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (!user || !user.passwordHash) {
      throw new Error("Invalid email or password");
    }

    const isValid = await verifyPassword(args.password, user.passwordHash);
    if (!isValid) {
      throw new Error("Invalid email or password");
    }

    // Update last login
    await ctx.db.patch(user._id, {
      lastLoginAt: Date.now(),
    });

    return {
      userId: user._id,
      organizationId: user.organizationId,
      role: user.role,
      name: user.name,
      email: user.email,
    };
  },
});

// Get current user by ID
export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Don't return password hash
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  },
});

// Get user with organization
export const getUserWithOrganization = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const organization = await ctx.db.get(user.organizationId);

    const { passwordHash, ...safeUser } = user;
    return {
      user: safeUser,
      organization,
    };
  },
});

// Invite additional owner
export const inviteOwner = mutation({
  args: {
    inviterId: v.id("users"),
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify inviter is an owner
    const inviter = await ctx.db.get(args.inviterId);
    if (!inviter || inviter.role !== "owner") {
      throw new Error("Only owners can invite other owners");
    }

    // Check if email already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (existingUser) {
      throw new Error("Email already registered");
    }

    // Create user as owner (without password - they'll set it via invite)
    const userId = await ctx.db.insert("users", {
      email: args.email.toLowerCase(),
      name: args.name,
      role: "owner",
      organizationId: inviter.organizationId,
      createdAt: Date.now(),
    });

    // Add to company chat
    const companyChannel = await ctx.db
      .query("chatChannels")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", inviter.organizationId)
      )
      .filter((q) => q.eq(q.field("type"), "company"))
      .first();

    if (companyChannel) {
      await ctx.db.patch(companyChannel._id, {
        participants: [...companyChannel.participants, userId],
      });
    }

    return userId;
  },
});

// Set password for invited user
export const setPassword = mutation({
  args: {
    userId: v.id("users"),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const passwordHash = await hashPassword(args.password);
    await ctx.db.patch(args.userId, {
      passwordHash,
      lastLoginAt: Date.now(),
    });

    return { success: true };
  },
});
