import { z } from "zod";
import { tool } from "@opencode-ai/plugin";
import * as fs from "node:fs";
import * as path from "node:path";
import { marketplaceRegistry } from "../registry/instance.js";
import { detectActiveAgents, AGENT_TARGETS } from "../installer/agent-targets.js";
const infoArgsSchema = z.object({
    identifier: z.string().describe("Skill identifier (required)"),
});
function findSkillInAgentDirs(projectRoot, marketplace, skillName) {
    const activeAgents = detectActiveAgents(projectRoot);
    if (activeAgents.length === 0) {
        activeAgents.push("opencode");
    }
    return activeAgents.map((agent) => {
        const agentInfo = AGENT_TARGETS[agent];
        const skillDir = path.join(projectRoot, agentInfo.dir, marketplace, skillName);
        const skillFile = path.join(skillDir, "SKILL.md");
        const relativePath = path.relative(projectRoot, skillFile);
        return {
            agent,
            path: relativePath,
            installed: fs.existsSync(skillFile),
        };
    });
}
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
            skill = results.find((r) => r.id === identifier) ?? results[0] ?? null;
        }
        // Extract marketplace and skill name for local scan
        let scanMarketplace = "";
        let scanSkillName = "";
        if (identifier.includes(":")) {
            [scanMarketplace, scanSkillName] = identifier.split(":", 2);
        }
        else if (skill) {
            scanMarketplace = skill.marketplace;
            scanSkillName = skill.id.includes(":") ? skill.id.split(":")[1] : skill.id;
        }
        const rows = [];
        if (skill) {
            rows.push(`## ${skill.name}`, "", "| Field | Value |", "|---|---|", `| **ID** | \`${skill.id}\` |`, `| **Marketplace** | ${skill.marketplace} |`, `| **Category** | ${skill.category ?? "—"} |`, `| **Stars** | ⭐ ${skill.stars} |`, `| **Installs** | ${skill.installCount} |`, `| **Description** | ${skill.description} |`, `| **Triggers** | ${skill.triggers.join(", ") || "—"} |`, `| **Install** | \`${skill.installCommand}\` |`, `| **Homepage** | [${skill.homepageUrl}](${skill.homepageUrl}) |`);
            if (skill.verified) {
                rows.push("| **Verified** | ✅ Verified |");
            }
        }
        // Installed locations section
        if (scanMarketplace && scanSkillName) {
            const projectRoot = process.cwd();
            const locations = findSkillInAgentDirs(projectRoot, scanMarketplace, scanSkillName);
            if (locations.length > 0) {
                rows.push("", "### Installed Locations", "");
                for (const loc of locations) {
                    const status = loc.installed ? `✅ \`${loc.path}\`` : "❌ not installed";
                    rows.push(`- **${loc.agent}**: ${status}`);
                }
            }
        }
        if (rows.length === 0) {
            return `## ❌ Skill Not Found\nSkill '${identifier}' was not found in any marketplace.`;
        }
        return rows.join("\n");
    },
});
//# sourceMappingURL=info.js.map