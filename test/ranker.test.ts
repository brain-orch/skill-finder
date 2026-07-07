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
});