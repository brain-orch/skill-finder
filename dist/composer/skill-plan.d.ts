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
/**
 * Discover all saved plans from the plans directory.
 * Returns metadata for each plan found.
 */
export declare function discoverPlans(projectRoot?: string): SkillPlanMeta[];
/**
 * Load a plan by key from the plans directory.
 * Returns null if not found or if the plan is corrupt.
 */
export declare function loadPlan(key: string, projectRoot?: string): SkillPlan | null;
/**
 * Save a plan to the plans directory.
 * Creates the directory structure if it doesn't exist.
 */
export declare function savePlan(plan: SkillPlan, projectRoot?: string): void;
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
//# sourceMappingURL=skill-plan.d.ts.map