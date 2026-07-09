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
}
export declare class SkillRecommender {
    private searchEngine;
    private indexer;
    private config;
    private registry;
    private installedSkillNames;
    constructor(searchEngine: SearchEngine, registry: MarketRegistry, indexer: SkillIndexer | null, config?: RecommenderConfig);
    recommend(context: DetectedContext): Promise<Recommendation[]>;
    private searchLocal;
    private searchNetwork;
    private mergeResults;
    private filterResults;
    private indexedToRecommendation;
    private toRecommendation;
    private scoreByCategoryMatch;
    private generateMatchReasons;
}
//# sourceMappingURL=recommender.d.ts.map