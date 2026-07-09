export declare const AGENT_TARGETS: {
    readonly opencode: {
        readonly dir: ".opencode/skills";
        readonly priority: 1;
    };
    readonly claude: {
        readonly dir: ".claude/skills";
        readonly priority: 2;
    };
    readonly cursor: {
        readonly dir: ".cursor/skills";
        readonly priority: 3;
    };
    readonly codex: {
        readonly dir: ".agents/skills";
        readonly priority: 4;
    };
    readonly generic: {
        readonly dir: ".agents/skills";
        readonly priority: 5;
    };
};
export type AgentTarget = keyof typeof AGENT_TARGETS;
export interface AgentTargetInfo {
    dir: string;
    priority: number;
}
/**
 * Detect which agents are active in the project by checking for their config/skills directories.
 * Returns array of active agent names in priority order.
 */
export declare function detectActiveAgents(projectRoot: string): AgentTarget[];
/**
 * Check if a specific agent target directory exists.
 */
export declare function targetExists(projectRoot: string, target: AgentTarget): boolean;
/**
 * Get the full path for a target skill directory.
 */
export declare function getTargetPath(projectRoot: string, target: AgentTarget): string;
//# sourceMappingURL=agent-targets.d.ts.map