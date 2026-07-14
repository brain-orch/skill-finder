/**
 * Category definitions, mapping tables, and shared types for task context detection.
 *
 * Extracted from detector.ts for maintainability.
 * These are pure data — no detection logic.
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
/** Common English stop-words filtered during text analysis. */
export declare const STOP_WORDS: Set<string>;
/** Keyword → category with default confidence. */
export interface KeywordEntry {
    keywords: string[];
    category: string;
    confidence: number;
}
export declare const KEYWORD_MAP: KeywordEntry[];
/** File extension → category mapping. */
export interface ExtensionEntry {
    extensions: string[];
    category: string;
    confidence: number;
}
export declare const EXTENSION_MAP: ExtensionEntry[];
/** Shell command prefix → category mapping. */
export interface CommandEntry {
    commands: string[];
    category: string;
    confidence: number;
}
export declare const COMMAND_MAP: CommandEntry[];
//# sourceMappingURL=categories.d.ts.map