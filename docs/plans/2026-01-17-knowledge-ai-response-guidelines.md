# Knowledge AI Response Guidelines

## Problem

Workers ask specific questions and want simple, actionable answers. Current RAG system returns verbose responses with too much context, overwhelming users who just need quick guidance on-site.

## Design Principles

### 1. Answer Length: Short by Default

- **1-2 sentences max** for direct answers
- Offer to expand: *"Want sizing details?"* or *"Need the full span table?"*
- Never dump paragraphs unprompted

### 2. Assumptions: State and Verify

Assume the common case for carpentry work:
- 450mm centres (standard joist spacing)
- Single span (not continuous)
- Residential load (not commercial)
- Non-cyclonic region

**Pattern:**
> "Assuming standard deck setup (450 centres, single span) - 190x45 Merbau gets you 3.2m max. That match your situation?"

### 3. Sources: Tiny Inline Hints

- Compact inline reference: *"...up to 4m span *(Boral specs)**"*
- No citation blocks or URL dumps
- Source is traceable if user wants to verify

### 4. Safety & Compliance: Always Prominent

Non-negotiable items are **always mentioned**, never hidden behind "want more info?":
- Fixing requirements that prevent splitting
- Treatment requirements for ground contact
- Load-bearing limitations
- Code compliance notes (NCC, AS 1684)

**Pattern:**
> "**Heads up:** pre-drill all fixings - merbau splits easily."

### 5. Vague Questions: Ask First

When user question lacks specifics, ask what matters before answering:

| Vague Question | AI Response |
|----------------|-------------|
| "What timber for bearers?" | "What matters most - strength, cost, or looks?" |
| "How do I fix this?" | "What are you fixing to - timber frame or steel?" |
| "Is this span OK?" | "What size and timber are you using?" |

Don't dump all options - guide to the right answer.

### 6. Proactive Guidance: Offer the Gotcha

Anticipate what the user didn't know to ask:

> **User:** Can I use spotted gum for deck bearers?
>
> **AI:** Yes, Spotted Gum (F27) is great for bearers *(Boral specs)*. 190x45 at 450 centres gives you 4.2m max.
>
> *Want the fixing specs? Hardwood needs specific nail sizes.*

## Example Interactions

### Specific Question
> **Worker:** What's the max span for 140x45 LVL bearer at 450 centres?
>
> **AI:** 2.8m for floor load *(Wesbeam E14)*. Need deck or balcony instead?

### Question Needing Clarification
> **Worker:** What timber should I use for the deck?
>
> **AI:** What matters most - durability, cost, or appearance?
>
> **Worker:** Durability, it's coastal
>
> **AI:** Spotted Gum (F27, Class 1 durability) - no treatment needed, handles salt air *(Boral specs)*. **Heads up:** use stainless fixings near the coast.

### Safety-Critical Answer
> **Worker:** Can I put the bearer posts in the ground?
>
> **AI:** Only with Class 1 durability timber (Spotted Gum, Ironbark) or H5-treated pine *(AS 1684)*. **Heads up:** H4 is NOT enough for in-ground - it's for above-ground contact only.
>
> *Want treatment class details?*

## Implementation Notes

### Prompt Engineering

The Gemini system prompt should enforce:
```
RESPONSE RULES:
1. Maximum 2 sentences for direct answer
2. State assumptions explicitly
3. Sources inline: "...value *(Source)*"
4. Safety notes use "Heads up:" prefix
5. End with ONE follow-up offer if relevant
6. If question is vague, ask ONE clarifying question first
```

### Query Classification

Before RAG, classify query intent:
- `specific_lookup` → Direct answer pattern
- `vague_exploration` → Ask clarifying question first
- `safety_critical` → Always include compliance note

### Chunk Selection

- Reduce from 5 chunks to **2-3 most relevant**
- Filter by score threshold (e.g., >0.7 similarity)
- Prefer chunks matching detected category (NCC for compliance, manufacturer for products)

## Success Metrics

- Average response length < 50 words
- User asks follow-up "tell me more" < 30% of time (means we got it right first try)
- Safety notes included 100% of time when applicable
