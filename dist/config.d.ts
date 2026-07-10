export interface SkillFinderConfig {
    enabled: boolean;
    autoRecommend: boolean;
    marketplaces: string[];
    cacheTtlHours: number;
    maxCacheSizeMb: number;
    preApprovedCategories: string[];
    showNotifications: boolean;
    maxRecommendations: number;
    updateCheck?: {
        enabled: boolean;
        intervalHours: number;
    };
    agentTargets?: Record<string, string>;
    minTrustGrade?: "A" | "B" | "C" | "D" | "F";
}
export declare const DEFAULT_CONFIG: SkillFinderConfig;
export declare function loadConfig(userConfig?: Partial<SkillFinderConfig>): SkillFinderConfig;
//# sourceMappingURL=config.d.ts.map