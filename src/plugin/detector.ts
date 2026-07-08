/**
 * Task context detection engine for the SkillFinder plugin.
 *
 * Analyzes user messages, tool calls, and session history to determine
 * which skill categories are relevant, with confidence scoring.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DetectedContext {
  categories: string[];           // Matched categories
  confidence: number;             // Overall confidence 0.0–1.0
  signals: DetectedSignal[];      // Individual signals that contributed
  timestamp: number;              // Detection time
}

export interface DetectedSignal {
  type: "keyword" | "extension" | "command" | "filename";
  value: string;
  category: string;
  confidence: number;             // 0.0–1.0
}

export interface SessionHistoryEntry {
  toolName: string;
  args: Record<string, unknown>;
  timestamp: number;
}

export interface TaskDetectorOptions {
  maxHistorySize?: number;
  confidenceThreshold?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_HISTORY = 100;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

/** Common English stop-words filtered during text analysis. */
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
// Mapping tables
// ---------------------------------------------------------------------------

/** Keyword → category with default confidence. */
interface KeywordEntry {
  keywords: string[];
  category: string;
  confidence: number;
}

const KEYWORD_MAP: KeywordEntry[] = [
  // pdf / document
  { keywords: ["pdf", "extract text", "ocr", "document"], category: "pdf-processing", confidence: 0.9 },
  { keywords: ["pdf", "document"], category: "document", confidence: 0.8 },
  // spreadsheet
  { keywords: ["excel", "spreadsheet", "csv", "sheet", "tsv"], category: "spreadsheet", confidence: 0.9 },
  { keywords: ["excel", "spreadsheet", "csv"], category: "data-analysis", confidence: 0.8 },
  // git
  { keywords: ["git", "commit", "push", "pull", "merge", "rebase"], category: "git-workflows", confidence: 0.6 },
  { keywords: ["git", "commit", "push"], category: "version-control", confidence: 0.5 },
  // deployment
  { keywords: ["deploy", "publish", "release", "npm publish", "docker push"], category: "deployment", confidence: 0.65 },
  { keywords: ["deploy", "publish", "release"], category: "devops", confidence: 0.5 },
  // testing
  { keywords: ["test", "testing", "unit test", "e2e", "vitest", "jest"], category: "testing", confidence: 0.6 },
  { keywords: ["test", "testing"], category: "quality", confidence: 0.5 },
  // docker
  { keywords: ["docker", "container", "dockerfile", "docker-compose"], category: "docker", confidence: 0.6 },
  { keywords: ["docker", "container"], category: "containerization", confidence: 0.5 },
  // database
  { keywords: ["sql", "database", "query", "postgres", "mysql", "sqlite"], category: "database", confidence: 0.6 },
  { keywords: ["sql", "database", "query"], category: "sql", confidence: 0.5 },
  // frontend / react
  { keywords: ["react", "component", "frontend", "ui", "jsx", "tsx"], category: "frontend", confidence: 0.6 },
  { keywords: ["react", "component", "jsx", "tsx"], category: "react", confidence: 0.6 },
  // api
  { keywords: ["api", "rest", "endpoint", "route"], category: "api-development", confidence: 0.6 },
  { keywords: ["api", "rest", "endpoint"], category: "backend", confidence: 0.5 },
  // security
  { keywords: ["security", "auth", "login", "password"], category: "security", confidence: 0.6 },
  { keywords: ["security", "auth", "login"], category: "authentication", confidence: 0.5 },
  // programming (generic — lower confidence)
  { keywords: ["code", "coding", "programming", "function", "class"], category: "programming", confidence: 0.4 },
  // typescript
  { keywords: ["typescript", "ts", "type"], category: "typescript", confidence: 0.7 },
  // python
  { keywords: ["python", "py", "django", "flask"], category: "python", confidence: 0.7 },
  // debugging
  { keywords: ["debug", "debugging", "bug", "error"], category: "debugging", confidence: 0.7 },
  // documentation
  { keywords: ["markdown", "md", "docs", "documentation"], category: "documentation", confidence: 0.7 },
  // config
  { keywords: ["config", "configuration", "env", "dotenv"], category: "config", confidence: 0.6 },
  // mobile
  { keywords: ["mobile", "ios", "android", "react-native"], category: "mobile", confidence: 0.6 },
  // performance
  { keywords: ["performance", "optimize", "optimization", "slow"], category: "performance", confidence: 0.6 },
  // regex
  { keywords: ["regex", "regexp", "pattern"], category: "programming", confidence: 0.5 },
];

/** File extension → category mapping. */
interface ExtensionEntry {
  extensions: string[];
  category: string;
  confidence: number;
}

const EXTENSION_MAP: ExtensionEntry[] = [
  { extensions: [".pdf", ".doc", ".docx"], category: "pdf-processing", confidence: 0.9 },
  { extensions: [".txt"], category: "pdf-processing", confidence: 0.5 },
  { extensions: [".xlsx", ".xls", ".csv", ".tsv"], category: "spreadsheet", confidence: 0.9 },
  { extensions: [".js", ".ts", ".tsx", ".jsx", ".py", ".rs", ".go"], category: "programming", confidence: 0.7 },
  { extensions: [".sql", ".db", ".sqlite"], category: "database", confidence: 0.9 },
  { extensions: [".json", ".yaml", ".yml", ".toml"], category: "config", confidence: 0.6 },
  { extensions: [".md", ".rst", ".txt"], category: "documentation", confidence: 0.5 },
  // React-specific
  { extensions: [".tsx", ".jsx"], category: "react", confidence: 0.7 },
  { extensions: [".tsx", ".jsx"], category: "frontend", confidence: 0.7 },
];

/** Shell command prefix → category mapping. */
interface CommandEntry {
  commands: string[];
  category: string;
  confidence: number;
}

const COMMAND_MAP: CommandEntry[] = [
  { commands: ["npm", "yarn", "pnpm", "bun"], category: "javascript", confidence: 0.7 },
  { commands: ["npm", "yarn", "pnpm"], category: "deployment", confidence: 0.5 },
  { commands: ["pip", "pip3", "uv"], category: "python", confidence: 0.7 },
  { commands: ["cargo", "rustc"], category: "rust", confidence: 0.7 },
  { commands: ["docker", "docker-compose"], category: "docker", confidence: 0.7 },
  { commands: ["docker", "docker-compose"], category: "containerization", confidence: 0.6 },
  { commands: ["psql", "sqlite3", "mysql"], category: "database", confidence: 0.8 },
  { commands: ["git"], category: "git-workflows", confidence: 0.7 },
  { commands: ["git"], category: "version-control", confidence: 0.6 },
  { commands: ["pytest", "jest", "vitest", "mocha"], category: "testing", confidence: 0.7 },
  { commands: ["tsc", "eslint", "biome", "ruff"], category: "programming", confidence: 0.6 },
];

// ---------------------------------------------------------------------------
// TaskDetector
// ---------------------------------------------------------------------------

export class TaskDetector {
  private history: SessionHistoryEntry[] = [];
  private readonly maxHistorySize: number;
  private readonly confidenceThreshold: number;

  constructor(options?: TaskDetectorOptions) {
    this.maxHistorySize = options?.maxHistorySize ?? DEFAULT_MAX_HISTORY;
    this.confidenceThreshold = options?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Analyze free-form text (from user messages). */
  analyzeText(text: string): DetectedContext {
    const signals: DetectedSignal[] = [];
    const lower = text.toLowerCase();

    // 1. Tokenize & filter stop-words
    const tokens = lower
      .split(/[^a-z0-9./]+/)
      .filter((t) => t.length > 0 && !STOP_WORDS.has(t));

    // 2. Check keywords — collect ALL matches, combine via noisy-OR per category
    const categoryConfidences = new Map<string, number>();

    for (const token of tokens) {
      for (const entry of KEYWORD_MAP) {
        if (entry.keywords.includes(token)) {
          const existing = categoryConfidences.get(entry.category);
          if (existing !== undefined) {
            // Noisy-OR: P(at least one) = 1 - Π(1 - Pi)
            categoryConfidences.set(entry.category, 1 - (1 - existing) * (1 - entry.confidence));
          } else {
            categoryConfidences.set(entry.category, entry.confidence);
          }
        }
      }
    }

    for (const entry of KEYWORD_MAP) {
      for (const kw of entry.keywords) {
        if (kw.includes(" ") && lower.includes(kw)) {
          const existing = categoryConfidences.get(entry.category);
          if (existing !== undefined) {
            categoryConfidences.set(entry.category, 1 - (1 - existing) * (1 - entry.confidence));
          } else {
            categoryConfidences.set(entry.category, entry.confidence);
          }
        }
      }
    }

    for (const [category, confidence] of categoryConfidences) {
      signals.push(this.keywordSignal(category, category, confidence));
    }

    // 4. Check for file extensions embedded in text
    const extMatches = lower.matchAll(/[\w/-]+\.[a-z]{1,5}\b/g);
    for (const match of extMatches) {
      const filename = match[0];
      const dotIdx = filename.lastIndexOf(".");
      if (dotIdx === -1) continue;
      const ext = filename.slice(dotIdx);
      for (const entry of EXTENSION_MAP) {
        if (entry.extensions.includes(ext)) {
          signals.push(this.extensionSignal(ext, entry.category, entry.confidence));
        }
      }
    }

    // 5. Check for programming language keywords in text
    for (const token of tokens) {
      // React detection
      if (token === "react" || token === "jsx" || token === "tsx") {
        signals.push(this.keywordSignal(token, "react", 0.7));
        signals.push(this.keywordSignal(token, "frontend", 0.6));
      }
    }

    return this.buildContext(signals);
  }

  /** Analyze a tool call (from tool.execute.before). */
  analyzeToolCall(toolName: string, args: Record<string, unknown>): DetectedContext {
    const signals: DetectedSignal[] = [];
    const lower = toolName.toLowerCase();

    // File-reading/writing tools → check extension
    if (lower === "read" || lower === "write" || lower === "edit") {
      const filename = String(args.filename ?? args.path ?? "").toLowerCase();
      if (filename) {
        const dotIdx = filename.lastIndexOf(".");
        if (dotIdx !== -1) {
          const ext = filename.slice(dotIdx);
          for (const entry of EXTENSION_MAP) {
            if (entry.extensions.includes(ext)) {
              signals.push(this.extensionSignal(ext, entry.category, entry.confidence));
            }
          }
          // Also add filename signal for specific matches
          signals.push(this.filenameSignal(filename, this.inferCategoryFromFilename(filename), 0.8));
        }
      }
    }

    // Shell tools → check command
    if (lower === "bash" || lower === "shell" || lower === "terminal") {
      const command = String(args.command ?? "").toLowerCase();
      if (command) {
        const cmdTokens = command.split(/\s+/);
        for (const cmd of cmdTokens) {
          for (const entry of COMMAND_MAP) {
            if (entry.commands.includes(cmd)) {
              signals.push(this.commandSignal(cmd, entry.category, entry.confidence));
            }
          }
        }
      }
    }

    return this.buildContext(signals);
  }

  /** Analyze session history for patterns. */
  analyzeHistory(): DetectedContext {
    const signals: DetectedSignal[] = [];
    const categoryCounts = new Map<string, number>();

    for (const entry of this.history) {
      const ctx = this.analyzeToolCall(entry.toolName, entry.args);
      for (const sig of ctx.signals) {
        signals.push(sig);
        categoryCounts.set(sig.category, (categoryCounts.get(sig.category) ?? 0) + 1);
      }
    }

    // Boost confidence for repeated categories (3+ occurrences)
    for (const sig of signals) {
      const count = categoryCounts.get(sig.category) ?? 0;
      if (count >= 3) {
        const boost = Math.min(count - 2, 8) * 0.1; // up to +0.8
        sig.confidence = Math.min(1.0, sig.confidence + boost);
      }
    }

    return this.buildContext(signals);
  }

  /** Record a tool call to session history. */
  recordToolCall(toolName: string, args: Record<string, unknown>): void {
    this.history.push({
      toolName,
      args,
      timestamp: Date.now(),
    });
    // Trim oldest if over limit
    while (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /** Clear session history. */
  clearHistory(): void {
    this.history = [];
  }

  /** Get current session history (shallow copy). */
  getHistory(): SessionHistoryEntry[] {
    return [...this.history];
  }

  // -----------------------------------------------------------------------
  // Signal factories
  // -----------------------------------------------------------------------

  private keywordSignal(keyword: string, category: string, confidence = 0.5): DetectedSignal {
    return { type: "keyword", value: keyword, category, confidence };
  }

  private extensionSignal(ext: string, category: string, confidence = 0.9): DetectedSignal {
    return { type: "extension", value: ext, category, confidence };
  }

  private commandSignal(cmd: string, category: string, confidence = 0.7): DetectedSignal {
    return { type: "command", value: cmd, category, confidence };
  }

  private filenameSignal(name: string, category: string, confidence = 0.8): DetectedSignal {
    return { type: "filename", value: name, category, confidence };
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /** Deduplicate signals by category, keeping highest confidence, then build context. */
  private buildContext(signals: DetectedSignal[]): DetectedContext {
    // Deduplicate by category — keep highest confidence signal per category
    const bestByCategory = new Map<string, DetectedSignal>();
    for (const sig of signals) {
      const existing = bestByCategory.get(sig.category);
      if (!existing || sig.confidence > existing.confidence) {
        bestByCategory.set(sig.category, sig);
      }
    }

    const deduped = [...bestByCategory.values()];

    // Overall confidence = average of top 3 signal confidences (or fewer)
    const sorted = deduped
      .map((s) => s.confidence)
      .sort((a, b) => b - a)
      .slice(0, 3);

    const confidence = sorted.length === 0
      ? 0
      : sorted.reduce((sum, c) => sum + c, 0) / sorted.length;

    // Only include categories above threshold
    const categories = deduped
      .filter((s) => s.confidence >= this.confidenceThreshold)
      .map((s) => s.category);

    // Deduplicate categories
    const uniqueCategories = [...new Set(categories)];

    return {
      categories: uniqueCategories,
      confidence: Math.round(confidence * 100) / 100,
      signals: deduped,
      timestamp: Date.now(),
    };
  }

  /** Merge multiple DetectedContexts into one. */
  mergeContexts(contexts: DetectedContext[]): DetectedContext {
    if (contexts.length === 0) {
      return { categories: [], confidence: 0, signals: [], timestamp: Date.now() };
    }

    const allSignals: DetectedSignal[] = [];
    for (const ctx of contexts) {
      allSignals.push(...ctx.signals);
    }

    return this.buildContext(allSignals);
  }

  /** Infer a general category from filename when extension match isn't specific enough. */
  private inferCategoryFromFilename(filename: string): string {
    if (filename.endsWith(".pdf") || filename.endsWith(".doc") || filename.endsWith(".docx")) {
      return "pdf-processing";
    }
    if (filename.endsWith(".xlsx") || filename.endsWith(".xls") || filename.endsWith(".csv")) {
      return "spreadsheet";
    }
    if (filename.endsWith(".sql") || filename.endsWith(".db") || filename.endsWith(".sqlite")) {
      return "database";
    }
    if (filename.endsWith(".json") || filename.endsWith(".yaml") || filename.endsWith(".yml")) {
      return "config";
    }
    if (filename.endsWith(".md") || filename.endsWith(".rst")) {
      return "documentation";
    }
    return "programming";
  }
}
