export interface SkillInfo {
    identifier: string;
    marketplace: string;
    skillName: string;
    trustGrade: string;
}
export declare class SkillUsageTracker {
    private baseDir;
    private pathMap;
    constructor(baseDir?: string);
    loadInstalledSkills(): SkillInfo[];
    buildPathMap(): Map<string, SkillInfo>;
    detect(filePath: string): SkillInfo | null;
    formatDisplay(info: SkillInfo): string;
}
//# sourceMappingURL=usage-tracker.d.ts.map