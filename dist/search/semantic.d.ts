import type { SkillIndexer } from "../cache/indexer.js";
export interface SemSearchResult {
    id: string;
    name: string;
    description: string;
    marketplace: string;
    score: number;
    fieldScores: {
        name: number;
        description: number;
        triggers: number;
    };
}
export declare class SemanticSearch {
    private indexer;
    constructor(indexer: SkillIndexer);
    search(query: string): SemSearchResult[];
    private tokenize;
    private scoreResults;
    private termAppearsInResult;
    private termInName;
    private termInDescription;
    private termInTriggers;
}
//# sourceMappingURL=semantic.d.ts.map