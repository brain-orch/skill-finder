import type { SkillSearchResult, SkillMarketplace, MarketplaceConfig } from "../types.js";
export declare class MarketRegistry {
    private readonly adapters;
    private readonly config;
    constructor(config: MarketplaceConfig);
    addAdapter(adapter: SkillMarketplace): void;
    searchAll(query: string, options?: {
        limit?: number;
        signal?: AbortSignal;
        category?: string;
    }): Promise<SkillSearchResult[]>;
    private searchWithRetry;
    getMarketplace(name: string): SkillMarketplace | undefined;
    listAvailable(): string[];
}
//# sourceMappingURL=index.d.ts.map