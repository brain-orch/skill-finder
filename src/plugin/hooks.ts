/**
 * Hook handlers for the SkillFinder plugin.
 *
 * Detects task categories from messages and tool calls,
 * applies debouncing to avoid redundant searches.
 */

export interface HookConfig {
  debounceMs?: number; // Default: 30000 (30s per category)
}

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
  canSearch(category: string): boolean {
    const now = Date.now();
    const last = this.lastSearchTime.get(category);

    if (last === undefined || now - last > this.config.debounceMs!) {
      this.lastSearchTime.set(category, now);
      return true;
    }

    return false;
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
