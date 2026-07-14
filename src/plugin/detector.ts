/**
 * Task context detection engine for the SkillFinder plugin.
 *
 * Analyzes user messages, tool calls, and session history to determine
 * which skill categories are relevant, with confidence scoring.
 */

import {
  STOP_WORDS, KEYWORD_MAP, EXTENSION_MAP, COMMAND_MAP,
} from "./categories.js";

import type {
  DetectedContext, DetectedSignal, SessionHistoryEntry, TaskDetectorOptions,
} from "./categories.js";

export {
  STOP_WORDS, KEYWORD_MAP, EXTENSION_MAP, COMMAND_MAP,
} from "./categories.js";

export type {
  KeywordEntry, ExtensionEntry, CommandEntry,
  DetectedContext, DetectedSignal, SessionHistoryEntry, TaskDetectorOptions,
} from "./categories.js";

const DEFAULT_MAX_HISTORY = 100;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

export class TaskDetector {
  private history: SessionHistoryEntry[] = [];
  private readonly maxHistorySize: number;
  private readonly confidenceThreshold: number;

  constructor(options?: TaskDetectorOptions) {
    this.maxHistorySize = options?.maxHistorySize ?? DEFAULT_MAX_HISTORY;
    this.confidenceThreshold = options?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  }

  /** Analyze free-form text (from user messages). */
  analyzeText(text: string): DetectedContext {
    const signals: DetectedSignal[] = [];
    const lower = text.toLowerCase();
    const tokens = lower.split(/[^a-z0-9./]+/).filter((t) => t.length > 0 && !STOP_WORDS.has(t));
    const categoryConfidences = new Map<string, number>();

    for (const token of tokens) {
      for (const entry of KEYWORD_MAP) {
        if (entry.keywords.includes(token)) {
          const existing = categoryConfidences.get(entry.category);
          if (existing !== undefined) {
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

    for (const token of tokens) {
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
          signals.push(this.filenameSignal(filename, this.inferCategoryFromFilename(filename), 0.8));
        }
      }
    }

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

    for (const sig of signals) {
      const count = categoryCounts.get(sig.category) ?? 0;
      if (count >= 3) {
        const boost = Math.min(count - 2, 8) * 0.1;
        sig.confidence = Math.min(1.0, sig.confidence + boost);
      }
    }

    return this.buildContext(signals);
  }

  /** Record a tool call to session history. */
  recordToolCall(toolName: string, args: Record<string, unknown>): void {
    this.history.push({ toolName, args, timestamp: Date.now() });
    while (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  clearHistory(): void {
    this.history = [];
  }

  getHistory(): SessionHistoryEntry[] {
    return [...this.history];
  }

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

  private buildContext(signals: DetectedSignal[]): DetectedContext {
    const bestByCategory = new Map<string, DetectedSignal>();
    for (const sig of signals) {
      const existing = bestByCategory.get(sig.category);
      if (!existing || sig.confidence > existing.confidence) {
        bestByCategory.set(sig.category, sig);
      }
    }

    const deduped = [...bestByCategory.values()];
    const sorted = deduped.map((s) => s.confidence).sort((a, b) => b - a).slice(0, 3);
    const confidence = sorted.length === 0 ? 0 : sorted.reduce((sum, c) => sum + c, 0) / sorted.length;
    const categories = deduped.filter((s) => s.confidence >= this.confidenceThreshold).map((s) => s.category);
    const uniqueCategories = [...new Set(categories)];

    return {
      categories: uniqueCategories,
      confidence: Math.round(confidence * 100) / 100,
      signals: deduped,
      timestamp: Date.now(),
    };
  }

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
