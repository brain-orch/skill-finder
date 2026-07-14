export interface LockMetadata {
    installedAt: string;
    version?: string;
    marketplace: string;
    versionRange?: string;
    changelog?: string;
    breaking?: boolean;
    dependencies?: string[];
    trustGrade?: string;
}
export interface LockedSkill {
    identifier: string;
    installedAt: string;
    contentHash: string;
    version?: string;
    marketplace: string;
    lastChecked: string;
    targets: string[];
    versionRange?: string;
    changelog?: string;
    breaking?: boolean;
    dependencies?: string[];
    trustGrade?: string;
}
export interface UpdateCheckResult {
    identifier: string;
    hasUpdate: boolean;
    currentHash: string;
    newHash?: string;
    checkedAt: string;
    breaking?: boolean;
}
export interface LockfileData {
    version: number;
    skills: Record<string, LockedSkill>;
}
//# sourceMappingURL=lock-types.d.ts.map