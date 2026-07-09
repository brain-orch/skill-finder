export interface LockMetadata {
    installedAt: string;
    version?: string;
    marketplace: string;
}
export interface LockedSkill {
    identifier: string;
    installedAt: string;
    contentHash: string;
    version?: string;
    marketplace: string;
    lastChecked: string;
    targets: string[];
}
export interface UpdateCheckResult {
    identifier: string;
    hasUpdate: boolean;
    currentHash: string;
    newHash?: string;
    checkedAt: string;
}
export declare class SkillLockManager {
    private lockfilePath;
    private skillsDir;
    constructor(baseDir?: string);
    /**
     * Compute SHA-256 hash of content string, prefixed with "sha256-".
     */
    static computeHash(content: string): string;
    /**
     * Lock a skill: compute SHA-256 of content and save to lockfile.
     */
    lockSkill(identifier: string, content: string, metadata: LockMetadata, targets?: string[]): void;
    /**
     * Unlock a skill: remove from lockfile.
     */
    unlockSkill(identifier: string): void;
    /**
     * Check if a skill has updates by comparing content hashes.
     */
    checkForUpdates(identifier: string, newContent: string): Promise<UpdateCheckResult>;
    /**
     * Return all locked skills.
     */
    getLockedSkills(): LockedSkill[];
    /**
     * Return skills not checked in N days (default 7).
     */
    getStaleSkills(days?: number): LockedSkill[];
    /**
     * Rebuild lockfile from filesystem by scanning installed skills
     * and re-hashing their SKILL.md files.
     */
    rebuild(): void;
    private readLockfile;
    private writeLockfile;
}
//# sourceMappingURL=skill-lock.d.ts.map