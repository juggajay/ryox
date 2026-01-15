import { v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "./_generated/server";

// Internal mutations for document/chunk creation (must be in non-Node file)
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

// Clear all knowledge docs and chunks (for reprocessing)
export const clearAllKnowledge = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all chunks first
    const chunks = await ctx.db.query("knowledgeChunks").collect();
    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }

    // Then delete all docs
    const docs = await ctx.db.query("knowledgeDocs").collect();
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }

    return { deletedDocs: docs.length, deletedChunks: chunks.length };
  },
});

// Get stats about the knowledge base
export const getKnowledgeStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("knowledgeDocs").collect();
    const chunks = await ctx.db.query("knowledgeChunks").collect();

    // Check for real embeddings (not all zeros)
    const chunksWithRealEmbeddings = chunks.filter(c => {
      const sum = c.embedding.reduce((a, b) => a + Math.abs(b), 0);
      return sum > 0;
    });

    return {
      totalDocs: docs.length,
      totalChunks: chunks.length,
      chunksWithRealEmbeddings: chunksWithRealEmbeddings.length,
      documents: docs.map(d => ({
        title: d.title,
        sourceUrl: d.sourceUrl,
        uploadedAt: d.uploadedAt,
      })),
    };
  },
});
