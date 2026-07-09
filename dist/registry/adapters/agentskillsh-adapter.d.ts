import type { SkillSearchResult, SkillMarketplace } from "../../types.js";
export declare class AgentSkillsMarketplace implements SkillMarketplace {
    readonly name: "agentskillsh";
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
//# sourceMappingURL=agentskillsh-adapter.d.ts.map