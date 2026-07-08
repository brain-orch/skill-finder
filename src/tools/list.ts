import { z } from "zod";
import { tool } from "@opencode-ai/plugin";
import * as fs from "node:fs";
import * as path from "node:path";
import { SKILLS_DIR } from "../constants.js";

const listArgsSchema = z.object({
  marketplace: z.string().optional().describe("Filter by marketplace (optional)"),
  category: z.string().optional().describe("Filter by category (optional)"),
});

export const listTool = tool({
  description: "List locally cached skills",
  args: listArgsSchema.shape,
  async execute(args, ctx) {
    const marketplace = args.marketplace?.trim() || undefined;
    const category = args.category?.trim() || undefined;

    const baseDir = path.join(ctx.directory || process.cwd(), SKILLS_DIR);

    if (!fs.existsSync(baseDir)) {
      return "No skills installed. Use `skill-finder_install` to add one.";
    }

    const marketplaces = marketplace
      ? [marketplace]
      : fs.readdirSync(baseDir).filter((d) => {
          const full = path.join(baseDir, d);
          return fs.statSync(full).isDirectory();
        });

    if (marketplaces.length === 0) {
      return "No skills installed. Use `skill-finder_install` to add one.";
    }

    const lines: string[] = ["## Installed Skills"];
    let total = 0;

    for (const mp of marketplaces) {
      const mpDir = path.join(baseDir, mp);
      if (!fs.existsSync(mpDir) || !fs.statSync(mpDir).isDirectory()) {
        continue;
      }

      const skills = fs.readdirSync(mpDir).filter((d) => {
        const full = path.join(mpDir, d);
        return fs.statSync(full).isDirectory();
      });

      if (skills.length === 0) {
        lines.push(`\n### 📦 ${mp} (0 installed)`);
        lines.push("No skills installed.");
        continue;
      }

      lines.push(`\n### 📦 ${mp} (${skills.length} installed)`);
      for (const skill of skills) {
        const skillDir = path.join(mpDir, skill);
        const skillMdPath = path.join(skillDir, "SKILL.md");
        let description = "";
        if (fs.existsSync(skillMdPath)) {
          const content = fs.readFileSync(skillMdPath, "utf-8");
          const firstLine = content.split("\n").find((l) => l.trim().length > 0);
          if (firstLine) {
            description = ` — ${firstLine.replace(/^#+\s*/, "").trim()}`;
          }
        }
        lines.push(`- **${skill}**${description}`);
        total++;
      }
    }

    if (total === 0) {
      return "No skills installed. Use `skill-finder_install` to add one.";
    }

    lines.push(`\n**Total: ${total} skills installed**`);
    return lines.join("\n");
  },
});
