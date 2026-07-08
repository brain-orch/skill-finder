import { z } from "zod";
import { tool } from "@opencode-ai/plugin";
import type { SkillSearchResult } from "../types.js";
import { marketplaceRegistry } from "../registry/instance.js";

const infoArgsSchema = z.object({
  identifier: z.string().describe("Skill identifier (required)"),
});

export const infoTool = tool({
  description: "Show skill details",
  args: infoArgsSchema.shape,
  async execute(args, _ctx) {
    const identifier = args.identifier.trim();
    if (!identifier) {
      return "❌ Error: identifier is required and must be non-empty.";
    }

    let skill = null;

    // Try to find adapter by marketplace prefix
    if (identifier.includes(":")) {
      const [marketplace, skillId] = identifier.split(":", 2);
      const adapter = marketplaceRegistry.getMarketplace(marketplace);
      if (adapter) {
        skill = await adapter.getSkillInfo(skillId);
      }
    }

    // Fallback: search all marketplaces
    if (!skill) {
      const results = await marketplaceRegistry.searchAll(identifier, { limit: 5 });
      skill = results.find((r: SkillSearchResult) => r.id === identifier) ?? results[0] ?? null;
    }

    if (!skill) {
      return `## ❌ Skill Not Found\nSkill '${identifier}' was not found in any marketplace.`;
    }

    const rows: string[] = [
      `## ${skill.name}`,
      "",
      "| Field | Value |",
      "|---|---|",
      `| **ID** | \`${skill.id}\` |`,
      `| **Marketplace** | ${skill.marketplace} |`,
      `| **Category** | ${skill.category ?? "—"} |`,
      `| **Stars** | ⭐ ${skill.stars} |`,
      `| **Installs** | ${skill.installCount} |`,
      `| **Description** | ${skill.description} |`,
      `| **Triggers** | ${skill.triggers.join(", ") || "—"} |`,
      `| **Install** | \`${skill.installCommand}\` |`,
      `| **Homepage** | [${skill.homepageUrl}](${skill.homepageUrl}) |`,
    ];

    if (skill.verified) {
      rows.push("| **Verified** | ✅ Verified |");
    }

    return rows.join("\n");
  },
});
