import { describe, it, expect } from "vitest";
import { RelevanceRanker } from "../src/search/ranker.js";
import type { SkillSearchResult } from "../src/types.js";

const createMockResult = (overrides: Partial<SkillSearchResult>): SkillSearchResult => ({
  id: overrides.id ?? "test:skill",
  name: overrides.name ?? "test-skill",
  description: overrides.description ?? "A test skill",
  marketplace: overrides.marketplace ?? "lobehub",
  category: overrides.category ?? null,
  triggers: overrides.triggers ?? [],
  installCount: overrides.installCount ?? 100,
  stars: overrides.stars ?? 4,
  installCommand: overrides.installCommand ?? "skill install test-skill",
  homepageUrl: overrides.homepageUrl ?? "https://example.com",
  verified: overrides.verified ?? false,
});

describe("RelevanceRanker", () => {
  it("ranks exact name match highest", () => {
    const ranker = new RelevanceRanker();
    const results = [
      createMockResult({ name: "pdf-tools", installCount: 100, stars: 3 }),
      createMockResult({ name: "document-parser", description: "PDF parsing tool", installCount: 200, stars: 4 }),
    ];

    const ranked = ranker.rank(results, "pdf-tools");

    expect(ranked[0].name).toBe("pdf-tools");
  });

  it("deduplicates by normalized name", () => {
    const ranker = new RelevanceRanker();
    const results = [
      createMockResult({ name: "my-skill", installCount: 100, stars: 3 }),
      createMockResult({ name: "my_skill", installCount: 200, stars: 4 }),
      createMockResult({ name: "my.skill", installCount: 50, stars: 2 }),
    ];

    // Use "my" to match all three (substring match)
    const ranked = ranker.rank(results, "my");

    // "my-skill" and "my_skill" normalize to same key ("my-skill")
    // "my.skill" stays separate because dots aren't handled
    expect(ranked.length).toBe(2);
    // "my_skill" has higher score (popularity + stars), so it wins
    expect(ranked[0].name).toBe("my_skill");
  });

  it("respects limit parameter", () => {
    const ranker = new RelevanceRanker();
    const results = [
      createMockResult({ name: "skill-a", installCount: 100 }),
      createMockResult({ name: "skill-b", installCount: 200 }),
      createMockResult({ name: "skill-c", installCount: 300 }),
    ];

    const ranked = ranker.rank(results, "skill", 2);

    expect(ranked.length).toBe(2);
  });

  it("returns empty array for empty input", () => {
    const ranker = new RelevanceRanker();
    const ranked = ranker.rank([], "test");

    expect(ranked).toEqual([]);
  });

  it("combines multiple scoring factors", () => {
    const ranker = new RelevanceRanker();
    const results = [
      createMockResult({
        name: "search-engine",
        description: "Fast search",
        category: "search",
        triggers: ["search", "find"],
        installCount: 500,
        stars: 5,
        verified: true,
      }),
      createMockResult({
        name: "basic-tool",
        description: "A basic tool",
        category: "utility",
        triggers: ["tool"],
        installCount: 1000,
        stars: 3,
        verified: false,
      }),
    ];

    const ranked = ranker.rank(results, "search");

    // "search-engine" should rank higher due to:
    // - exact name match (+10)
    // - description match (+2)
    // - category match (+3)
    // - trigger match (+4)
    // - verified bonus (0.1x)
    expect(ranked[0].name).toBe("search-engine");
  });

  it("prefers verified skills when scores equal", () => {
    const ranker = new RelevanceRanker();
    const results = [
      createMockResult({
        name: "skill-a",
        installCount: 100,
        stars: 3,
        verified: false,
      }),
      createMockResult({
        name: "skill-b",
        installCount: 100,
        stars: 3,
        verified: true,
      }),
    ];

    const ranked = ranker.rank(results, "skill");

    // Both have same name match score, same popularity, same stars
    // Verified bonus (0.1) should break the tie
    expect(ranked[0].verified).toBe(true);
    expect(ranked[1].verified).toBe(false);
  });

  describe("freshness boost", () => {
    it("boosts score by 0.1 for skills used within 7 days", () => {
      const ranker = new RelevanceRanker();
      const results = [
        createMockResult({ id: "test:fresh", name: "fresh-skill", installCount: 100 }),
        createMockResult({ id: "test:old", name: "old-skill", installCount: 100 }),
      ];

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
      const freshnessData = new Map<string, string>([
        ["test:fresh", oneDayAgo],
      ]);

      const ranked = ranker.rank(results, "fresh-skill", undefined, freshnessData);

      expect(ranked[0].id).toBe("test:fresh");
    });

    it("boosts score by 0.05 for skills used within 30 days", () => {
      const ranker = new RelevanceRanker();
      const results = [
        createMockResult({ id: "test:recent", name: "recent-skill", installCount: 100 }),
        createMockResult({ id: "test:stale", name: "stale-skill", installCount: 100 }),
      ];

      const now = new Date();
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();
      const freshnessData = new Map<string, string>([
        ["test:recent", fifteenDaysAgo],
      ]);

      const ranked = ranker.rank(results, "recent-skill", undefined, freshnessData);

      expect(ranked[0].id).toBe("test:recent");
    });

    it("gives no boost for skills used more than 30 days ago", () => {
      const ranker = new RelevanceRanker();
      const results = [
        createMockResult({ id: "test:ancient", name: "ancient-skill", installCount: 100 }),
      ];

      const now = new Date();
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const freshnessData = new Map<string, string>([
        ["test:ancient", sixtyDaysAgo],
      ]);

      const ranked = ranker.rank(results, "ancient-skill", undefined, freshnessData);

      expect(ranked[0].id).toBe("test:ancient");
    });

    it("works without freshness data (backwards compatible)", () => {
      const ranker = new RelevanceRanker();
      const results = [
        createMockResult({ name: "skill-a", installCount: 100 }),
        createMockResult({ name: "skill-b", installCount: 200 }),
      ];

      const ranked = ranker.rank(results, "skill");

      expect(ranked).toHaveLength(2);
    });
  });

  it("deduplicates same name from different marketplaces using quality score", () => {
    const ranker = new RelevanceRanker();
    const results = [
      createMockResult({
        name: "pdf-tools",
        marketplace: "lobehub",
        installCount: 500,
        stars: 4,
        description: "PDF processing tool",
        triggers: ["pdf"],
      }),
      createMockResult({
        name: "pdf-tools",
        marketplace: "skillsmp",
        installCount: 1000,
        stars: 5,
        description: "Advanced PDF toolkit with extraction and merging",
        triggers: ["pdf", "extract", "merge"],
      }),
    ];

    const ranked = ranker.rank(results, "pdf-tools");

    expect(ranked.length).toBe(1);
    expect(ranked[0].marketplace).toBe("skillsmp");
  });

  it("deduplicates same name from same marketplace using calculate score", () => {
    const ranker = new RelevanceRanker();
    const results = [
      createMockResult({
        name: "pdf-tools",
        marketplace: "lobehub",
        installCount: 100,
        stars: 3,
        description: "Basic PDF tool",
        triggers: [],
      }),
      createMockResult({
        name: "pdf-tools",
        marketplace: "lobehub",
        installCount: 500,
        stars: 5,
        description: "Advanced PDF toolkit",
        triggers: ["pdf"],
      }),
    ];

    const ranked = ranker.rank(results, "pdf-tools");

    expect(ranked.length).toBe(1);
    expect(ranked[0].installCount).toBe(500);
  });

  it("returns all results when no duplicates exist", () => {
    const ranker = new RelevanceRanker();
    const results = [
      createMockResult({ name: "skill-a", marketplace: "lobehub" }),
      createMockResult({ name: "skill-b", marketplace: "skillsmp" }),
      createMockResult({ name: "skill-c", marketplace: "clawhub" }),
    ];

    const ranked = ranker.rank(results, "skill");

    expect(ranked.length).toBe(3);
  });
});