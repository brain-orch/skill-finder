export interface CachedSkillInfo {
    id: string;
    name: string;
    marketplace: string;
    filePath: string;
    installedAt: string;
    sizeBytes: number;
    skillHash: string;
}
export declare function skillFileExists(dir: string, name: string): boolean;
export declare function scanDir(dir: string, out: CachedSkillInfo[]): void;
export declare function sumSize(dir: string): number;
export declare function checkQuota(currentBytes: number, maxSizeMb: number): {
    withinQuota: boolean;
    currentSizeMb: number;
    maxSizeMb: number;
};
//# sourceMappingURL=cache-helpers.d.ts.map