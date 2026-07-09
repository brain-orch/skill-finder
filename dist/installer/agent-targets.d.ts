import type { SkillFinderConfig } from "../config.js";
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
 * Load custom agent targets from config. Custom targets override built-in ones
 * if they share the same name, and are otherwise additive.
 */
export declare function loadConfigTargets(config: SkillFinderConfig): void;
/**
 * Get all agent targets (built-in merged with config targets).
 * Config targets override built-in targets with the same name.
 */
export declare function getAllTargets(): Record<string, AgentTargetInfo>;
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
export interface DetectedAgent {
    name: string;
    dir: string;
    confidence: "high" | "medium" | "low";
    source: string;
}
/**
 * Scan common agent directories in project root and home directory.
 * Only detects existing directories — never creates them.
 * Timeboxed to 2 seconds max to avoid slowing down install.
 */
export declare function probeAgentDirs(projectRoot: string): DetectedAgent[];
//# sourceMappingURL=agent-targets.d.ts.map