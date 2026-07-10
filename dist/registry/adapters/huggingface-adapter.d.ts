import type { SkillSearchResult, SkillMarketplace } from "../../types.js";
export interface HuggingFaceSearchResult extends SkillSearchResult {
    _meta: {
        type: "ml-model";
        note: "not a skill — use 'git clone' or 'pip install'";
    };
}
export declare class HuggingFaceMarketplace implements SkillMarketplace {
    name: "huggingface";
    search(query: string, options?: {
        category?: string;
        limit?: number;
        signal?: AbortSignal;
    }): Promise<HuggingFaceSearchResult[]>;
    getSkillInfo(identifier: string): Promise<HuggingFaceSearchResult | null>;
    install(identifier: string, targetDir: string): Promise<{
        path: string;
        files: string[];
    }>;
    isAvailable(): boolean;
}
//# sourceMappingURL=huggingface-adapter.d.ts.map