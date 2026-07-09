import type { SkillSearchResult, SkillMarketplace } from "../../types.js";
export declare class SkillShMarketplace implements SkillMarketplace {
    name: "skillssh";
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
//# sourceMappingURL=skillssh-adapter.d.ts.map