import { v } from "convex/values";
import { mutation, query, action, internalQuery, internalAction } from "./_generated/server";
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

    // Get chunk counts
    const enriched = await Promise.all(
      filtered.map(async (doc) => {
        const chunks = await ctx.db
          .query("knowledgeChunks")
          .withIndex("by_doc", (q) => q.eq("docId", doc._id))
          .collect();
        return {
          ...doc,
          chunkCount: chunks.length,
          isGlobal: doc.organizationId === undefined,
        };
      })
    );

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

// Vector search for relevant chunks (internal action)
export const searchKnowledge = internalAction({
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

    // Step 1: Search for relevant knowledge chunks using RAG
    console.log(`Searching knowledge base for: "${args.question}"`);
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
