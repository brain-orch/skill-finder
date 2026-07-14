import type { SkillSearchResult } from "../types.js";
import { type SkillPlan } from "../composer/skill-plan.js";
import { type DetectedStack } from "./parsers.js";
export type { DetectedStack } from "./parsers.js";
export interface ScanResult {
    detectedStacks: DetectedStack[];
    skillRecommendations: SkillSearchResult[];
    composedPlans?: SkillPlan[];
    scannedAt: number;
    projectRoot: string;
}
export declare class ProjectScanner {
    private lastScanResult;
    private planComposer;
    constructor();
    /**
     * Scan a project root: detect tech stacks and search for relevant skills.
     */
    scan(projectRoot: string): Promise<ScanResult>;
    /**
     * Detect tech stacks by reading config files synchronously.
     */
    detectStacks(projectRoot: string): DetectedStack[];
    /**
     * Search skill marketplaces for each detected stack.
     */
    searchSkills(stacks: DetectedStack[]): Promise<SkillSearchResult[]>;
    /**
     * Return the last scan result, or null if no scan has been performed.
     */
    getProjectContext(): ScanResult | null;
}
//# sourceMappingURL=project-scanner.d.ts.map