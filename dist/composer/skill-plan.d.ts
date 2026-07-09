import type { SkillSearchResult } from "../types.js";
export interface SkillPlanSkill {
    query: string;
    reason: string;
    category?: string;
}
export interface SkillPlan {
    key: string;
    name: string;
    description: string;
    matchCategories: string[];
    skills: SkillPlanSkill[];
    /** Populated after searchPlanSkills() */
    searchResults?: SkillSearchResult[][];
}
export interface SkillPlanMeta {
    key: string;
    name: string;
    description: string;
    matchCategories: string[];
}
export declare class SkillPlanComposer {
    /**
     * Compose skill plans based on detected stack categories.
     * Returns all plans whose matchCategories overlap with detectedStacks.
     */
    composePlan(detectedStacks: string[]): SkillPlan[];
    /**
     * Return all available plan metadata (without search results).
     */
    getAvailablePlans(): SkillPlanMeta[];
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
//# sourceMappingURL=skill-plan.d.ts.map