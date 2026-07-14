import type { SkillMarketplace } from "../types.js";
import type { SkillIndexer } from "./indexer.js";
import { CachedSkillInfo } from "./cache-helpers.js";
export interface CacheConfig {
    globalDir: string;
    projectDir: string;
    tempDir?: string;
    maxCacheSizeMb?: number;
    cacheTtlHours?: number;
}
export declare class CacheManager {
    private readonly config;
    private readonly resolvedMaxCacheSizeMb;
    private readonly resolvedCacheTtlHours;
    private lastRefreshTime;
    private lastRefreshFailed;
    constructor(config: CacheConfig);
    download(identifier: string, marketplace: SkillMarketplace, targetDir?: string): Promise<{
        path: string;
        files: string[];
    }>;
    isCached(_identifier: string, name: string): boolean;
    getSkillPath(_identifier: string, name: string): string | null;
    remove(_identifier: string, name: string): boolean;
    listCached(): CachedSkillInfo[];
    getCacheSize(): number;
    /**
     * Force refresh the marketplace index by re-scanning cached skills.
     * Guards against rapid re-refresh: if the last refresh failed, waits
     * at least 1 hour before allowing another attempt.
     */
    refresh(indexer: SkillIndexer): Promise<{
        indexed: number;
        failed: number;
    }>;
    /**
     * Flag stale skills (installed > maxAge ago) without deleting them.
     * Default maxAge is 7 days (168 hours).
     */
    cleanup(): {
        staleCount: number;
        staleSkills: string[];
    };
    /**
     * Check disk quota against configured maximum.
     */
    checkQuota(): {
        withinQuota: boolean;
        currentSizeMb: number;
        maxSizeMb: number;
    };
    private skillFileExists;
    private scanDir;
    private sumSize;
}
//# sourceMappingURL=index.d.ts.map