/**
 * Skeleton hook handlers for the SkillFinder plugin.
 *
 * Each handler logs its invocation and is a no-op placeholder.
 * Real logic (marketplace indexing, keyword detection, context analysis)
 * will be added in subsequent waves.
 */
export class PluginHooks {
    constructor() {
        console.log("skill-finder: PluginHooks initialized");
    }
    /**
     * Fires on session.created (mapped to the 'event' hook).
     * Intended purpose: initialize skill index when a session starts.
     */
    async onSessionCreated(input) {
        console.log("skill-finder: session.created", { input });
    }
    /**
     * Fires on message.part.updated (mapped to 'chat.message').
     * Intended purpose: monitor message parts for task-related keywords.
     */
    async onMessagePartUpdated(input, output) {
        console.log("skill-finder: message.part.updated", {
            hasInput: !!input,
            hasOutput: !!output,
        });
    }
    /**
     * Fires on tool.execute.before (exact match).
     * Intended purpose: intercept tool calls to detect context for skill suggestions.
     */
    async onToolExecuteBefore(input, output) {
        const rec = input;
        console.log("skill-finder: tool.execute.before", {
            toolName: rec?.tool,
            hasArgs: !!output?.args,
        });
    }
}
//# sourceMappingURL=hooks.js.map