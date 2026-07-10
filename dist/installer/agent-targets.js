import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
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
/*  Configurable Targets                                               */
/* ------------------------------------------------------------------ */
let configTargets = null;
/**
 * Load custom agent targets from config. Custom targets override built-in ones
 * if they share the same name, and are otherwise additive.
 */
export function loadConfigTargets(config) {
    if (!config.agentTargets) {
        configTargets = null;
        return;
    }
    configTargets = {};
    let maxPriority = 0;
    for (const info of Object.values(AGENT_TARGETS)) {
        if (info.priority > maxPriority)
            maxPriority = info.priority;
    }
    for (const [name, dir] of Object.entries(config.agentTargets)) {
        if (typeof name === "string" && typeof dir === "string") {
            configTargets[name] = {
                dir,
                priority: maxPriority + 1,
            };
            maxPriority++;
        }
    }
}
/**
 * Get all agent targets (built-in merged with config targets).
 * Config targets override built-in targets with the same name.
 */
export function getAllTargets() {
    const merged = {};
    // Start with built-in targets
    for (const [name, info] of Object.entries(AGENT_TARGETS)) {
        merged[name] = { ...info };
    }
    // Override/add with config targets
    if (configTargets) {
        for (const [name, info] of Object.entries(configTargets)) {
            merged[name] = { ...info };
        }
    }
    return merged;
}
/* ------------------------------------------------------------------ */
/*  Detection Functions                                                */
/* ------------------------------------------------------------------ */
/**
 * Detect which agents are active in the project by checking for their config/skills directories.
 * Returns array of active agent names in priority order.
 */
export function detectActiveAgents(projectRoot) {
    const active = [];
    const allTargets = getAllTargets();
    for (const [target, info] of Object.entries(allTargets)) {
        const targetDir = path.join(projectRoot, info.dir);
        if (fs.existsSync(targetDir)) {
            active.push(target);
        }
    }
    // Sort by priority (lower number = higher priority)
    active.sort((a, b) => (allTargets[a]?.priority ?? Infinity) - (allTargets[b]?.priority ?? Infinity));
    return active;
}
/**
 * Check if a specific agent target directory exists.
 */
export function targetExists(projectRoot, target) {
    const allTargets = getAllTargets();
    const info = allTargets[target];
    if (!info)
        return false;
    const targetDir = path.join(projectRoot, info.dir);
    return fs.existsSync(targetDir);
}
/**
 * Get the full path for a target skill directory.
 */
export function getTargetPath(projectRoot, target) {
    const allTargets = getAllTargets();
    const info = allTargets[target];
    if (!info)
        throw new Error(`Unknown agent target: ${target}`);
    return path.join(projectRoot, info.dir);
}
const AGENT_DIR_PROBES = [
    { name: "opencode", dir: ".opencode/skills", confidence: "high", source: "project" },
    { name: "claude", dir: ".claude/skills", confidence: "high", source: "project" },
    { name: "cursor", dir: ".cursor/skills", confidence: "high", source: "project" },
    { name: "codex", dir: ".agents/skills", confidence: "high", source: "project" },
    { name: "windsurf", dir: ".windsurf/skills", confidence: "medium", source: "project" },
    { name: "github-agents", dir: ".github/agents", confidence: "medium", source: "project" },
];
const HOME_AGENT_DIR_PROBES = [
    { name: "claude-global", dir: ".claude/plugins", confidence: "medium", source: "home" },
    { name: "cursor-global", dir: ".cursor/skills", confidence: "medium", source: "home" },
];
/**
 * Scan common agent directories in project root and home directory.
 * Only detects existing directories — never creates them.
 * Timeboxed to 2 seconds max to avoid slowing down install.
 */
export function probeAgentDirs(projectRoot) {
    const detected = [];
    const start = Date.now();
    const TIMEOUT_MS = 2000;
    for (const probe of AGENT_DIR_PROBES) {
        if (Date.now() - start > TIMEOUT_MS)
            break;
        const fullPath = path.join(projectRoot, probe.dir);
        try {
            if (fs.existsSync(fullPath)) {
                detected.push({
                    name: probe.name,
                    dir: probe.dir,
                    confidence: probe.confidence,
                    source: probe.source,
                });
            }
        }
        catch (err) {
            console.warn("[skill-finder] skipping inaccessible project agent path:", err instanceof Error ? err.message : String(err));
        }
    }
    const homeDir = os.homedir();
    for (const probe of HOME_AGENT_DIR_PROBES) {
        if (Date.now() - start > TIMEOUT_MS)
            break;
        const fullPath = path.join(homeDir, probe.dir);
        try {
            if (fs.existsSync(fullPath)) {
                detected.push({
                    name: probe.name,
                    dir: probe.dir,
                    confidence: probe.confidence,
                    source: probe.source,
                });
            }
        }
        catch (err) {
            console.warn("[skill-finder] skipping inaccessible home agent path:", err instanceof Error ? err.message : String(err));
        }
    }
    return detected;
}
//# sourceMappingURL=agent-targets.js.map