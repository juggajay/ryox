import { v } from "convex/values";
import { mutation, query, action, internalQuery, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Add a document directly (without embeddings for simplicity)
export const addDocument = mutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    content: v.string(),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role !== "owner") throw new Error("Only owners can add documents");

    // Create document
    const docId = await ctx.db.insert("knowledgeDocs", {
      organizationId: user.organizationId,
      title: args.title,
      sourceUrl: args.sourceUrl,
      uploadedAt: Date.now(),
    });

    // Store content as single chunk (simplified)
    await ctx.db.insert("knowledgeChunks", {
      docId,
      content: args.content,
      embedding: new Array(1536).fill(0), // Placeholder
      chunkIndex: 0,
    });

    return docId;
  },
});

// List documents
// OPTIMIZED: Fix N+1 pattern - fetch all chunks once instead of per-document
export const listDocuments = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    // Get org docs and global docs
    const docs = await ctx.db.query("knowledgeDocs").collect();

    const filtered = docs.filter(
      (d) => d.organizationId === user.organizationId || d.organizationId === undefined
    );

    // OPTIMIZATION: Fetch ALL chunks once, then count by docId
    // Previously: N+1 queries (1 per document)
    // Now: Single query + in-memory grouping
    const allChunks = await ctx.db.query("knowledgeChunks").collect();

    // Create chunk count map for O(1) lookup
    const chunkCountMap = new Map<string, number>();
    for (const chunk of allChunks) {
      const docIdStr = chunk.docId.toString();
      chunkCountMap.set(docIdStr, (chunkCountMap.get(docIdStr) || 0) + 1);
    }

    // Enrich documents with counts (no additional queries)
    const enriched = filtered.map((doc) => ({
      ...doc,
      chunkCount: chunkCountMap.get(doc._id.toString()) || 0,
      isGlobal: doc.organizationId === undefined,
    }));

    return enriched;
  },
});

// Get document content
export const getDocumentContent = query({
  args: {
    userId: v.id("users"),
    docId: v.id("knowledgeDocs"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const doc = await ctx.db.get(args.docId);
    if (!doc) return null;
    if (doc.organizationId && doc.organizationId !== user.organizationId) {
      return null;
    }

    const chunks = await ctx.db
      .query("knowledgeChunks")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .collect();

    return {
      ...doc,
      content: chunks.map((c) => c.content).join("\n\n"),
    };
  },
});

// Delete document and its chunks
export const deleteDocument = mutation({
  args: {
    userId: v.id("users"),
    docId: v.id("knowledgeDocs"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role !== "owner") throw new Error("Only owners can delete documents");

    const doc = await ctx.db.get(args.docId);
    if (!doc) throw new Error("Document not found");
    if (doc.organizationId && doc.organizationId !== user.organizationId) {
      throw new Error("Unauthorized");
    }

    // Delete all chunks
    const chunks = await ctx.db
      .query("knowledgeChunks")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .collect();

    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }

    // Delete document
    await ctx.db.delete(args.docId);

    return { success: true };
  },
});

// Internal queries for RAG
export const getChunk = internalQuery({
  args: { chunkId: v.id("knowledgeChunks") },
  handler: async (ctx, { chunkId }) => ctx.db.get(chunkId),
});

export const getDoc = internalQuery({
  args: { docId: v.id("knowledgeDocs") },
  handler: async (ctx, { docId }) => ctx.db.get(docId),
});

// ============================================
// QUERY CACHE - Speeds up repeated questions
// ============================================

// Simple hash function for cache keys
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

// Normalize query for cache matching
function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Check cache for existing answer
export const getCachedAnswer = internalQuery({
  args: { queryHash: v.string() },
  handler: async (ctx, { queryHash }) => {
    return await ctx.db
      .query("knowledgeCache")
      .withIndex("by_query_hash", (q) => q.eq("queryHash", queryHash))
      .first();
  },
});

// Update cache hit count
export const updateCacheHit = internalMutation({
  args: { cacheId: v.id("knowledgeCache") },
  handler: async (ctx, { cacheId }) => {
    const cached = await ctx.db.get(cacheId);
    if (cached) {
      await ctx.db.patch(cacheId, {
        hitCount: cached.hitCount + 1,
        lastHitAt: Date.now(),
      });
    }
  },
});

// Store answer in cache
export const cacheAnswer = internalMutation({
  args: {
    queryHash: v.string(),
    normalizedQuery: v.string(),
    answer: v.string(),
    sources: v.array(v.object({
      title: v.string(),
      url: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    // Check if already cached (race condition prevention)
    const existing = await ctx.db
      .query("knowledgeCache")
      .withIndex("by_query_hash", (q) => q.eq("queryHash", args.queryHash))
      .first();

    if (existing) {
      return existing._id;
    }

    // Clean up old cache entries (keep last 1000)
    const allCached = await ctx.db
      .query("knowledgeCache")
      .withIndex("by_created_at")
      .order("desc")
      .collect();

    if (allCached.length > 1000) {
      // Delete oldest entries beyond 1000
      const toDelete = allCached.slice(1000);
      for (const entry of toDelete) {
        await ctx.db.delete(entry._id);
      }
    }

    return await ctx.db.insert("knowledgeCache", {
      queryHash: args.queryHash,
      normalizedQuery: args.normalizedQuery,
      answer: args.answer,
      sources: args.sources,
      createdAt: Date.now(),
      hitCount: 1,
      lastHitAt: Date.now(),
    });
  },
});

// ============================================
// CONVERSATION MEMORY - Remembers recent exchanges
// ============================================

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const MAX_CONVERSATION_HISTORY = 10;

// Summarize answer for token efficiency (keep under 100 chars)
function summarizeAnswer(answer: string): string {
  // Remove markdown formatting
  let summary = answer.replace(/\*\*/g, '').replace(/\n/g, ' ').trim();
  // Take first sentence or first 100 chars
  const firstSentence = summary.match(/^[^.!?]+[.!?]/);
  if (firstSentence && firstSentence[0].length <= 150) {
    return firstSentence[0];
  }
  return summary.length > 100 ? summary.substring(0, 100) + '...' : summary;
}

// Format relative time for prompt
function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  return 'earlier';
}

// Save a conversation exchange
export const saveConversation = internalMutation({
  args: {
    userId: v.id("users"),
    question: v.string(),
    answer: v.string(),
    parsedContext: v.optional(v.object({
      memberType: v.optional(v.string()),
      timberType: v.optional(v.string()),
      species: v.optional(v.string()),
      size: v.optional(v.string()),
      span: v.optional(v.number()),
      spacing: v.optional(v.number()),
      loadType: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Save the exchange
    await ctx.db.insert("knowledgeConversations", {
      userId: args.userId,
      question: args.question,
      answerSummary: summarizeAnswer(args.answer),
      parsedContext: args.parsedContext,
      createdAt: now,
      expiresAt: now + TWENTY_FOUR_HOURS,
    });

    // Enforce max history limit per user (delete oldest beyond 10)
    const userHistory = await ctx.db
      .query("knowledgeConversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    if (userHistory.length > MAX_CONVERSATION_HISTORY) {
      const toDelete = userHistory.slice(MAX_CONVERSATION_HISTORY);
      for (const entry of toDelete) {
        await ctx.db.delete(entry._id);
      }
    }
  },
});

// Get conversation history for a user (last 10, not expired)
export const getConversationHistory = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const now = Date.now();

    const history = await ctx.db
      .query("knowledgeConversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gt(q.field("expiresAt"), now))
      .order("desc")
      .take(MAX_CONVERSATION_HISTORY);

    return history;
  },
});

// Format conversation history for prompt injection
export const formatHistoryForPrompt = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const now = Date.now();

    const history = await ctx.db
      .query("knowledgeConversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.gt(q.field("expiresAt"), now))
      .order("desc")
      .take(MAX_CONVERSATION_HISTORY);

    if (history.length === 0) {
      return null;
    }

    // Format oldest-first for natural reading order
    const lines = history.reverse().map((entry) => {
      const timeAgo = formatRelativeTime(entry.createdAt);
      const contextHint = entry.parsedContext?.memberType
        ? ` (${entry.parsedContext.memberType}${entry.parsedContext.timberType ? ', ' + entry.parsedContext.timberType : ''})`
        : '';
      return `[${timeAgo}] "${entry.question}"${contextHint} → ${entry.answerSummary}`;
    });

    return `RECENT CONVERSATION (last 24hrs):\n---\n${lines.join('\n')}\n---`;
  },
});

// Cleanup expired conversations (called by cron)
export const cleanupExpiredConversations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const expired = await ctx.db
      .query("knowledgeConversations")
      .withIndex("by_expires")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    for (const entry of expired) {
      await ctx.db.delete(entry._id);
    }

    return { deleted: expired.length };
  },
});

// Vector search for relevant chunks (internal action)
export const searchKnowledge = internalAction({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    minScore: v.optional(v.number()),
  },
  handler: async (ctx, { query, limit = 3, minScore = 0.6 }): Promise<Array<{
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

    // Vector search - fetch extra to allow filtering
    const results = await ctx.vectorSearch("knowledgeChunks", "by_embedding", {
      vector: embeddingResult.embedding,
      limit: limit + 2, // Fetch extra in case some are below threshold
    });

    // Filter by minimum score and limit
    const filtered = results
      .filter((r) => r._score >= minScore)
      .slice(0, limit);

    console.log(`Knowledge search: ${results.length} results, ${filtered.length} above ${minScore} threshold`);

    // OPTIMIZED: Parallel fetch all chunks first, then all docs
    // Previously: sequential chunk→doc per result (N*2 serial queries)
    // Now: parallel chunks, then parallel docs (2 parallel batches)

    // Step 1: Fetch all chunks in parallel
    const chunks = await Promise.all(
      filtered.map((result) =>
        ctx.runQuery(internal.knowledge.getChunk, { chunkId: result._id })
      )
    );

    // Step 2: Get unique doc IDs and fetch all docs in parallel
    const docIds = [...new Set(chunks.filter(c => c).map(c => c!.docId))];
    const docs = await Promise.all(
      docIds.map((docId) =>
        ctx.runQuery(internal.knowledge.getDoc, { docId })
      )
    );

    // Step 3: Create doc lookup map for O(1) access
    const docMap = new Map(docs.filter(d => d).map(d => [d!._id, d!]));

    // Step 4: Combine results
    const enriched = filtered.map((result, i) => {
      const chunk = chunks[i];
      const doc = chunk ? docMap.get(chunk.docId) : null;
      return {
        content: chunk?.content || "",
        score: result._score,
        docTitle: doc?.title || "Unknown",
        sourceUrl: doc?.sourceUrl,
      };
    });

    return enriched;
  },
});

// RAG-powered question answering
// OPTIMIZED: Uses query cache and conversation memory
export const askQuestion = action({
  args: {
    userId: v.id("users"),
    question: v.string(),
    conversationHistory: v.optional(v.string()), // Pre-formatted history from formatHistoryForPrompt
  },
  handler: async (ctx, args): Promise<{ answer: string; sources: Array<{ title: string; url?: string }> }> => {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return {
        answer: "AI service not configured. Please contact the administrator.",
        sources: [],
      };
    }

    // OPTIMIZATION: Check cache first (but only for queries without conversation context)
    // If there's conversation history, skip cache to ensure contextual responses
    const normalized = normalizeQuery(args.question);
    const queryHash = simpleHash(normalized);

    if (!args.conversationHistory) {
      const cached = await ctx.runQuery(internal.knowledge.getCachedAnswer, { queryHash });
      if (cached) {
        console.log(`Cache HIT for: "${args.question}" (hash: ${queryHash})`);
        ctx.runMutation(internal.knowledge.updateCacheHit, { cacheId: cached._id });
        return {
          answer: cached.answer,
          sources: cached.sources,
        };
      }
    }

    console.log(`Processing: "${args.question}" (with${args.conversationHistory ? '' : 'out'} conversation history)`);

    // Step 1: Search for relevant knowledge chunks using RAG
    const relevantChunks: Array<{
      content: string;
      score: number;
      docTitle: string;
      sourceUrl?: string;
    }> = await ctx.runAction(internal.knowledge.searchKnowledge, {
      query: args.question,
      limit: 5,
    });
    console.log(`Found ${relevantChunks.length} relevant chunks`);

    // Step 2: Build context from retrieved chunks
    const ragContext = relevantChunks.length > 0
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

    // Step 4: Build prompt with optional conversation history
    const conversationSection = args.conversationHistory
      ? `\n${args.conversationHistory}\n\nUse the conversation history above when the user references previous topics (e.g., "what about...", "and for...", "instead of...").\n`
      : '';

    // Step 5: Call Gemini with RAG context + conversation history
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a concise assistant for Australian carpenters on job sites. They need quick, accurate answers - not essays.

RESPONSE RULES:
1. Maximum 2 sentences for your direct answer
2. Sources inline and compact: "...value *(Source)*" - never citation blocks
3. State assumptions: "Assuming standard setup (450 centres)..."
4. Safety/compliance notes use "Heads up:" prefix and are ALWAYS included - never hide these
5. End with ONE short follow-up offer if relevant: "Want the span table?" or "Need fixing specs?"
6. If question is vague, ask ONE clarifying question: "What matters most - strength, cost, or looks?"
${conversationSection}
KNOWLEDGE BASE CONTEXT:
${ragContext}

CURRENT QUESTION: ${args.question}

Remember: 1-2 sentences max, inline sources, safety notes prominent.`,
                },
              ],
            },
          ],
        }),
      }
    );

    const result = await response.json();

    // Log response for debugging
    if (!response.ok) {
      console.error("Gemini API error:", response.status, JSON.stringify(result));
    }

    // Check for blocked content or errors
    if (result.error) {
      console.error("Gemini error:", result.error);
      return {
        answer: `API Error: ${result.error.message || "Unknown error"}`,
        sources
      };
    }

    if (result.promptFeedback?.blockReason) {
      console.error("Content blocked:", result.promptFeedback.blockReason);
      return {
        answer: "The question could not be processed. Please try rephrasing.",
        sources
      };
    }

    const answer =
      result.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I couldn't generate an answer. Please try again.";

    // OPTIMIZATION: Cache the successful response
    if (answer && !answer.startsWith("API Error") && !answer.startsWith("Sorry")) {
      ctx.runMutation(internal.knowledge.cacheAnswer, {
        queryHash,
        normalizedQuery: normalized,
        answer,
        sources,
      });
    }

    return { answer, sources };
  },
});

// Search knowledge without user context (for testing)
export const testSearch = action({
  args: { query: v.string() },
  handler: async (ctx, { query }): Promise<Array<{
    content: string;
    score: number;
    docTitle: string;
    sourceUrl?: string;
  }>> => {
    const results = await ctx.runAction(internal.knowledge.searchKnowledge, {
      query,
      limit: 3,
    });
    return results;
  },
});
