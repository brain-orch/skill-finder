import type { SkillSearchResult, SkillMarketplace } from "../../types.js";
export declare class AwesomeSkillMarketplace implements SkillMarketplace {
    name: "awesomeskill";
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
//# sourceMappingURL=awesomeskill-adapter.d.ts.map