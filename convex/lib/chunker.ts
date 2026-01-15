// Intelligent text chunking for RAG
export interface Chunk {
  content: string;
  index: number;
  heading?: string;
}

// More aggressive chunking for better RAG retrieval
export function chunkContent(markdown: string, maxChunkSize: number = 800): Chunk[] {
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  // First, split by major headings (## or ###)
  const sections = markdown.split(/(?=^#{2,3}\s)/m);

  for (const section of sections) {
    // Extract heading if present
    const headingMatch = section.match(/^(#{2,3})\s+(.+)$/m);
    const heading = headingMatch ? headingMatch[2].trim() : "";

    // If section is small enough, add as single chunk
    if (section.length <= maxChunkSize && section.trim().length > 100) {
      chunks.push({
        content: section.trim(),
        index: chunkIndex++,
        heading,
      });
      continue;
    }

    // Otherwise, split by paragraphs (double newlines)
    const paragraphs = section.split(/\n\n+/);
    let currentChunk = "";

    for (const para of paragraphs) {
      const trimmedPara = para.trim();
      if (trimmedPara.length < 30) continue; // Skip tiny paragraphs

      if (currentChunk.length + trimmedPara.length <= maxChunkSize) {
        currentChunk += (currentChunk ? "\n\n" : "") + trimmedPara;
      } else {
        // Save current chunk if substantial
        if (currentChunk.length > 100) {
          chunks.push({
            content: currentChunk,
            index: chunkIndex++,
            heading,
          });
        }

        // If single paragraph is too long, split by sentences
        if (trimmedPara.length > maxChunkSize) {
          const sentences = trimmedPara.split(/(?<=[.!?])\s+/);
          let sentenceChunk = "";

          for (const sentence of sentences) {
            if (sentenceChunk.length + sentence.length <= maxChunkSize) {
              sentenceChunk += (sentenceChunk ? " " : "") + sentence;
            } else {
              if (sentenceChunk.length > 100) {
                chunks.push({
                  content: sentenceChunk,
                  index: chunkIndex++,
                  heading,
                });
              }
              sentenceChunk = sentence;
            }
          }
          currentChunk = sentenceChunk;
        } else {
          currentChunk = trimmedPara;
        }
      }
    }

    // Don't forget the last chunk from this section
    if (currentChunk.length > 100) {
      chunks.push({
        content: currentChunk,
        index: chunkIndex++,
        heading,
      });
    }
  }

  return chunks;
}

// More aggressive markdown cleaning
export function cleanMarkdown(markdown: string): string {
  let cleaned = markdown;

  // Remove image markdown entirely
  cleaned = cleaned.replace(/!\[Image \d+:[^\]]*\]\([^)]+\)/g, "");
  cleaned = cleaned.replace(/!\[[^\]]*\]\([^)]+\)/g, "");

  // Remove common navigation patterns
  cleaned = cleaned.replace(/\[Skip to.*?\]/gi, "");
  cleaned = cleaned.replace(/\[Menu\]|\[Search\]|\[Home\]/gi, "");

  // Remove navigation link lists (lines that are just links)
  cleaned = cleaned.replace(/^\s*\*\s*\[[^\]]{1,40}\]\([^)]+\)\s*$/gm, "");
  cleaned = cleaned.replace(/^\s*-\s*\[[^\]]{1,40}\]\([^)]+\)\s*$/gm, "");

  // Remove footer/header sections
  cleaned = cleaned.replace(/^Top menu\s*-+[\s\S]*?(?=\n#{2}|\n\n\n)/gm, "");
  cleaned = cleaned.replace(/^Footer\s*-+[\s\S]*$/gm, "");
  cleaned = cleaned.replace(/^Stay up-to-date[\s\S]*$/gm, "");
  cleaned = cleaned.replace(/^Subscribe to our newsletter[\s\S]*$/gm, "");

  // Remove cookie notices, privacy, etc
  cleaned = cleaned.replace(/cookie|privacy policy|terms of use|copyright \d{4}/gi, "");
  cleaned = cleaned.replace(/FWPA Footer menu[\s\S]*$/gi, "");

  // Remove social media and contact sections at the end
  cleaned = cleaned.replace(/\[Contact us\.\]\([^)]+\)[\s\S]*$/gi, "");

  // Clean up repeated horizontal rules
  cleaned = cleaned.replace(/(\*\s*){3,}/g, "");
  cleaned = cleaned.replace(/-{3,}/g, "---");

  // Collapse multiple newlines
  cleaned = cleaned.replace(/\n{4,}/g, "\n\n\n");

  // Remove empty link brackets
  cleaned = cleaned.replace(/\[\]\([^)]+\)/g, "");

  return cleaned.trim();
}
