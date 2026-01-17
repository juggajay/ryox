"use node";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { chunkContent, cleanMarkdown } from "./lib/chunker";

const JINA_API_KEY = "jina_8f23cf2ccf4842fe908240f6a2405aadca_vX0BwKYJf_pZhXTQ1TmYo9KgI";

// All target URLs to scrape
const TARGET_URLS = [
  // WoodSolutions - Timber Framing
  { url: "https://www.woodsolutions.com.au/timber-framing", title: "WoodSolutions: Timber Framing" },
  { url: "https://www.woodsolutions.com.au/wood-species", title: "WoodSolutions: Wood Species" },
  { url: "https://www.woodsolutions.com.au/resources/specifications/span-tables-and-software", title: "WoodSolutions: Span Tables" },
  { url: "https://www.woodsolutions.com.au/design-guides", title: "WoodSolutions: Design Guides" },
  { url: "https://www.woodsolutions.com.au/resources/standards-codes/as1684-user-guides", title: "WoodSolutions: AS 1684 User Guides" },

  // HIA - Australian Standards
  { url: "https://hia.com.au/resources-and-advice/building-it-right/australian-standards/articles/using-as-1684-for-timber-framing", title: "HIA: Using AS 1684" },
  { url: "https://hia.com.au/resources-and-advice/building-it-right/australian-standards/articles/residential-timber-framed-construction-part-2-non-cyclonic-areas", title: "HIA: Non-Cyclonic Construction" },

  // ABCB / NCC - Legislation
  { url: "https://www.abcb.gov.au/resources", title: "ABCB: Resources" },
  { url: "https://ncc.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/front-matter/how-use-housing-provisions", title: "NCC: How to Use Housing Provisions" },

  // NSW Standards & Tolerances - Quality/Finish
  { url: "https://www.fairtrading.nsw.gov.au/housing-and-property/building-and-renovating/after-you-build-or-renovate/guide-to-standards-and-tolerances", title: "NSW: Guide to Standards and Tolerances" },

  // James Hardie - Fibre Cement Products
  { url: "https://www.jameshardie.com.au/technicalLibrary", title: "James Hardie: Technical Library" },

  // CSR Gyprock - Plasterboard Products
  { url: "https://www.gyprock.com.au/resources", title: "CSR Gyprock: Resources" },

  // Hume Doors - Door Installation
  { url: "https://www.humedoors.com.au/support/installation-instructions", title: "Hume Doors: Installation Instructions" },
];

// Scrape a single URL via Jina Reader API (public for testing)
export const scrapeUrl = action({
  args: { url: v.string() },
  handler: async (ctx, { url }): Promise<{ success: boolean; content?: string; error?: string; length?: number }> => {
    try {
      const response = await fetch(`https://r.jina.ai/${url}`, {
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

      return { success: true, content, length: content.length };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

// Internal scrape action
export const scrapeUrlInternal = internalAction({
  args: { url: v.string() },
  handler: async (ctx, { url }): Promise<{ success: boolean; content?: string; error?: string }> => {
    try {
      const response = await fetch(`https://r.jina.ai/${url}`, {
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

      if (content.length < 100) {
        return { success: false, error: "Content too short - may be blocked or empty" };
      }

      return { success: true, content };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

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
    const scrapeResult = await ctx.runAction(internal.knowledgeScraper.scrapeUrlInternal, { url });
    if (!scrapeResult.success || !scrapeResult.content) {
      return { success: false, error: `Scrape failed: ${scrapeResult.error}` };
    }
    console.log(`    Scraped ${scrapeResult.content.length} characters`);

    // Step 2: Clean and chunk the content
    console.log(`[2/4] Chunking content`);
    const cleanedContent = cleanMarkdown(scrapeResult.content);
    const chunks = chunkContent(cleanedContent);

    if (chunks.length === 0) {
      return { success: false, error: "No valid chunks extracted from content" };
    }
    console.log(`    Created ${chunks.length} chunks`);

    // Step 3: Create the document record (global - no org ID)
    console.log(`[3/4] Creating document record`);
    const docId = await ctx.runMutation(internal.knowledgeScraperHelpers.createDocument, {
      title,
      sourceUrl: url,
    });

    // Step 4: Generate embeddings and store chunks (with rate limiting)
    console.log(`[4/4] Generating embeddings for ${chunks.length} chunks`);
    let storedCount = 0;

    for (const chunk of chunks) {
      // Rate limit: 200ms between requests to avoid hitting API limits
      await new Promise(resolve => setTimeout(resolve, 200));

      const embeddingResult = await ctx.runAction(internal.embeddings.generateEmbedding, {
        text: chunk.content,
      });

      if (!embeddingResult.success || !embeddingResult.embedding) {
        console.warn(`    Embedding failed for chunk ${chunk.index}: ${embeddingResult.error}`);
        continue; // Skip this chunk but continue with others
      }

      await ctx.runMutation(internal.knowledgeScraperHelpers.storeChunk, {
        docId,
        content: chunk.content,
        embedding: embeddingResult.embedding,
        chunkIndex: chunk.index,
      });

      storedCount++;
      console.log(`    Stored chunk ${storedCount}/${chunks.length}`);
    }

    console.log(`Complete: ${storedCount}/${chunks.length} chunks stored for "${title}"`);

    return {
      success: true,
      docId: docId.toString(),
      chunksStored: storedCount,
    };
  },
});

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
      const existing = await ctx.runQuery(internal.knowledgeScraperHelpers.getDocByUrl, {
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

      // Rate limit between documents (3 seconds)
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log(`\n========================================`);
    console.log(`BATCH COMPLETE: ${processed} processed, ${failed} failed`);
    console.log(`========================================`);

    return { processed, failed, results };
  },
});
