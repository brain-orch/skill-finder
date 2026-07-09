import type { SkillSearchResult, MarketplaceConfig } from "../types.js";
import { MarketRegistry } from "../registry/index.js";
import { SemanticSearch, type SemSearchResult } from "./semantic.js";
export interface SearchOptions {
    query: string;
    category?: string;
    limit?: number;
    timeoutMs?: number;
}
export declare class SearchEngine {
    private registry;
    private ranker;
    private config;
    semanticSearch?: SemanticSearch;
    constructor(registry: MarketRegistry, config: MarketplaceConfig);
    search(options: SearchOptions): Promise<SkillSearchResult[]>;
    searchAllMarketplaces(options: SearchOptions): Promise<SkillSearchResult[]>;
    searchLocal(query: string): SemSearchResult[];
}
export { SemanticSearch, type SemSearchResult } from "./semantic.js";
//# sourceMappingURL=index.d.ts.map