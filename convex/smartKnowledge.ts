"use node";
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Types for query classification
type QueryType =
  | "span_lookup"
  | "fastener_lookup"
  | "timber_info"
  | "general_knowledge"
  | "compliance_check";

type QuerySpecificity = "specific" | "vague";

interface ParsedQuery {
  type: QueryType;
  specificity: QuerySpecificity;
  memberType?: string;
  timberType?: string;
  species?: string;
  size?: string;
  span?: number;
  spacing?: number;
  loadType?: string;
  missing: string[];
  safetyTopics: string[]; // Detected safety-relevant topics
}

// Safety/compliance topics that always need "Heads up" notes
const SAFETY_PATTERNS = {
  inGround: /\b(in[- ]?ground|below[- ]?ground|buried|post[- ]?hole)/i,
  wetArea: /\b(wet[- ]?area|bathroom|shower|laundry|waterproof)/i,
  loadBearing: /\b(load[- ]?bearing|structural|support|bearer|beam)/i,
  fixing: /\b(fix|nail|screw|bolt|connect|fasten)/i,
  treatment: /\b(treat|h[2-5]|durability|rot|termite|decay)/i,
  height: /\b(balcony|balustrade|railing|deck[- ]?height|fall)/i,
  fire: /\b(fire|flame|bushfire|bal[- ]?\d+|ember)/i,
};

// Pattern matching for fast extraction
const PATTERNS = {
  size: /(\d{2,3})\s*x\s*(\d{2,3})/i,
  span: /(\d+\.?\d*)\s*m(?:m|etre|eter)?(?:\s+span)?/i,
  spanMm: /(\d{3,4})\s*mm/i,
  spacing: /(?:at\s+)?(\d{3})\s*(?:mm\s+)?(?:centres?|centers?|c\/c|spacings?)/i,
  lvl: /\b(lvl|laminated\s*veneer)/i,
  mgp: /\b(mgp\s*\d{1,2})/i,
  hardwood: /\b(spotted\s*gum|blackbutt|ironbark|merbau|jarrah|tallowwood|hardwood)/i,
  memberType: /\b(bearer|joist|rafter|lintel|stud|beam|decking)/i,
  loadType: /\b(floor|deck|roof|balcony|ceiling)/i,
};

// Detect safety topics in query
function detectSafetyTopics(query: string): string[] {
  const topics: string[] = [];
  for (const [topic, pattern] of Object.entries(SAFETY_PATTERNS)) {
    if (pattern.test(query)) {
      topics.push(topic);
    }
  }
  return topics;
}

// Determine if query is specific or vague
function determineSpecificity(query: string, parsed: Partial<ParsedQuery>): QuerySpecificity {
  const q = query.toLowerCase();

  // Vague indicators
  const vaguePatterns = [
    /^what\s+(timber|wood|material)/i,        // "What timber should I use?"
    /^which\s+(is\s+)?(best|better)/i,        // "Which is best?"
    /^should\s+i/i,                           // "Should I use..."
    /^can\s+i\s+use/i,                        // "Can I use..." without specifics
    /^how\s+do\s+i/i,                         // "How do I..."
    /\?$/,                                     // Ends with question mark (weak signal)
  ];

  // Specific indicators - has concrete details
  const hasSize = !!parsed.size;
  const hasSpan = !!parsed.span;
  const hasTimberType = !!parsed.timberType;
  const hasMemberType = !!parsed.memberType;
  const hasNumbers = /\d{2,}/.test(query); // Has meaningful numbers

  const specificCount = [hasSize, hasSpan, hasTimberType, hasMemberType, hasNumbers].filter(Boolean).length;

  // If query has 2+ specific details, it's specific
  if (specificCount >= 2) return "specific";

  // Check for vague patterns
  for (const pattern of vaguePatterns) {
    if (pattern.test(q) && specificCount < 2) {
      return "vague";
    }
  }

  // Default to specific if we have at least one concrete detail
  return specificCount >= 1 ? "specific" : "vague";
}

// Parse user query to extract known parameters
function parseQuery(query: string): ParsedQuery {
  const q = query.toLowerCase();
  const result: ParsedQuery = {
    type: "general_knowledge",
    specificity: "specific", // Will be updated below
    missing: [],
    safetyTopics: [],
  };

  // Extract size (e.g., "140x45")
  const sizeMatch = query.match(PATTERNS.size);
  if (sizeMatch) {
    result.size = `${sizeMatch[1]}x${sizeMatch[2]}`;
  }

  // Extract span
  const spanMatch = query.match(PATTERNS.span);
  if (spanMatch) {
    result.span = Math.round(parseFloat(spanMatch[1]) * 1000); // convert to mm
  } else {
    const spanMmMatch = query.match(PATTERNS.spanMm);
    if (spanMmMatch) {
      result.span = parseInt(spanMmMatch[1]);
    }
  }

  // Extract spacing
  const spacingMatch = query.match(PATTERNS.spacing);
  if (spacingMatch) {
    result.spacing = parseInt(spacingMatch[1]);
  }

  // Extract timber type
  if (PATTERNS.lvl.test(q)) {
    result.timberType = "LVL";
  } else if (PATTERNS.mgp.test(q)) {
    const mgpMatch = q.match(PATTERNS.mgp);
    result.timberType = mgpMatch![1].toUpperCase().replace(/\s+/g, "");
  } else if (PATTERNS.hardwood.test(q)) {
    result.timberType = "hardwood";
    const speciesMatch = q.match(PATTERNS.hardwood);
    if (speciesMatch && speciesMatch[1] !== "hardwood") {
      result.species = speciesMatch[1].replace(/\s+/g, "_");
    }
  }

  // Extract member type
  const memberMatch = q.match(PATTERNS.memberType);
  if (memberMatch) {
    result.memberType = memberMatch[1];
    if (result.memberType === "decking") {
      result.memberType = "decking_joist";
    }
  }

  // Extract load type
  const loadMatch = q.match(PATTERNS.loadType);
  if (loadMatch) {
    result.loadType = loadMatch[1];
  }

  // Determine query type and what's missing
  if (result.memberType) {
    result.type = "span_lookup";

    // Determine what parameters are missing for a span lookup
    if (!result.span && !result.size) {
      result.missing.push("span_or_size");
    }
    if (!result.timberType) {
      result.missing.push("timber_type");
    }
    if (!result.loadType && ["bearer", "joist"].includes(result.memberType)) {
      result.missing.push("load_type");
    }
  } else if (q.includes("nail") || q.includes("bolt") || q.includes("fix") || q.includes("connect")) {
    result.type = "fastener_lookup";
  } else if (q.includes("treatment") || q.includes("durability") || q.includes("species")) {
    result.type = "timber_info";
  }

  // Detect safety topics
  result.safetyTopics = detectSafetyTopics(query);

  // Determine specificity
  result.specificity = determineSpecificity(query, result);

  return result;
}

// Generate follow-up question based on what's missing
function generateFollowUp(parsed: ParsedQuery): string | null {
  if (parsed.missing.length === 0) return null;

  const missing = parsed.missing[0];

  switch (missing) {
    case "span_or_size":
      return "What span do you need to cover? (e.g., 3.6m)";
    case "timber_type":
      return "What timber are you using? ○ LVL ○ Hardwood ○ MGP Pine";
    case "load_type":
      return "What's it supporting? ○ Floor ○ Deck ○ Roof ○ Balcony";
    case "species":
      return "Which hardwood? ○ Spotted Gum (F27) ○ Blackbutt (F17) ○ Merbau (F14)";
    default:
      return null;
  }
}

// Generate clarifying question for vague queries
function generateVagueClarification(question: string): string | null {
  const q = question.toLowerCase();

  // Timber selection questions
  if (/what\s+(timber|wood|material)/.test(q)) {
    if (q.includes("deck")) {
      return "What matters most for the deck? ○ Durability ○ Cost ○ Appearance";
    }
    if (q.includes("bearer") || q.includes("joist") || q.includes("frame")) {
      return "What's the application? ○ Floor ○ Deck ○ Roof";
    }
    return "What are you building? ○ Deck ○ Floor frame ○ Structural ○ Other";
  }

  // "Which is best" questions
  if (/which\s+(is\s+)?(best|better)/.test(q)) {
    return "What matters most? ○ Strength ○ Cost ○ Durability ○ Appearance";
  }

  // "Can I use" questions without specifics
  if (/^can\s+i\s+use/.test(q) && !/\d{2,}/.test(q)) {
    return "What's the span and load? (e.g., 3m bearer for deck)";
  }

  // "How do I" questions
  if (/^how\s+do\s+i/.test(q)) {
    if (q.includes("fix") || q.includes("attach") || q.includes("connect")) {
      return "What are you fixing to? ○ Timber frame ○ Steel ○ Concrete ○ Masonry";
    }
  }

  return null;
}

// Safety notes for different topics
const SAFETY_NOTES: Record<string, string> = {
  inGround: "**Heads up:** In-ground use requires Class 1 durability timber or H5 treatment minimum.",
  fixing: "**Heads up:** Pre-drill hardwood to avoid splitting.",
  treatment: "**Heads up:** H4 is above-ground only - use H5 for in-ground contact.",
  wetArea: "**Heads up:** Wet areas need waterproof membrane under tiles per AS 3740.",
  height: "**Heads up:** Balustrades must be 1000mm min height per NCC.",
  loadBearing: "**Heads up:** Load-bearing changes may need engineer sign-off.",
  fire: "**Heads up:** BAL ratings affect material choices - check your zone.",
};

// Format span result for display - CONCISE version
function formatSpanResult(results: any[], parsed: ParsedQuery): string {
  if (results.length === 0) {
    return `No span data for ${parsed.size || "this size"} ${parsed.timberType || "timber"} ${parsed.memberType || "member"}. Check manufacturer specs directly.`;
  }

  const best = results[0];
  const spanM = (best.maxSpan / 1000).toFixed(1);
  const species = best.species ? ` (${best.species.replace(/_/g, " ")})` : "";

  // Concise one-liner with inline source
  let response = `${best.size} ${best.timberType}${species} - **${spanM}m max** at ${best.spacing || 450}mm centres *(${best.source})*`;

  // Add safety note if relevant
  if (parsed.safetyTopics.length > 0) {
    const note = SAFETY_NOTES[parsed.safetyTopics[0]];
    if (note) {
      response += `\n\n${note}`;
    }
  }

  // Add brief follow-up offer if alternatives exist
  if (results.length > 1) {
    response += "\n\n*Want to compare other sizes?*";
  }

  return response;
}

// Main smart query action
export const smartQuery = action({
  args: {
    userId: v.id("users"),
    question: v.string(),
    context: v.optional(v.object({
      previousQuestion: v.optional(v.string()),
      previousParsed: v.optional(v.any()),
    })),
  },
  handler: async (ctx, args): Promise<{
    answer: string;
    needsFollowUp: boolean;
    followUpQuestion?: string;
    parsed?: any;
    sources: Array<{ title: string; url?: string }>;
  }> => {
    // MEMORY: Fetch conversation history for context
    const conversationHistory = await ctx.runQuery(
      internal.knowledge.formatHistoryForPrompt,
      { userId: args.userId }
    );

    // Parse the query
    let parsed = parseQuery(args.question);

    // If we have context from previous question, merge it
    if (args.context?.previousParsed) {
      const prev = args.context.previousParsed;
      parsed = {
        ...parsed,
        memberType: parsed.memberType || prev.memberType,
        timberType: parsed.timberType || prev.timberType,
        species: parsed.species || prev.species,
        span: parsed.span || prev.span,
        spacing: parsed.spacing || prev.spacing,
        loadType: parsed.loadType || prev.loadType,
        size: parsed.size || prev.size,
        missing: parsed.missing,
      };

      // Inherit query type from context if we have member type now
      if (parsed.memberType && prev.type === "span_lookup") {
        parsed.type = "span_lookup";
      }

      // Recalculate missing for span lookups
      parsed.missing = [];
      if (parsed.type === "span_lookup") {
        if (!parsed.span && !parsed.size) parsed.missing.push("span_or_size");
        if (!parsed.timberType) parsed.missing.push("timber_type");
        if (!parsed.loadType && ["bearer", "joist"].includes(parsed.memberType || "")) {
          parsed.missing.push("load_type");
        }
      }
    }

    console.log("Parsed query:", JSON.stringify(parsed));

    // Handle vague general questions - ask for clarification first
    if (parsed.specificity === "vague" && parsed.type === "general_knowledge") {
      const clarifyQuestion = generateVagueClarification(args.question);
      if (clarifyQuestion) {
        return {
          answer: "",
          needsFollowUp: true,
          followUpQuestion: clarifyQuestion,
          parsed,
          sources: [],
        };
      }
    }

    // Check if we need follow-up for span lookups
    const followUp = generateFollowUp(parsed);
    if (followUp && parsed.type === "span_lookup") {
      return {
        answer: "",
        needsFollowUp: true,
        followUpQuestion: followUp,
        parsed,
        sources: [],
      };
    }

    // Handle different query types
    if (parsed.type === "span_lookup") {
      // Query structured span tables
      const results = await ctx.runQuery(internal.smartKnowledgeHelpers.querySpanTable, {
        memberType: parsed.memberType,
        timberType: parsed.timberType,
        species: parsed.species,
        size: parsed.size,
        minSpan: parsed.span,
        spacing: parsed.spacing || 450,
        loadType: parsed.loadType,
      });

      const answer = formatSpanResult(results, parsed);

      // MEMORY: Save span lookup to conversation history
      if (answer && results.length > 0) {
        ctx.runMutation(internal.knowledge.saveConversation, {
          userId: args.userId,
          question: args.question,
          answer,
          parsedContext: {
            memberType: parsed.memberType,
            timberType: parsed.timberType,
            species: parsed.species,
            size: parsed.size,
            span: parsed.span,
            spacing: parsed.spacing,
            loadType: parsed.loadType,
          },
        });
      }

      return {
        answer,
        needsFollowUp: false,
        parsed,
        sources: results.length > 0 ? [{ title: results[0].source }] : [],
      };
    }

    // Fall back to RAG for general queries (with conversation history)
    const ragResult = await ctx.runAction(api.knowledge.askQuestion, {
      userId: args.userId,
      question: args.question,
      conversationHistory: conversationHistory ?? undefined,
    });

    // MEMORY: Save RAG response to conversation history
    if (ragResult.answer && !ragResult.answer.startsWith("API Error")) {
      ctx.runMutation(internal.knowledge.saveConversation, {
        userId: args.userId,
        question: args.question,
        answer: ragResult.answer,
        parsedContext: parsed.memberType ? {
          memberType: parsed.memberType,
          timberType: parsed.timberType,
          species: parsed.species,
          size: parsed.size,
          span: parsed.span,
          spacing: parsed.spacing,
          loadType: parsed.loadType,
        } : undefined,
      });
    }

    return {
      answer: ragResult.answer,
      needsFollowUp: false,
      parsed,
      sources: ragResult.sources,
    };
  },
});

// Seed initial span data (for testing)
export const seedSpanData = action({
  args: {},
  handler: async (ctx) => {
    // Seed some common LVL spans (Wesbeam E14)
    const lvlData = [
      // Floor bearers - single span, 450 spacing joists
      { memberType: "bearer", timberType: "LVL", stressGrade: "E14", size: "90x45", width: 90, depth: 45, loadType: "floor", spacing: 450, maxSpan: 1800, continuous: false, source: "Wesbeam E14 Guide" },
      { memberType: "bearer", timberType: "LVL", stressGrade: "E14", size: "140x45", width: 140, depth: 45, loadType: "floor", spacing: 450, maxSpan: 2800, continuous: false, source: "Wesbeam E14 Guide" },
      { memberType: "bearer", timberType: "LVL", stressGrade: "E14", size: "170x45", width: 170, depth: 45, loadType: "floor", spacing: 450, maxSpan: 3400, continuous: false, source: "Wesbeam E14 Guide" },
      { memberType: "bearer", timberType: "LVL", stressGrade: "E14", size: "190x45", width: 190, depth: 45, loadType: "floor", spacing: 450, maxSpan: 3900, continuous: false, source: "Wesbeam E14 Guide" },
      { memberType: "bearer", timberType: "LVL", stressGrade: "E14", size: "240x45", width: 240, depth: 45, loadType: "floor", spacing: 450, maxSpan: 4800, continuous: false, source: "Wesbeam E14 Guide" },
      { memberType: "bearer", timberType: "LVL", stressGrade: "E14", size: "290x45", width: 290, depth: 45, loadType: "floor", spacing: 450, maxSpan: 5600, continuous: false, source: "Wesbeam E14 Guide" },

      // Floor joists - 450 spacing
      { memberType: "joist", timberType: "LVL", stressGrade: "E14", size: "90x45", width: 90, depth: 45, loadType: "floor", spacing: 450, maxSpan: 2100, continuous: false, source: "Wesbeam E14 Guide" },
      { memberType: "joist", timberType: "LVL", stressGrade: "E14", size: "140x45", width: 140, depth: 45, loadType: "floor", spacing: 450, maxSpan: 3200, continuous: false, source: "Wesbeam E14 Guide" },
      { memberType: "joist", timberType: "LVL", stressGrade: "E14", size: "170x45", width: 170, depth: 45, loadType: "floor", spacing: 450, maxSpan: 3900, continuous: false, source: "Wesbeam E14 Guide" },
      { memberType: "joist", timberType: "LVL", stressGrade: "E14", size: "190x45", width: 190, depth: 45, loadType: "floor", spacing: 450, maxSpan: 4400, continuous: false, source: "Wesbeam E14 Guide" },
      { memberType: "joist", timberType: "LVL", stressGrade: "E14", size: "240x45", width: 240, depth: 45, loadType: "floor", spacing: 450, maxSpan: 5500, continuous: false, source: "Wesbeam E14 Guide" },

      // Deck bearers
      { memberType: "bearer", timberType: "LVL", stressGrade: "E14", size: "140x45", width: 140, depth: 45, loadType: "deck", spacing: 450, maxSpan: 3200, continuous: false, source: "Wesbeam E14 Guide" },
      { memberType: "bearer", timberType: "LVL", stressGrade: "E14", size: "170x45", width: 170, depth: 45, loadType: "deck", spacing: 450, maxSpan: 3900, continuous: false, source: "Wesbeam E14 Guide" },
      { memberType: "bearer", timberType: "LVL", stressGrade: "E14", size: "190x45", width: 190, depth: 45, loadType: "deck", spacing: 450, maxSpan: 4500, continuous: false, source: "Wesbeam E14 Guide" },
      { memberType: "bearer", timberType: "LVL", stressGrade: "E14", size: "240x45", width: 240, depth: 45, loadType: "deck", spacing: 450, maxSpan: 5500, continuous: false, source: "Wesbeam E14 Guide" },
    ];

    // Hardwood spans (Spotted Gum F27)
    const hardwoodData = [
      // Spotted Gum bearers
      { memberType: "bearer", timberType: "hardwood", species: "spotted_gum", stressGrade: "F27", size: "90x90", width: 90, depth: 90, loadType: "deck", spacing: 450, maxSpan: 2400, continuous: false, source: "Boral Hardwood Span Tables" },
      { memberType: "bearer", timberType: "hardwood", species: "spotted_gum", stressGrade: "F27", size: "140x45", width: 140, depth: 45, loadType: "deck", spacing: 450, maxSpan: 2600, continuous: false, source: "Boral Hardwood Span Tables" },
      { memberType: "bearer", timberType: "hardwood", species: "spotted_gum", stressGrade: "F27", size: "190x45", width: 190, depth: 45, loadType: "deck", spacing: 450, maxSpan: 4200, continuous: false, source: "Boral Hardwood Span Tables" },
      { memberType: "bearer", timberType: "hardwood", species: "spotted_gum", stressGrade: "F27", size: "240x45", width: 240, depth: 45, loadType: "deck", spacing: 450, maxSpan: 5100, continuous: false, source: "Boral Hardwood Span Tables" },

      // Spotted Gum joists
      { memberType: "joist", timberType: "hardwood", species: "spotted_gum", stressGrade: "F27", size: "90x45", width: 90, depth: 45, loadType: "deck", spacing: 450, maxSpan: 1800, continuous: false, source: "Boral Hardwood Span Tables" },
      { memberType: "joist", timberType: "hardwood", species: "spotted_gum", stressGrade: "F27", size: "140x45", width: 140, depth: 45, loadType: "deck", spacing: 450, maxSpan: 2800, continuous: false, source: "Boral Hardwood Span Tables" },
      { memberType: "joist", timberType: "hardwood", species: "spotted_gum", stressGrade: "F27", size: "190x45", width: 190, depth: 45, loadType: "deck", spacing: 450, maxSpan: 3800, continuous: false, source: "Boral Hardwood Span Tables" },

      // Blackbutt bearers (F17)
      { memberType: "bearer", timberType: "hardwood", species: "blackbutt", stressGrade: "F17", size: "140x45", width: 140, depth: 45, loadType: "deck", spacing: 450, maxSpan: 2200, continuous: false, source: "Boral Hardwood Span Tables" },
      { memberType: "bearer", timberType: "hardwood", species: "blackbutt", stressGrade: "F17", size: "190x45", width: 190, depth: 45, loadType: "deck", spacing: 450, maxSpan: 3600, continuous: false, source: "Boral Hardwood Span Tables" },
      { memberType: "bearer", timberType: "hardwood", species: "blackbutt", stressGrade: "F17", size: "240x45", width: 240, depth: 45, loadType: "deck", spacing: 450, maxSpan: 4400, continuous: false, source: "Boral Hardwood Span Tables" },

      // Merbau bearers (F14)
      { memberType: "bearer", timberType: "hardwood", species: "merbau", stressGrade: "F14", size: "140x45", width: 140, depth: 45, loadType: "deck", spacing: 450, maxSpan: 2000, continuous: false, source: "Boral Hardwood Span Tables" },
      { memberType: "bearer", timberType: "hardwood", species: "merbau", stressGrade: "F14", size: "190x45", width: 190, depth: 45, loadType: "deck", spacing: 450, maxSpan: 3200, continuous: false, source: "Boral Hardwood Span Tables" },
      { memberType: "bearer", timberType: "hardwood", species: "merbau", stressGrade: "F14", size: "240x45", width: 240, depth: 45, loadType: "deck", spacing: 450, maxSpan: 4000, continuous: false, source: "Boral Hardwood Span Tables" },
    ];

    // MGP spans
    const mgpData = [
      // MGP10 floor joists
      { memberType: "joist", timberType: "MGP10", stressGrade: "F5", size: "90x45", width: 90, depth: 45, loadType: "floor", spacing: 450, maxSpan: 1600, continuous: false, source: "WoodSolutions Span Tables" },
      { memberType: "joist", timberType: "MGP10", stressGrade: "F5", size: "140x45", width: 140, depth: 45, loadType: "floor", spacing: 450, maxSpan: 2500, continuous: false, source: "WoodSolutions Span Tables" },
      { memberType: "joist", timberType: "MGP10", stressGrade: "F5", size: "190x45", width: 190, depth: 45, loadType: "floor", spacing: 450, maxSpan: 3400, continuous: false, source: "WoodSolutions Span Tables" },
      { memberType: "joist", timberType: "MGP10", stressGrade: "F5", size: "240x45", width: 240, depth: 45, loadType: "floor", spacing: 450, maxSpan: 4300, continuous: false, source: "WoodSolutions Span Tables" },

      // MGP10 bearers
      { memberType: "bearer", timberType: "MGP10", stressGrade: "F5", size: "140x45", width: 140, depth: 45, loadType: "floor", spacing: 450, maxSpan: 2200, continuous: false, source: "WoodSolutions Span Tables" },
      { memberType: "bearer", timberType: "MGP10", stressGrade: "F5", size: "190x45", width: 190, depth: 45, loadType: "floor", spacing: 450, maxSpan: 3000, continuous: false, source: "WoodSolutions Span Tables" },
      { memberType: "bearer", timberType: "MGP10", stressGrade: "F5", size: "240x45", width: 240, depth: 45, loadType: "floor", spacing: 450, maxSpan: 3800, continuous: false, source: "WoodSolutions Span Tables" },

      // MGP12 floor joists
      { memberType: "joist", timberType: "MGP12", stressGrade: "F8", size: "90x45", width: 90, depth: 45, loadType: "floor", spacing: 450, maxSpan: 1800, continuous: false, source: "WoodSolutions Span Tables" },
      { memberType: "joist", timberType: "MGP12", stressGrade: "F8", size: "140x45", width: 140, depth: 45, loadType: "floor", spacing: 450, maxSpan: 2800, continuous: false, source: "WoodSolutions Span Tables" },
      { memberType: "joist", timberType: "MGP12", stressGrade: "F8", size: "190x45", width: 190, depth: 45, loadType: "floor", spacing: 450, maxSpan: 3800, continuous: false, source: "WoodSolutions Span Tables" },
      { memberType: "joist", timberType: "MGP12", stressGrade: "F8", size: "240x45", width: 240, depth: 45, loadType: "floor", spacing: 450, maxSpan: 4800, continuous: false, source: "WoodSolutions Span Tables" },
    ];

    // Insert all data
    const allData = [...lvlData, ...hardwoodData, ...mgpData];
    let inserted = 0;

    for (const entry of allData) {
      await ctx.runMutation(internal.smartKnowledgeHelpers.insertSpanEntry, entry as any);
      inserted++;
    }

    // Seed timber grades
    const timberGrades = [
      { grade: "LVL-E14", stressGrade: "F14", durabilityClass: 4, commonUses: ["bearers", "joists", "lintels", "rafters"], treatmentRequired: "H2", inGroundOk: false, source: "Wesbeam" },
      { grade: "MGP10", stressGrade: "F5", durabilityClass: 4, commonUses: ["framing", "joists", "rafters"], treatmentRequired: "H2", inGroundOk: false, source: "WoodSolutions" },
      { grade: "MGP12", stressGrade: "F8", durabilityClass: 4, commonUses: ["framing", "joists", "bearers"], treatmentRequired: "H2", inGroundOk: false, source: "WoodSolutions" },
      { grade: "F27", species: "spotted_gum", stressGrade: "F27", durabilityClass: 1, commonUses: ["decking", "bearers", "posts", "outdoor"], treatmentRequired: "none", inGroundOk: true, density: 1050, source: "Boral" },
      { grade: "F17", species: "blackbutt", stressGrade: "F17", durabilityClass: 1, commonUses: ["decking", "flooring", "framing"], treatmentRequired: "none", inGroundOk: true, density: 900, source: "Boral" },
      { grade: "F14", species: "merbau", stressGrade: "F14", durabilityClass: 1, commonUses: ["decking", "outdoor furniture"], treatmentRequired: "none", inGroundOk: true, density: 850, source: "Boral" },
      { grade: "F27", species: "ironbark", stressGrade: "F27", durabilityClass: 1, commonUses: ["heavy structural", "posts", "bearers"], treatmentRequired: "none", inGroundOk: true, density: 1100, source: "Boral" },
    ];

    for (const grade of timberGrades) {
      await ctx.runMutation(internal.smartKnowledgeHelpers.insertTimberGrade, grade as any);
    }

    return {
      spansInserted: inserted,
      gradesInserted: timberGrades.length,
    };
  },
});
