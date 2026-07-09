import * as fs from "node:fs";
import * as path from "node:path";
/* ------------------------------------------------------------------ */
/*  Agent Target Configuration                                         */
/* ------------------------------------------------------------------ */
export const AGENT_TARGETS = {
    opencode: { dir: ".opencode/skills", priority: 1 },
    claude: { dir: ".claude/skills", priority: 2 },
    cursor: { dir: ".cursor/skills", priority: 3 },
    codex: { dir: ".agents/skills", priority: 4 },
    generic: { dir: ".agents/skills", priority: 5 },
};
/* ------------------------------------------------------------------ */
/*  Detection Functions                                                */
/* ------------------------------------------------------------------ */
/**
 * Detect which agents are active in the project by checking for their config/skills directories.
 * Returns array of active agent names in priority order.
 */
export function detectActiveAgents(projectRoot) {
    const active = [];
    for (const [target, info] of Object.entries(AGENT_TARGETS)) {
        const targetDir = path.join(projectRoot, info.dir);
        if (fs.existsSync(targetDir)) {
            active.push(target);
        }
    }
    // Sort by priority (lower number = higher priority)
    active.sort((a, b) => AGENT_TARGETS[a].priority - AGENT_TARGETS[b].priority);
    return active;
}
/**
 * Check if a specific agent target directory exists.
 */
export function targetExists(projectRoot, target) {
    const info = AGENT_TARGETS[target];
    if (!info)
        return false;
    const targetDir = path.join(projectRoot, info.dir);
    return fs.existsSync(targetDir);
}
/**
 * Get the full path for a target skill directory.
 */
export function getTargetPath(projectRoot, target) {
    const info = AGENT_TARGETS[target];
    if (!info)
        throw new Error(`Unknown agent target: ${target}`);
    return path.join(projectRoot, info.dir);
}
//# sourceMappingURL=agent-targets.js.map