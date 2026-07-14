import { SkillPlan, SkillPlanMeta } from "./plan-helpers.js";
export declare class SkillPlanComposer {
    /**
     * Compose skill plans based on detected stack categories.
     * Returns all plans whose matchCategories overlap with detectedStacks.
     * Includes both built-in STACK_PLANS and registry plans.
     */
    composePlan(detectedStacks: string[], projectRoot?: string): SkillPlan[];
    /**
     * Return all available plan metadata (without search results).
     * Includes both built-in STACK_PLANS and registry plans.
     */
    getAvailablePlans(projectRoot?: string): SkillPlanMeta[];
    /**
     * Get a plan by key from either built-in STACK_PLANS or registry.
     * Returns null if not found.
     */
    getPlanByKey(key: string, projectRoot?: string): SkillPlan | null;
    /**
     * Search marketplace for each skill in the plan.
     * Returns the plan with searchResults populated.
     */
    searchPlanSkills(plan: SkillPlan): Promise<SkillPlan>;
    /**
     * Search all skills across all plans.
     */
    searchAllPlansSkills(plans: SkillPlan[]): Promise<SkillPlan[]>;
}
export type { SkillPlanSkill, SkillPlan, SkillPlanMeta } from "./plan-helpers.js";
export { discoverPlans, loadPlan, savePlan } from "./plan-helpers.js";
//# sourceMappingURL=skill-plan.d.ts.map