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

// Add another owner to the organization
export const addOwner = mutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify caller is an owner
    const caller = await ctx.db.get(args.userId);
    if (!caller || caller.role !== "owner") {
      throw new Error("Only owners can add other owners");
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
    const passwordHash = await hashPassword(args.password);

    // Create user as owner
    const newUserId = await ctx.db.insert("users", {
      email: args.email.toLowerCase(),
      name: args.name,
      passwordHash,
      role: "owner",
      organizationId: caller.organizationId,
      createdAt: Date.now(),
    });

    // Add to company chat
    const companyChannel = await ctx.db
      .query("chatChannels")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", caller.organizationId)
      )
      .filter((q) => q.eq(q.field("type"), "company"))
      .first();

    if (companyChannel) {
      await ctx.db.patch(companyChannel._id, {
        participants: [...companyChannel.participants, newUserId],
      });
    }

    return newUserId;
  },
});

// List all owners in organization
export const listOwners = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    const owners = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) => q.eq("organizationId", user.organizationId))
      .filter((q) => q.eq(q.field("role"), "owner"))
      .collect();

    return owners.map((o) => ({
      _id: o._id,
      name: o.name,
      email: o.email,
      createdAt: o.createdAt,
      lastLoginAt: o.lastLoginAt,
    }));
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

// Update user profile
export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if email is being changed and if it's already taken
    if (args.email.toLowerCase() !== user.email) {
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
        .first();

      if (existingUser) {
        throw new Error("Email already in use");
      }
    }

    await ctx.db.patch(args.userId, {
      name: args.name,
      email: args.email.toLowerCase(),
    });

    return { success: true };
  },
});

// Update organization
export const updateOrganization = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    abn: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can update organization");
    }

    await ctx.db.patch(user.organizationId, {
      name: args.name,
      abn: args.abn,
    });

    return { success: true };
  },
});

// Change password
export const changePassword = mutation({
  args: {
    userId: v.id("users"),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.passwordHash) {
      throw new Error("User not found");
    }

    // Verify current password
    const isValid = await verifyPassword(args.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new Error("Current password is incorrect");
    }

    // Hash and save new password
    const passwordHash = await hashPassword(args.newPassword);
    await ctx.db.patch(args.userId, {
      passwordHash,
    });

    return { success: true };
  },
});
