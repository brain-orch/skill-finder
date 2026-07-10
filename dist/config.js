export const DEFAULT_CONFIG = {
    enabled: true,
    autoRecommend: true,
    marketplaces: ["lobehub", "skillssh", "agentskillsh", "skillsmp", "clawhub", "mcpservers", "awesomeskill"],
    cacheTtlHours: 24,
    maxCacheSizeMb: 500,
    preApprovedCategories: [],
    showNotifications: true,
    maxRecommendations: 3,
    updateCheck: {
        enabled: true,
        intervalHours: 24,
    },
    agentTargets: undefined,
    minTrustGrade: "C",
};
function clamp(value, min, max, label) {
    if (typeof value !== "number" || isNaN(value)) {
        console.warn(`skill-finder: invalid ${label} "${value}", using default`);
        return DEFAULT_CONFIG[label];
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
function validateMarketplaces(marketplaces) {
    if (!Array.isArray(marketplaces) || marketplaces.length === 0) {
        return DEFAULT_CONFIG.marketplaces;
    }
    return marketplaces.filter((m) => typeof m === "string");
}
function validateStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((v) => typeof v === "string");
}
function validateAgentTargets(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return undefined;
    const result = {};
    for (const [key, val] of Object.entries(value)) {
        if (typeof key === "string" && typeof val === "string") {
            result[key] = val;
        }
    }
    return Object.keys(result).length > 0 ? result : undefined;
}
const VALID_TRUST_GRADES = new Set(["A", "B", "C", "D", "F"]);
function validateTrustGrade(value) {
    if (typeof value === "string" && VALID_TRUST_GRADES.has(value)) {
        return value;
    }
    return DEFAULT_CONFIG.minTrustGrade;
}
export function loadConfig(userConfig) {
    if (!userConfig || typeof userConfig !== "object") {
        return { ...DEFAULT_CONFIG };
    }
    const updateCheck = userConfig.updateCheck
        ? {
            enabled: typeof userConfig.updateCheck.enabled === "boolean"
                ? userConfig.updateCheck.enabled
                : DEFAULT_CONFIG.updateCheck?.enabled ?? true,
            intervalHours: clamp(userConfig.updateCheck.intervalHours, 1, 168, "updateCheck.intervalHours"),
        }
        : DEFAULT_CONFIG.updateCheck;
    return {
        enabled: typeof userConfig.enabled === "boolean" ? userConfig.enabled : DEFAULT_CONFIG.enabled,
        autoRecommend: typeof userConfig.autoRecommend === "boolean"
            ? userConfig.autoRecommend
            : DEFAULT_CONFIG.autoRecommend,
        marketplaces: validateMarketplaces(userConfig.marketplaces),
        cacheTtlHours: clamp(userConfig.cacheTtlHours, 1, 8760, "cacheTtlHours"),
        maxCacheSizeMb: clamp(userConfig.maxCacheSizeMb, 10, 10000, "maxCacheSizeMb"),
        preApprovedCategories: validateStringArray(userConfig.preApprovedCategories),
        showNotifications: typeof userConfig.showNotifications === "boolean"
            ? userConfig.showNotifications
            : DEFAULT_CONFIG.showNotifications,
        maxRecommendations: clamp(userConfig.maxRecommendations, 1, 10, "maxRecommendations"),
        updateCheck,
        agentTargets: userConfig.agentTargets && typeof userConfig.agentTargets === "object"
            ? validateAgentTargets(userConfig.agentTargets)
            : DEFAULT_CONFIG.agentTargets,
        minTrustGrade: validateTrustGrade(userConfig.minTrustGrade),
    };
}
//# sourceMappingURL=config.js.map