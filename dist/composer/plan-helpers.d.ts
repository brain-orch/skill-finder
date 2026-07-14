import { SkillSearchResult } from "../types.js";
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
export declare const STACK_PLANS: Record<string, SkillPlan>;
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
//# sourceMappingURL=plan-helpers.d.ts.map