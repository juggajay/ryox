import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List all channels for a user
export const listChannels = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    // Get all channels where user is a participant
    const allChannels = await ctx.db
      .query("chatChannels")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    // Filter channels where user is participant
    const userChannels = allChannels.filter((ch) =>
      ch.participants.includes(args.userId)
    );

    // Enrich with additional data
    const enrichedChannels = await Promise.all(
      userChannels.map(async (channel) => {
        // Get last message
        const messages = await ctx.db
          .query("chatMessages")
          .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
          .collect();

        const lastMessage = messages[messages.length - 1];

        // Count unread messages
        const unreadCount = messages.filter(
          (m) => !m.readBy.includes(args.userId) && m.senderId !== args.userId
        ).length;

        // Get job name if it's a job channel
        let jobName: string | undefined;
        if (channel.type === "job" && channel.jobId) {
          const job = await ctx.db.get(channel.jobId);
          jobName = job?.name;
        }

        // Get participants names for DM display
        let participantNames: string[] = [];
        if (channel.type === "dm") {
          const participants = await Promise.all(
            channel.participants
              .filter((p) => p !== args.userId)
              .map((p) => ctx.db.get(p))
          );
          participantNames = participants.filter(Boolean).map((p) => p!.name);
        }

        return {
          ...channel,
          jobName,
          participantNames,
          lastMessage: lastMessage
            ? {
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
                senderName:
                  (await ctx.db.get(lastMessage.senderId))?.name || "Unknown",
              }
            : null,
          unreadCount,
        };
      })
    );

    // Sort by last message time
    enrichedChannels.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt || a.createdAt;
      const bTime = b.lastMessage?.createdAt || b.createdAt;
      return bTime - aTime;
    });

    return enrichedChannels;
  },
});

// Get messages for a channel
export const getMessages = query({
  args: {
    userId: v.id("users"),
    channelId: v.id("chatChannels"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    const channel = await ctx.db.get(args.channelId);
    if (!channel) return [];
    if (!channel.participants.includes(args.userId)) return [];

    let messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();

    // Sort by time ascending (oldest first)
    messages.sort((a, b) => a.createdAt - b.createdAt);

    // Limit results if specified
    if (args.limit) {
      messages = messages.slice(-args.limit);
    }

    // Enrich with sender names
    const enriched = await Promise.all(
      messages.map(async (msg) => {
        const sender = await ctx.db.get(msg.senderId);
        return {
          ...msg,
          senderName: sender?.name || "Unknown",
          isOwnMessage: msg.senderId === args.userId,
        };
      })
    );

    return enriched;
  },
});

// Send a message
export const sendMessage = mutation({
  args: {
    userId: v.id("users"),
    channelId: v.id("chatChannels"),
    content: v.string(),
    attachmentUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    if (!channel.participants.includes(args.userId)) {
      throw new Error("Not a member of this channel");
    }

    const messageId = await ctx.db.insert("chatMessages", {
      channelId: args.channelId,
      senderId: args.userId,
      content: args.content,
      attachmentUrl: args.attachmentUrl,
      readBy: [args.userId], // Sender has read it
      createdAt: Date.now(),
    });

    return messageId;
  },
});

// Mark messages as read
export const markAsRead = mutation({
  args: {
    userId: v.id("users"),
    channelId: v.id("chatChannels"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    if (!channel.participants.includes(args.userId)) {
      throw new Error("Not a member of this channel");
    }

    // Get all unread messages in channel
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();

    // Mark each unread message as read
    for (const msg of messages) {
      if (!msg.readBy.includes(args.userId)) {
        await ctx.db.patch(msg._id, {
          readBy: [...msg.readBy, args.userId],
        });
      }
    }

    return { success: true };
  },
});

// Toggle a reaction on a message
export const toggleReaction = mutation({
  args: {
    userId: v.id("users"),
    messageId: v.id("chatMessages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    const channel = await ctx.db.get(message.channelId);
    if (!channel) throw new Error("Channel not found");
    if (!channel.participants.includes(args.userId)) {
      throw new Error("Not a member of this channel");
    }

    const reactions = message.reactions || [];
    const existingIndex = reactions.findIndex(
      (r) => r.emoji === args.emoji && r.userId === args.userId
    );

    if (existingIndex >= 0) {
      // Remove reaction
      reactions.splice(existingIndex, 1);
    } else {
      // Add reaction
      reactions.push({ emoji: args.emoji, userId: args.userId });
    }

    await ctx.db.patch(args.messageId, { reactions });

    return { success: true };
  },
});

// Edit a message (within 15 min window)
export const editMessage = mutation({
  args: {
    userId: v.id("users"),
    messageId: v.id("chatMessages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    // Must be sender
    if (message.senderId !== args.userId) {
      throw new Error("Can only edit your own messages");
    }

    // Check 15 minute window
    const fifteenMinutes = 15 * 60 * 1000;
    if (Date.now() - message.createdAt > fifteenMinutes) {
      throw new Error("Edit window has expired (15 minutes)");
    }

    // Cannot edit deleted messages
    if (message.isDeleted) {
      throw new Error("Cannot edit a deleted message");
    }

    await ctx.db.patch(args.messageId, {
      content: args.content,
      editedAt: Date.now(),
    });

    return { success: true };
  },
});

// Delete a message (within 15 min window)
export const deleteMessage = mutation({
  args: {
    userId: v.id("users"),
    messageId: v.id("chatMessages"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    // Must be sender
    if (message.senderId !== args.userId) {
      throw new Error("Can only delete your own messages");
    }

    // Check 15 minute window
    const fifteenMinutes = 15 * 60 * 1000;
    if (Date.now() - message.createdAt > fifteenMinutes) {
      throw new Error("Delete window has expired (15 minutes)");
    }

    await ctx.db.patch(args.messageId, {
      isDeleted: true,
      content: "", // Clear content
      attachments: [], // Clear attachments
    });

    return { success: true };
  },
});

// Create a DM channel or get existing one
export const getOrCreateDM = mutation({
  args: {
    userId: v.id("users"),
    otherUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const otherUser = await ctx.db.get(args.otherUserId);
    if (!otherUser) throw new Error("Other user not found");
    if (user.organizationId !== otherUser.organizationId) {
      throw new Error("Users not in same organization");
    }

    // Check if DM channel already exists
    const existingChannels = await ctx.db
      .query("chatChannels")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .filter((q) => q.eq(q.field("type"), "dm"))
      .collect();

    const existingDM = existingChannels.find(
      (ch) =>
        ch.participants.includes(args.userId) &&
        ch.participants.includes(args.otherUserId) &&
        ch.participants.length === 2
    );

    if (existingDM) {
      return existingDM._id;
    }

    // Create new DM channel
    const channelId = await ctx.db.insert("chatChannels", {
      organizationId: user.organizationId,
      type: "dm",
      participants: [args.userId, args.otherUserId],
      createdAt: Date.now(),
    });

    return channelId;
  },
});

// Get or create company channel
export const getOrCreateCompanyChannel = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Check if company channel exists
    const existingChannel = await ctx.db
      .query("chatChannels")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .filter((q) => q.eq(q.field("type"), "company"))
      .first();

    if (existingChannel) {
      // Add user if not already participant
      if (!existingChannel.participants.includes(args.userId)) {
        await ctx.db.patch(existingChannel._id, {
          participants: [...existingChannel.participants, args.userId],
        });
      }
      return existingChannel._id;
    }

    // Get all users in org
    const orgUsers = await ctx.db
      .query("users")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    // Create company channel
    const channelId = await ctx.db.insert("chatChannels", {
      organizationId: user.organizationId,
      type: "company",
      name: "Team Chat",
      participants: orgUsers.map((u) => u._id),
      createdAt: Date.now(),
    });

    return channelId;
  },
});

// Get total unread count for badge
export const getTotalUnreadCount = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return 0;

    const allChannels = await ctx.db
      .query("chatChannels")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    const userChannels = allChannels.filter((ch) =>
      ch.participants.includes(args.userId)
    );

    let totalUnread = 0;

    for (const channel of userChannels) {
      const messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
        .collect();

      totalUnread += messages.filter(
        (m) => !m.readBy.includes(args.userId) && m.senderId !== args.userId
      ).length;
    }

    return totalUnread;
  },
});

// Get channel details
export const getChannel = query({
  args: {
    userId: v.id("users"),
    channelId: v.id("chatChannels"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const channel = await ctx.db.get(args.channelId);
    if (!channel) return null;
    if (!channel.participants.includes(args.userId)) return null;

    // Get participant details
    const participants = await Promise.all(
      channel.participants.map(async (p) => {
        const u = await ctx.db.get(p);
        return u ? { _id: u._id, name: u.name, role: u.role } : null;
      })
    );

    // Get job if it's a job channel
    let job = null;
    if (channel.type === "job" && channel.jobId) {
      job = await ctx.db.get(channel.jobId);
    }

    return {
      ...channel,
      participants: participants.filter(Boolean),
      job,
    };
  },
});
