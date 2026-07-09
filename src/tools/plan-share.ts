import { z } from "zod";
import { tool } from "@opencode-ai/plugin";
import { PlanSerializer } from "../composer/plan-serializer.js";
import { SkillPlanComposer, type SkillPlan } from "../composer/skill-plan.js";

const serializer = new PlanSerializer();
const composer = new SkillPlanComposer();

// ── Export Plan Tool ───────────────────────────────────────

const exportPlanArgsSchema = z.object({
  planKey: z.string().describe("Key of the plan to export (e.g., 'nextjs-prisma')"),
});

export const exportPlanTool = tool({
  description: "Export a skill plan to JSON format for sharing",
  args: exportPlanArgsSchema.shape,
  async execute(args) {
    const allPlans = composer.getAvailablePlans();
    const planMeta = allPlans.find((p) => p.key === args.planKey);

    if (!planMeta) {
      const availableKeys = allPlans.map((p) => p.key).join(", ");
      return `Plan '${args.planKey}' not found. Available plans: ${availableKeys}`;
    }

    // Reconstruct full plan from metadata (skills are in STACK_PLANS)
    // We need to compose a plan with the skills
    const plans = composer.composePlan(planMeta.matchCategories);
    const plan = plans.find((p) => p.key === args.planKey);

    if (!plan) {
      return `Could not reconstruct plan '${args.planKey}'. This should not happen.`;
    }

    const json = serializer.exportPlan(plan);
    return `## Exported Plan: ${plan.name}\n\n\`\`\`json\n${json}\n\`\`\`\n\nCopy this JSON to share the plan with your team.`;
  },
});

// ── Import Plan Tool ───────────────────────────────────────

const importPlanArgsSchema = z.object({
  json: z.string().describe("JSON string of the plan to import"),
});

export const importPlanTool = tool({
  description: "Import a skill plan from JSON format",
  args: importPlanArgsSchema.shape,
  async execute(args) {
    try {
      const plan: SkillPlan = serializer.importPlan(args.json);
      return `## Imported Plan: ${plan.name}\n\n- **Key:** ${plan.key}\n- **Description:** ${plan.description}\n- **Categories:** ${plan.matchCategories.join(", ")}\n- **Skills:** ${plan.skills.length}\n\nPlan imported successfully. You can now use it with the \`skill-finder_plan\` tool.`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Import failed: ${message}`;
    }
  },
});
