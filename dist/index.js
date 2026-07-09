import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig } from "./config.js";
import { PluginHooks } from "./plugin/hooks.js";
import { ProjectScanner } from "./scanner/project-scanner.js";
// Import tool definitions
import { searchTool, setScanResult } from "./tools/search.js";
import { installTool } from "./tools/install.js";
import { listTool } from "./tools/list.js";
import { removeTool } from "./tools/remove.js";
import { infoTool } from "./tools/info.js";
import { checkUpdatesTool } from "./tools/check-updates.js";
import { planTool, listPlansTool } from "./tools/plan.js";
import { exportPlanTool, importPlanTool } from "./tools/plan-share.js";
// Plugin-level config reference, populated at init
let pluginConfig;
let scanner = null;
export function getConfig() {
    return pluginConfig;
}
export function getScanner() {
    return scanner;
}
/**
 * Try to read the skill-finder plugin config from opencode.json.
 * Looks for the file in the project root (same dir that contains .opencode/).
 */
function readConfigFromFile() {
    try {
        // Walk up from the plugin directory to find opencode.json
        let dir = process.cwd();
        for (let i = 0; i < 10; i++) {
            const candidate = path.join(dir, ".opencode", "opencode.json");
            if (fs.existsSync(candidate)) {
                const raw = JSON.parse(fs.readFileSync(candidate, "utf-8"));
                const pluginsBlock = raw.plugins;
                if (pluginsBlock?.["skill-finder"]) {
                    const sf = pluginsBlock["skill-finder"];
                    return sf.config;
                }
            }
            const parent = path.dirname(dir);
            if (parent === dir)
                break; // reached root
            dir = parent;
        }
    }
    catch (e) {
        console.warn("skill-finder: could not read config from opencode.json", e);
    }
    return undefined;
}
export const SkillFinderPlugin = async ({ project, client, $, directory, worktree }) => {
    pluginConfig = loadConfig(readConfigFromFile());
    console.log("skill-finder: plugin initialized", JSON.stringify(pluginConfig));
    scanner = new ProjectScanner();
    // Fire-and-forget scan — don't block plugin init
    scanner.scan(process.cwd()).then((result) => {
        setScanResult(result);
        console.log("skill-finder: project scan complete", result.detectedStacks.map((s) => s.name));
    }).catch(() => { });
    const hooks = new PluginHooks();
    return {
        // ── Hooks ──────────────────────────────────────────────────────
        event: hooks.onSessionCreated,
        "chat.message": hooks.onMessagePartUpdated,
        "tool.execute.before": hooks.onToolExecuteBefore,
        // ── Custom tools ───────────────────────────────────────────────
        tool: {
            "skill-finder_search": searchTool,
            "skill-finder_install": installTool,
            "skill-finder_list": listTool,
            "skill-finder_remove": removeTool,
            "skill-finder_info": infoTool,
            "skill-finder_check-updates": checkUpdatesTool,
            "skill-finder_plan": planTool,
            "skill-finder_list-plans": listPlansTool,
            "skill-finder_export-plan": exportPlanTool,
            "skill-finder_import-plan": importPlanTool,
        },
    };
};
export default SkillFinderPlugin;
//# sourceMappingURL=index.js.map