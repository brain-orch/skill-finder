import { z } from "zod";
import { tool } from "@opencode-ai/plugin";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { marketplaceRegistry } from "../registry/instance.js";
import { SkillLockManager } from "../cache/skill-lock.js";
import {
  AGENT_TARGETS,
  detectActiveAgents,
  getAllTargets,
  probeAgentDirs,
  type AgentTarget,
} from "../installer/agent-targets.js";

const VALID_TARGETS = ["opencode", "claude", "cursor", "codex", "all", "auto", "detect"] as const;

const installArgsSchema = z.object({
  identifier: z.string().describe("Skill identifier (required)"),
  marketplace: z.string().describe("Marketplace name (required)"),
  confirm: z.boolean().default(true).describe("Skip confirmation (default true)"),
  target: z
    .string()
    .default("opencode")
    .describe("Agent target: opencode, claude, cursor, codex, all, auto, detect (default: opencode)"),
});

function resolveTargets(
  target: string,
  projectRoot: string,
): AgentTarget[] {
  const allTargets = getAllTargets();

  if (target === "all") {
    const active = detectActiveAgents(projectRoot);
    return active.length > 0 ? active : ["opencode"];
  }

  if (target === "auto") {
    const active = detectActiveAgents(projectRoot);
    return active.length > 0 ? [active[0]] : ["opencode"];
  }

  if (target === "detect") {
    const detected = probeAgentDirs(projectRoot);
    const targets: AgentTarget[] = [];
    for (const agent of detected) {
      if (allTargets[agent.name]) {
        targets.push(agent.name as AgentTarget);
      }
    }
    return targets.length > 0 ? targets : ["opencode"];
  }

  const validTarget = target as AgentTarget;
  if (allTargets[validTarget]) {
    return [validTarget];
  }

  return ["opencode"];
}

function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export const installTool = tool({
  description: "Download and install a skill",
  args: installArgsSchema.shape,
  async execute(args, ctx) {
    const identifier = args.identifier.trim();
    if (!identifier) {
      return "❌ Error: identifier is required and must be non-empty.";
    }

    const marketplace = args.marketplace.trim();
    if (!marketplace) {
      return "❌ Error: marketplace is required and must be non-empty.";
    }

    const confirm = args.confirm ?? true;
    if (!confirm) {
      return "## ⚠️ Confirmation Required\nPass `confirm=true` to proceed with installation.";
    }

    const adapter = marketplaceRegistry.getMarketplace(marketplace);
    if (!adapter) {
      return `## ❌ Unknown Marketplace\nMarketplace '${marketplace}' is not available. Available: ${marketplaceRegistry.listAvailable().join(", ")}`;
    }

    const projectRoot = ctx.directory || process.cwd();
    const targetInput = args.target?.trim() || "opencode";
    const targets = resolveTargets(targetInput, projectRoot);

    // Parse identifier to get skill name: "marketplace:skill-name" or "skill-name"
    const skillName = identifier.includes(":") ? identifier.split(":")[1] : identifier;
    const marketplaceDir = identifier.includes(":") ? identifier.split(":")[0] : marketplace;

    // Download to temp dir first
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-install-"));
    const tmpTargetDir = path.join(tmpDir, "download");

    try {
      const result = await adapter.install(identifier, tmpTargetDir);

      const installedPaths: string[] = [];
      const installedTargets: string[] = [];

      for (const target of targets) {
        const allTargets = getAllTargets();
        const agentInfo = allTargets[target];
        if (!agentInfo) continue;
        const targetBaseDir = path.join(projectRoot, agentInfo.dir, marketplaceDir, skillName);

        // Only install if target directory exists
        const agentDir = path.join(projectRoot, agentInfo.dir);
        if (!fs.existsSync(agentDir)) {
          continue;
        }

        // Copy from temp to target
        if (fs.existsSync(result.path)) {
          const sourcePath = result.path;
          if (fs.statSync(sourcePath).isDirectory()) {
            copyDirRecursive(sourcePath, targetBaseDir);
          } else {
            fs.mkdirSync(path.dirname(targetBaseDir), { recursive: true });
            fs.copyFileSync(sourcePath, targetBaseDir);
          }
        }

        const relativePath = path.relative(projectRoot, targetBaseDir);
        installedPaths.push(relativePath);
        installedTargets.push(agentInfo.dir);
      }

      if (installedPaths.length === 0) {
        const allTargets = getAllTargets();
        return `## ⚠️ No Target Directories\nSkill downloaded but no agent target directories exist. Create one of: ${targets.map((t) => allTargets[t]?.dir ?? t).join(", ")}`;
      }

      // Lock with targets
      try {
        const lockManager = new SkillLockManager(projectRoot);
        const skillFile = installedPaths[0]
          ? path.join(projectRoot, installedPaths[0], "SKILL.md")
          : "";
        const content = fs.existsSync(skillFile)
          ? fs.readFileSync(skillFile, "utf-8")
          : JSON.stringify(result.files);
        
        // Get skill info to check for version (adapter may not provide version)
        let version = "0.0.0";
        let versionRange = "^0.0.0";
        let changelog = "unknown";
        let breaking = false;
        let dependencies: string[] = [];
        
        try {
          const skillInfo = await adapter.getSkillInfo(identifier);
          if (skillInfo) {
            // SkillSearchResult doesn't have version, so we default to "0.0.0"
          }
        } catch {
          // Skill info fetch failure should not block installation
        }
        
        lockManager.lockSkill(identifier, content, {
          installedAt: new Date().toISOString(),
          marketplace,
          version,
          versionRange,
          changelog,
          breaking,
          dependencies,
        }, installedTargets);
      } catch {
        // Lockfile write failure should not block installation
      }

      const lines: string[] = [
        `## ✅ Installed ${identifier}`,
        `- **Marketplace:** ${marketplace}`,
        `- **Target:** ${targetInput}`,
        `- **Installed at:**`,
      ];

      for (const p of installedPaths) {
        lines.push(`  - \`${p}\``);
      }

      if (result.files.length > 0) {
        lines.push(`- **Files:** ${result.files.join(", ")}`);
      }

      return lines.join("\n");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `## ❌ Installation Failed\n${message}`;
    } finally {
      // Cleanup temp dir
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  },
});
