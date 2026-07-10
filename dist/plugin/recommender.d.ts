import type { DetectedContext } from "./detector.js";
import { SearchEngine } from "../search/index.js";
import { SkillIndexer } from "../cache/indexer.js";
import { MarketRegistry } from "../registry/index.js";
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
export declare class SkillRecommender {
    private searchEngine;
    private indexer;
    private config;
    private registry;
    private installedSkillNames;
    private trustScorer;
    private dismissedSkills;
    private acceptedSkills;
    constructor(searchEngine: SearchEngine, registry: MarketRegistry, indexer: SkillIndexer | null, config?: RecommenderConfig);
    recommend(context: DetectedContext): Promise<Recommendation[]>;
    acceptSkill(identifier: string): void;
    dismissSkill(identifier: string): void;
    resetFeedback(): void;
    private searchLocal;
    private searchNetwork;
    private mergeResults;
    private filterResults;
    private deduplicateByIdentifier;
    private indexedToRecommendation;
    private toRecommendation;
    private scoreByCategoryMatch;
    private generateMatchReasons;
}
//# sourceMappingURL=recommender.d.ts.map