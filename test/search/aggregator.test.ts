import { describe, it, expect } from "vitest";
import { SearchAggregator } from "../../src/search/aggregator.js";
import type { ParsedIntent } from "../../src/search/intent-parser.js";
import type { SkillSearchResult } from "../../src/types.js";

const makeSkill = (overrides: Partial<SkillSearchResult>): SkillSearchResult => ({
  id: overrides.id ?? "test:skill",
  name: overrides.name ?? "test-skill",
  description: overrides.description ?? "A test skill",
  marketplace: overrides.marketplace ?? "lobehub",
  category: overrides.category ?? null,
  triggers: overrides.triggers ?? ["test"],
  installCount: overrides.installCount ?? 100,
  stars: overrides.stars ?? 4.0,
  installCommand: overrides.installCommand ?? "skill install test:skill",
  homepageUrl: overrides.homepageUrl ?? "https://example.com/skill",
  verified: overrides.verified ?? false,
});

const makeIntent = (categories: string[]): ParsedIntent => ({
  primaryIntent: categories[0] ?? "",
  categories,
  expandedQueries: [],
  confidence: 0.8,
});

describe("SearchAggregator", () => {
  let aggregator: SearchAggregator;

  it("deduplicates same skill across two marketplaces, keeps higher quality", () => {
    aggregator = new SearchAggregator();
    const results: SkillSearchResult[][] = [
      [
        makeSkill({ id: "lobehub:pdf-tools", name: "pdf-tools", marketplace: "lobehub", stars: 3.0, installCount: 50 }),
      ],
      [
        makeSkill({ id: "skillssh:pdf-tools", name: "pdf-tools", marketplace: "skillssh", stars: 4.5, installCount: 200 }),
      ],
    ];
    const intent = makeIntent(["pdf-processing"]);

    const agg = aggregator.aggregateResults(results, intent);

    // Should keep only one pdf-tools (the higher quality one from skillssh)
    const allResults = [...agg.categories.flatMap((c) => c.results), ...agg.other];
    const pdfTools = allResults.filter((r) => r.name === "pdf-tools");
    expect(pdfTools.length).toBe(1);
    expect(pdfTools[0].marketplace).toBe("skillssh");
  });

  it("groups results by matching intent categories", () => {
    aggregator = new SearchAggregator();
    const results: SkillSearchResult[][] = [
      [
        makeSkill({ id: "lobehub:pdf-tools", name: "pdf-tools", category: "pdf-processing" }),
        makeSkill({ id: "lobehub:react-hooks", name: "react-hooks", category: "frontend" }),
      ],
    ];
    const intent = makeIntent(["pdf-processing", "frontend"]);

    const agg = aggregator.aggregateResults(results, intent);

    expect(agg.categories.length).toBe(2);
    const catNames = agg.categories.map((c) => c.category);
    expect(catNames).toContain("pdf-processing");
    expect(catNames).toContain("frontend");
    expect(agg.other.length).toBe(0);
  });

  it("returns empty AggregatedResults for empty input", () => {
    aggregator = new SearchAggregator();
    const intent = makeIntent(["pdf-processing"]);

    const agg = aggregator.aggregateResults([], intent);

    expect(agg.categories).toEqual([]);
    expect(agg.other).toEqual([]);
    expect(agg.totalUnique).toBe(0);
  });

  it("puts non-matching results in 'other' bucket", () => {
    aggregator = new SearchAggregator();
    const results: SkillSearchResult[][] = [
      [
        makeSkill({ id: "lobehub:pdf-tools", name: "pdf-tools", category: "pdf-processing" }),
        makeSkill({ id: "lobehub:docker-helper", name: "docker-helper", category: "docker" }),
      ],
    ];
    const intent = makeIntent(["pdf-processing"]);

    const agg = aggregator.aggregateResults(results, intent);

    expect(agg.categories.length).toBe(1);
    expect(agg.categories[0].category).toBe("pdf-processing");
    expect(agg.other.length).toBe(1);
    expect(agg.other[0].name).toBe("docker-helper");
  });

  it("correctly groups 10 results all in same category", () => {
    aggregator = new SearchAggregator();
    const results: SkillSearchResult[][] = [
      Array.from({ length: 10 }, (_, i) =>
        makeSkill({
          id: `lobehub:tool-${i}`,
          name: `tool-${i}`,
          category: "database",
        }),
      ),
    ];
    const intent = makeIntent(["database"]);

    const agg = aggregator.aggregateResults(results, intent);

    expect(agg.categories.length).toBe(1);
    expect(agg.categories[0].results.length).toBe(10);
    expect(agg.other.length).toBe(0);
    expect(agg.totalUnique).toBe(10);
  });

  it("ranks results by quality score descending within categories", () => {
    aggregator = new SearchAggregator();
    const results: SkillSearchResult[][] = [
      [
        makeSkill({ id: "lobehub:low", name: "low-skill", category: "database", stars: 1.0, installCount: 10 }),
        makeSkill({ id: "lobehub:high", name: "high-skill", category: "database", stars: 5.0, installCount: 500 }),
      ],
    ];
    const intent = makeIntent(["database"]);

    const agg = aggregator.aggregateResults(results, intent);

    expect(agg.categories[0].results[0].name).toBe("high-skill");
    expect(agg.categories[0].results[1].name).toBe("low-skill");
  });

  it("handles single marketplace result", () => {
    aggregator = new SearchAggregator();
    const results: SkillSearchResult[][] = [
      [
        makeSkill({ id: "lobehub:single", name: "single-skill", category: "testing" }),
      ],
    ];
    const intent = makeIntent(["testing"]);

    const agg = aggregator.aggregateResults(results, intent);

    expect(agg.totalUnique).toBe(1);
    expect(agg.categories.length).toBe(1);
    expect(agg.categories[0].results[0].name).toBe("single-skill");
  });

  it("merges results from multiple queries", () => {
    aggregator = new SearchAggregator();
    const results: SkillSearchResult[][] = [
      [
        makeSkill({ id: "lobehub:tool-a", name: "tool-a", category: "pdf-processing" }),
      ],
      [
        makeSkill({ id: "lobehub:tool-b", name: "tool-b", category: "pdf-processing" }),
      ],
    ];
    const intent = makeIntent(["pdf-processing"]);

    const agg = aggregator.aggregateResults(results, intent);

    expect(agg.totalUnique).toBe(2);
    expect(agg.categories[0].results.length).toBe(2);
  });
});
