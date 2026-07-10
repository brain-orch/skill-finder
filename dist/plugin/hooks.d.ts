/**
 * Hook handlers for the SkillFinder plugin.
 *
 * Detects task categories from messages and tool calls,
 * applies debouncing to avoid redundant searches.
 */
export interface HookConfig {
    debounceMs?: number;
}
/** Adaptive throttle input passed by the caller to adjust debounce dynamically. */
export interface AdaptiveThrottle {
    acceptanceRate: number;
    consecutiveDismissals: number;
}
export declare class PluginHooks {
    private config;
    private lastSearchTime;
    private recommendationCount;
    private acceptanceCount;
    private consecutiveDismissals;
    private suppressed;
    constructor(config?: HookConfig);
    /**
     * Fires on session.created.
     * Logs session start and resets debounce state.
     */
    onSessionCreated(_input: unknown): Promise<void>;
    /**
     * Fires on message.part.updated.
     * Extracts text from input/output and detects task categories.
     */
    onMessagePartUpdated(input: unknown, output: unknown): Promise<void>;
    /**
     * Fires before every tool call.
     * Detects context from tool name and arguments.
     */
    onToolExecuteBefore(input: unknown, output: unknown): Promise<void>;
    /** Detect categories from free-form text via keyword matching. */
    detectCategories(text: string): string[];
    /** Check debounce: returns true if enough time has passed since last search for this category. */
    canSearch(category: string, suppressOn?: AdaptiveThrottle): boolean;
    recordAcceptance(): void;
    recordDismissal(): void;
    getRecommendationCount(): number;
    getAcceptanceCount(): number;
    getConsecutiveDismissals(): number;
    isSuppressed(): boolean;
    private extractText;
    private detectToolCategories;
}
//# sourceMappingURL=hooks.d.ts.map