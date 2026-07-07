/**
 * Skeleton hook handlers for the SkillFinder plugin.
 *
 * Each handler logs its invocation and is a no-op placeholder.
 * Real logic (marketplace indexing, keyword detection, context analysis)
 * will be added in subsequent waves.
 */
export declare class PluginHooks {
    constructor();
    /**
     * Fires on session.created (mapped to the 'event' hook).
     * Intended purpose: initialize skill index when a session starts.
     */
    onSessionCreated(input: unknown): Promise<void>;
    /**
     * Fires on message.part.updated (mapped to 'chat.message').
     * Intended purpose: monitor message parts for task-related keywords.
     */
    onMessagePartUpdated(input: unknown, output: unknown): Promise<void>;
    /**
     * Fires on tool.execute.before (exact match).
     * Intended purpose: intercept tool calls to detect context for skill suggestions.
     */
    onToolExecuteBefore(input: unknown, output: unknown): Promise<void>;
}
//# sourceMappingURL=hooks.d.ts.map