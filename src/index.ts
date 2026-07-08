import * as fs from "node:fs";
import * as path from "node:path";
import type { Plugin } from "@opencode-ai/plugin";
import type { SkillFinderConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { PluginHooks } from "./plugin/hooks.js";
import { ProjectScanner } from "./scanner/project-scanner.js";

// Import tool definitions
import { searchTool } from "./tools/search.js";
import { installTool } from "./tools/install.js";
import { listTool } from "./tools/list.js";
import { removeTool } from "./tools/remove.js";
import { infoTool } from "./tools/info.js";
import { checkUpdatesTool } from "./tools/check-updates.js";
import { planTool } from "./tools/plan.js";

// Plugin-level config reference, populated at init
let pluginConfig: SkillFinderConfig;

let scanner: ProjectScanner | null = null;

export function getConfig(): SkillFinderConfig {
  return pluginConfig;
}

export function getScanner(): ProjectScanner | null {
  return scanner;
}

/**
 * Try to read the skill-finder plugin config from opencode.json.
 * Looks for the file in the project root (same dir that contains .opencode/).
 */
function readConfigFromFile(): Partial<SkillFinderConfig> | undefined {
  try {
    // Walk up from the plugin directory to find opencode.json
    let dir = process.cwd();
    for (let i = 0; i < 10; i++) {
      const candidate = path.join(dir, ".opencode", "opencode.json");
      if (fs.existsSync(candidate)) {
        const raw = JSON.parse(fs.readFileSync(candidate, "utf-8"));
        const pluginsBlock = raw.plugins as Record<string, unknown> | undefined;
        if (pluginsBlock?.["skill-finder"]) {
          const sf = pluginsBlock["skill-finder"] as Record<string, unknown>;
          return sf.config as Partial<SkillFinderConfig> | undefined;
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break; // reached root
      dir = parent;
    }
  } catch (e) {
    console.warn("skill-finder: could not read config from opencode.json", e);
  }
  return undefined;
}

export const SkillFinderPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  pluginConfig = loadConfig(readConfigFromFile());
  console.log("skill-finder: plugin initialized", JSON.stringify(pluginConfig));

  scanner = new ProjectScanner();

  // Fire-and-forget scan — don't block plugin init
  scanner.scan(process.cwd()).then((result) => {
    console.log(
      "skill-finder: project scan complete",
      result.detectedStacks.map((s) => s.name),
    );
  }).catch(() => {});

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
    },
  };
};

export default SkillFinderPlugin;
