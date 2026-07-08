import { z } from "zod";
import { tool } from "@opencode-ai/plugin";
import * as fs from "node:fs";
import * as path from "node:path";
import { SKILLS_DIR } from "../constants.js";

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

    const baseDir = path.join(ctx.directory || process.cwd(), SKILLS_DIR);

    // Parse identifier: "{marketplace}:{name}" or just "{name}"
    let skillPath: string | null = null;
    let relativePath = "";

    if (identifier.includes(":")) {
      const [marketplace, name] = identifier.split(":", 2);
      skillPath = path.join(baseDir, marketplace, name);
      relativePath = path.join(SKILLS_DIR, marketplace, name);
    } else {
      // Search all marketplace dirs for the skill name
      if (fs.existsSync(baseDir)) {
        const marketplaces = fs.readdirSync(baseDir).filter((d) => {
          const full = path.join(baseDir, d);
          return fs.statSync(full).isDirectory();
        });
        for (const mp of marketplaces) {
          const candidate = path.join(baseDir, mp, identifier);
          if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
            skillPath = candidate;
            relativePath = path.join(SKILLS_DIR, mp, identifier);
            break;
          }
        }
      }
    }

    if (!skillPath || !fs.existsSync(skillPath)) {
      return `## ❌ Not Found\nSkill '${identifier}' is not installed.`;
    }

    try {
      fs.rmSync(skillPath, { recursive: true, force: true });
      return [
        `## ✅ Removed ${identifier}`,
        `- **Path:** ${relativePath}`,
      ].join("\n");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `## ❌ Removal Failed\n${message}`;
    }
  },
});
