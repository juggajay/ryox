# Knowledge AI Conversation Memory Design

## Overview

Add conversation memory to the Knowledge AI so it remembers the last 10-20 exchanges for 24 hours. This enables follow-up questions like "what about 600 centres instead?" without re-explaining context.

## Approach: Balanced Memory

**Trade-offs accepted:**
- +50-100ms latency per query (acceptable)
- ~1500 extra tokens per request (within budget)
- 24hr TTL prevents stale context confusion

**Not included:**
- Long-term user preference learning
- Job/project-specific context
- Cross-session memory beyond 24hrs

## Data Model

```typescript
knowledgeConversations: defineTable({
  userId: v.id("users"),
  question: v.string(),
  answer: v.string(),
  parsedContext: v.optional(v.object({
    memberType: v.optional(v.string()),
    timberType: v.optional(v.string()),
    size: v.optional(v.string()),
    span: v.optional(v.number()),
    loadType: v.optional(v.string()),
  })),
  createdAt: v.number(),
  expiresAt: v.number(), // createdAt + 24hrs
})
  .index("by_user", ["userId"])
  .index("by_expires", ["expiresAt"])
```

## Prompt Injection Format

```
RECENT CONVERSATION (last 24hrs):
---
[2 mins ago] User asked about 140x45 LVL joist spans → You answered: 3.2m max at 450 centres
[15 mins ago] User asked about deck bearer sizing → You answered: 190x45 hardwood for 3.6m span
---

CURRENT QUESTION: What about 600 centres instead?
```

**Constraints:**
- Max 10 exchanges (~1500 tokens)
- Compressed format (question summary → answer summary)
- Relative timestamps for relevance

## Cleanup Mechanism

1. **Lazy cleanup**: Filter expired on every query
2. **Scheduled cleanup**: Hourly cron deletes expired entries

## Implementation Files

- `convex/schema.ts` - Add knowledgeConversations table
- `convex/knowledge.ts` - Add save/fetch/cleanup functions
- `convex/smartKnowledge.ts` - Inject history into prompt
- `convex/crons.ts` - Hourly cleanup job

## Success Criteria

- Follow-up questions work: "what about X instead?"
- No noticeable latency increase (< 100ms)
- Memory auto-expires after 24hrs
- Scoped per-user (no cross-user leakage)
