import type { SkillPlan, SkillPlanSkill } from "./skill-plan.js";
export interface PlanExportFormat {
    version: number;
    key: string;
    name: string;
    description: string;
    matchCategories: string[];
    skills: SkillPlanSkill[];
    exportedAt: string;
    exporter: string;
}
export declare class PlanSerializer {
    /**
     * Export a SkillPlan to a JSON string with metadata.
     */
    exportPlan(plan: SkillPlan): string;
    /**
     * Import a SkillPlan from a JSON string.
     * Validates required fields and version compatibility.
     * Throws if JSON is invalid, version is unsupported, or required fields are missing.
     */
    importPlan(json: string): SkillPlan;
}
//# sourceMappingURL=plan-serializer.d.ts.map