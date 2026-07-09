import { z } from "zod";
import { tool } from "@opencode-ai/plugin";
import * as fs from "node:fs";
import * as path from "node:path";
import { detectActiveAgents, AGENT_TARGETS } from "../installer/agent-targets.js";
const listArgsSchema = z.object({
    marketplace: z.string().optional().describe("Filter by marketplace (optional)"),
    category: z.string().optional().describe("Filter by category (optional)"),
});
function readSkillsFromDir(baseDir, marketplace) {
    if (!fs.existsSync(baseDir))
        return [];
    const marketplaces = marketplace
        ? [marketplace]
        : fs.readdirSync(baseDir).filter((d) => {
            const full = path.join(baseDir, d);
            return fs.statSync(full).isDirectory();
        });
    const skills = [];
    for (const mp of marketplaces) {
        const mpDir = path.join(baseDir, mp);
        if (!fs.existsSync(mpDir) || !fs.statSync(mpDir).isDirectory())
            continue;
        const skillDirs = fs.readdirSync(mpDir).filter((d) => {
            const full = path.join(mpDir, d);
            return fs.statSync(full).isDirectory();
        });
        for (const skill of skillDirs) {
            const skillDir = path.join(mpDir, skill);
            const skillMdPath = path.join(skillDir, "SKILL.md");
            let description = "";
            if (fs.existsSync(skillMdPath)) {
                const content = fs.readFileSync(skillMdPath, "utf-8");
                const firstLine = content.split("\n").find((l) => l.trim().length > 0);
                if (firstLine) {
                    description = firstLine.replace(/^#+\s*/, "").trim();
                }
            }
            skills.push({ name: `${mp}:${skill}`, description });
        }
    }
    return skills;
}
export const listTool = tool({
    description: "List locally cached skills",
    args: listArgsSchema.shape,
    async execute(args, ctx) {
        const marketplace = args.marketplace?.trim() || undefined;
        const category = args.category?.trim() || undefined;
        const projectRoot = ctx.directory || process.cwd();
        const activeAgents = detectActiveAgents(projectRoot);
        if (activeAgents.length === 0) {
            // Fallback: check opencode even if not detected
            activeAgents.push("opencode");
        }
        const lines = ["## Installed Skills"];
        let total = 0;
        for (const agent of activeAgents) {
            const agentInfo = AGENT_TARGETS[agent];
            const agentDir = path.join(projectRoot, agentInfo.dir);
            if (!fs.existsSync(agentDir))
                continue;
            const skills = readSkillsFromDir(agentDir, marketplace);
            if (skills.length === 0)
                continue;
            lines.push(`\n### 📦 ${agent} (${agentInfo.dir}) — ${skills.length} installed`);
            for (const skill of skills) {
                const desc = skill.description ? ` — ${skill.description}` : "";
                lines.push(`- **${skill.name}**${desc}`);
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
//# sourceMappingURL=list.js.map