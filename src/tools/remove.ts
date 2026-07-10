import { z } from "zod";
import { tool } from "@opencode-ai/plugin";
import * as fs from "node:fs";
import * as path from "node:path";
import { SkillLockManager } from "../cache/skill-lock.js";
import { detectActiveAgents, AGENT_TARGETS } from "../installer/agent-targets.js";

const removeArgsSchema = z.object({
  identifier: z.string().describe("Skill identifier (required)"),
});

export const removeTool = tool({
  description: "Remove a cached skill",
  args: removeArgsSchema.shape,
  async execute(args, ctx) {
    const identifier = args.identifier.trim();
    if (!identifier) {
      return "❌ Error: identifier is required and must be non-empty.";
    }

    const projectRoot = ctx.directory || process.cwd();
    const activeAgents = detectActiveAgents(projectRoot);
    if (activeAgents.length === 0) {
      activeAgents.push("opencode");
    }

    // Parse identifier: "{marketplace}:{name}" or just "{name}"
    let marketplace: string;
    let skillName: string;

    if (identifier.includes(":")) {
      [marketplace, skillName] = identifier.split(":", 2);
    } else {
      // Search all marketplace dirs for the skill name
      marketplace = "";
      skillName = identifier;
    }

    const removedPaths: string[] = [];

    for (const agent of activeAgents) {
      const agentInfo = AGENT_TARGETS[agent];
      const agentDir = path.join(projectRoot, agentInfo.dir);

      if (!fs.existsSync(agentDir)) continue;

      if (marketplace) {
        // Direct path
        const skillPath = path.join(agentDir, marketplace, skillName);
        if (fs.existsSync(skillPath) && fs.statSync(skillPath).isDirectory()) {
          fs.rmSync(skillPath, { recursive: true, force: true });
          removedPaths.push(path.relative(projectRoot, skillPath));
        }
      } else {
        // Search all marketplace dirs
        const marketplaces = fs.readdirSync(agentDir).filter((d) => {
          const full = path.join(agentDir, d);
          return fs.statSync(full).isDirectory();
        });

        for (const mp of marketplaces) {
          const candidate = path.join(agentDir, mp, skillName);
          if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
            fs.rmSync(candidate, { recursive: true, force: true });
            removedPaths.push(path.relative(projectRoot, candidate));
          }
        }
      }
    }

    if (removedPaths.length === 0) {
      return `## ❌ Not Found\nSkill '${identifier}' is not installed.`;
    }

    // Unlock from lockfile
    try {
      const lockManager = new SkillLockManager(projectRoot);
      lockManager.unlockSkill(identifier);
    } catch (err) {
      console.warn(
        "[skill-finder] lockfile write failed during removal:",
        err instanceof Error ? err.message : String(err),
      );
    }

    const lines: string[] = [
      `## ✅ Removed ${identifier}`,
      `- **Removed from:**`,
    ];

    for (const p of removedPaths) {
      lines.push(`  - \`${p}\``);
    }

    return lines.join("\n");
  },
});
