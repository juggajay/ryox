# AI Assistant Design: On-Site Carpenter Knowledge Base

## User Story

A carpenter on-site needs specific, actionable information quickly. They pull out their phone, ask a question, and get a precise answer they can use immediately - not vague references to standards they'd need to look up.

**Example transformation:**

| Before | After |
|--------|-------|
| "Check AS 1684 span tables" | "**190x45 Spotted Gum** - max span 4.2m for deck loads" |

---

## Architecture Overview

### Hybrid Knowledge Base

Two data stores working together:

```
┌─────────────────────────────────────────────────────┐
│                  USER QUESTION                      │
│     "What size bearer for 3.6m under floor?"        │
└─────────────────────┬───────────────────────────────┘
                      │
          ┌───────────▼───────────┐
          │   QUESTION CLASSIFIER │
          │   (Is this a span     │
          │    table lookup?)     │
          └───────────┬───────────┘
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
┌─────────────────┐      ┌─────────────────┐
│ STRUCTURED DB   │      │   RAG SEARCH    │
│ (Span tables,   │      │ (General info,  │
│  precise data)  │      │  how-to, code)  │
└────────┬────────┘      └────────┬────────┘
         │                        │
         └────────────┬───────────┘
                      ▼
          ┌───────────────────────┐
          │  SMART FOLLOW-UPS     │
          │  (Missing: load type, │
          │   spacing, species?)  │
          └───────────┬───────────┘
                      ▼
          ┌───────────────────────┐
          │  SPECIFIC ANSWER      │
          │  "Use 170x45 LVL      │
          │   (Wesbeam E14)"      │
          └───────────────────────┘
```

**1. Structured Tables** - Span data, fastener specs, timber grades (queryable with precise lookups)

**2. RAG Chunks** - General knowledge, how-to methods, code explanations (semantic search)

---

## Data Schema

### Core Tables

```typescript
// Span table entries - the core lookup data
spanTables: defineTable({
  memberType: v.union(v.literal("bearer"), v.literal("joist"), v.literal("rafter"), v.literal("lintel"), v.literal("stud"), v.literal("decking_joist")),
  timberType: v.union(v.literal("LVL"), v.literal("MGP10"), v.literal("MGP12"), v.literal("MGP15"), v.literal("hardwood")),
  species: v.optional(v.string()), // "spotted_gum", "blackbutt", etc.
  stressGrade: v.optional(v.string()), // "F14", "F17", "F27"
  size: v.string(), // "90x45", "140x45", "190x45"
  loadType: v.union(v.literal("floor"), v.literal("roof"), v.literal("deck"), v.literal("balcony")),
  spacing: v.number(), // 450, 600, 900 mm
  maxSpan: v.number(), // mm - THE ANSWER
  continuous: v.boolean(), // single vs continuous span
  source: v.string(), // "Wesbeam E14", "Boral Hardwood Tables"
  sourcePage: v.optional(v.string()),
})

// Fastener requirements
fasteners: defineTable({
  connection: v.string(), // "joist-to-bearer", "bearer-to-post"
  method: v.string(), // "skew nail", "joist hanger", "bolted"
  fastenerSpec: v.string(), // "2x 75mm nails", "M12 bolt"
  timberType: v.optional(v.string()), // specific requirements for hardwood
  notes: v.optional(v.string()), // "Pre-drill for hardwood"
  source: v.string(),
})

// Timber grades and species
timberGrades: defineTable({
  grade: v.string(), // "MGP10", "F17", "LVL-E14"
  species: v.optional(v.string()),
  stressGrade: v.string(),
  durabilityClass: v.optional(v.number()), // 1-4
  commonUses: v.array(v.string()),
  treatmentRequired: v.string(), // "none", "H2", "H3", "H4"
  inGroundOk: v.boolean(),
})
```

### Hardwood-Specific Data

```typescript
hardwoodSpans: defineTable({
  species: v.string(), // "spotted_gum", "blackbutt", "ironbark", "merbau"
  stressGrade: v.string(), // "F14", "F17", "F22", "F27"
  memberType: v.string(),
  size: v.string(),
  maxSpan: v.number(),
  deckingSpacing: v.optional(v.number()), // for decking joists
  boardSpacing: v.optional(v.string()), // "5mm gap"
  treatment: v.string(), // hardwood often "none"
  durabilityClass: v.number(),
  source: v.string(),
})
```

---

## Data Sources

### Tier 1 - High Priority (Timber Framing Focus)

| Source | Data | Format |
|--------|------|--------|
| **Wesbeam Technical Guide** | LVL spans - bearers, joists, lintels, rafters | PDF |
| **Hyne Timber Design Guide** | Glulam + LVL spans, connections | PDF |
| **WoodSolutions Hardwood Guides** | Spotted Gum, Blackbutt, Ironbark spans | PDF + web |
| **Boral Timber Technical** | Hardwood bearer/joist spans, decking | PDF |
| **Tilling Timber Span Tables** | F14/F17/F27 hardwood spans | PDF |
| **Outdoor Timber Decking Guide** | Merbau, Spotted Gum decking specs | PDF + web |
| **MiTek Fixing Guide** | Connectors, nail plates, joist hangers | PDF |

### Tier 2 - Gap Fillers

| Source | Data | Format |
|--------|------|--------|
| **CHH Hyne Beam Calculator** | I-joist and LVL sizing | Web scrape |
| **ITW Proline Catalogue** | Brackets, straps, fasteners | PDF |
| **Multinail Technical** | Roof truss connections, tie-downs | PDF |

### Tier 3 - Code/Compliance

| Source | Data | Format |
|--------|------|--------|
| **HIA Technical Notes** | AS 1684 guidance | Web (already scraped) |
| **ABCB Housing Provisions** | NCC Volume 2 requirements | Web |

### Hardwood Species Coverage

| Species | Stress Grade | Common Uses |
|---------|--------------|-------------|
| Spotted Gum | F27 | Decking, bearers, posts |
| Blackbutt | F17 | Decking, flooring, framing |
| Ironbark | F27 | Heavy structural, posts |
| Tallowwood | F17 | Decking, cladding |
| Merbau | F14 | Decking (imported) |
| Jarrah | F14-F17 | Decking, outdoor |
| Victorian Ash | F8 | Internal framing, flooring |

### Extraction Pipeline

```
PDF → Jina AI (convert to markdown) → Gemini (extract to JSON) → Validate → Store in Convex
```

---

## Smart Follow-up Logic

### Required Parameters by Query Type

```typescript
queryTypes: {
  "bearer_sizing": {
    required: ["span", "loadType", "timberPreference"],
    optional: ["spacing", "continuous"],
    defaults: { spacing: 450, continuous: false }
  },
  "joist_span": {
    required: ["size", "timberType", "loadType"],
    optional: ["spacing"],
    defaults: { spacing: 450 }
  },
  "decking_joist": {
    required: ["span", "timberType"],
    optional: ["boardThickness"],
    defaults: { boardThickness: 19, spacing: 450 }
  },
  "hardwood_bearer": {
    required: ["span", "species", "loadType"],
    optional: ["spacing"],
    defaults: { spacing: 450 }
  }
}
```

### Follow-up Questions

| Missing Param | Question | Quick Options |
|---------------|----------|---------------|
| `span` | "What span do you need to cover?" | Free text |
| `loadType` | "What's it supporting?" | Floor / Deck / Roof / Balcony |
| `timberType` | "What timber?" | LVL / Hardwood / MGP Pine |
| `species` | "Which hardwood?" | Spotted Gum / Blackbutt / Merbau / Ironbark |
| `spacing` | "What centres?" | 450mm / 600mm |
| `size` | "What size member?" | Free text |

### Example Conversation Flow

```
USER: "Bearer size for 4m span"

AI DETECTS:
  - Query type: bearer_sizing
  - Has: span (4000mm)
  - Missing: loadType, timberPreference

AI ASKS: "What's sitting on it - floor joists or deck joists?"

USER: "Deck"

AI DETECTS:
  - Has: span, loadType=deck
  - Missing: timberPreference

AI ASKS: "LVL or hardwood?"

USER: "Spotted gum"

AI QUERIES: memberType=bearer, maxSpan>=4000, species=spotted_gum, loadType=deck

AI RESPONDS:
  "✓ 190x45 SPOTTED GUM
   Max span: 4.2m for deck loads

   Also works: 140x65 (less depth)
   Fixing: 2x M12 bolts to post
   Treatment: None needed (Class 1)

   📖 Boral Hardwood Span Tables"
```

### Speed Shortcuts

Pattern detection for combined input (skips follow-ups):

```typescript
patterns: [
  { regex: /(\d+)x(\d+)\s*(lvl|spotted gum|blackbutt|mgp\d+)/i,
    extracts: ["width", "depth", "timber"] },
  { regex: /(\d+\.?\d*)\s*m\s*span/i,
    extracts: ["span"] },
  { regex: /(floor|deck|roof|balcony)/i,
    extracts: ["loadType"] },
  { regex: /at\s*(\d+)\s*(mm|centres)/i,
    extracts: ["spacing"] },
]
```

Examples that skip questions:
- "190x45 spotted gum bearer span" → Direct answer
- "LVL floor joist 140x45 at 450" → Direct answer

---

## Response Format

### Principles

- Mobile-first (small screen, bright sunlight, one-handed use)
- Answer FIRST, details second
- Scannable in 2 seconds
- Source always visible

### Standard Response Template

```
┌─────────────────────────────────────────┐
│  ✓  190x45 SPOTTED GUM                  │  ← THE ANSWER (bold, prominent)
│     Max span: 4.2m                      │  ← Key spec
├─────────────────────────────────────────┤
│  Alternatives:                          │
│  • 170x45 LVL (E14) - 4.5m max         │  ← Options
│  • 240x45 MGP10 - 4.1m max             │
├─────────────────────────────────────────┤
│  Fixing: 2x M12 bolts to post          │  ← Related info
│  Treatment: None needed (Class 1)       │
├─────────────────────────────────────────┤
│  📖 Boral Hardwood Span Tables p.23    │  ← Source
└─────────────────────────────────────────┘
```

### Response Types

**1. Span/Sizing Query**
```
✓ 140x45 LVL (Wesbeam E14)
  Max span: 3.9m at 450 centres

  Also works: 190x45 MGP10 (3.8m)

  📖 Wesbeam Residential Guide
```

**2. Yes/No Compliance Query**
```
✓ YES - 90x90 post is OK for 2.4m height

  Requirements:
  • Max height: 2.7m (you're under)
  • Bracing: Required at top
  • Fixing: 2x M12 to bearer

  📖 AS1684.2 Table 27
```

**3. How-To Query**
```
BEARER TO POST CONNECTION

  1. Check bearer is flush to post face
  2. Drill 2x 14mm holes, 50mm from edges
  3. Install M12 bolts with washers both sides
  4. Torque to hand-tight + ¼ turn

  ⚠️ Hardwood: Pre-drill to avoid splitting

  📖 MiTek Connection Guide
```

**4. Need More Info Response**
```
⚠️ NEED MORE INFO

  For F14 hardwood lintel over 2.1m door:

  What's above it?
  ○ Single storey (roof only)
  ○ Double storey (floor above)
  ○ Just cladding (non-load bearing)
```

### Formatting Rules

| Element | Style |
|---------|-------|
| Primary answer | Bold, larger text, top |
| Numbers/sizes | Always include units (mm, m) |
| Alternatives | Bullet list, indented |
| Warnings | ⚠️ prefix |
| Sources | 📖 prefix, bottom |
| Steps | Numbered list |

---

## Implementation Phases

### Phase 1: Structured Data Foundation
1. Create Convex schema for span tables, fasteners, timber grades
2. Build PDF extraction pipeline (Jina + Gemini)
3. Extract Wesbeam LVL guide (highest impact)
4. Extract Boral hardwood span tables
5. Test basic queries

### Phase 2: Smart Query Logic
1. Build question classifier (span lookup vs general RAG)
2. Implement follow-up question logic
3. Add pattern detection for speed shortcuts
4. Integrate structured + RAG responses

### Phase 3: Response Formatting
1. Build response templates
2. Mobile-optimized UI components
3. Add copy-to-clipboard for answers
4. Source linking

### Phase 4: Data Expansion
1. Add remaining Tier 1 sources
2. Fastener/connection data (MiTek)
3. Tier 2 sources as needed
4. User feedback loop for gaps

---

## Success Criteria

1. **Specific answers** - "190x45 Spotted Gum" not "check the span tables"
2. **Fast** - Answer or first follow-up in <2 seconds
3. **Accurate** - All answers cite specific sources
4. **Complete** - Covers 90% of on-site timber queries without "I don't know"
5. **Mobile-friendly** - Usable one-handed in sunlight
