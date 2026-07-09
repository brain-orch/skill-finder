export interface IndexedSkill {
    id: string;
    name: string;
    description: string;
    marketplace: string;
    category: string | null;
    triggers: string[];
    installCount: number;
    stars: number;
    filePath: string;
    installedAt: string;
    lastUsed: string | null;
    useCount: number;
    skillHash: string;
}
export declare class SkillIndexer {
    private db;
    private dbPath;
    constructor(dbPath: string);
    init(): void;
    indexSkill(skill: IndexedSkill): void;
    searchLocal(query: string, limit?: number): IndexedSkill[];
    markUsed(identifier: string): void;
    getFreshness(identifiers: string[]): Map<string, string>;
    removeFromIndex(identifier: string): void;
    getStats(): Array<{
        marketplace: string;
        count: number;
        lastRefresh: string | null;
    }>;
    sanitizeFTS5(query: string): string;
    close(): void;
    refreshFromCache(cachedSkills: Array<{
        id: string;
        name: string;
        marketplace: string;
        filePath: string;
        installedAt: string;
        skillHash: string;
    }>): void;
    private prepareDb;
}
//# sourceMappingURL=indexer.d.ts.map