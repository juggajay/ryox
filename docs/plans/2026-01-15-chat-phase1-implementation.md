# Chat Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add reactions, read receipts UI, photo/file sharing, @mentions, and edit/delete to the existing chat system.

**Architecture:** Extend the existing Convex schema with new fields (reactions, editedAt, isDeleted, mentions). Add new mutations for reactions/edit/delete. Enhance the UI with interactive message components.

**Tech Stack:** Convex (backend), React/Next.js (frontend), shadcn/ui components, date-fns

---

## Overview

**Phase 1 Features:**
1. Reactions on messages (emoji picker, display reactions)
2. Read receipts UI (show who's seen messages)
3. Photo/file sharing (upload, preview, gallery)
4. @mentions (autocomplete, highlight, notification)
5. Edit/delete with 15-min window

---

## Task 1: Update Schema for Phase 1 Features

**Files:**
- Modify: `convex/schema.ts:344-352`

**Step 1: Update chatMessages schema**

Add new fields to support reactions, editing, deletion, and mentions.

```typescript
// In convex/schema.ts, replace the chatMessages table definition

  // Chat Messages
  chatMessages: defineTable({
    channelId: v.id("chatChannels"),
    senderId: v.id("users"),
    content: v.string(),
    // Attachments - now supports multiple files
    attachments: v.optional(v.array(v.object({
      url: v.string(),
      type: v.union(v.literal("image"), v.literal("file")),
      name: v.string(),
      size: v.number(),
    }))),
    // Legacy single attachment (keep for backwards compatibility)
    attachmentUrl: v.optional(v.string()),
    readBy: v.array(v.id("users")),
    // Reactions
    reactions: v.optional(v.array(v.object({
      emoji: v.string(),
      userId: v.id("users"),
    }))),
    // Mentions
    mentions: v.optional(v.array(v.id("users"))),
    // Edit/Delete
    editedAt: v.optional(v.number()),
    isDeleted: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_channel", ["channelId"]),
```

**Step 2: Run Convex to validate schema**

Run: `npx convex dev`
Expected: Schema updates successfully, no errors

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(chat): add reactions, mentions, edit/delete fields to schema"
```

---

## Task 2: Add Reaction Mutations

**Files:**
- Modify: `convex/chat.ts`

**Step 1: Add toggleReaction mutation**

Add after the `markAsRead` mutation (around line 194):

```typescript
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
```

**Step 2: Run Convex to validate**

Run: `npx convex dev`
Expected: No errors, function registered

**Step 3: Commit**

```bash
git add convex/chat.ts
git commit -m "feat(chat): add toggleReaction mutation"
```

---

## Task 3: Add Edit and Delete Mutations

**Files:**
- Modify: `convex/chat.ts`

**Step 1: Add editMessage mutation**

Add after the `toggleReaction` mutation:

```typescript
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
```

**Step 2: Run Convex to validate**

Run: `npx convex dev`
Expected: No errors, functions registered

**Step 3: Commit**

```bash
git add convex/chat.ts
git commit -m "feat(chat): add editMessage and deleteMessage mutations"
```

---

## Task 4: Update sendMessage for Mentions and Attachments

**Files:**
- Modify: `convex/chat.ts:131-158`

**Step 1: Update sendMessage mutation**

Replace the existing `sendMessage` mutation:

```typescript
// Send a message
export const sendMessage = mutation({
  args: {
    userId: v.id("users"),
    channelId: v.id("chatChannels"),
    content: v.string(),
    attachmentUrl: v.optional(v.string()),
    attachments: v.optional(v.array(v.object({
      url: v.string(),
      type: v.union(v.literal("image"), v.literal("file")),
      name: v.string(),
      size: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Channel not found");
    if (!channel.participants.includes(args.userId)) {
      throw new Error("Not a member of this channel");
    }

    // Parse mentions from content (@username pattern)
    const mentionPattern = /@(\w+)/g;
    const mentionMatches = args.content.match(mentionPattern) || [];

    // Find mentioned users
    const mentions: typeof args.userId[] = [];
    if (mentionMatches.length > 0) {
      const orgUsers = await ctx.db
        .query("users")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", user.organizationId)
        )
        .collect();

      for (const match of mentionMatches) {
        const username = match.slice(1).toLowerCase(); // Remove @
        const mentionedUser = orgUsers.find(
          (u) => u.name.toLowerCase().replace(/\s+/g, '') === username ||
                 u.name.toLowerCase().split(' ')[0] === username
        );
        if (mentionedUser && !mentions.includes(mentionedUser._id)) {
          mentions.push(mentionedUser._id);
        }
      }
    }

    const messageId = await ctx.db.insert("chatMessages", {
      channelId: args.channelId,
      senderId: args.userId,
      content: args.content,
      attachmentUrl: args.attachmentUrl,
      attachments: args.attachments,
      readBy: [args.userId],
      mentions: mentions.length > 0 ? mentions : undefined,
      createdAt: Date.now(),
    });

    return messageId;
  },
});
```

**Step 2: Run Convex to validate**

Run: `npx convex dev`
Expected: No errors

**Step 3: Commit**

```bash
git add convex/chat.ts
git commit -m "feat(chat): add mentions parsing and attachments to sendMessage"
```

---

## Task 5: Add Query for Read Receipt Details

**Files:**
- Modify: `convex/chat.ts`

**Step 1: Add getMessageReadBy query**

Add after the `getChannel` query:

```typescript
// Get read receipt details for a message
export const getMessageReadBy = query({
  args: {
    userId: v.id("users"),
    messageId: v.id("chatMessages"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const message = await ctx.db.get(args.messageId);
    if (!message) return null;

    const channel = await ctx.db.get(message.channelId);
    if (!channel) return null;
    if (!channel.participants.includes(args.userId)) return null;

    // Get details for users who read the message
    const readByUsers = await Promise.all(
      message.readBy.map(async (userId) => {
        const u = await ctx.db.get(userId);
        return u ? { _id: u._id, name: u.name } : null;
      })
    );

    return {
      readBy: readByUsers.filter(Boolean),
      totalParticipants: channel.participants.length,
    };
  },
});
```

**Step 2: Update getMessages to include reaction user names**

Modify the `getMessages` query's enrichment section (around line 115-124):

```typescript
    // Enrich with sender names and reaction details
    const enriched = await Promise.all(
      messages.map(async (msg) => {
        const sender = await ctx.db.get(msg.senderId);

        // Get reaction user names
        let reactionsWithNames: { emoji: string; userId: string; userName: string }[] = [];
        if (msg.reactions && msg.reactions.length > 0) {
          reactionsWithNames = await Promise.all(
            msg.reactions.map(async (r) => {
              const u = await ctx.db.get(r.userId);
              return {
                emoji: r.emoji,
                userId: r.userId,
                userName: u?.name || "Unknown",
              };
            })
          );
        }

        // Check if within edit window
        const fifteenMinutes = 15 * 60 * 1000;
        const canEdit = msg.senderId === args.userId &&
                        Date.now() - msg.createdAt < fifteenMinutes &&
                        !msg.isDeleted;

        return {
          ...msg,
          senderName: sender?.name || "Unknown",
          isOwnMessage: msg.senderId === args.userId,
          reactionsWithNames,
          canEdit,
          readByCount: msg.readBy.length,
        };
      })
    );
```

**Step 3: Run Convex to validate**

Run: `npx convex dev`
Expected: No errors

**Step 4: Commit**

```bash
git add convex/chat.ts
git commit -m "feat(chat): add read receipt query and enrich messages with reactions"
```

---

## Task 6: Create Message Component with Reactions UI

**Files:**
- Create: `src/components/chat/ChatMessage.tsx`

**Step 1: Create the ChatMessage component**

```typescript
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

// Quick reaction emojis
const QUICK_REACTIONS = ['👍', '✅', '❤️', '😂', '🔥'];

interface Attachment {
  url: string;
  type: 'image' | 'file';
  name: string;
  size: number;
}

interface Reaction {
  emoji: string;
  userId: string;
  userName: string;
}

interface ChatMessageProps {
  message: {
    _id: Id<"chatMessages">;
    content: string;
    senderName: string;
    isOwnMessage: boolean;
    createdAt: number;
    editedAt?: number;
    isDeleted?: boolean;
    attachments?: Attachment[];
    attachmentUrl?: string;
    reactionsWithNames: Reaction[];
    canEdit: boolean;
    readByCount: number;
    mentions?: Id<"users">[];
  };
  userId: Id<"users">;
  onEdit?: (messageId: Id<"chatMessages">, content: string) => void;
}

export function ChatMessage({ message, userId, onEdit }: ChatMessageProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const toggleReaction = useMutation(api.chat.toggleReaction);
  const editMessage = useMutation(api.chat.editMessage);
  const deleteMessage = useMutation(api.chat.deleteMessage);

  // Group reactions by emoji
  const groupedReactions = message.reactionsWithNames.reduce((acc, r) => {
    if (!acc[r.emoji]) {
      acc[r.emoji] = { emoji: r.emoji, count: 0, users: [], hasOwn: false };
    }
    acc[r.emoji].count++;
    acc[r.emoji].users.push(r.userName);
    if (r.userId === userId) {
      acc[r.emoji].hasOwn = true;
    }
    return acc;
  }, {} as Record<string, { emoji: string; count: number; users: string[]; hasOwn: boolean }>);

  const handleReaction = async (emoji: string) => {
    await toggleReaction({ userId, messageId: message._id, emoji });
    setShowReactionPicker(false);
  };

  const handleEdit = async () => {
    if (editContent.trim() && editContent !== message.content) {
      await editMessage({ userId, messageId: message._id, content: editContent.trim() });
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm('Delete this message?')) {
      await deleteMessage({ userId, messageId: message._id });
      setShowContextMenu(false);
    }
  };

  // Handle deleted messages
  if (message.isDeleted) {
    return (
      <div className={`flex ${message.isOwnMessage ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[85%] md:max-w-[70%] px-4 py-2.5 text-[var(--foreground-muted)] italic text-sm">
          This message was deleted
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${message.isOwnMessage ? 'justify-end' : 'justify-start'} group`}>
      <div className="relative">
        {/* Message bubble */}
        <div
          className={`
            max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2.5
            ${message.isOwnMessage
              ? 'bg-[var(--accent)] text-[var(--background)] rounded-br-md'
              : 'bg-[var(--secondary)] rounded-bl-md'
            }
          `}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowContextMenu(!showContextMenu);
          }}
          onClick={() => setShowReactionPicker(false)}
        >
          {!message.isOwnMessage && (
            <p className="text-xs font-medium mb-1 opacity-70">
              {message.senderName}
            </p>
          )}

          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-2 py-1 rounded bg-[var(--background)] text-[var(--foreground)] text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEdit();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
              />
              <div className="flex gap-2 text-xs">
                <button onClick={handleEdit} className="text-green-400">Save</button>
                <button onClick={() => setIsEditing(false)} className="opacity-70">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words text-[15px]">{message.content}</p>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((att, i) => (
                <div key={i}>
                  {att.type === 'image' ? (
                    <img
                      src={att.url}
                      alt={att.name}
                      className="max-w-full rounded-lg cursor-pointer"
                      onClick={() => window.open(att.url, '_blank')}
                    />
                  ) : (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-[var(--background)]/20 rounded-lg text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="truncate">{att.name}</span>
                      <span className="text-xs opacity-70">
                        {(att.size / 1024).toFixed(0)}KB
                      </span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Legacy single attachment */}
          {message.attachmentUrl && !message.attachments?.length && (
            <div className="mt-2">
              <img
                src={message.attachmentUrl}
                alt="Attachment"
                className="max-w-full rounded-lg cursor-pointer"
                onClick={() => window.open(message.attachmentUrl, '_blank')}
              />
            </div>
          )}

          <div className={`flex items-center gap-2 mt-1 text-[10px] ${
            message.isOwnMessage ? 'opacity-70 justify-end' : 'text-[var(--foreground-muted)]'
          }`}>
            {message.editedAt && <span>(edited)</span>}
            <span>{format(new Date(message.createdAt), 'HH:mm')}</span>
            {message.isOwnMessage && (
              <span title={`Seen by ${message.readByCount}`}>
                {message.readByCount > 1 ? '✓✓' : '✓'}
              </span>
            )}
          </div>
        </div>

        {/* Reactions display */}
        {Object.keys(groupedReactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.values(groupedReactions).map((r) => (
              <button
                key={r.emoji}
                onClick={() => handleReaction(r.emoji)}
                className={`
                  flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                  ${r.hasOwn
                    ? 'bg-[var(--accent)]/30 border border-[var(--accent)]'
                    : 'bg-[var(--secondary)] border border-[var(--border)]'
                  }
                `}
                title={r.users.join(', ')}
              >
                <span>{r.emoji}</span>
                <span>{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Reaction picker */}
        {showReactionPicker && (
          <div className={`
            absolute bottom-full mb-2 z-10
            ${message.isOwnMessage ? 'right-0' : 'left-0'}
            flex gap-1 p-2 bg-[var(--card)] border border-[var(--border)] rounded-full shadow-lg
          `}>
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="w-8 h-8 flex items-center justify-center hover:bg-[var(--secondary)] rounded-full transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Context menu */}
        {showContextMenu && (
          <div className={`
            absolute top-full mt-1 z-10
            ${message.isOwnMessage ? 'right-0' : 'left-0'}
            bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[140px]
          `}>
            <button
              onClick={() => { setShowReactionPicker(true); setShowContextMenu(false); }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--secondary)]"
            >
              React
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(message.content); setShowContextMenu(false); }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--secondary)]"
            >
              Copy
            </button>
            {message.canEdit && (
              <>
                <button
                  onClick={() => { setIsEditing(true); setShowContextMenu(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--secondary)]"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--secondary)] text-red-400"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}

        {/* Quick reaction button (appears on hover) */}
        <button
          onClick={() => setShowReactionPicker(!showReactionPicker)}
          className={`
            absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity
            ${message.isOwnMessage ? '-left-10' : '-right-10'}
            w-8 h-8 flex items-center justify-center bg-[var(--card)] border border-[var(--border)] rounded-full text-sm
          `}
        >
          😀
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Verify file compiles**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/chat/ChatMessage.tsx
git commit -m "feat(chat): create ChatMessage component with reactions and context menu"
```

---

## Task 7: Create Mention Autocomplete Component

**Files:**
- Create: `src/components/chat/MentionInput.tsx`

**Step 1: Create the MentionInput component**

```typescript
'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface Participant {
  _id: string;
  name: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  participants: Participant[];
  disabled?: boolean;
  placeholder?: string;
}

export function MentionInput({
  value,
  onChange,
  onSubmit,
  participants,
  disabled,
  placeholder = "Type a message...",
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Participant[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if we're in a mention context (after @)
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex >= 0) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Only show suggestions if no space after @
      if (!textAfterAt.includes(' ')) {
        const query = textAfterAt.toLowerCase();
        const filtered = participants.filter(p =>
          p.name.toLowerCase().includes(query) ||
          p.name.toLowerCase().split(' ')[0].includes(query)
        ).slice(0, 5);

        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
        setMentionStart(lastAtIndex);
        setSelectedIndex(0);
        return;
      }
    }

    setShowSuggestions(false);
    setMentionStart(-1);
  }, [value, participants]);

  const insertMention = (participant: Participant) => {
    if (mentionStart < 0) return;

    const beforeMention = value.slice(0, mentionStart);
    const cursorPos = inputRef.current?.selectionStart || value.length;
    const afterMention = value.slice(cursorPos);

    // Use first name for mention
    const mentionText = `@${participant.name.split(' ')[0]} `;
    const newValue = beforeMention + mentionText + afterMention;

    onChange(newValue);
    setShowSuggestions(false);

    // Focus and set cursor position
    setTimeout(() => {
      inputRef.current?.focus();
      const newCursorPos = beforeMention.length + mentionText.length;
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          insertMention(suggestions[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="
          w-full px-4 py-3
          bg-[var(--secondary)] border border-[var(--border)]
          rounded-2xl
          text-base
          focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
        "
      />

      {/* Mention suggestions dropdown */}
      {showSuggestions && (
        <div className="absolute bottom-full mb-2 left-0 right-0 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden z-20">
          {suggestions.map((p, i) => (
            <button
              key={p._id}
              onClick={() => insertMention(p)}
              className={`
                w-full px-4 py-2 text-left text-sm flex items-center gap-2
                ${i === selectedIndex ? 'bg-[var(--secondary)]' : 'hover:bg-[var(--secondary)]'}
              `}
            >
              <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center text-xs text-[var(--background)]">
                {p.name.charAt(0)}
              </div>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify file compiles**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/chat/MentionInput.tsx
git commit -m "feat(chat): create MentionInput component with autocomplete"
```

---

## Task 8: Create File Upload Component

**Files:**
- Create: `src/components/chat/FileUpload.tsx`

**Step 1: Create the FileUpload component**

```typescript
'use client';

import { useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';

interface UploadedFile {
  url: string;
  type: 'image' | 'file';
  name: string;
  size: number;
}

interface FileUploadProps {
  onFilesSelected: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

export function FileUpload({
  onFilesSelected,
  maxFiles = 10,
  maxSizeMB = 25
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate
    if (files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const oversized = files.filter(f => f.size > maxSizeBytes);
    if (oversized.length > 0) {
      alert(`Files must be under ${maxSizeMB}MB: ${oversized.map(f => f.name).join(', ')}`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uploadedFiles: UploadedFile[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Get upload URL from Convex
        const uploadUrl = await generateUploadUrl();

        // Upload file
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!response.ok) throw new Error('Upload failed');

        const { storageId } = await response.json();

        // Determine file type
        const isImage = file.type.startsWith('image/');

        uploadedFiles.push({
          url: storageId, // Will be resolved by Convex
          type: isImage ? 'image' : 'file',
          name: file.name,
          size: file.size,
        });

        setUploadProgress(((i + 1) / files.length) * 100);
      }

      onFilesSelected(uploadedFiles);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload files');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={handleFileSelect}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="
          p-3 rounded-xl
          bg-[var(--secondary)] border border-[var(--border)]
          hover:bg-[var(--card)]
          disabled:opacity-50
          transition-colors
        "
      >
        {isUploading ? (
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        )}
      </button>

      {isUploading && uploadProgress > 0 && (
        <div className="absolute -top-1 -right-1 w-4 h-4">
          <svg className="w-4 h-4 transform -rotate-90">
            <circle
              cx="8"
              cy="8"
              r="6"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeDasharray={`${(uploadProgress / 100) * 37.7} 37.7`}
            />
          </svg>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create files.ts for upload URL generation**

Create `convex/files.ts`:

```typescript
import { mutation } from "./_generated/server";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getUrl = mutation({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
```

Wait - we need to import v. Let me fix that:

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
```

**Step 3: Run Convex to validate**

Run: `npx convex dev`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/chat/FileUpload.tsx convex/files.ts
git commit -m "feat(chat): add file upload component and Convex storage helpers"
```

---

## Task 9: Update Chat Page to Use New Components

**Files:**
- Modify: `src/app/(dashboard)/chat/page.tsx`

**Step 1: Import new components and update imports**

Replace the imports at the top:

```typescript
'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '@/lib/auth-context';
import { useState, useEffect, useRef } from 'react';
import { Id } from '../../../../convex/_generated/dataModel';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { MentionInput } from '@/components/chat/MentionInput';
import { FileUpload } from '@/components/chat/FileUpload';
```

**Step 2: Update state and add attachment state**

Add after existing state declarations (around line 14-16):

```typescript
  const [pendingAttachments, setPendingAttachments] = useState<Array<{
    url: string;
    type: 'image' | 'file';
    name: string;
    size: number;
  }>>([]);
```

**Step 3: Update handleSendMessage to include attachments**

Replace the `handleSendMessage` function:

```typescript
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user || !selectedChannelId || (!messageInput.trim() && pendingAttachments.length === 0)) return;

    setIsSending(true);
    try {
      await sendMessage({
        userId: user._id,
        channelId: selectedChannelId,
        content: messageInput.trim(),
        attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
      });
      setMessageInput('');
      setPendingAttachments([]);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };
```

**Step 4: Replace message rendering with ChatMessage component**

Replace the messages.map section (around lines 243-273):

```typescript
                messages.map((msg) => (
                  <ChatMessage
                    key={msg._id}
                    message={msg}
                    userId={user!._id}
                  />
                ))
```

**Step 5: Replace input with MentionInput and add FileUpload**

Replace the form section (around lines 278-319):

```typescript
            {/* Pending attachments preview */}
            {pendingAttachments.length > 0 && (
              <div className="px-3 md:px-4 pt-2 flex gap-2 flex-wrap">
                {pendingAttachments.map((att, i) => (
                  <div key={i} className="relative group">
                    {att.type === 'image' ? (
                      <img src={att.url} alt={att.name} className="w-16 h-16 object-cover rounded-lg" />
                    ) : (
                      <div className="w-16 h-16 bg-[var(--secondary)] rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    )}
                    <button
                      onClick={() => setPendingAttachments(atts => atts.filter((_, idx) => idx !== i))}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-3 md:p-4 border-t border-[var(--border)] bg-[var(--card)]">
              <div className="flex gap-2 items-end">
                <FileUpload
                  onFilesSelected={(files) => setPendingAttachments(prev => [...prev, ...files])}
                />

                <MentionInput
                  value={messageInput}
                  onChange={setMessageInput}
                  onSubmit={() => handleSendMessage()}
                  participants={selectedChannel?.participants.filter((p): p is NonNullable<typeof p> => p !== null) || []}
                  disabled={isSending}
                />

                <button
                  type="submit"
                  disabled={isSending || (!messageInput.trim() && pendingAttachments.length === 0)}
                  className="
                    p-3 md:px-6 md:py-3
                    bg-[var(--accent)] text-[var(--background)]
                    rounded-2xl md:rounded-xl
                    font-medium
                    hover:bg-[var(--accent)]/90
                    disabled:opacity-50 disabled:cursor-not-allowed
                    active:scale-95 transition-transform
                  "
                >
                  {isSending ? (
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-5 h-5 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span className="hidden md:inline">Send</span>
                    </>
                  )}
                </button>
              </div>
            </form>
```

**Step 6: Run dev server to test**

Run: `npm run dev`
Expected: Chat page loads with new components, no errors

**Step 7: Commit**

```bash
git add src/app/\(dashboard\)/chat/page.tsx
git commit -m "feat(chat): integrate ChatMessage, MentionInput, and FileUpload components"
```

---

## Task 10: Add Read Receipt Modal Component

**Files:**
- Create: `src/components/chat/ReadReceiptModal.tsx`

**Step 1: Create the ReadReceiptModal component**

```typescript
'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

interface ReadReceiptModalProps {
  messageId: Id<"chatMessages">;
  userId: Id<"users">;
  onClose: () => void;
}

export function ReadReceiptModal({ messageId, userId, onClose }: ReadReceiptModalProps) {
  const readReceipts = useQuery(api.chat.getMessageReadBy, { userId, messageId });

  if (!readReceipts) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-[var(--card)] rounded-xl p-4 w-72">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-[var(--secondary)] rounded w-1/2" />
            <div className="h-8 bg-[var(--secondary)] rounded" />
            <div className="h-8 bg-[var(--secondary)] rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[var(--card)] rounded-xl p-4 w-72 max-h-80 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">
            Seen by {readReceipts.readBy.length}
          </h3>
          <button onClick={onClose} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-2">
          {readReceipts.readBy.map((user) => (
            <div key={user._id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--secondary)]">
              <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-sm text-[var(--background)]">
                {user.name.charAt(0)}
              </div>
              <span className="text-sm">{user.name}</span>
            </div>
          ))}
        </div>

        {readReceipts.readBy.length < readReceipts.totalParticipants && (
          <p className="text-xs text-[var(--foreground-muted)] mt-3 pt-3 border-t border-[var(--border)]">
            {readReceipts.totalParticipants - readReceipts.readBy.length} haven't seen this yet
          </p>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify file compiles**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/chat/ReadReceiptModal.tsx
git commit -m "feat(chat): add ReadReceiptModal component"
```

---

## Task 11: Update ChatMessage to Show Read Receipt Modal

**Files:**
- Modify: `src/components/chat/ChatMessage.tsx`

**Step 1: Import and add state for read receipt modal**

Add import at top:

```typescript
import { ReadReceiptModal } from './ReadReceiptModal';
```

Add state in component:

```typescript
const [showReadReceipts, setShowReadReceipts] = useState(false);
```

**Step 2: Make read receipt count clickable**

Replace the read receipt indicator in the timestamp section:

```typescript
            {message.isOwnMessage && message.readByCount > 1 && (
              <button
                onClick={() => setShowReadReceipts(true)}
                className="hover:underline"
                title={`Seen by ${message.readByCount}`}
              >
                ✓✓ {message.readByCount > 2 && message.readByCount}
              </button>
            )}
            {message.isOwnMessage && message.readByCount === 1 && (
              <span title="Sent">✓</span>
            )}
```

**Step 3: Add modal render**

Add before the closing div of the component:

```typescript
        {/* Read receipts modal */}
        {showReadReceipts && (
          <ReadReceiptModal
            messageId={message._id}
            userId={userId}
            onClose={() => setShowReadReceipts(false)}
          />
        )}
```

**Step 4: Run to verify**

Run: `npm run dev`
Expected: Clicking on read receipts opens modal

**Step 5: Commit**

```bash
git add src/components/chat/ChatMessage.tsx
git commit -m "feat(chat): add read receipt modal trigger to ChatMessage"
```

---

## Task 12: Final Testing and Polish

**Step 1: Test all Phase 1 features**

Run: `npm run dev`

Test checklist:
- [ ] Send a message - should appear immediately
- [ ] Long-press/right-click a message - context menu appears
- [ ] Click React - emoji picker appears
- [ ] Select an emoji - reaction appears on message
- [ ] Click same emoji again - reaction removed (toggle)
- [ ] Click reaction bubble to see who reacted
- [ ] Type @ - autocomplete shows participants
- [ ] Select participant - mention inserted
- [ ] Click + button - file picker opens
- [ ] Select image - preview appears
- [ ] Send message with image - image displays inline
- [ ] Edit own message (within 15 min) - shows (edited)
- [ ] Delete own message (within 15 min) - shows "deleted" placeholder
- [ ] Click read receipt count - modal shows who's seen
- [ ] Verify 15-min window enforced on edit/delete

**Step 2: Fix any issues found during testing**

Address any bugs or UI issues discovered.

**Step 3: Run build to ensure no TypeScript errors**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 4: Final commit**

```bash
git add .
git commit -m "feat(chat): complete Phase 1 - reactions, read receipts, files, mentions, edit/delete"
```

---

## Summary

Phase 1 adds:
1. **Reactions** - Quick emoji reactions on any message with toggle behavior
2. **Read Receipts UI** - Clickable indicator showing who's seen messages
3. **File/Photo Sharing** - Upload multiple files with preview
4. **@Mentions** - Autocomplete participant names, highlighted in messages
5. **Edit/Delete** - 15-minute window to edit or delete own messages

Files created:
- `src/components/chat/ChatMessage.tsx`
- `src/components/chat/MentionInput.tsx`
- `src/components/chat/FileUpload.tsx`
- `src/components/chat/ReadReceiptModal.tsx`
- `convex/files.ts`

Files modified:
- `convex/schema.ts`
- `convex/chat.ts`
- `src/app/(dashboard)/chat/page.tsx`
