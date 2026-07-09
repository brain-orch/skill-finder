/**
 * Intent parser for natural language search queries.
 *
 * Translates free-form queries into structured ParsedIntent objects
 * with category detection and query expansion. Regex-based only —
 * no LLM, ML, or external API dependencies.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ParsedIntent {
  primaryIntent: string;      // Best-matching category name
  categories: string[];       // All matched categories (deduplicated)
  expandedQueries: string[];  // Original + synonym-expanded query variants
  confidence: number;         // 0.0–1.0 overall confidence
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Category keyword map — mirrors detector.ts KEYWORD_MAP patterns. */
interface CategoryKeywordEntry {
  keywords: string[];
  category: string;
  confidence: number;
  synonyms: string[];  // expansion terms for this category
}

const CATEGORY_KEYWORDS: CategoryKeywordEntry[] = [
  // pdf / document
  { keywords: ["pdf", "extract text", "ocr", "document"], category: "pdf-processing", confidence: 0.9, synonyms: ["pdf", "document", "ocr", "extract text"] },
  { keywords: ["pdf", "document"], category: "document", confidence: 0.8, synonyms: ["pdf", "document", "file", "text"] },
  // spreadsheet
  { keywords: ["excel", "spreadsheet", "csv", "sheet", "tsv"], category: "spreadsheet", confidence: 0.9, synonyms: ["spreadsheet", "excel", "csv", "data", "table"] },
  { keywords: ["excel", "spreadsheet", "csv"], category: "data-analysis", confidence: 0.8, synonyms: ["data", "analysis", "chart", "statistics"] },
  // git
  { keywords: ["git", "commit", "push", "pull", "merge", "rebase"], category: "git-workflows", confidence: 0.6, synonyms: ["git", "commit", "branch", "merge", "rebase"] },
  { keywords: ["git", "commit", "push"], category: "version-control", confidence: 0.5, synonyms: ["version", "control", "commit", "history"] },
  // deployment
  { keywords: ["deploy", "publish", "release", "npm publish", "docker push"], category: "deployment", confidence: 0.65, synonyms: ["deploy", "publish", "release", "ci/cd", "pipeline"] },
  { keywords: ["deploy", "publish", "release"], category: "devops", confidence: 0.5, synonyms: ["deploy", "infrastructure", "devops", "cloud"] },
  // testing
  { keywords: ["test", "testing", "unit test", "e2e", "vitest", "jest"], category: "testing", confidence: 0.6, synonyms: ["test", "testing", "unit test", "e2e", "spec"] },
  { keywords: ["test", "testing"], category: "quality", confidence: 0.5, synonyms: ["quality", "lint", "format", "check"] },
  // docker
  { keywords: ["docker", "container", "dockerfile", "docker-compose"], category: "docker", confidence: 0.6, synonyms: ["docker", "container", "dockerfile", "compose"] },
  { keywords: ["docker", "container"], category: "containerization", confidence: 0.5, synonyms: ["container", "docker", "kubernetes", "orchestration"] },
  // database
  { keywords: ["sql", "database", "query", "postgres", "mysql", "sqlite"], category: "database", confidence: 0.6, synonyms: ["database", "sql", "postgres", "mysql", "query"] },
  { keywords: ["sql", "database", "query"], category: "sql", confidence: 0.5, synonyms: ["sql", "query", "database", "migration"] },
  // frontend / react
  { keywords: ["react", "component", "frontend", "ui", "jsx", "tsx"], category: "frontend", confidence: 0.6, synonyms: ["frontend", "ui", "react", "component", "jsx"] },
  { keywords: ["react", "component", "jsx", "tsx"], category: "react", confidence: 0.6, synonyms: ["react", "jsx", "tsx", "hook", "component"] },
  // api
  { keywords: ["api", "rest", "endpoint", "route"], category: "api-development", confidence: 0.6, synonyms: ["api", "rest", "endpoint", "route", "http"] },
  { keywords: ["api", "rest", "endpoint"], category: "backend", confidence: 0.5, synonyms: ["backend", "server", "api", "route"] },
  // security
  { keywords: ["security", "auth", "login", "password"], category: "security", confidence: 0.6, synonyms: ["security", "auth", "login", "jwt", "token"] },
  { keywords: ["security", "auth", "login"], category: "authentication", confidence: 0.5, synonyms: ["auth", "login", "session", "oauth"] },
  // programming (generic — lower confidence)
  { keywords: ["code", "coding", "programming", "function", "class"], category: "programming", confidence: 0.4, synonyms: ["code", "programming", "function", "class", "module"] },
  // typescript
  { keywords: ["typescript", "ts", "type"], category: "typescript", confidence: 0.7, synonyms: ["typescript", "type", "interface", "generic"] },
  // python
  { keywords: ["python", "py", "django", "flask"], category: "python", confidence: 0.7, synonyms: ["python", "django", "flask", "pip", "pylint"] },
  // debugging
  { keywords: ["debug", "debugging", "bug", "error"], category: "debugging", confidence: 0.7, synonyms: ["debug", "debugger", "breakpoint", "trace", "error"] },
  // documentation
  { keywords: ["markdown", "md", "docs", "documentation"], category: "documentation", confidence: 0.7, synonyms: ["documentation", "docs", "readme", "markdown"] },
  // config
  { keywords: ["config", "configuration", "env", "dotenv"], category: "config", confidence: 0.6, synonyms: ["config", "configuration", "env", "settings"] },
  // mobile
  { keywords: ["mobile", "ios", "android", "react-native"], category: "mobile", confidence: 0.6, synonyms: ["mobile", "ios", "android", "react-native", "app"] },
  // performance
  { keywords: ["performance", "optimize", "optimization", "slow"], category: "performance", confidence: 0.6, synonyms: ["performance", "optimize", "benchmark", "profiling"] },
  // regex
  { keywords: ["regex", "regexp", "pattern"], category: "programming", confidence: 0.5, synonyms: ["regex", "pattern", "match", "expression"] },
];

/** Common stop-words filtered during text analysis. */
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "each",
  "every", "both", "few", "more", "most", "other", "some", "such", "no",
  "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "just", "because", "but", "and", "or", "if", "while", "that", "this",
  "it", "its", "i", "me", "my", "we", "our", "you", "your", "he", "him",
  "his", "she", "her", "they", "them", "their", "what", "which", "who",
  "whom", "these", "those", "about", "up", "also", "like", "get", "got",
  "make", "let", "please", "want", "need", "try", "use", "using",
]);

// ---------------------------------------------------------------------------
// IntentParser
// ---------------------------------------------------------------------------

export class IntentParser {
  /**
   * Parse a natural language query into a structured ParsedIntent.
   *
   * @param query - Free-form search query
   * @returns ParsedIntent with categories, expanded queries, and confidence
   */
  parse(query: string): ParsedIntent {
    // Handle empty/null/whitespace
    if (!query || !query.trim()) {
      return { primaryIntent: "", categories: [], expandedQueries: [], confidence: 0 };
    }

    const lower = query.toLowerCase();
    const tokens = this.tokenize(lower);

    // Filter to meaningful tokens (exclude stop words)
    const meaningfulTokens = tokens.filter((t) => !STOP_WORDS.has(t));

    // If no meaningful tokens after filtering, return empty
    if (meaningfulTokens.length === 0) {
      return { primaryIntent: "", categories: [], expandedQueries: [], confidence: 0 };
    }

    // Detect categories using keyword matching
    const matchedCategories = this.detectCategories(lower, meaningfulTokens);

    // If no categories matched, return empty with original query as expansion
    if (matchedCategories.length === 0) {
      return { primaryIntent: "", categories: [], expandedQueries: [query.trim()], confidence: 0 };
    }

    // Sort by confidence descending
    matchedCategories.sort((a, b) => b.confidence - a.confidence);

    const primaryIntent = matchedCategories[0].category;
    const categories = [...new Set(matchedCategories.map((c) => c.category))];

    // Expand query with synonyms from matched categories
    const expandedQueries = this.expandQuery(query.trim(), matchedCategories);

    // Compute overall confidence: max of matched confidences, boosted by category count
    const maxConfidence = matchedCategories[0].confidence;
    const categoryBoost = Math.min((categories.length - 1) * 0.05, 0.15);
    const confidence = Math.min(maxConfidence + categoryBoost, 1.0);

    return {
      primaryIntent,
      categories,
      expandedQueries,
      confidence: Math.round(confidence * 100) / 100,
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Tokenize text into lowercase words. */
  private tokenize(text: string): string[] {
    return text
      .split(/[^a-z0-9./]+/)
      .filter((t) => t.length > 0);
  }

  /**
   * Detect categories from query using keyword matching.
   * Supports both single-token and multi-word keyword matching.
   */
  private detectCategories(
    lower: string,
    tokens: string[],
  ): Array<{ category: string; confidence: number; synonyms: string[] }> {
    const categoryConfidences = new Map<string, { confidence: number; synonyms: string[] }>();

    // Single-token matches
    for (const token of tokens) {
      for (const entry of CATEGORY_KEYWORDS) {
        if (entry.keywords.includes(token)) {
          const existing = categoryConfidences.get(entry.category);
          if (existing) {
            // Noisy-OR: P(at least one) = 1 - Π(1 - Pi)
            existing.confidence = 1 - (1 - existing.confidence) * (1 - entry.confidence);
          } else {
            categoryConfidences.set(entry.category, {
              confidence: entry.confidence,
              synonyms: entry.synonyms,
            });
          }
        }
      }
    }

    // Multi-word keyword matches (e.g., "extract text", "unit test")
    for (const entry of CATEGORY_KEYWORDS) {
      for (const kw of entry.keywords) {
        if (kw.includes(" ") && lower.includes(kw)) {
          const existing = categoryConfidences.get(entry.category);
          if (existing) {
            existing.confidence = 1 - (1 - existing.confidence) * (1 - entry.confidence);
          } else {
            categoryConfidences.set(entry.category, {
              confidence: entry.confidence,
              synonyms: entry.synonyms,
            });
          }
        }
      }
    }

    return Array.from(categoryConfidences.entries()).map(([category, data]) => ({
      category,
      ...data,
    }));
  }

  /**
   * Expand the original query with synonyms from matched categories.
   * Deduplicates and preserves original query as first entry.
   */
  private expandQuery(
    originalQuery: string,
    matchedCategories: Array<{ synonyms: string[] }>,
  ): string[] {
    const seen = new Set<string>();
    const expanded: string[] = [];

    // Always include the original query
    const normalizedOriginal = originalQuery.trim().toLowerCase();
    seen.add(normalizedOriginal);
    expanded.push(originalQuery.trim());

    // Add synonyms from matched categories (skip terms already in query)
    for (const cat of matchedCategories) {
      for (const syn of cat.synonyms) {
        if (!seen.has(syn) && !normalizedOriginal.includes(syn)) {
          seen.add(syn);
          expanded.push(syn);
        }
      }
    }

    return expanded;
  }
}
