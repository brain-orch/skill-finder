export interface SkillFinderConfig {
  enabled: boolean;
  autoRecommend: boolean;
  marketplaces: string[];
  cacheTtlHours: number;
  maxCacheSizeMb: number;
  preApprovedCategories: string[];
  showNotifications: boolean;
  maxRecommendations: number;
}

export const DEFAULT_CONFIG: SkillFinderConfig = {
  enabled: true,
  autoRecommend: true,
  marketplaces: ["lobehub", "skillssh", "agentskillsh", "skillsmp", "clawhub", "mcpservers", "awesomeskill"],
  cacheTtlHours: 24,
  maxCacheSizeMb: 500,
  preApprovedCategories: [],
  showNotifications: true,
  maxRecommendations: 3,
};

function clamp(value: number, min: number, max: number, label: string): number {
  if (typeof value !== "number" || isNaN(value)) {
    console.warn(`skill-finder: invalid ${label} "${value}", using default`);
    return (DEFAULT_CONFIG as unknown as Record<string, unknown>)[label] as number;
  }
  if (value < min) {
    console.warn(`skill-finder: ${label} ${value} below min ${min}, clamping`);
    return min;
  }
  if (value > max) {
    console.warn(`skill-finder: ${label} ${value} above max ${max}, clamping`);
    return max;
  }
  return value;
}

function validateMarketplaces(marketplaces: unknown): string[] {
  if (!Array.isArray(marketplaces) || marketplaces.length === 0) {
    return DEFAULT_CONFIG.marketplaces;
  }
  return marketplaces.filter((m): m is string => typeof m === "string");
}

function validateStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export function loadConfig(userConfig?: Partial<SkillFinderConfig>): SkillFinderConfig {
  if (!userConfig || typeof userConfig !== "object") {
    return { ...DEFAULT_CONFIG };
  }

  return {
    enabled: typeof userConfig.enabled === "boolean" ? userConfig.enabled : DEFAULT_CONFIG.enabled,
    autoRecommend:
      typeof userConfig.autoRecommend === "boolean"
        ? userConfig.autoRecommend
        : DEFAULT_CONFIG.autoRecommend,
    marketplaces: validateMarketplaces(userConfig.marketplaces),
    cacheTtlHours: clamp(
      userConfig.cacheTtlHours as number,
      1,
      8760,
      "cacheTtlHours",
    ),
    maxCacheSizeMb: clamp(
      userConfig.maxCacheSizeMb as number,
      10,
      10000,
      "maxCacheSizeMb",
    ),
    preApprovedCategories: validateStringArray(userConfig.preApprovedCategories),
    showNotifications:
      typeof userConfig.showNotifications === "boolean"
        ? userConfig.showNotifications
        : DEFAULT_CONFIG.showNotifications,
    maxRecommendations: clamp(
      userConfig.maxRecommendations as number,
      1,
      10,
      "maxRecommendations",
    ),
  };
}
