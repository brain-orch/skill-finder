export interface SkillSearchResult {
    id: string;
    name: string;
    description: string;
    marketplace: "lobehub" | "skillssh" | "agentskillsh" | "skillsmp" | "mcpservers" | "awesomeskill" | "clawhub";
    category: string | null;
    triggers: string[];
    installCount: number;
    stars: number;
    installCommand: string;
    homepageUrl: string;
    verified: boolean;
}
export interface SkillMarketplace {
    name: string;
    search(query: string, options?: {
        category?: string;
        limit?: number;
        signal?: AbortSignal;
    }): Promise<SkillSearchResult[]>;
    getSkillInfo(identifier: string): Promise<SkillSearchResult | null>;
    install(identifier: string, targetDir: string): Promise<{
        path: string;
        files: string[];
    }>;
    isAvailable(): boolean;
}
export interface MarketplaceConfig {
    marketplaces: string[];
    searchTimeoutMs: number;
    retryCount: number;
    retryBackoffMs: number;
}
export interface CacheEntry {
    key: string;
    value: unknown;
    timestamp: number;
    ttl: number;
}
//# sourceMappingURL=types.d.ts.map