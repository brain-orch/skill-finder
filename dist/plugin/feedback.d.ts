import type { SkillSearchResult } from "../types.js";
export interface Recommendation {
    identifier: string;
    name: string;
    marketplace: string;
    description: string;
    score: number;
    trustGrade: "A" | "B" | "C" | "D" | "F";
    matchReasons: string[];
    fromCache: boolean;
    alreadyInstalled: boolean;
}
export interface RecommenderConfig {
    maxResults?: number;
    localWeight?: number;
    networkWeight?: number;
    minScore?: number;
    installedSkillNames?: string[];
    minTrustGrade?: "A" | "B" | "C" | "D" | "F";
}
export declare class FeedbackManager {
    private dismissedSkills;
    private acceptedSkills;
    acceptSkill(identifier: string): void;
    dismissSkill(identifier: string): void;
    resetFeedback(): void;
    isDismissed(identifier: string): boolean;
}
export declare function scoreByCategoryMatch(skill: SkillSearchResult, categories: string[]): number;
export declare function generateMatchReasons(skill: SkillSearchResult, categories: string[]): string[];
export declare function indexedToRecommendation(skill: {
    id: string;
    name: string;
    description: string;
    marketplace: string;
    category: string | null;
    triggers: string[];
    installCount: number;
    stars: number;
}, categories: string[], trustGrade: "A" | "B" | "C" | "D" | "F"): Recommendation;
export declare function toRecommendation(skill: SkillSearchResult, fromCache: boolean, categories: string[], trustGrade: "A" | "B" | "C" | "D" | "F"): Recommendation;
//# sourceMappingURL=feedback.d.ts.map