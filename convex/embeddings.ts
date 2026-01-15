"use node";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";

// Generate embedding using Gemini gemini-embedding-001 model
// Returns 1536 dimensions to match schema
export const generateEmbedding = internalAction({
  args: { text: v.string() },
  handler: async (ctx, { text }): Promise<{ success: boolean; embedding?: number[]; error?: string }> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "GEMINI_API_KEY not configured" };
    }

    // Truncate text if too long (Gemini has 2048 token limit for embeddings)
    const truncatedText = text.slice(0, 8000);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/text-embedding-004",
            content: { parts: [{ text: truncatedText }] },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Gemini API error: ${response.status} - ${errorText}` };
      }

      const result = await response.json();
      const embedding = result.embedding?.values;

      if (!embedding || !Array.isArray(embedding)) {
        return { success: false, error: `Invalid embedding response: ${JSON.stringify(result)}` };
      }

      // text-embedding-004 returns 768 dimensions, we need to pad to 1536 for schema
      // OR we can update the schema - for now, let's pad with zeros
      let finalEmbedding = embedding;
      if (embedding.length < 1536) {
        finalEmbedding = [...embedding, ...new Array(1536 - embedding.length).fill(0)];
      }

      return { success: true, embedding: finalEmbedding };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

// Public action for testing
export const testEmbedding = action({
  args: { text: v.string() },
  handler: async (ctx, { text }): Promise<{ success: boolean; dimensions?: number; error?: string }> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "GEMINI_API_KEY not configured" };
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/text-embedding-004",
            content: { parts: [{ text }] },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Gemini API error: ${response.status} - ${errorText}` };
      }

      const result = await response.json();
      const embedding = result.embedding?.values;

      return {
        success: true,
        dimensions: embedding?.length || 0,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});
