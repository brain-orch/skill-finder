import { z } from "zod";
import { tool } from "@opencode-ai/plugin";
import { SkillPlanComposer } from "../composer/skill-plan.js";
import { getScanner } from "../index.js";
const composer = new SkillPlanComposer();
const planArgsSchema = z.object({
    stacks: z
        .string()
        .optional()
        .describe("Comma-separated stack names to generate a plan for (optional, uses scanner if omitted)"),
});
function formatPlanMarkdown(plan) {
    const lines = [];
    lines.push(`## 🎯 Skill Plan: ${plan.name}`);
    lines.push(plan.description);
    lines.push("");
    if (plan.searchResults && plan.searchResults.length > 0) {
        lines.push("### Recommended Skills");
        lines.push("");
        for (let i = 0; i < plan.skills.length; i++) {
            const skill = plan.skills[i];
            const results = plan.searchResults[i] ?? [];
            lines.push(`${i + 1}. **${skill.query}** (${skill.category ?? "general"})`);
            lines.push(`   ${skill.reason}`);
            lines.push("");
            if (results.length === 0) {
                lines.push("   _No skills found in marketplaces._");
            }
            else {
                for (const result of results.slice(0, 3)) {
                    const stars = result.stars ? `⭐${result.stars}` : "⭐0";
                    const installs = result.installCount ? `${result.installCount} installs` : "0 installs";
                    lines.push(`   → **${result.name}** — ${result.description} (${stars} · ${installs})`);
                    lines.push(`   [Install](${result.homepageUrl}) | ID: \`${result.id}\``);
                }
            }
            lines.push("");
        }
    }
    else {
        lines.push("### Skills to Search");
        lines.push("");
        for (const skill of plan.skills) {
            lines.push(`- **${skill.query}** (${skill.category ?? "general"}) — ${skill.reason}`);
        }
        lines.push("");
    }
    lines.push("---");
    lines.push("");
    return lines.join("\n");
}
export const planTool = tool({
    description: "Generate skill plan recommendations based on detected tech stack",
    args: planArgsSchema.shape,
    async execute(args, _ctx) {
        let stacks = [];
        if (args.stacks) {
            stacks = args.stacks
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
        }
        else {
            const scanner = getScanner();
            if (scanner) {
                const context = scanner.getProjectContext();
                if (context) {
                    stacks = context.detectedStacks.map((s) => s.name);
                }
            }
        }
        if (stacks.length === 0) {
            return "No tech stack detected. Use the `stacks` parameter to specify stacks manually, or run a project scan first.";
        }
        const plans = composer.composePlan(stacks);
        if (plans.length === 0) {
            return `No skill plans found for stacks: ${stacks.join(", ")}. Try different stack names or check available plans with \`getAvailablePlans()\`.`;
        }
        const enrichedPlans = await composer.searchAllPlansSkills(plans);
        const lines = [];
        lines.push(`# 📋 Skill Plan Recommendations`);
        lines.push(`Detected stacks: ${stacks.join(", ")}`);
        lines.push("");
        for (const plan of enrichedPlans) {
            lines.push(formatPlanMarkdown(plan));
        }
        lines.push(`**Total: ${enrichedPlans.length} plan(s) with ${enrichedPlans.reduce((sum, p) => sum + p.skills.length, 0)} skill recommendations**`);
        return lines.join("\n");
    },
});
//# sourceMappingURL=plan.js.map