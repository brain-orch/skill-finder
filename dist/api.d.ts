import type { SkillSearchResult } from "./types.js";
import type { LockedSkill } from "./cache/skill-lock.js";
import type { SkillFinderConfig } from "./config.js";
export interface SearchOptions {
    category?: string;
    limit?: number;
}
export interface InstallResult {
    path: string;
    files: string[];
    targets: string[];
}
export interface UpdateEntry {
    identifier: string;
    currentVersion: string;
    availableVersion: string;
    breaking: boolean;
}
export interface PlanEntry {
    key: string;
    name: string;
    skills: string[];
    description: string;
}
export declare class SkillFinderAPI {
    private config;
    private lockManager;
    private changelogTracker;
    private planComposer;
    constructor(config?: Partial<SkillFinderConfig>);
    /**
     * Search for skills across all marketplaces.
     */
    search(query: string, options?: SearchOptions): Promise<SkillSearchResult[]>;
    /**
     * Download and install a skill.
     */
    install(identifier: string, marketplace: string, target?: string): Promise<InstallResult>;
    /**
     * List all locally cached/locked skills.
     */
    list(): Promise<LockedSkill[]>;
    /**
     * Get detailed info about a specific skill.
     * Returns null if not found.
     */
    info(identifier: string): Promise<SkillSearchResult | null>;
    /**
     * Remove a skill from the lockfile.
     * Returns true if successfully removed, false otherwise.
     */
    remove(identifier: string): Promise<boolean>;
    /**
     * Check all locked skills for available updates.
     */
    checkUpdates(): Promise<UpdateEntry[]>;
    /**
     * Get available skill plans, optionally filtered by stack.
     */
    plan(stack?: string): Promise<PlanEntry[]>;
}
//# sourceMappingURL=api.d.ts.map