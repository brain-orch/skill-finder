import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { SkillRecommender } from "../src/plugin/recommender.js";
import type { DetectedContext } from "../src/plugin/detector.js";
import type { SkillSearchResult } from "../src/types.js";
import { SearchEngine } from "../src/search/index.js";
import { SkillIndexer } from "../src/cache/indexer.js";
import { MarketRegistry } from "../src/registry/index.js";
import { MockMarketplace } from "../src/registry/mock.js";

// ---------------------------------------------------------------------------
// Sample skills
// ---------------------------------------------------------------------------

function makeSkill(overrides: Partial<SkillSearchResult> & { id: string; name: string }): SkillSearchResult {
  return {
    description: `A tool for ${overrides.name}`,
    marketplace: "lobehub",
    category: null,
    triggers: [],
    installCount: 0,
    stars: 0,
    installCommand: `install ${overrides.id}`,
    homepageUrl: `https://example.com/${overrides.id}`,
    verified: false,
    ...overrides,
  };
}

const PDF_SKILL = makeSkill({
  id: "lobehub:pdf-tools",
  name: "pdf-tools",
  description: "Extract text and images from PDF documents using OCR",
  marketplace: "lobehub",
  category: "pdf-processing",
  triggers: ["pdf", "extract text", "ocr"],
  installCount: 500,
  stars: 4.5,
  verified: true,
});

const PDF_READER = makeSkill({
  id: "lobehub:pdf-reader",
  name: "pdf-reader",
  description: "Read and parse PDF files for text extraction",
  marketplace: "lobehub",
  category: "pdf-processing",
  triggers: ["pdf", "document"],
  installCount: 300,
  stars: 4.0,
  verified: true,
});

const GIT_SKILL = makeSkill({
  id: "skillssh:git-master",
  name: "git-master",
  description: "Advanced git workflows and history management",
  marketplace: "skillssh",
  category: "git-workflows",
  triggers: ["git", "commit", "rebase"],
  installCount: 800,
  stars: 4.8,
  verified: true,
});

const DOCKER_SKILL = makeSkill({
  id: "awesomeskill:docker-helper",
  name: "docker-helper",
  description: "Docker container management and optimization",
  marketplace: "awesomeskill",
  category: "docker",
  triggers: ["docker", "container"],
  installCount: 200,
  stars: 3.5,
  verified: false,
});

const UNRELATED_SKILL = makeSkill({
  id: "lobehub:frontend-builder",
  name: "frontend-builder",
  description: "Build modern React frontends with Tailwind CSS",
  marketplace: "lobehub",
  category: "frontend",
  triggers: ["react", "frontend", "ui"],
  installCount: 1000,
  stars: 4.9,
  verified: true,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function createFixture() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "recommender-test-"));
  const dbPath = path.join(tmpDir, "test.db");

  // Local indexer with pre-indexed skills
  const indexer = new SkillIndexer(dbPath);
  indexer.init();
  indexer.indexSkill({
    id: "local:pdf-tools",
    name: "pdf-tools",
    description: "Extract text and images from PDF documents",
    marketplace: "lobehub",
    category: "pdf-processing",
    triggers: ["pdf", "ocr"],
    installCount: 500,
    stars: 4.5,
    filePath: "/tmp/pdf-tools/SKILL.md",
    installedAt: "2025-01-01T00:00:00Z",
    lastUsed: null,
    useCount: 0,
    skillHash: "abc123",
  });
  indexer.indexSkill({
    id: "local:git-master",
    name: "git-master",
    description: "Advanced git workflows and history management",
    marketplace: "skillssh",
    category: "git-workflows",
    triggers: ["git", "commit"],
    installCount: 800,
    stars: 4.8,
    filePath: "/tmp/git-master/SKILL.md",
    installedAt: "2025-01-01T00:00:00Z",
    lastUsed: null,
    useCount: 0,
    skillHash: "def456",
  });

  // Network marketplace
  const mockMarket = new MockMarketplace("lobehub", [
    PDF_SKILL,
    PDF_READER,
    GIT_SKILL,
    DOCKER_SKILL,
    UNRELATED_SKILL,
  ]);

  const registry = new MarketRegistry({
    marketplaces: ["lobehub"],
    searchTimeoutMs: 5000,
    retryCount: 0,
    retryBackoffMs: 0,
  });
  registry.addAdapter(mockMarket);

  const searchEngine = new SearchEngine(registry, {
    marketplaces: ["lobehub"],
    searchTimeoutMs: 5000,
    retryCount: 0,
    retryBackoffMs: 0,
  });

  return { indexer, registry, searchEngine, tmpDir };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SkillRecommender", () => {
  let tmpDir: string;
  let indexer: SkillIndexer | null = null;

  afterEach(() => {
    // Close indexer first to release SQLite file locks (critical on Windows)
    if (indexer) {
      indexer.close();
      indexer = null;
    }
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Windows may still hold file handles — best effort cleanup
      }
    }
  });

  it("returns empty for empty categories", async () => {
    const fixture = createFixture();
    tmpDir = fixture.tmpDir;
    indexer = fixture.indexer;

    const recommender = new SkillRecommender(
      fixture.searchEngine,
      fixture.registry,
      fixture.indexer,
    );

    const result = await recommender.recommend(makeContext([]));
    expect(result).toEqual([]);
  });

  it("returns top 3 recommendations by default", async () => {
    const fixture = createFixture();
    tmpDir = fixture.tmpDir;
    indexer = fixture.indexer;

    const recommender = new SkillRecommender(
      fixture.searchEngine,
      fixture.registry,
      fixture.indexer,
    );

    const result = await recommender.recommend(makeContext(["pdf-processing"]));
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("filters already installed skills", async () => {
    const fixture = createFixture();
    tmpDir = fixture.tmpDir;
    indexer = fixture.indexer;

    const recommender = new SkillRecommender(
      fixture.searchEngine,
      fixture.registry,
      fixture.indexer,
      { installedSkillNames: ["pdf-tools"] },
    );

    const result = await recommender.recommend(makeContext(["pdf-processing"]));
    const names = result.map((r) => r.name);
    expect(names).not.toContain("pdf-tools");
  });

  it("generates match reasons", async () => {
    const fixture = createFixture();
    tmpDir = fixture.tmpDir;
    indexer = fixture.indexer;

    const recommender = new SkillRecommender(
      fixture.searchEngine,
      fixture.registry,
      fixture.indexer,
    );

    const result = await recommender.recommend(makeContext(["pdf-processing"]));
    expect(result.length).toBeGreaterThan(0);

    const top = result[0];
    expect(top.matchReasons.length).toBeGreaterThan(0);
    // Should have at least one reason about category match
    const hasCategoryReason = top.matchReasons.some(
      (r) => r.includes("category") || r.includes("trigger") || r.includes("installs") || r.includes("rating"),
    );
    expect(hasCategoryReason).toBe(true);
  });

  it("respects maxResults config", async () => {
    const fixture = createFixture();
    tmpDir = fixture.tmpDir;
    indexer = fixture.indexer;

    const recommender = new SkillRecommender(
      fixture.searchEngine,
      fixture.registry,
      fixture.indexer,
      { maxResults: 2 },
    );

    const result = await recommender.recommend(makeContext(["pdf-processing"]));
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("scores results in descending order", async () => {
    const fixture = createFixture();
    tmpDir = fixture.tmpDir;
    indexer = fixture.indexer;

    const recommender = new SkillRecommender(
      fixture.searchEngine,
      fixture.registry,
      fixture.indexer,
    );

    const result = await recommender.recommend(makeContext(["pdf-processing", "git-workflows"]));
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it("handles null indexer gracefully (network only)", async () => {
    const fixture = createFixture();
    tmpDir = fixture.tmpDir;
    // Don't track fixture.indexer — we pass null to recommender
    // but still need to close it in cleanup
    indexer = fixture.indexer;

    const recommender = new SkillRecommender(
      fixture.searchEngine,
      fixture.registry,
      null, // no indexer
    );

    const result = await recommender.recommend(makeContext(["pdf-processing"]));
    // Should still get network results
    expect(result.length).toBeGreaterThan(0);
    // All should be from network (not cache)
    for (const r of result) {
      expect(r.fromCache).toBe(false);
    }
  });

  it("deduplicates by identifier", async () => {
    const fixture = createFixture();
    tmpDir = fixture.tmpDir;
    indexer = fixture.indexer;

    // Add a second marketplace that returns the same skill
    const dupMarket = new MockMarketplace("skillssh", [PDF_SKILL]);
    fixture.registry.addAdapter(dupMarket);

    const recommender = new SkillRecommender(
      fixture.searchEngine,
      fixture.registry,
      fixture.indexer,
    );

    const result = await recommender.recommend(makeContext(["pdf-processing"]));
    const identifiers = result.map((r) => r.identifier);
    const uniqueIdentifiers = new Set(identifiers);
    expect(identifiers.length).toBe(uniqueIdentifiers.size);
  });

  it("filters below minScore", async () => {
    const fixture = createFixture();
    tmpDir = fixture.tmpDir;
    indexer = fixture.indexer;

    // Set a very high minScore so most results get filtered
    const recommender = new SkillRecommender(
      fixture.searchEngine,
      fixture.registry,
      fixture.indexer,
      { minScore: 0.95 },
    );

    const result = await recommender.recommend(makeContext(["pdf-processing"]));
    for (const r of result) {
      expect(r.score).toBeGreaterThanOrEqual(0.95);
    }
  });

  it("merges local and network results", async () => {
    const fixture = createFixture();
    tmpDir = fixture.tmpDir;
    indexer = fixture.indexer;

    const recommender = new SkillRecommender(
      fixture.searchEngine,
      fixture.registry,
      fixture.indexer,
    );

    const result = await recommender.recommend(makeContext(["pdf-processing"]));

    // Should have both local and network results merged
    // (pdf-tools exists in both local index and network, deduped to one)
    expect(result.length).toBeGreaterThan(0);

    // The merged result for pdf-tools should come from local (higher weight)
    const pdfResult = result.find((r) => r.name === "pdf-tools");
    if (pdfResult) {
      expect(pdfResult.fromCache).toBe(true);
    }
  });
});
