import type { SkillSearchResult, MarketplaceConfig } from "../types.js";
import { MarketRegistry } from "../registry/index.js";
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
    constructor(registry: MarketRegistry, config: MarketplaceConfig);
    search(options: SearchOptions): Promise<SkillSearchResult[]>;
    searchAllMarketplaces(options: SearchOptions): Promise<SkillSearchResult[]>;
}
//# sourceMappingURL=index.d.ts.map