import type { DetectedContext } from "./detector.js";
import { SearchEngine } from "../search/index.js";
import { SkillIndexer } from "../cache/indexer.js";
import { MarketRegistry } from "../registry/index.js";
export type { Recommendation, RecommenderConfig } from "./feedback.js";
export declare class SkillRecommender {
    private searchEngine;
    private indexer;
    private config;
    private registry;
    private installedSkillNames;
    private trustScorer;
    private feedback;
    constructor(searchEngine: SearchEngine, registry: MarketRegistry, indexer: SkillIndexer | null, config?: import("./feedback.js").RecommenderConfig);
    recommend(context: DetectedContext): Promise<import("./feedback.js").Recommendation[]>;
    acceptSkill(identifier: string): void;
    dismissSkill(identifier: string): void;
    resetFeedback(): void;
    private searchLocal;
    private searchNetwork;
    private mergeResults;
    private filterResults;
    private deduplicateByIdentifier;
}
//# sourceMappingURL=recommender.d.ts.map