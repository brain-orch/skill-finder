/**
 * Task context detection engine for the SkillFinder plugin.
 *
 * Analyzes user messages, tool calls, and session history to determine
 * which skill categories are relevant, with confidence scoring.
 */
import type { DetectedContext, SessionHistoryEntry, TaskDetectorOptions } from "./categories.js";
export { STOP_WORDS, KEYWORD_MAP, EXTENSION_MAP, COMMAND_MAP, } from "./categories.js";
export type { KeywordEntry, ExtensionEntry, CommandEntry, DetectedContext, DetectedSignal, SessionHistoryEntry, TaskDetectorOptions, } from "./categories.js";
export declare class TaskDetector {
    private history;
    private readonly maxHistorySize;
    private readonly confidenceThreshold;
    constructor(options?: TaskDetectorOptions);
    /** Analyze free-form text (from user messages). */
    analyzeText(text: string): DetectedContext;
    /** Analyze a tool call (from tool.execute.before). */
    analyzeToolCall(toolName: string, args: Record<string, unknown>): DetectedContext;
    /** Analyze session history for patterns. */
    analyzeHistory(): DetectedContext;
    /** Record a tool call to session history. */
    recordToolCall(toolName: string, args: Record<string, unknown>): void;
    clearHistory(): void;
    getHistory(): SessionHistoryEntry[];
    private keywordSignal;
    private extensionSignal;
    private commandSignal;
    private filenameSignal;
    private buildContext;
    mergeContexts(contexts: DetectedContext[]): DetectedContext;
    private inferCategoryFromFilename;
}
//# sourceMappingURL=detector.d.ts.map