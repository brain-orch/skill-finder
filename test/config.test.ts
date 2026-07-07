import { describe, it, expect } from "vitest";
import { loadConfig, DEFAULT_CONFIG, type SkillFinderConfig } from "../src/config.js";

describe("Config loading", () => {
  it("returns defaults when no config given", () => {
    const config = loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("returns defaults when null given", () => {
    const config = loadConfig(null as unknown as Partial<SkillFinderConfig>);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("partial merge overrides only specified fields", () => {
    const config = loadConfig({ enabled: false });
    expect(config.enabled).toBe(false);
    expect(config.autoRecommend).toBe(DEFAULT_CONFIG.autoRecommend);
    expect(config.marketplaces).toEqual(DEFAULT_CONFIG.marketplaces);
    expect(config.cacheTtlHours).toBe(DEFAULT_CONFIG.cacheTtlHours);
  });

  it("field override works for all boolean fields", () => {
    const config = loadConfig({
      enabled: false,
      autoRecommend: false,
      showNotifications: false,
    });
    expect(config.enabled).toBe(false);
    expect(config.autoRecommend).toBe(false);
    expect(config.showNotifications).toBe(false);
  });

  it("marketplaces defaults on empty array", () => {
    const config = loadConfig({ marketplaces: [] });
    expect(config.marketplaces).toEqual(DEFAULT_CONFIG.marketplaces);
  });

  it("cacheTtlHours below min clamped", () => {
    const config = loadConfig({ cacheTtlHours: -5 });
    expect(config.cacheTtlHours).toBe(1);
  });

  it("cacheTtlHours above max clamped", () => {
    const config = loadConfig({ cacheTtlHours: 99999 });
    expect(config.cacheTtlHours).toBe(8760);
  });

  it("maxCacheSizeMb below min clamped", () => {
    const config = loadConfig({ maxCacheSizeMb: 1 });
    expect(config.maxCacheSizeMb).toBe(10);
  });

  it("maxRecommendations below min clamped", () => {
    const config = loadConfig({ maxRecommendations: 0 });
    expect(config.maxRecommendations).toBe(1);
  });

  it("maxRecommendations above max clamped", () => {
    const config = loadConfig({ maxRecommendations: 20 });
    expect(config.maxRecommendations).toBe(10);
  });

  it("invalid type falls back to default for number fields", () => {
    const config = loadConfig({
      cacheTtlHours: "abc" as unknown as number,
      maxCacheSizeMb: NaN,
    });
    expect(config.cacheTtlHours).toBe(DEFAULT_CONFIG.cacheTtlHours);
    expect(config.maxCacheSizeMb).toBe(DEFAULT_CONFIG.maxCacheSizeMb);
  });

  it("preApprovedCategories defaults to empty array", () => {
    const config = loadConfig();
    expect(config.preApprovedCategories).toEqual([]);
  });

  it("preApprovedCategories accepts string array", () => {
    const config = loadConfig({ preApprovedCategories: ["pdf-processing"] });
    expect(config.preApprovedCategories).toEqual(["pdf-processing"]);
  });
});
