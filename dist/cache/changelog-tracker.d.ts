export interface ChangeEntry {
    identifier: string;
    fromVersion: string;
    toVersion: string;
    breaking: boolean;
    timestamp: string;
}
export declare class ChangelogTracker {
    private changelogPath;
    constructor(baseDir?: string);
    recordChange(identifier: string, fromVersion: string, toVersion: string, breaking: boolean): void;
    getChangelog(identifier: string): ChangeEntry[];
    hasBreakingChanges(identifier: string): boolean;
    private readChangelog;
    private writeChangelog;
}
//# sourceMappingURL=changelog-tracker.d.ts.map