import type { SkillSearchResult, SkillMarketplace } from "../types.js";
export declare class MockMarketplace implements SkillMarketplace {
    name: string;
    private readonly results;
    constructor(name: string, results?: SkillSearchResult[]);
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
//# sourceMappingURL=mock.d.ts.map