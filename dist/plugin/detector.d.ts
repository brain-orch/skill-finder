/**
 * Task context detection engine for the SkillFinder plugin.
 *
 * Analyzes user messages, tool calls, and session history to determine
 * which skill categories are relevant, with confidence scoring.
 */
export interface DetectedContext {
    categories: string[];
    confidence: number;
    signals: DetectedSignal[];
    timestamp: number;
}
export interface DetectedSignal {
    type: "keyword" | "extension" | "command" | "filename";
    value: string;
    category: string;
    confidence: number;
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
    /** Clear session history. */
    clearHistory(): void;
    /** Get current session history (shallow copy). */
    getHistory(): SessionHistoryEntry[];
    private keywordSignal;
    private extensionSignal;
    private commandSignal;
    private filenameSignal;
    /** Deduplicate signals by category, keeping highest confidence, then build context. */
    private buildContext;
    /** Merge multiple DetectedContexts into one. */
    mergeContexts(contexts: DetectedContext[]): DetectedContext;
    /** Infer a general category from filename when extension match isn't specific enough. */
    private inferCategoryFromFilename;
}
//# sourceMappingURL=detector.d.ts.map