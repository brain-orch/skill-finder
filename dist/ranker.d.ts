import type { SkillSearchResult } from "../types.js";
export declare class RelevanceRanker {
    rank(results: SkillSearchResult[], query: string, limit?: number): SkillSearchResult[];
    private calculateScore;
    private keywordMatchScore;
    private popularityScore;
    private starsScore;
    private verifiedScore;
    private deduplicate;
    private normalizeName;
}
//# sourceMappingURL=ranker.d.ts.map