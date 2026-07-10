/**
 * Hook handlers for the SkillFinder plugin.
 *
 * Detects task categories from messages and tool calls,
 * applies debouncing to avoid redundant searches.
 */

export interface HookConfig {
  debounceMs?: number; // Default: 30000 (30s per category)
}

/** Adaptive throttle input passed by the caller to adjust debounce dynamically. */
export interface AdaptiveThrottle {
  acceptanceRate: number;       // 0..1 — ratio of accepts to total recommendations
  consecutiveDismissals: number;
}

// Threshold defaults — tunable in future versions
const HIGH_ACCEPTANCE_THRESHOLD = 0.5;
const LOW_ACCEPTANCE_THRESHOLD = 0.2;
const DISMISSAL_SUPPRESS_THRESHOLD = 5;

/** Keyword → categories mapping */
const KEYWORD_MAP: [string[], string[]][] = [
  [["pdf", "extract text", "document", "ocr"], ["pdf-processing", "document"]],
  [["excel", "spreadsheet", "csv", "sheet"], ["spreadsheet", "data-analysis"]],
  [["git", "commit", "push", "pull", "merge"], ["git-workflows", "version-control"]],
  [["deploy", "publish", "release", "npm publish"], ["deployment", "devops"]],
  [["test", "testing", "unit test", "e2e"], ["testing", "quality"]],
  [["docker", "container", "dockerfile"], ["docker", "containerization"]],
  [["sql", "database", "query", "postgres"], ["database", "sql"]],
  [["react", "component", "frontend", "ui"], ["frontend", "react"]],
  [["api", "rest", "endpoint", "route"], ["api-development", "backend"]],
  [["security", "auth", "login", "password"], ["security", "authentication"]],
];

const DEFAULT_DEBOUNCE_MS = 30_000;

export class PluginHooks {
  private config: HookConfig;
  private lastSearchTime: Map<string, number> = new Map();
  private recommendationCount = 0;
  private acceptanceCount = 0;
  private consecutiveDismissals = 0;
  private suppressed = false;

  constructor(config?: HookConfig) {
    this.config = { debounceMs: config?.debounceMs ?? DEFAULT_DEBOUNCE_MS };
  }

  /**
   * Fires on session.created.
   * Logs session start and resets debounce state.
   */
  async onSessionCreated(_input: unknown): Promise<void> {
    console.log("skill-finder: session started");
    this.lastSearchTime.clear();
    this.recommendationCount = 0;
    this.acceptanceCount = 0;
    this.consecutiveDismissals = 0;
    this.suppressed = false;
  }

  /**
   * Fires on message.part.updated.
   * Extracts text from input/output and detects task categories.
   */
  async onMessagePartUpdated(input: unknown, output: unknown): Promise<void> {
    const text = this.extractText(input) + " " + this.extractText(output);
    const categories = this.detectCategories(text);

    for (const cat of categories) {
      if (this.canSearch(cat)) {
        console.log(`skill-finder: detected category '${cat}' from message`);
      }
    }
  }

  /**
   * Fires before every tool call.
   * Detects context from tool name and arguments.
   */
  async onToolExecuteBefore(input: unknown, output: unknown): Promise<void> {
    const rec = input as Record<string, unknown> | undefined;
    if (!rec) return;

    const toolName = rec.toolName ?? rec.tool ?? "";
    const args = (rec.args ?? {}) as Record<string, unknown>;

    const categories = this.detectToolCategories(toolName as string, args);

    for (const cat of categories) {
      if (this.canSearch(cat)) {
        console.log(`skill-finder: detected category '${cat}' from tool`);
      }
    }
  }

  /** Detect categories from free-form text via keyword matching. */
  detectCategories(text: string): string[] {
    const lower = text.toLowerCase();
    const matched: string[] = [];

    for (const [keywords, categories] of KEYWORD_MAP) {
      if (keywords.some((kw) => lower.includes(kw))) {
        matched.push(...categories);
      }
    }

    // Deduplicate while preserving order
    return [...new Set(matched)];
  }

  /** Check debounce: returns true if enough time has passed since last search for this category. */
  canSearch(category: string, suppressOn?: AdaptiveThrottle): boolean {
    if (this.suppressed) return false;

    let debounceMs = this.config.debounceMs!;

    if (suppressOn) {
      this.recommendationCount++;

      if (suppressOn.consecutiveDismissals >= DISMISSAL_SUPPRESS_THRESHOLD) {
        this.suppressed = true;
        return false;
      }

      if (suppressOn.acceptanceRate < LOW_ACCEPTANCE_THRESHOLD) {
        debounceMs = 60_000;
      } else if (suppressOn.acceptanceRate > HIGH_ACCEPTANCE_THRESHOLD) {
        debounceMs = 15_000;
      }
    }

    const now = Date.now();
    const last = this.lastSearchTime.get(category);

    if (last === undefined || now - last > debounceMs) {
      this.lastSearchTime.set(category, now);
      return true;
    }

    return false;
  }

  recordAcceptance(): void {
    this.acceptanceCount++;
    this.consecutiveDismissals = 0;
  }

  recordDismissal(): void {
    this.consecutiveDismissals++;
  }

  getRecommendationCount(): number {
    return this.recommendationCount;
  }

  getAcceptanceCount(): number {
    return this.acceptanceCount;
  }

  getConsecutiveDismissals(): number {
    return this.consecutiveDismissals;
  }

  isSuppressed(): boolean {
    return this.suppressed;
  }

  // ---- private helpers ----

  private extractText(value: unknown): string {
    if (typeof value === "string") return value;
    if (value === null || value === undefined) return "";
    const rec = value as Record<string, unknown>;
    if (typeof rec.text === "string") return rec.text;
    if (typeof rec.content === "string") return rec.content;
    return "";
  }

  private detectToolCategories(toolName: string, args: Record<string, unknown>): string[] {
    const lower = toolName.toLowerCase();
    const categories: string[] = [];

    if (lower === "read") {
      const filename = String(args.filename ?? args.path ?? "").toLowerCase();
      if (filename.endsWith(".pdf")) {
        categories.push("pdf-processing", "document");
      }
    }

    if (lower === "bash" || lower === "shell") {
      const command = String(args.command ?? "").toLowerCase();
      if (command.includes("git")) {
        categories.push("git-workflows", "version-control");
      }
      if (command.includes("npm")) {
        categories.push("deployment", "devops");
      }
      if (command.includes("docker")) {
        categories.push("docker", "containerization");
      }
      if (command.includes("test") || command.includes("vitest") || command.includes("jest")) {
        categories.push("testing", "quality");
      }
      if (command.includes("sql") || command.includes("psql") || command.includes("postgres")) {
        categories.push("database", "sql");
      }
    }

    return [...new Set(categories)];
  }
}
