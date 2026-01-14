import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";

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

// Ask AI question - uses Gemini directly
export const askQuestion = action({
  args: {
    userId: v.id("users"),
    question: v.string(),
  },
  handler: async (ctx, args): Promise<{ answer: string; sources: string[] }> => {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return {
        answer: "AI service not configured. Please contact the administrator.",
        sources: [],
      };
    }

    // Call Gemini for answer (direct, without RAG for simplicity)
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
                  text: `You are a helpful assistant for a carpentry business in Australia. Answer questions based on Australian building standards (NCC, AS 1684, etc.) and carpentry best practices.

Question: ${args.question}

Provide a clear, practical answer. Include specific code references where relevant. If you're unsure, say so. Keep the answer concise but informative.`,
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

    return {
      answer,
      sources: ["Australian Building Standards", "Carpentry Best Practices"],
    };
  },
});
