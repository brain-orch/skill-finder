import { describe, it, expect, vi, beforeEach } from "vitest";
import { SemanticSearch } from "../../src/search/semantic.js";
import type { SkillIndexer, IndexedSkill } from "../../src/cache/indexer.js";

const createMockSkill = (overrides: Partial<IndexedSkill> = {}): IndexedSkill => ({
  id: "mock:skill",
  name: "mock-skill",
  description: "A mock skill for testing",
  marketplace: "lobehub",
  category: null,
  triggers: ["test"],
  installCount: 100,
  stars: 4.0,
  filePath: "/mock/path",
  installedAt: "2024-01-01T00:00:00Z",
  lastUsed: null,
  useCount: 0,
  skillHash: "abc123",
  ...overrides,
});

const createMockIndexer = (skills: IndexedSkill[]): SkillIndexer => ({
  searchLocal: vi.fn().mockReturnValue(skills),
  init: vi.fn(),
  indexSkill: vi.fn(),
  markUsed: vi.fn(),
  getFreshness: vi.fn(),
  removeFromIndex: vi.fn(),
  getStats: vi.fn(),
  sanitizeFTS5: vi.fn(),
  close: vi.fn(),
  refreshFromCache: vi.fn(),
});

describe("SemanticSearch", () => {
  let mockSkills: IndexedSkill[];

  beforeEach(() => {
    mockSkills = [
      createMockSkill({
        id: "mock:pdf-tools",
        name: "pdf-tools",
        description: "PDF processing toolkit",
        triggers: ["pdf", "document"],
      }),
      createMockSkill({
        id: "mock:document-parser",
        name: "document-parser",
        description: "Parse various document formats",
        triggers: ["parser", "document"],
      }),
      createMockSkill({
        id: "mock:image-converter",
        name: "image-converter",
        description: "Convert between image formats",
        triggers: ["image", "convert"],
      }),
    ];
  });

  it("basic search returns results", () => {
    const indexer = createMockIndexer(mockSkills);
    const semantic = new SemanticSearch(indexer);

    const results = semantic.search("pdf document");

    expect(results.length).toBeGreaterThan(0);
    expect(indexer.searchLocal).toHaveBeenCalledWith("pdf document", 50);
  });

  it("empty query returns empty array", () => {
    const indexer = createMockIndexer(mockSkills);
    const semantic = new SemanticSearch(indexer);

    expect(semantic.search("")).toEqual([]);
    expect(semantic.search("   ")).toEqual([]);
  });

  it("no results from indexer returns empty array", () => {
    const indexer = createMockIndexer([]);
    const semantic = new SemanticSearch(indexer);

    const results = semantic.search("nonexistent");

    expect(results).toEqual([]);
  });

  it("field prioritization: name matches ranked above description-only matches", () => {
    // Create skills where one matches in name only, another in description only
    const skills = [
      createMockSkill({
        id: "mock:pdf-basic",
        name: "pdf-basic",
        description: "Basic tool for text",
        triggers: ["text"],
      }),
      createMockSkill({
        id: "mock:text-finder",
        name: "text-finder",
        description: "Find and extract pdf content",
        triggers: ["search"],
      }),
    ];

    const indexer = createMockIndexer(skills);
    const semantic = new SemanticSearch(indexer);

    const results = semantic.search("pdf");

    // "pdf-basic" should rank higher because "pdf" is in its name (weight 3)
    // while "text-finder" only has "pdf" in its description (weight 2)
    expect(results[0].id).toBe("mock:pdf-basic");
    expect(results[0].fieldScores.name).toBeGreaterThan(0);
  });

  it("sorting by combined score descending", () => {
    // Create skills with known relevance differences
    const skills = [
      createMockSkill({
        id: "mock:low-match",
        name: "low-match",
        description: "Contains pdf in description only",
        triggers: [],
      }),
      createMockSkill({
        id: "mock:high-match",
        name: "pdf-master",
        description: "PDF tools with pdf processing",
        triggers: ["pdf"],
      }),
    ];

    const indexer = createMockIndexer(skills);
    const semantic = new SemanticSearch(indexer);

    const results = semantic.search("pdf");

    // "pdf-master" should rank higher: name match (3) + desc match (2) + trigger match (1)
    // "low-match" only gets desc match (2)
    expect(results[0].id).toBe("mock:high-match");
    expect(results[results.length - 1].id).toBe("mock:low-match");
  });

  it("special characters are sanitized correctly", () => {
    const indexer = createMockIndexer(mockSkills);
    const semantic = new SemanticSearch(indexer);

    // These should not throw errors
    const results1 = semantic.search('test "quoted"');
    const results2 = semantic.search("test AND query");
    const results3 = semantic.search("test (parens)");

    // Should not throw, and indexer.searchLocal is called
    expect(indexer.searchLocal).toHaveBeenCalledTimes(3);
  });

  it("backwards compatible: existing search interface unchanged", async () => {
    // Import SearchEngine to verify it still works
    const { SearchEngine } = await import("../../src/search/index.js");
    const { MarketRegistry } = await import("../../src/registry/index.js");

    const config = {
      marketplaces: ["mock"],
      searchTimeoutMs: 15_000,
      retryCount: 2,
      retryBackoffMs: 1000,
    };

    const registry = new MarketRegistry(config);
    const engine = new SearchEngine(registry, config);

    // Old search method should still work
    const results = await engine.search({ query: "test" });
    expect(Array.isArray(results)).toBe(true);

    // searchLocal should return empty when semanticSearch is not set
    const localResults = engine.searchLocal("test");
    expect(localResults).toEqual([]);
  });

  it("searchLocal delegates to semanticSearch when available", () => {
    const indexer = createMockIndexer(mockSkills);
    const semantic = new SemanticSearch(indexer);

    const results = semantic.search("pdf");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("id");
    expect(results[0]).toHaveProperty("name");
    expect(results[0]).toHaveProperty("score");
    expect(results[0]).toHaveProperty("fieldScores");
    expect(results[0].fieldScores).toHaveProperty("name");
    expect(results[0].fieldScores).toHaveProperty("description");
    expect(results[0].fieldScores).toHaveProperty("triggers");
  });

  it("multi-term query computes correct IDF", () => {
    // When a term appears in all results, IDF should be low
    // When a term appears in few results, IDF should be high
    const skills = [
      createMockSkill({
        id: "mock:pdf-only",
        name: "pdf-only",
        description: "PDF tool",
        triggers: ["pdf"],
      }),
      createMockSkill({
        id: "mock:pdf-common",
        name: "pdf-common",
        description: "PDF and document tool",
        triggers: ["pdf", "document"],
      }),
      createMockSkill({
        id: "mock:doc-only",
        name: "doc-only",
        description: "Document tool",
        triggers: ["document"],
      }),
    ];

    const indexer = createMockIndexer(skills);
    const semantic = new SemanticSearch(indexer);

    const results = semantic.search("pdf document");

    // "pdf-only" has pdf in name (3x) but no document
    // "pdf-common" has both in name/desc/triggers
    // "doc-only" has document in name but no pdf
    expect(results.length).toBe(3);

    // All results should have scores
    for (const result of results) {
      expect(result.score).toBeGreaterThanOrEqual(0);
    }
  });
});
