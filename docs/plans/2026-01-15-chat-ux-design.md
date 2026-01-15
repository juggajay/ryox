# Chat UX Design

> WhatsApp-style team chat with optional threading, built for carpentry crews.

## Overview

A real-time chat system that feels instantly familiar (WhatsApp-style) while supporting work-specific features like job channels, announcements, and shared checklists. Dark theme to match the CarpTrack app.

## Design Principles

1. **Familiar** - Anyone who's used WhatsApp can use this immediately
2. **Fast** - Quick reactions, voice messages, minimal taps to do common things
3. **Flat** - Everyone's equal (except owner-only announcements)
4. **Focused** - Chat stays chat; job details stay on the job page

---

## Channel Structure

### Three Channel Types

| Type | Icon | Description | Auto-created |
|------|------|-------------|--------------|
| **General** | 🏢 | Company-wide, everyone's in it | On org creation |
| **Job** | 🔨 | Per-job channel | When job created |
| **DM** | Avatar | Private 1-on-1 | On first message |

### Channel Behavior

- **General**: All org members automatically added
- **Job channels**: Workers added when allocated to job, removed when deallocated
- **DMs**: Created on-demand when user initiates conversation

---

## Core Chat Experience

### Message Display

- Dark theme throughout (matches app)
- Own messages: right-aligned, amber/gold accent bubble
- Others' messages: left-aligned, dark gray bubble
- Sender name above message (in group channels)
- Timestamp on each message (subtle, HH:mm format)
- Messages in chronological order, newest at bottom
- Auto-scroll to newest on channel open

### Message Input

- Fixed input bar at bottom of screen
- Text field expands up to 4 lines, then scrolls internally
- **Left**: + button for attachments
- **Right**: Send button (when text entered) or mic button (when empty)
- Send button replaces mic button dynamically

---

## Threading System

### Quick Replies (Inline)

Reply to a specific message without leaving the main flow.

**How it works:**
1. Swipe right on message (or long-press → "Reply")
2. Original message shown quoted above your reply input
3. Reply appears in main chat with quoted context
4. Below original message: "3 replies" link
5. Tap to expand replies inline
6. Collapse to hide again

**Use case**: Quick clarifications, "yes got it" responses, short follow-ups.

### Breakout Threads (Named)

Create a dedicated sub-conversation for bigger discussions.

**How it works:**
1. Long-press message → "Start thread"
2. Enter thread name (e.g., "Deck materials for Monday")
3. Thread appears as a card in the main chat:
   - Thread name (bold)
   - Last message preview
   - Participant avatars
   - "12 messages" count
4. Tap card to open thread in modal overlay (slides up, 90% height)
5. Thread has its own message input, same features as main chat
6. "X" button to close and return to channel

**Use case**: Extended discussions, planning, problem-solving that needs its own space.

---

## Message Features

### Reactions

**Interaction:**
- Long-press message → emoji picker appears
- Quick reaction bar at top: 👍 ✅ ❤️ 😂 🔥
- Full emoji picker below for other reactions

**Display:**
- Reactions appear below message bubble
- Grouped by emoji with count: 👍 3  ❤️ 2
- Tap reaction row to see who reacted with what

### Voice Messages

**Recording:**
- Hold mic button to record
- Slide up to lock (hands-free recording continues)
- Slide left to cancel
- Waveform animation while recording
- Duration counter

**Playback:**
- Waveform visualization with progress bar
- Play/pause button
- 1.5x / 2x speed toggle
- Duration shown

### Read Receipts

**Indicators (below your sent messages):**
- ✓ Sent (single gray check)
- ✓✓ Delivered (double gray check)
- ✓✓ Seen (double blue/amber check)

**Group chats:**
- "Seen by 4" text below message
- Tap to see list of who's read / who hasn't

### Photo & File Sharing

**Sending:**
- Tap + button → Camera / Photo Library / Files
- Multiple photos can be selected
- Preview before sending

**Display:**
- Photos: inline thumbnail, tap for full-screen with pinch-zoom
- Multiple photos: gallery view, swipe through
- Files: attachment card with filename, size, icon
- Tap file to download/preview

### @ Mentions

**Input:**
- Type @ to trigger autocomplete
- Shows list of channel participants
- Select person to insert @Name

**Display:**
- Mentioned name highlighted in message
- @everyone available in General channel (owner only)

**Behavior:**
- Mention triggers push notification even if channel muted
- Mentioned user sees message highlighted in their view

---

## Special Message Types

### Polls

**Creating:**
1. Tap + button → "Poll"
2. Enter question
3. Add 2-5 options
4. Optional: multiple choice, anonymous, end time
5. Send

**Display:**
- Card with question as header
- Options as tappable rows
- Vote → shows results as horizontal bars with percentages
- "5 votes" total count
- Creator can close poll early

**Example:**
```
Saturday start time?
━━━━━━━━━━━ 6:00 AM (2 votes, 40%)
━━━━━━━━━━━━━━━━ 7:00 AM (3 votes, 60%)
```

### Location Sharing

**Sending:**
1. Tap + button → "Location"
2. Map preview shows current location
3. Confirm to send

**Display:**
- Mini map thumbnail
- Address text
- Distance from viewer's current location
- Tap to open in Google Maps / Apple Maps

### Checklists

**Creating:**
1. Tap + button → "Checklist"
2. Enter title (e.g., "Bunnings run")
3. Add items
4. Send

**Display:**
- Card with title as header
- Checkbox items
- "2/5 complete" progress indicator
- Anyone can check/uncheck items
- Checked items show strikethrough
- Creator can add items after posting

**Example:**
```
Bunnings run (2/5)
☑ 75mm screws
☑ Brackets
☐ Silicone
☐ Wood glue
☐ Sandpaper
```

---

## Edit & Delete

### Rules

- **Window**: 15 minutes after sending
- **Edit**: Changes message content, shows "(edited)" label
- **Delete**: Replaces with "This message was deleted" (gray italic)
- **After 15 min**: Only "Copy" and "Reply" available

### Interaction

Long-press your own message (within window):
- "Edit" → inline edit mode
- "Delete" → confirmation dialog → deleted

---

## Notifications

### Default Behavior

All messages trigger push notifications.

**Notification content:**
- Sender name
- Channel name
- Message preview (truncated)

**Tap action:** Opens channel, scrolled to message.

### Muting

**How to mute:**
- Long-press channel → "Mute"
- Options: 1 hour / 8 hours / 1 week / Forever

**Muted behavior:**
- No push notifications
- Still shows unread badge in channel list
- Mute icon shown next to channel name
- @mentions break through mute (always notify)

### Announcement Notifications

- Distinct sound/vibration pattern
- Higher priority notification
- Shows "ANNOUNCEMENT" label

---

## Pinned Messages

### Pinning

- Long-press message → "Pin"
- Anyone can pin/unpin
- Max 25 pins per channel

### Accessing Pins

- Pin icon in channel header
- Tap → slides out panel with all pinned messages
- Most recent at top
- Tap pinned message to jump to it in context

### Use Cases

- Site access codes
- Important addresses
- Key decisions
- Reference information

---

## Announcements

### Who Can Post

Owners only. Toggle appears when composing in General channel.

### Display

- Distinct amber border
- Megaphone icon
- "ANNOUNCEMENT" label
- "Acknowledge" button below

### Acknowledgment

- Workers tap "Acknowledge" to confirm they've read
- Owner sees: "4/7 acknowledged"
- Tap to see list of who has / hasn't acknowledged
- Unacknowledged announcements stay highlighted

### Use Cases

- Safety notices
- Schedule changes
- Important updates requiring confirmation

---

## Search

### Accessing

Magnifying glass icon in top navigation of chat screen.

### Basic Search

- Type keywords
- Results appear as you type (debounced)
- Results show: message snippet (highlighted), sender, channel, timestamp
- Tap result to jump to message in context

### Filters

Filter chips below search bar:

| Filter | Options |
|--------|---------|
| **Channel** | Specific channel or "All channels" |
| **From** | Specific person or "Anyone" |
| **Date range** | Today, Last 7 days, Last 30 days, Custom |
| **Type** | All, Photos, Files, Voice, Polls, Locations, Checklists |

Filters combine for precise searches.

### Media Gallery View

When filtering by Photos or Files:
- Option to switch to grid view
- Thumbnails in gallery layout
- Tap thumbnail for full screen
- Option to jump to message context

### Search History

- Recent searches saved locally
- Appear below search bar when empty
- Tap to re-run
- Swipe to remove

---

## Mobile Layout

### Channel List View

Full-screen list, each row:
- Left: Channel icon (🏢 / 🔨 / avatar)
- Channel name (bold if unread)
- Last message preview + sender (gray, truncated)
- Right: Timestamp
- Right: Unread badge (amber circle with count)

Sorted by most recent message.

**FAB** (bottom-right): New message → DM person picker

### Chat View

- Slides in from right on channel tap
- **Header**: Back arrow, channel name, pin icon, menu (⋮)
- **Messages**: Full screen, scrollable
- **Input**: Fixed at bottom

### Gestures

| Gesture | Action |
|---------|--------|
| Swipe right on message | Quick reply |
| Long-press message | Context menu |
| Swipe from left edge | Back to channel list |
| Pull down in chat | Load older messages |

### Thread Modal

- Opens as overlay (slides up from bottom)
- 90% screen height
- "X" to close
- Same input bar at bottom

---

## Permissions Summary

| Action | Worker | Owner |
|--------|--------|-------|
| Send messages | ✓ | ✓ |
| React to messages | ✓ | ✓ |
| Reply / start threads | ✓ | ✓ |
| Pin messages | ✓ | ✓ |
| Create polls/checklists | ✓ | ✓ |
| Share location | ✓ | ✓ |
| Edit/delete own (15 min) | ✓ | ✓ |
| Post announcements | ✗ | ✓ |
| @everyone | ✗ | ✓ |

---

## Technical Notes

### No Offline Support

Online-only. Signal coverage is reliable in operating areas.

### No In-App Calling

Workers use regular phone calls. Keep app focused on messaging.

### No Typing Indicator

Decided against - not needed for this use case.

### Integration with Jobs

Lightweight only:
- Job channels show job name
- Link to job page for details
- No inline job actions from chat

---

## Data Model Updates Required

### New Fields on `chatMessages`

```typescript
chatMessages: defineTable({
  // ... existing fields ...

  // Threading
  replyToId: v.optional(v.id("chatMessages")),  // For quick replies
  threadId: v.optional(v.id("chatThreads")),     // If message is in a thread

  // Message type
  messageType: v.union(
    v.literal("text"),
    v.literal("voice"),
    v.literal("image"),
    v.literal("file"),
    v.literal("poll"),
    v.literal("location"),
    v.literal("checklist"),
    v.literal("announcement")
  ),

  // Rich content (JSON based on messageType)
  richContent: v.optional(v.any()),

  // Reactions
  reactions: v.optional(v.array(v.object({
    emoji: v.string(),
    userId: v.id("users"),
  }))),

  // Edit tracking
  editedAt: v.optional(v.number()),
  isDeleted: v.optional(v.boolean()),

  // Announcement acknowledgments
  acknowledgedBy: v.optional(v.array(v.id("users"))),

  // Pinned
  isPinned: v.optional(v.boolean()),
  pinnedAt: v.optional(v.number()),
  pinnedBy: v.optional(v.id("users")),
})
```

### New Table: `chatThreads`

```typescript
chatThreads: defineTable({
  channelId: v.id("chatChannels"),
  name: v.string(),
  createdBy: v.id("users"),
  createdAt: v.number(),
  lastMessageAt: v.number(),
  messageCount: v.number(),
  starterMessageId: v.id("chatMessages"),  // The message that started the thread
}).index("by_channel", ["channelId"])
```

### New Table: `chatPolls`

```typescript
chatPolls: defineTable({
  messageId: v.id("chatMessages"),
  question: v.string(),
  options: v.array(v.string()),
  allowMultiple: v.boolean(),
  anonymous: v.boolean(),
  endsAt: v.optional(v.number()),
  closedAt: v.optional(v.number()),
  votes: v.array(v.object({
    optionIndex: v.number(),
    userId: v.id("users"),
  })),
})
```

### New Table: `chatChecklists`

```typescript
chatChecklists: defineTable({
  messageId: v.id("chatMessages"),
  title: v.string(),
  items: v.array(v.object({
    text: v.string(),
    completed: v.boolean(),
    completedBy: v.optional(v.id("users")),
    completedAt: v.optional(v.number()),
  })),
})
```

### Updates to `chatChannels`

```typescript
chatChannels: defineTable({
  // ... existing fields ...

  // Muting (per-user, stored separately or in user preferences)
  // Consider a separate chatMutes table
})
```

### New Table: `chatMutes`

```typescript
chatMutes: defineTable({
  userId: v.id("users"),
  channelId: v.id("chatChannels"),
  mutedUntil: v.union(v.number(), v.literal("forever")),
}).index("by_user_channel", ["userId", "channelId"])
```

---

## Implementation Priority

### Phase 1: Core Enhancements
1. Reactions on messages
2. Read receipts (who's seen)
3. Photo/file sharing improvements
4. @ mentions with notifications
5. Edit/delete with 15-min window

### Phase 2: Threading
1. Quick replies (reply-to)
2. Breakout threads
3. Thread modal view

### Phase 3: Special Messages
1. Polls
2. Location sharing
3. Checklists

### Phase 4: Organization Features
1. Pinned messages
2. Announcements with acknowledgment
3. Channel muting

### Phase 5: Search
1. Basic text search
2. Filters (channel, person, date, type)
3. Media gallery view

### Phase 6: Voice Messages
1. Recording UI
2. Playback UI
3. Speed controls
