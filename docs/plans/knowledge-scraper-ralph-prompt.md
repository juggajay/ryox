# Ralph Loop: Australian Building Standards Knowledge Base Scraper

## OBJECTIVE
Scrape Australian building standards content from public sources, process it into chunks, generate real embeddings, and store in Convex database. **ACCURACY IS CRITICAL** - every piece of data must be verified before storage.

## CREDENTIALS
- **Jina Reader API Key**: `jina_8f23cf2ccf4842fe908240f6a2405aadca_vX0BwKYJf_pZhXTQ1TmYo9KgI`
- **Jina Reader Endpoint**: `https://r.jina.ai/{encoded_url}`
- **Gemini API**: Already configured in `.env.local` as `GEMINI_API_KEY`

## TARGET SOURCES (Priority Order)

### Tier 1: WoodSolutions (Primary - Timber/Carpentry Focus)
Start with these - most relevant for carpenters:
| URL | Content Type |
|-----|--------------|
| https://www.woodsolutions.com.au/wood-species | Timber species properties |
| https://www.woodsolutions.com.au/timber-framing | Timber framing guide |
| https://www.woodsolutions.com.au/resources/specifications/span-tables-and-software | Span tables info |
| https://www.woodsolutions.com.au/design-guides | Design guides overview |

### Tier 2: HIA (Housing Industry Association)
| URL | Content Type |
|-----|--------------|
| https://hia.com.au/resources-and-advice/building-it-right/australian-standards/articles/using-as-1684-for-timber-framing | AS 1684 guide |
| https://hia.com.au/resources-and-advice/building-it-right/australian-standards/articles/residential-timber-framed-construction-part-2-non-cyclonic-areas | Non-cyclonic construction |

### Tier 3: ABCB Resources
| URL | Content Type |
|-----|--------------|
| https://www.abcb.gov.au/resources | Resource library |

---

## PHASE 1: Infrastructure Setup

### Step 1.1: Create the scraper action
**File: `convex/knowledgeScraper.ts`**

```typescript
"use node";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const JINA_API_KEY = "jina_8f23cf2ccf4842fe908240f6a2405aadca_vX0BwKYJf_pZhXTQ1TmYo9KgI";

// Scrape a single URL via Jina Reader API
export const scrapeUrl = action({
  args: { url: v.string() },
  handler: async (ctx, { url }): Promise<{ success: boolean; content?: string; error?: string }> => {
    try {
      const response = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${JINA_API_KEY}`,
          "Accept": "text/markdown",
          "X-Return-Format": "markdown",
        },
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const content = await response.text();

      // Basic validation - content should have substance
      if (content.length < 100) {
        return { success: false, error: "Content too short - may be blocked or empty" };
      }

      return { success: true, content };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});
```

### Step 1.2: Create embedding generator
**File: `convex/embeddings.ts`**

```typescript
"use node";
import { v } from "convex/values";
import { action } from "./_generated/server";

// Generate embedding using Gemini gemini-embedding-001 model
// Returns 1536 dimensions to match schema
export const generateEmbedding = action({
  args: { text: v.string() },
  handler: async (ctx, { text }): Promise<{ success: boolean; embedding?: number[]; error?: string }> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "GEMINI_API_KEY not configured" };
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: { parts: [{ text }] },
            outputDimensionality: 1536, // Match schema requirement
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Gemini API error: ${response.status} - ${errorText}` };
      }

      const result = await response.json();
      const embedding = result.embedding?.values;

      if (!embedding || embedding.length !== 1536) {
        return { success: false, error: `Invalid embedding: got ${embedding?.length || 0} dimensions` };
      }

      return { success: true, embedding };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});
```

### Step 1.3: Create chunking utility
**File: `convex/lib/chunker.ts`**

```typescript
// Intelligent text chunking for RAG
export interface Chunk {
  content: string;
  index: number;
  heading?: string;
}

export function chunkContent(markdown: string, maxChunkSize: number = 1500): Chunk[] {
  const chunks: Chunk[] = [];

  // Split by headings (## or ###)
  const sections = markdown.split(/(?=^#{2,3}\s)/m);

  let currentChunk = "";
  let currentHeading = "";
  let chunkIndex = 0;

  for (const section of sections) {
    // Extract heading if present
    const headingMatch = section.match(/^(#{2,3})\s+(.+)$/m);
    if (headingMatch) {
      currentHeading = headingMatch[2].trim();
    }

    // If section fits in current chunk, add it
    if (currentChunk.length + section.length <= maxChunkSize) {
      currentChunk += section;
    } else {
      // Save current chunk if it has content
      if (currentChunk.trim().length > 50) {
        chunks.push({
          content: currentChunk.trim(),
          index: chunkIndex++,
          heading: currentHeading,
        });
      }
      currentChunk = section;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 50) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex,
      heading: currentHeading,
    });
  }

  return chunks;
}

// Clean markdown of navigation, footers, etc.
export function cleanMarkdown(markdown: string): string {
  let cleaned = markdown;

  // Remove common navigation patterns
  cleaned = cleaned.replace(/\[Skip to.*?\]/gi, "");
  cleaned = cleaned.replace(/\[Menu\]|\[Search\]|\[Home\]/gi, "");

  // Remove excessive links that are just navigation
  cleaned = cleaned.replace(/^\s*-\s*\[.{1,30}\]\([^)]+\)\s*$/gm, "");

  // Remove cookie notices, footers
  cleaned = cleaned.replace(/cookie|privacy policy|terms of use|copyright \d{4}/gi, "");

  // Collapse multiple newlines
  cleaned = cleaned.replace(/\n{4,}/g, "\n\n\n");

  return cleaned.trim();
}
```

### Verification Checkpoint 1
Before proceeding, verify:
- [ ] `scrapeUrl` action can fetch https://www.woodsolutions.com.au/timber-framing and return markdown
- [ ] `generateEmbedding` action returns exactly 1536 dimensions
- [ ] Run both manually via Convex dashboard to confirm

**Test command:**
```bash
npx convex run knowledgeScraper:scrapeUrl '{"url":"https://www.woodsolutions.com.au/timber-framing"}'
```

---

## PHASE 2: Content Processing Pipeline

### Step 2.1: Create the full processing action
**Add to `convex/knowledgeScraper.ts`:**

```typescript
import { chunkContent, cleanMarkdown } from "./lib/chunker";

// Process and store a document with real embeddings
export const processDocument = action({
  args: {
    url: v.string(),
    title: v.string(),
  },
  handler: async (ctx, { url, title }): Promise<{
    success: boolean;
    docId?: string;
    chunksStored?: number;
    error?: string;
  }> => {
    // Step 1: Scrape the URL
    console.log(`[1/4] Scraping: ${url}`);
    const scrapeResult = await ctx.runAction(internal.knowledgeScraper.scrapeUrl, { url });
    if (!scrapeResult.success || !scrapeResult.content) {
      return { success: false, error: `Scrape failed: ${scrapeResult.error}` };
    }

    // Step 2: Clean and chunk the content
    console.log(`[2/4] Chunking content (${scrapeResult.content.length} chars)`);
    const cleanedContent = cleanMarkdown(scrapeResult.content);
    const chunks = chunkContent(cleanedContent);

    if (chunks.length === 0) {
      return { success: false, error: "No valid chunks extracted from content" };
    }
    console.log(`    Created ${chunks.length} chunks`);

    // Step 3: Create the document record (global - no org ID)
    const docId = await ctx.runMutation(internal.knowledgeScraper.createDocument, {
      title,
      sourceUrl: url,
    });

    // Step 4: Generate embeddings and store chunks (with rate limiting)
    console.log(`[3/4] Generating embeddings for ${chunks.length} chunks`);
    let storedCount = 0;

    for (const chunk of chunks) {
      // Rate limit: 1 request per 100ms to avoid hitting API limits
      await new Promise(resolve => setTimeout(resolve, 100));

      const embeddingResult = await ctx.runAction(internal.embeddings.generateEmbedding, {
        text: chunk.content,
      });

      if (!embeddingResult.success || !embeddingResult.embedding) {
        console.warn(`    Embedding failed for chunk ${chunk.index}: ${embeddingResult.error}`);
        continue; // Skip this chunk but continue with others
      }

      await ctx.runMutation(internal.knowledgeScraper.storeChunk, {
        docId,
        content: chunk.content,
        embedding: embeddingResult.embedding,
        chunkIndex: chunk.index,
      });

      storedCount++;
      console.log(`    Stored chunk ${chunk.index + 1}/${chunks.length}`);
    }

    console.log(`[4/4] Complete: ${storedCount}/${chunks.length} chunks stored`);

    return {
      success: true,
      docId,
      chunksStored: storedCount,
    };
  },
});

// Internal mutations for document/chunk creation
export const createDocument = internalMutation({
  args: {
    title: v.string(),
    sourceUrl: v.string(),
  },
  handler: async (ctx, { title, sourceUrl }) => {
    return await ctx.db.insert("knowledgeDocs", {
      organizationId: undefined, // Global document
      title,
      sourceUrl,
      uploadedAt: Date.now(),
    });
  },
});

export const storeChunk = internalMutation({
  args: {
    docId: v.id("knowledgeDocs"),
    content: v.string(),
    embedding: v.array(v.float64()),
    chunkIndex: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("knowledgeChunks", args);
  },
});
```

### Verification Checkpoint 2
- [ ] Process one document: WoodSolutions timber-framing
- [ ] Verify chunks are stored with real embeddings (not zeros)
- [ ] Check chunk content is coherent (read a few manually)

**Test command:**
```bash
npx convex run knowledgeScraper:processDocument '{"url":"https://www.woodsolutions.com.au/timber-framing","title":"WoodSolutions: Timber Framing Guide"}'
```

---

## PHASE 3: RAG Search Implementation

### Step 3.1: Update knowledge.ts with vector search
**Replace the `askQuestion` action in `convex/knowledge.ts`:**

```typescript
// Vector search for relevant chunks
export const searchKnowledge = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { query, limit = 5 }): Promise<Array<{
    content: string;
    score: number;
    docTitle: string;
    sourceUrl?: string;
  }>> => {
    // Generate embedding for the query
    const embeddingResult = await ctx.runAction(internal.embeddings.generateEmbedding, {
      text: query,
    });

    if (!embeddingResult.success || !embeddingResult.embedding) {
      console.error("Failed to generate query embedding:", embeddingResult.error);
      return [];
    }

    // Vector search
    const results = await ctx.vectorSearch("knowledgeChunks", "by_embedding", {
      vector: embeddingResult.embedding,
      limit,
    });

    // Enrich with document info
    const enriched = await Promise.all(
      results.map(async (result) => {
        const chunk = await ctx.runQuery(internal.knowledge.getChunk, { chunkId: result._id });
        const doc = chunk ? await ctx.runQuery(internal.knowledge.getDoc, { docId: chunk.docId }) : null;

        return {
          content: chunk?.content || "",
          score: result._score,
          docTitle: doc?.title || "Unknown",
          sourceUrl: doc?.sourceUrl,
        };
      })
    );

    return enriched;
  },
});

// RAG-powered question answering
export const askQuestion = action({
  args: {
    userId: v.id("users"),
    question: v.string(),
  },
  handler: async (ctx, args): Promise<{ answer: string; sources: Array<{ title: string; url?: string }> }> => {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return {
        answer: "AI service not configured. Please contact the administrator.",
        sources: [],
      };
    }

    // Step 1: Search for relevant knowledge chunks
    const relevantChunks = await ctx.runAction(api.knowledge.searchKnowledge, {
      query: args.question,
      limit: 5,
    });

    // Step 2: Build context from retrieved chunks
    const context = relevantChunks.length > 0
      ? relevantChunks.map((c, i) => `[Source ${i + 1}: ${c.docTitle}]\n${c.content}`).join("\n\n---\n\n")
      : "No relevant information found in the knowledge base.";

    // Step 3: Build sources list (deduplicated)
    const sourcesMap = new Map<string, { title: string; url?: string }>();
    for (const chunk of relevantChunks) {
      if (!sourcesMap.has(chunk.docTitle)) {
        sourcesMap.set(chunk.docTitle, { title: chunk.docTitle, url: chunk.sourceUrl });
      }
    }
    const sources = Array.from(sourcesMap.values());

    // Step 4: Call Gemini with RAG context
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a knowledgeable assistant for Australian carpenters. Answer questions based ONLY on the provided context from official building standards and guides.

IMPORTANT RULES:
1. Only use information from the CONTEXT below
2. If the context doesn't contain the answer, say "I don't have specific information on that in my knowledge base"
3. Always cite which source your information comes from using [Source: title]
4. Be practical and specific - carpenters need actionable information
5. If referencing Australian Standards (AS 1684, NCC, etc.), mention the specific standard

CONTEXT:
${context}

QUESTION: ${args.question}

Provide a clear, practical answer with source citations.`,
                },
              ],
            },
          ],
        }),
      }
    );

    const result = await response.json();
    const answer =
      result.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I couldn't generate an answer. Please try again.";

    return { answer, sources };
  },
});

// Internal helpers
export const getChunk = internalQuery({
  args: { chunkId: v.id("knowledgeChunks") },
  handler: async (ctx, { chunkId }) => ctx.db.get(chunkId),
});

export const getDoc = internalQuery({
  args: { docId: v.id("knowledgeDocs") },
  handler: async (ctx, { docId }) => ctx.db.get(docId),
});
```

### Verification Checkpoint 3
- [ ] Vector search returns relevant results for "timber framing"
- [ ] askQuestion uses RAG context (not just Gemini's training)
- [ ] Sources are correctly attributed in responses

---

## PHASE 4: Batch Document Processing

### Step 4.1: Create batch processor
**Add to `convex/knowledgeScraper.ts`:**

```typescript
// All target URLs to scrape
const TARGET_URLS = [
  { url: "https://www.woodsolutions.com.au/timber-framing", title: "WoodSolutions: Timber Framing" },
  { url: "https://www.woodsolutions.com.au/wood-species", title: "WoodSolutions: Wood Species" },
  { url: "https://www.woodsolutions.com.au/resources/specifications/span-tables-and-software", title: "WoodSolutions: Span Tables" },
  { url: "https://www.woodsolutions.com.au/design-guides", title: "WoodSolutions: Design Guides" },
  { url: "https://hia.com.au/resources-and-advice/building-it-right/australian-standards/articles/using-as-1684-for-timber-framing", title: "HIA: Using AS 1684" },
  { url: "https://hia.com.au/resources-and-advice/building-it-right/australian-standards/articles/residential-timber-framed-construction-part-2-non-cyclonic-areas", title: "HIA: Non-Cyclonic Construction" },
  { url: "https://www.abcb.gov.au/resources", title: "ABCB: Resources" },
];

// Process all documents (run this action)
export const processAllDocuments = action({
  args: {},
  handler: async (ctx): Promise<{
    processed: number;
    failed: number;
    results: Array<{ url: string; success: boolean; error?: string; chunks?: number }>;
  }> => {
    const results: Array<{ url: string; success: boolean; error?: string; chunks?: number }> = [];
    let processed = 0;
    let failed = 0;

    for (const target of TARGET_URLS) {
      console.log(`\n========================================`);
      console.log(`Processing: ${target.title}`);
      console.log(`URL: ${target.url}`);
      console.log(`========================================`);

      // Check if already processed (by URL)
      const existing = await ctx.runQuery(internal.knowledgeScraper.getDocByUrl, {
        url: target.url,
      });

      if (existing) {
        console.log(`SKIPPED: Already exists with ${existing.chunkCount} chunks`);
        results.push({ url: target.url, success: true, chunks: existing.chunkCount });
        processed++;
        continue;
      }

      // Process the document
      const result = await ctx.runAction(api.knowledgeScraper.processDocument, {
        url: target.url,
        title: target.title,
      });

      if (result.success) {
        console.log(`SUCCESS: Stored ${result.chunksStored} chunks`);
        results.push({ url: target.url, success: true, chunks: result.chunksStored });
        processed++;
      } else {
        console.error(`FAILED: ${result.error}`);
        results.push({ url: target.url, success: false, error: result.error });
        failed++;
      }

      // Rate limit between documents (2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n========================================`);
    console.log(`BATCH COMPLETE: ${processed} processed, ${failed} failed`);
    console.log(`========================================`);

    return { processed, failed, results };
  },
});

export const getDocByUrl = internalQuery({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    const docs = await ctx.db.query("knowledgeDocs").collect();
    const doc = docs.find(d => d.sourceUrl === url);
    if (!doc) return null;

    const chunks = await ctx.db
      .query("knowledgeChunks")
      .withIndex("by_doc", q => q.eq("docId", doc._id))
      .collect();

    return { ...doc, chunkCount: chunks.length };
  },
});
```

### Verification Checkpoint 4
- [ ] All 7 URLs processed successfully
- [ ] No duplicate documents
- [ ] Total chunks > 20 (reasonable amount of knowledge)

---

## PHASE 5: Accuracy Validation

### Test Questions
Run these through the AI to verify accuracy:

| # | Question | Expected Behavior |
|---|----------|-------------------|
| 1 | "What timber species are suitable for structural framing in Australia?" | Should cite WoodSolutions, mention MGP grades |
| 2 | "What is AS 1684?" | Should cite HIA, explain it's the timber framing standard |
| 3 | "How do I determine floor joist sizes?" | Should mention span tables, load requirements |
| 4 | "What is the NCC?" | Should cite ABCB, explain National Construction Code |

### Verification Checkpoint 5
- [ ] Test questions return relevant, accurate answers
- [ ] Answers cite actual sources from knowledge base
- [ ] No hallucinated standards or fake requirements
- [ ] "I don't know" returned for questions outside knowledge base

---

## STATE TRACKING

Create/update `docs/plans/scraper-progress.json` after each phase:

```json
{
  "currentPhase": 1,
  "checkpoints": {
    "1": { "passed": false, "timestamp": null },
    "2": { "passed": false, "timestamp": null },
    "3": { "passed": false, "timestamp": null },
    "4": { "passed": false, "timestamp": null },
    "5": { "passed": false, "timestamp": null }
  },
  "documentsProcessed": [],
  "documentsFailed": [],
  "totalChunks": 0,
  "lastUpdated": null
}
```

---

## COMPLETION CRITERIA

Output the following ONLY when ALL conditions are met:
1. All 5 checkpoints passed
2. At least 5 of 7 URLs successfully processed
3. At least 20 total chunks stored
4. Vector search returns relevant results
5. RAG answers cite real sources

```
<promise>KNOWLEDGE BASE COMPLETE</promise>
```

---

## ERROR RECOVERY

If stuck:
1. Check `scraper-progress.json` for current state
2. Review Convex logs for specific errors
3. If Jina fails: Check rate limits, try single URL first
4. If Gemini fails: Check API key, try smaller text
5. If embeddings wrong size: Verify model is `gemini-embedding-001` with `outputDimensionality: 1536`
