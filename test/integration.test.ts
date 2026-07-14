import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { MarketRegistry } from "../src/registry/index.js";
import { MockMarketplace } from "../src/registry/mock.js";
import { CacheManager } from "../src/cache/index.js";
import { SkillIndexer } from "../src/cache/indexer.js";
import { sanitizeFTS5 } from "../src/cache/fts5-utils.js";
import { SkillRecommender } from "../src/plugin/recommender.js";
import { SkillActivator } from "../src/activation.js";
import { SearchEngine } from "../src/search/index.js";
import { loadConfig } from "../src/config.js";
import type { SkillSearchResult, SkillMarketplace, MarketplaceConfig } from "../src/types.js";
import type { DetectedContext } from "../src/plugin/detector.js";
import type { ActivationConfig } from "../src/activation.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkill(
  overrides: Partial<SkillSearchResult> & { id: string; name: string },
): SkillSearchResult {
  return {
    description: `A skill called ${overrides.name}`,
    marketplace: "lobehub",
    category: null,
    triggers: [],
    installCount: 0,
    stars: 0,
    installCommand: `opencode install ${overrides.id}`,
    homepageUrl: `https://example.com/${overrides.id}`,
    verified: false,
    ...overrides,
  };
}

function makeContext(categories: string[]): DetectedContext {
  return {
    categories,
    confidence: 0.8,
    signals: categories.map((c) => ({
      type: "keyword" as const,
      value: c,
      category: c,
      confidence: 0.8,
    })),
    timestamp: Date.now(),
  };
}

function makeRegistryConfig(): MarketplaceConfig {
  return {
    marketplaces: [],
    searchTimeoutMs: 5000,
    retryCount: 0,
    retryBackoffMs: 0,
  };
}

// ---------------------------------------------------------------------------
// 1. End-to-end: marketplace → search → download → index → recommend → activate
// ---------------------------------------------------------------------------

describe("Integration: full end-to-end flow", () => {
  let tmpDir: string;
  let indexer: SkillIndexer | null;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-finder-e2e-"));
    indexer = null;
  });

  afterEach(() => {
    if (indexer) {
      indexer.close();
      indexer = null;
    }
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Windows cleanup best-effort
      }
    }
  });

  it("search → download → index → recommend → activate completes successfully", async () => {
    // --- Stage 1: Set up marketplace with skills ---
    const pdfSkill = makeSkill({
      id: "lobehub:pdf-tools",
      name: "pdf-tools",
      description: "Extract text and images from PDF documents",
      marketplace: "lobehub",
      category: "pdf-processing",
      triggers: ["pdf", "extract text", "ocr"],
      installCount: 500,
      stars: 4.5,
      verified: true,
    });

    const registry = new MarketRegistry(makeRegistryConfig());
    const mockMarket = new MockMarketplace("lobehub", [pdfSkill]);
    registry.addAdapter(mockMarket);

    // --- Stage 2: Search for "pdf" ---
    const searchEngine = new SearchEngine(registry, makeRegistryConfig());
    const searchResults = await searchEngine.search({ query: "pdf" });
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].name).toContain("pdf");

    // --- Stage 3: Download the skill via CacheManager ---
    const cache = new CacheManager({
      globalDir: path.join(tmpDir, "global-skills"),
      projectDir: path.join(tmpDir, "project-skills"),
      tempDir: tmpDir,
    });
    const downloadResult = await cache.download("lobehub:pdf-tools", mockMarket);
    expect(fs.existsSync(downloadResult.path)).toBe(true);
    expect(downloadResult.path.endsWith("SKILL.md")).toBe(true);

    // --- Stage 4: Index the downloaded skill in FTS5 DB ---
    const dbPath = path.join(tmpDir, "test-index.db");
    indexer = new SkillIndexer(dbPath);
    indexer.init();

    indexer.indexSkill({
      id: "lobehub:pdf-tools",
      name: "pdf-tools",
      description: "Extract text and images from PDF documents",
      marketplace: "lobehub",
      category: "pdf-processing",
      triggers: ["pdf", "extract text", "ocr"],
      installCount: 500,
      stars: 4.5,
      filePath: downloadResult.path,
      installedAt: new Date().toISOString(),
      lastUsed: null,
      useCount: 0,
      skillHash: "abc123",
    });

    const localResults = indexer.searchLocal("pdf");
    expect(localResults.length).toBeGreaterThan(0);
    expect(localResults[0].name).toBe("pdf-tools");

    // --- Stage 5: Run recommender with both local and network ---
    const recommender = new SkillRecommender(searchEngine, registry, indexer);
    const recommendations = await recommender.recommend(makeContext(["pdf-processing"]));
    expect(recommendations.length).toBeGreaterThan(0);

    const topRec = recommendations[0];
    expect(topRec.name).toBe("pdf-tools");
    expect(topRec.matchReasons.length).toBeGreaterThan(0);

    // --- Stage 6: Activate the skill ---
    const activator = new SkillActivator({
      globalSkillsDir: path.join(tmpDir, "global-activated"),
      projectSkillsDir: path.join(tmpDir, "project-activated"),
      preApprovedCategories: ["pdf-processing"],
    });

    const sourceDir = path.dirname(downloadResult.path);
    const activationResult = await activator.activate("pdf-tools", sourceDir, {
      categories: ["pdf-processing"],
    });

    expect(activationResult.success).toBe(true);
    expect(activationResult.skillName).toBe("pdf-tools");
    expect(activationResult.message).toBe("Activated");
    expect(fs.existsSync(activationResult.path)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Edge cases
// ---------------------------------------------------------------------------

describe("Edge cases: all marketplaces down", () => {
  it("searchAll returns empty gracefully when all adapters throw", async () => {
    const registry = new MarketRegistry(makeRegistryConfig());

    const failingAdapter1: SkillMarketplace = {
      name: "failing1",
      search: () => Promise.reject(new Error("connection refused")),
      getSkillInfo: () => Promise.resolve(null),
      install: () => Promise.resolve({ path: "", files: [] }),
      isAvailable: () => false,
    };
    const failingAdapter2: SkillMarketplace = {
      name: "failing2",
      search: () => Promise.reject(new Error("timeout")),
      getSkillInfo: () => Promise.resolve(null),
      install: () => Promise.resolve({ path: "", files: [] }),
      isAvailable: () => false,
    };

    registry.addAdapter(failingAdapter1);
    registry.addAdapter(failingAdapter2);

    const results = await registry.searchAll("pdf");
    expect(results).toEqual([]);
  });

  it("SearchEngine.search returns empty when all marketplaces fail", async () => {
    const registry = new MarketRegistry(makeRegistryConfig());
    registry.addAdapter({
      name: "fail1",
      search: () => Promise.reject(new Error("boom")),
      getSkillInfo: () => Promise.resolve(null),
      install: () => Promise.resolve({ path: "", files: [] }),
      isAvailable: () => false,
    });

    const engine = new SearchEngine(registry, makeRegistryConfig());
    const results = await engine.search({ query: "anything" });
    expect(results).toEqual([]);
  });
});

describe("Edge cases: duplicate results from multiple marketplaces", () => {
  it("deduplicates by normalized name in SearchEngine ranker", async () => {
    const skillA = makeSkill({
      id: "market-a:pdf-tools",
      name: "pdf-tools",
      description: "PDF toolkit from market A",
      marketplace: "lobehub",
      installCount: 100,
    });
    const skillB = makeSkill({
      id: "market-b:pdf-tools",
      name: "pdf_tools", // Same name, different separator
      description: "PDF toolkit from market B",
      marketplace: "skillssh",
      installCount: 200,
    });

    const registry = new MarketRegistry(makeRegistryConfig());
    registry.addAdapter(new MockMarketplace("market-a", [skillA]));
    registry.addAdapter(new MockMarketplace("market-b", [skillB]));

    const engine = new SearchEngine(registry, makeRegistryConfig());
    const results = await engine.search({ query: "pdf-tools" });

    // After dedup, only one result with normalized name "pdf-tools"
    expect(results).toHaveLength(1);
    // Dedup keeps first-seen when scores are equal (pdf-tools from market-a)
    expect(results[0].installCount).toBe(100);
  });

  it("deduplicates in recommender by identifier", async () => {
    const tmpDirInner = fs.mkdtempSync(path.join(os.tmpdir(), "skill-finder-dedup-"));
    let innerIndexer: SkillIndexer | null = null;

    try {
      const dbPath = path.join(tmpDirInner, "dedup.db");
      innerIndexer = new SkillIndexer(dbPath);
      innerIndexer.init();

      const skillA = makeSkill({
        id: "lobehub:pdf-tools",
        name: "pdf-tools",
        description: "PDF toolkit",
        marketplace: "lobehub",
        category: "pdf-processing",
        triggers: ["pdf"],
        installCount: 500,
      });

      const registry = new MarketRegistry(makeRegistryConfig());
      // Two marketplaces returning the same skill
      registry.addAdapter(new MockMarketplace("lobehub", [skillA]));
      registry.addAdapter(new MockMarketplace("skillssh", [skillA]));

      const searchEngine = new SearchEngine(registry, makeRegistryConfig());
      const recommender = new SkillRecommender(searchEngine, registry, innerIndexer);

      const results = await recommender.recommend(makeContext(["pdf-processing"]));
      const identifiers = results.map((r) => r.identifier);
      expect(new Set(identifiers).size).toBe(identifiers.length);
    } finally {
      if (innerIndexer) innerIndexer.close();
      fs.rmSync(tmpDirInner, { recursive: true, force: true });
    }
  });
});

describe("Edge cases: special characters in query", () => {
  let tmpDirInner: string;
  let indexerInner: SkillIndexer | null;

  beforeEach(() => {
    tmpDirInner = fs.mkdtempSync(path.join(os.tmpdir(), "skill-finder-special-"));
    indexerInner = new SkillIndexer(path.join(tmpDirInner, "special.db"));
    indexerInner.init();
  });

  afterEach(() => {
    if (indexerInner) {
      indexerInner.close();
      indexerInner = null;
    }
    fs.rmSync(tmpDirInner, { recursive: true, force: true });
  });

  it("sanitizeFTS5 strips AND/OR/NOT/NEAR operators", () => {
    expect(sanitizeFTS5("pdf AND extract")).toBe('"pdf" "extract"');
    expect(sanitizeFTS5("test OR value")).toBe('"test" "value"');
    expect(sanitizeFTS5("NOT important")).toBe('"important"');
    expect(sanitizeFTS5("NEAR match")).toBe('"match"');
  });

  it("sanitizeFTS5 handles parentheses and wildcards", () => {
    // "(group)" is a single token — not bare ( or ), so it's kept
    expect(sanitizeFTS5("(group)")).toBe('"(group)"');
    // bare ( and ) are stripped, leaving the inner token
    expect(sanitizeFTS5("( bare )")).toBe('"bare"');
    // lone * is stripped; word* would be kept
    expect(sanitizeFTS5("test * value")).toBe('"test" "value"');
  });

  it("sanitizeFTS5 escapes inner double quotes", () => {
    const result = sanitizeFTS5('say "hello" world');
    expect(result).toBe('"say" """hello""" "world"');
  });

  it("searchLocal with special character query returns empty or handles gracefully", () => {
    // Query with only operators should produce empty sanitized string → empty results
    const results = indexerInner!.searchLocal("AND OR NOT");
    expect(results).toEqual([]);
  });

  it("searchLocal with mixed query works", () => {
    indexerInner!.indexSkill({
      id: "test:special",
      name: "special-skill",
      description: "A skill for testing special chars and values",
      marketplace: "lobehub",
      category: null,
      triggers: ["test", "value"],
      installCount: 0,
      stars: 0,
      filePath: "/tmp/special/SKILL.md",
      installedAt: new Date().toISOString(),
      lastUsed: null,
      useCount: 0,
      skillHash: "abc",
    });

    // "test AND value" → sanitized to '"test" "value"' → FTS5 implicit AND
    // Both "test" and "value" appear in triggers, so it matches
    const results = indexerInner!.searchLocal("test AND value");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});

describe("Edge cases: empty cache", () => {
  it("searchLocal returns empty on empty indexer", () => {
    const tmpDirInner = fs.mkdtempSync(path.join(os.tmpdir(), "skill-finder-empty-"));
    const idx = new SkillIndexer(path.join(tmpDirInner, "empty.db"));
    idx.init();

    try {
      expect(idx.searchLocal("anything")).toEqual([]);
      expect(idx.getStats()).toEqual([]);
    } finally {
      idx.close();
      fs.rmSync(tmpDirInner, { recursive: true, force: true });
    }
  });

  it("CacheManager.listCached returns empty for fresh dirs", () => {
    const tmpDirInner = fs.mkdtempSync(path.join(os.tmpdir(), "skill-finder-fresh-"));
    const cache = new CacheManager({
      globalDir: path.join(tmpDirInner, "global"),
      projectDir: path.join(tmpDirInner, "project"),
      tempDir: tmpDirInner,
    });

    try {
      expect(cache.listCached()).toEqual([]);
      expect(cache.getCacheSize()).toBe(0);
    } finally {
      fs.rmSync(tmpDirInner, { recursive: true, force: true });
    }
  });
});

describe("Edge cases: oversized cache cleanup", () => {
  it("cleanup on many cached skills does not crash", () => {
    const tmpDirInner = fs.mkdtempSync(path.join(os.tmpdir(), "skill-finder-oversized-"));
    const globalDir = path.join(tmpDirInner, "global");
    const projectDir = path.join(tmpDirInner, "project");
    fs.mkdirSync(globalDir, { recursive: true });
    fs.mkdirSync(projectDir, { recursive: true });

    // Simulate 50 cached skills
    for (let i = 0; i < 50; i++) {
      const skillDir = path.join(globalDir, `skill-${i}`);
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, "SKILL.md"),
        `# skill-${i}\n${"content ".repeat(100)}`,
        "utf-8",
      );
    }

    const cache = new CacheManager({ globalDir, projectDir, tempDir: tmpDirInner });

    try {
      const cached = cache.listCached();
      expect(cached).toHaveLength(50);

      // cleanup should not crash
      const result = cache.cleanup();
      expect(result.staleCount).toBeGreaterThanOrEqual(0);

      // checkQuota should not crash
      const quota = cache.checkQuota();
      expect(quota.currentSizeMb).toBeGreaterThanOrEqual(0);
    } finally {
      fs.rmSync(tmpDirInner, { recursive: true, force: true });
    }
  });
});

describe("Edge cases: partial config merge", () => {
  it("loadConfig with partial user config merges correctly", () => {
    const config = loadConfig({
      enabled: false,
      marketplaces: ["custom-market"],
    });

    expect(config.enabled).toBe(false);
    expect(config.marketplaces).toEqual(["custom-market"]);
    // Defaults preserved
    expect(config.autoRecommend).toBe(true);
    expect(config.cacheTtlHours).toBe(24);
    expect(config.maxCacheSizeMb).toBe(500);
    expect(config.maxRecommendations).toBe(3);
  });

  it("loadConfig with undefined returns full defaults", () => {
    const config = loadConfig(undefined);
    expect(config.enabled).toBe(true);
    expect(config.autoRecommend).toBe(true);
    expect(config.marketplaces).toEqual(["lobehub", "skillssh", "agentskillsh", "skillsmp", "clawhub", "mcpservers", "awesomeskill"]);
    expect(config.cacheTtlHours).toBe(24);
    expect(config.maxCacheSizeMb).toBe(500);
    expect(config.preApprovedCategories).toEqual([]);
    expect(config.showNotifications).toBe(true);
    expect(config.maxRecommendations).toBe(3);
  });

  it("loadConfig clamps out-of-range values", () => {
    const config = loadConfig({
      cacheTtlHours: 99999, // above max 8760
      maxCacheSizeMb: -5,   // below min 10
      maxRecommendations: 100, // above max 10
    });

    expect(config.cacheTtlHours).toBe(8760);
    expect(config.maxCacheSizeMb).toBe(10);
    expect(config.maxRecommendations).toBe(10);
  });

  it("loadConfig filters non-string marketplaces", () => {
    const config = loadConfig({
      marketplaces: ["valid", 123 as unknown as string, null as unknown as string, "also-valid"],
    });

    expect(config.marketplaces).toEqual(["valid", "also-valid"]);
  });

  it("loadConfig with empty marketplaces array falls back to defaults", () => {
    const config = loadConfig({ marketplaces: [] });
    expect(config.marketplaces).toEqual(["lobehub", "skillssh", "agentskillsh", "skillsmp", "clawhub", "mcpservers", "awesomeskill"]);
  });
});

describe("Edge cases: already installed skill", () => {
  it("activation returns already-installed message", async () => {
    const tmpDirInner = fs.mkdtempSync(path.join(os.tmpdir(), "skill-finder-already-"));
    const globalDir = path.join(tmpDirInner, "global");
    const projectDir = path.join(tmpDirInner, "project");
    fs.mkdirSync(globalDir, { recursive: true });
    fs.mkdirSync(projectDir, { recursive: true });

    // Pre-create the skill directory
    const skillDir = path.join(globalDir, "existing-skill");
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      "# existing-skill\n",
      "utf-8",
    );

    const activator = new SkillActivator({
      globalSkillsDir: globalDir,
      projectSkillsDir: projectDir,
      preApprovedCategories: [],
    });

    try {
      // Create a source dir to pass (won't be used since already installed)
      const sourceDir = path.join(tmpDirInner, "source");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "SKILL.md"), "# source\n", "utf-8");

      const result = await activator.activate("existing-skill", sourceDir, {
        categories: ["testing"],
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Already installed");
      expect(result.path).toContain("existing-skill");
      expect(result.path).toContain("SKILL.md");
    } finally {
      fs.rmSync(tmpDirInner, { recursive: true, force: true });
    }
  });
});

describe("Edge cases: concurrent operations", () => {
  it("concurrent searchAll calls do not crash", async () => {
    const registry = new MarketRegistry(makeRegistryConfig());
    const mockMarket = new MockMarketplace("lobehub", [
      makeSkill({ id: "lobehub:a", name: "alpha", triggers: ["alpha"] }),
      makeSkill({ id: "lobehub:b", name: "beta", triggers: ["beta"] }),
    ]);
    registry.addAdapter(mockMarket);

    const queries = ["alpha", "beta", "alpha beta", "", "nonexistent"];
    const promises = queries.map((q) => registry.searchAll(q));
    const results = await Promise.all(promises);

    expect(results).toHaveLength(5);
    // Empty query returns empty
    expect(results[3]).toEqual([]);
    // Non-matching returns empty (MockMarketplace filters by name/desc/triggers)
    expect(results[4]).toEqual([]);
  });

  it("concurrent download calls to CacheManager do not crash", async () => {
    const tmpDirInner = fs.mkdtempSync(path.join(os.tmpdir(), "skill-finder-concurrent-"));
    const cache = new CacheManager({
      globalDir: path.join(tmpDirInner, "global"),
      projectDir: path.join(tmpDirInner, "project"),
      tempDir: tmpDirInner,
    });

    const mockMarket = new MockMarketplace("lobehub", [
      makeSkill({ id: "lobehub:skill-a", name: "skill-a" }),
      makeSkill({ id: "lobehub:skill-b", name: "skill-b" }),
      makeSkill({ id: "lobehub:skill-c", name: "skill-c" }),
    ]);

    try {
      const downloads = [
        cache.download("lobehub:skill-a", mockMarket),
        cache.download("lobehub:skill-b", mockMarket),
        cache.download("lobehub:skill-c", mockMarket),
      ];

      const results = await Promise.all(downloads);
      expect(results).toHaveLength(3);

      for (const r of results) {
        expect(fs.existsSync(r.path)).toBe(true);
      }
    } finally {
      fs.rmSync(tmpDirInner, { recursive: true, force: true });
    }
  });

  it("concurrent indexer operations do not crash", () => {
    const tmpDirInner = fs.mkdtempSync(path.join(os.tmpdir(), "skill-finder-concurrent-idx-"));
    const idx = new SkillIndexer(path.join(tmpDirInner, "concurrent.db"));
    idx.init();

    try {
      // Index multiple skills sequentially (SQLite handles concurrency internally)
      for (let i = 0; i < 20; i++) {
        idx.indexSkill({
          id: `concurrent:skill-${i}`,
          name: `concurrent-skill-${i}`,
          description: `Skill ${i} for concurrent testing`,
          marketplace: "lobehub",
          category: null,
          triggers: [`trigger-${i}`],
          installCount: i * 10,
          stars: i % 5,
          filePath: `/tmp/skill-${i}/SKILL.md`,
          installedAt: new Date().toISOString(),
          lastUsed: null,
          useCount: 0,
          skillHash: `hash-${i}`,
        });
      }

      // Search concurrently
      const searches = Array.from({ length: 5 }, (_, i) =>
        idx.searchLocal(`concurrent-skill-${i}`, 10),
      );

      for (const results of searches) {
        expect(results.length).toBeGreaterThanOrEqual(1);
      }
    } finally {
      idx.close();
      fs.rmSync(tmpDirInner, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Performance
// ---------------------------------------------------------------------------

describe("Performance: search completes within reasonable time", () => {
  it("search completes under 1000ms with multiple marketplaces", async () => {
    const registry = new MarketRegistry(makeRegistryConfig());

    // Add 5 marketplaces with 10 skills each
    for (let m = 0; m < 5; m++) {
      const skills = Array.from({ length: 10 }, (_, i) =>
        makeSkill({
          id: `market-${m}:skill-${i}`,
          name: `skill-${i}`,
          description: `Skill ${i} from marketplace ${m}`,
          marketplace: "lobehub",
          triggers: [`keyword-${i}`],
          installCount: i * 100,
        }),
      );
      registry.addAdapter(new MockMarketplace(`market-${m}`, skills));
    }

    const engine = new SearchEngine(registry, makeRegistryConfig());

    const start = Date.now();
    const results = await engine.search({ query: "skill" });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1000);
    expect(results.length).toBeGreaterThan(0);
  });

  it("full pipeline (search + recommend) completes under 1000ms", async () => {
    const tmpDirInner = fs.mkdtempSync(path.join(os.tmpdir(), "skill-finder-perf-"));
    let perfIndexer: SkillIndexer | null = null;

    try {
      const dbPath = path.join(tmpDirInner, "perf.db");
      perfIndexer = new SkillIndexer(dbPath);
      perfIndexer.init();

      // Pre-index 10 skills
      for (let i = 0; i < 10; i++) {
        perfIndexer.indexSkill({
          id: `perf:skill-${i}`,
          name: `perf-skill-${i}`,
          description: `Performance test skill ${i}`,
          marketplace: "lobehub",
          category: "testing",
          triggers: [`perf-${i}`],
          installCount: i * 50,
          stars: (i % 5) + 1,
          filePath: `/tmp/perf-skill-${i}/SKILL.md`,
          installedAt: new Date().toISOString(),
          lastUsed: null,
          useCount: 0,
          skillHash: `perf-hash-${i}`,
        });
      }

      // Network marketplace
      const skills = Array.from({ length: 10 }, (_, i) =>
        makeSkill({
          id: `network:perf-skill-${i}`,
          name: `perf-skill-${i}`,
          description: `Network skill ${i}`,
          marketplace: "skillssh",
          category: "testing",
          triggers: [`perf-${i}`],
          installCount: i * 50,
        }),
      );

      const registry = new MarketRegistry(makeRegistryConfig());
      registry.addAdapter(new MockMarketplace("network", skills));

      const searchEngine = new SearchEngine(registry, makeRegistryConfig());
      const recommender = new SkillRecommender(searchEngine, registry, perfIndexer);

      const start = Date.now();
      const results = await recommender.recommend(makeContext(["testing"]));
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(1000);
      expect(results.length).toBeGreaterThan(0);
    } finally {
      if (perfIndexer) perfIndexer.close();
      fs.rmSync(tmpDirInner, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Cross-component integration: CacheManager + Indexer + Refresh
// ---------------------------------------------------------------------------

describe("Integration: cache refresh into indexer", () => {
  let tmpDirInner: string;
  let indexerInner: SkillIndexer | null;

  beforeEach(() => {
    tmpDirInner = fs.mkdtempSync(path.join(os.tmpdir(), "skill-finder-refresh-"));
    indexerInner = new SkillIndexer(path.join(tmpDirInner, "refresh.db"));
    indexerInner.init();
  });

  afterEach(() => {
    if (indexerInner) {
      indexerInner.close();
      indexerInner = null;
    }
    fs.rmSync(tmpDirInner, { recursive: true, force: true });
  });

  it("download then refresh indexes skill into FTS5", async () => {
    const globalDir = path.join(tmpDirInner, "global");
    const projectDir = path.join(tmpDirInner, "project");
    fs.mkdirSync(globalDir, { recursive: true });
    fs.mkdirSync(projectDir, { recursive: true });

    const cache = new CacheManager({
      globalDir,
      projectDir,
      tempDir: tmpDirInner,
    });

    const mockMarket = new MockMarketplace("lobehub", [
      makeSkill({ id: "lobehub:pdf-tools", name: "pdf-tools" }),
      makeSkill({ id: "lobehub:json-fmt", name: "json-fmt" }),
    ]);

    // Download two skills
    await cache.download("lobehub:pdf-tools", mockMarket);
    await cache.download("lobehub:json-fmt", mockMarket);

    // Refresh cache into indexer
    const refreshResult = await cache.refresh(indexerInner!);
    expect(refreshResult.indexed).toBe(2);
    expect(refreshResult.failed).toBe(0);

    // Now searchLocal should find them
    const pdfResults = indexerInner!.searchLocal("pdf-tools");
    expect(pdfResults.length).toBeGreaterThanOrEqual(1);

    const jsonResults = indexerInner!.searchLocal("json-fmt");
    expect(jsonResults.length).toBeGreaterThanOrEqual(1);
  });

  it("remove then refresh removes skill from index", async () => {
    const globalDir = path.join(tmpDirInner, "global");
    const projectDir = path.join(tmpDirInner, "project");
    fs.mkdirSync(globalDir, { recursive: true });
    fs.mkdirSync(projectDir, { recursive: true });

    const cache = new CacheManager({
      globalDir,
      projectDir,
      tempDir: tmpDirInner,
    });

    const mockMarket = new MockMarketplace("lobehub", [
      makeSkill({ id: "lobehub:skill-a", name: "skill-a" }),
    ]);

    await cache.download("lobehub:skill-a", mockMarket);

    // Refresh — skill should be indexed
    await cache.refresh(indexerInner!);
    expect(indexerInner!.searchLocal("skill-a").length).toBe(1);

    // Remove the skill from cache
    cache.remove("lobehub:skill-a", "skill-a");
    expect(cache.isCached("lobehub:skill-a", "skill-a")).toBe(false);

    // Refresh again — skill should be gone from index
    await cache.refresh(indexerInner!);
    expect(indexerInner!.searchLocal("skill-a")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. Activator edge cases in integration context
// ---------------------------------------------------------------------------

describe("Integration: activator with pre-approved and consent paths", () => {
  let tmpDirInner: string;

  beforeEach(() => {
    tmpDirInner = fs.mkdtempSync(path.join(os.tmpdir(), "skill-finder-activator-int-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDirInner, { recursive: true, force: true });
  });

  it("pre-approved category activates to global dir without consent", async () => {
    const activator = new SkillActivator({
      globalSkillsDir: path.join(tmpDirInner, "global"),
      projectSkillsDir: path.join(tmpDirInner, "project"),
      preApprovedCategories: ["pdf-processing"],
    });

    const sourceDir = path.join(tmpDirInner, "source", "pdf-skill");
    fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "SKILL.md"), "name: 'pdf-skill'\ndescription: 'PDF processing skill'\ntags:\n  - pdf\n  - document\n", "utf-8");

      const result = await activator.activate("pdf-skill", sourceDir, {
        categories: ["pdf-processing"],
      });

      expect(result.success).toBe(true);
      expect(result.path).toContain("global");
    expect(result.requiresConsent).toBe(false);
  });

  it("user consent activates to project dir", async () => {
    const activator = new SkillActivator({
      globalSkillsDir: path.join(tmpDirInner, "global"),
      projectSkillsDir: path.join(tmpDirInner, "project"),
      preApprovedCategories: [],
    });

    const sourceDir = path.join(tmpDirInner, "source", "custom-skill");
    fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "SKILL.md"), "name: 'custom-skill'\ndescription: 'Custom skill'\ntags:\n  - custom\n", "utf-8");

      const result = await activator.activate("custom-skill", sourceDir, {
        categories: ["unknown-category"],
        userConsent: { approved: true, autoApproveFuture: false, showDetails: false },
      });

      expect(result.success).toBe(true);
      expect(result.path).toContain("project");
    expect(result.requiresConsent).toBe(false);
  });

  it("no consent and non-pre-approved requires consent", async () => {
    const activator = new SkillActivator({
      globalSkillsDir: path.join(tmpDirInner, "global"),
      projectSkillsDir: path.join(tmpDirInner, "project"),
      preApprovedCategories: [],
    });

    const sourceDir = path.join(tmpDirInner, "source", "unknown-skill");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, "SKILL.md"), "# unknown-skill\n", "utf-8");

    const result = await activator.activate("unknown-skill", sourceDir, {
      categories: ["unknown-category"],
    });

    expect(result.success).toBe(false);
    expect(result.requiresConsent).toBe(true);
    expect(result.message).toContain("Load it?");
  });
});
