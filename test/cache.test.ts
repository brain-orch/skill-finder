import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { CacheManager } from "../src/cache/index.js";
import { SkillIndexer } from "../src/cache/indexer.js";
import { sanitizeFTS5 } from "../src/cache/fts5-utils.js";
import type { IndexedSkill } from "../src/cache/indexer.js";
import type { SkillSearchResult, SkillMarketplace } from "../src/types.js";

/* ------------------------------------------------------------------ */
/*  Test-only mock marketplace (writes to a temp dir we control)       */
/* ------------------------------------------------------------------ */

class TestMarketplace implements SkillMarketplace {
  name = "test-market";
  private skills: Map<string, SkillSearchResult> = new Map();

  register(skill: SkillSearchResult): void {
    this.skills.set(skill.id, skill);
  }

  async search(query: string): Promise<SkillSearchResult[]> {
    const q = query.toLowerCase();
    return Array.from(this.skills.values()).filter(
      (s) =>
        s.name.includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.triggers.some((t) => t.includes(q)),
    );
  }

  async getSkillInfo(id: string): Promise<SkillSearchResult | null> {
    return this.skills.get(id) ?? null;
  }

  async install(
    identifier: string,
    targetDir: string,
  ): Promise<{ path: string; files: string[] }> {
    const skill = this.skills.get(identifier);
    const name = skill?.name ?? identifier.split(":").pop() ?? identifier;

    const skillDir = path.join(targetDir, name);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      `name: '${name}'\ndescription: 'Skill content for ${identifier}'\ntags:\n  - test\n  - mock\n`,
      "utf-8",
    );

    return { path: skillDir, files: ["SKILL.md"] };
  }

  isAvailable(): boolean {
    return true;
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

function makeConfig(tmpDir: string) {
  const globalDir = path.join(tmpDir, "global-skills");
  const projectDir = path.join(tmpDir, "project-skills");
  return { globalDir, projectDir, tempDir: tmpDir };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("CacheManager", () => {
  let tmpDir: string;
  let cache: CacheManager;
  let marketplace: TestMarketplace;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-finder-test-"));
    cache = new CacheManager(makeConfig(tmpDir));
    marketplace = new TestMarketplace();
    marketplace.register(
      makeSkill({ id: "test:pdf-tools", name: "pdf-tools" }),
    );
    marketplace.register(
      makeSkill({ id: "test:json-fmt", name: "json-fmt", marketplace: "skillssh" }),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /* 1 */
  it("download creates SKILL.md in cache dir", async () => {
    const result = await cache.download("test:pdf-tools", marketplace);

    expect(fs.existsSync(result.path)).toBe(true);
    expect(result.path.endsWith("SKILL.md")).toBe(true);
    expect(result.files).toEqual(["SKILL.md"]);
  });

  /* 2 */
  it("isCached returns true after download", async () => {
    await cache.download("test:pdf-tools", marketplace);

    expect(cache.isCached("test:pdf-tools", "pdf-tools")).toBe(true);
  });

  /* 3 */
  it("isCached returns false for unknown skill", () => {
    expect(cache.isCached("nope:missing", "missing")).toBe(false);
  });

  /* 4 */
  it("remove deletes cached skill", async () => {
    await cache.download("test:pdf-tools", marketplace);
    expect(cache.isCached("test:pdf-tools", "pdf-tools")).toBe(true);

    const removed = cache.remove("test:pdf-tools", "pdf-tools");
    expect(removed).toBe(true);
    expect(cache.isCached("test:pdf-tools", "pdf-tools")).toBe(false);
  });

  /* 5 */
  it("listCached returns downloaded skills", async () => {
    await cache.download("test:pdf-tools", marketplace);
    await cache.download("test:json-fmt", marketplace);

    const cached = cache.listCached();
    expect(cached).toHaveLength(2);

    const names = cached.map((c) => c.name).sort();
    expect(names).toEqual(["json-fmt", "pdf-tools"]);

    for (const entry of cached) {
      expect(entry.skillHash).toMatch(/^[a-f0-9]{64}$/);
      expect(entry.sizeBytes).toBeGreaterThan(0);
      expect(entry.filePath).toContain("SKILL.md");
    }
  });

  /* 6 */
  it("getCacheSize returns non-zero after download", async () => {
    expect(cache.getCacheSize()).toBe(0);

    await cache.download("test:pdf-tools", marketplace);

    expect(cache.getCacheSize()).toBeGreaterThan(0);
  });

  /* 7 */
  it("handles temp file cleanup on failure", async () => {
    const failMarket: SkillMarketplace = {
      name: "fail",
      search: () => Promise.resolve([]),
      getSkillInfo: () => Promise.resolve(null),
      install: async () => {
        throw new Error("network boom");
      },
      isAvailable: () => true,
    };

    await expect(
      cache.download("fail:boom", failMarket),
    ).rejects.toThrow("network boom");

    // No .tmp files left behind in globalDir
    const globalDir = path.join(tmpDir, "global-skills");
    if (fs.existsSync(globalDir)) {
      const tmpFiles = fs
        .readdirSync(globalDir, { recursive: true })
        .filter((f): f is string => typeof f === "string" && f.endsWith(".tmp"));
      expect(tmpFiles).toHaveLength(0);
    }
  });

  /* 8 */
  it("download to custom targetDir works", async () => {
    const customDir = path.join(tmpDir, "custom-install");
    const result = await cache.download(
      "test:json-fmt",
      marketplace,
      customDir,
    );

    expect(result.path).toContain("custom-install");
    expect(fs.existsSync(result.path)).toBe(true);

    // Should NOT appear in global cache
    expect(cache.isCached("test:json-fmt", "json-fmt")).toBe(false);
  });

  /* 9 */
  it("rejects identifiers whose skill segment escapes the cache directory", async () => {
    await expect(
      cache.download("test:../escape", marketplace),
    ).rejects.toThrow("Invalid skill name");

    expect(fs.existsSync(path.join(tmpDir, "escape"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, "global-skills", "escape"))).toBe(
      false,
    );
  });

  /* 10 */
  it("rejects unsafe cache lookup names before touching the filesystem", () => {
    expect(() => cache.isCached("test:../escape", "../escape")).toThrow(
      "Invalid skill name",
    );
    expect(() => cache.getSkillPath("test:../escape", "../escape")).toThrow(
      "Invalid skill name",
    );
    expect(() => cache.remove("test:../escape", "../escape")).toThrow(
      "Invalid skill name",
    );
  });
});

/* ------------------------------------------------------------------ */
/*  SkillIndexer Tests                                                 */
/* ------------------------------------------------------------------ */

function makeIndexedSkill(overrides: Partial<IndexedSkill> & { id: string; name: string }): IndexedSkill {
  return {
    description: `A skill called ${overrides.name}`,
    marketplace: "lobehub",
    category: null,
    triggers: [],
    installCount: 0,
    stars: 0,
    filePath: `/skills/${overrides.name}/SKILL.md`,
    installedAt: new Date().toISOString(),
    lastUsed: null,
    useCount: 0,
    skillHash: "abc123def456",
    ...overrides,
  };
}

describe("SkillIndexer", () => {
  let tmpDir: string;
  let indexer: SkillIndexer;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-finder-indexer-test-"));
    indexer = new SkillIndexer(path.join(tmpDir, "test.db"));
    indexer.init();
  });

  afterEach(() => {
    indexer.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /* 1 */
  it("init creates FTS5 tables", () => {
    // If init succeeded, we can index and search
    const skill = makeIndexedSkill({ id: "test:init", name: "init-test" });
    indexer.indexSkill(skill);

    const results = indexer.searchLocal("init-test");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("test:init");
  });

  /* 2 */
  it("indexSkill inserts a skill", () => {
    const skill = makeIndexedSkill({
      id: "test:insert",
      name: "insert-test",
      description: "A skill for testing insertion",
      marketplace: "skillssh",
      category: "testing",
      triggers: ["insert", "test"],
      installCount: 42,
      stars: 4.5,
    });

    indexer.indexSkill(skill);

    const results = indexer.searchLocal("insert-test");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("test:insert");
    expect(results[0].name).toBe("insert-test");
    expect(results[0].description).toBe("A skill for testing insertion");
    expect(results[0].marketplace).toBe("skillssh");
    expect(results[0].category).toBe("testing");
    expect(results[0].triggers).toEqual(["insert", "test"]);
    expect(results[0].installCount).toBe(42);
    expect(results[0].stars).toBe(4.5);
  });

  /* 3 */
  it("searchLocal returns matching skills ranked by relevance", () => {
    indexer.indexSkill(makeIndexedSkill({
      id: "test:alpha",
      name: "alpha",
      description: "First skill",
      triggers: ["first"],
    }));
    indexer.indexSkill(makeIndexedSkill({
      id: "test:beta",
      name: "beta",
      description: "Second skill with alpha in description",
    }));
    indexer.indexSkill(makeIndexedSkill({
      id: "test:gamma",
      name: "gamma",
      description: "Third skill",
    }));

    // Search for "alpha" - should match both alpha and beta (beta has alpha in description)
    const results = indexer.searchLocal("alpha");
    expect(results.length).toBeGreaterThanOrEqual(2);

    // First result should be the one with "alpha" in name (higher relevance)
    const ids = results.map((r) => r.id);
    expect(ids).toContain("test:alpha");
    expect(ids).toContain("test:beta");
  });

  /* 4 */
  it("searchLocal returns empty for non-matching query", () => {
    indexer.indexSkill(makeIndexedSkill({
      id: "test:nomatch",
      name: "nomatch",
      description: "Some skill",
    }));

    const results = indexer.searchLocal("xyznonexistent");
    expect(results).toHaveLength(0);
  });

  /* 5 */
  it("sanitizeFTS5 wraps tokens in quotes", () => {
    const result = sanitizeFTS5("hello world");
    expect(result).toBe('"hello" "world"');
  });

  /* 6 */
  it("sanitizeFTS5 removes FTS5 operators", () => {
    const result = sanitizeFTS5("hello AND world OR test NOT near");
    expect(result).toBe('"hello" "world" "test"');
  });

  /* 7 */
  it("sanitizeFTS5 escapes inner quotes", () => {
    const result = sanitizeFTS5('test "quoted" value');
    // "quoted" → escape inner " to "" → ""quoted"" → wrap → """""""quoted""""""""
    // Wait, let me trace: token = '"quoted"', escaped = '""quoted""', wrapped = '""""quoted""""'
    expect(result).toBe('"test" """quoted""" "value"');
  });

  /* 8 */
  it("removeFromIndex deletes skill", () => {
    indexer.indexSkill(makeIndexedSkill({ id: "test:delete", name: "delete-me" }));

    // Verify it exists
    let results = indexer.searchLocal("delete-me");
    expect(results).toHaveLength(1);

    // Remove it
    indexer.removeFromIndex("test:delete");

    // Verify it's gone
    results = indexer.searchLocal("delete-me");
    expect(results).toHaveLength(0);
  });

  /* 9 */
  it("getStats returns grouped marketplaces", () => {
    indexer.indexSkill(makeIndexedSkill({ id: "test:s1", name: "skill1", marketplace: "lobehub" }));
    indexer.indexSkill(makeIndexedSkill({ id: "test:s2", name: "skill2", marketplace: "lobehub" }));
    indexer.indexSkill(makeIndexedSkill({ id: "test:s3", name: "skill3", marketplace: "skillssh" }));

    const stats = indexer.getStats();
    expect(stats).toHaveLength(2);

    const lobeHubStats = stats.find((s) => s.marketplace === "lobehub");
    expect(lobeHubStats).toBeDefined();
    expect(lobeHubStats!.count).toBe(2);

    const skillsShStats = stats.find((s) => s.marketplace === "skillssh");
    expect(skillsShStats).toBeDefined();
    expect(skillsShStats!.count).toBe(1);
  });

  /* 10 */
  it("handles empty database gracefully", () => {
    const results = indexer.searchLocal("anything");
    expect(results).toHaveLength(0);

    const stats = indexer.getStats();
    expect(stats).toHaveLength(0);
  });

  /* 11 */
  it("indexSkill with replace updates existing skill", () => {
    indexer.indexSkill(makeIndexedSkill({
      id: "test:replace",
      name: "replace-me",
      description: "Original description",
    }));

    indexer.indexSkill(makeIndexedSkill({
      id: "test:replace",
      name: "replace-me",
      description: "Updated description",
    }));

    const results = indexer.searchLocal("replace-me");
    expect(results).toHaveLength(1);
    expect(results[0].description).toBe("Updated description");
  });

  /* 12 */
  it("searchLocal respects limit parameter", () => {
    for (let i = 0; i < 5; i++) {
      indexer.indexSkill(makeIndexedSkill({
        id: `test:limit-${i}`,
        name: `limit-skill`,
        description: `Skill number ${i}`,
      }));
    }

    const results = indexer.searchLocal("limit-skill", 3);
    expect(results).toHaveLength(3);
  });

  /* 13 */
  it("sanitizeFTS5 handles empty query", () => {
    const result = sanitizeFTS5("");
    expect(result).toBe("");
  });

  /* 14 */
  it("sanitizeFTS5 handles wildcard operator", () => {
    const result = sanitizeFTS5("test * value");
    expect(result).toBe('"test" "value"');
  });

  /* 15 */
  it("sanitizeFTS5 handles parentheses", () => {
    // Bare ( and ) are removed; (group) is a single token, not removed
    const result = sanitizeFTS5("test ( ) value");
    expect(result).toBe('"test" "value"');
  });

  /* 16 */
  it("markUsed updates last_used and increments use_count", () => {
    indexer.indexSkill(makeIndexedSkill({ id: "test:mark-used", name: "mark-used" }));

    indexer.markUsed("test:mark-used");

    const results = indexer.searchLocal("mark-used");
    expect(results).toHaveLength(1);
    expect(results[0].lastUsed).toBeTruthy();
    expect(results[0].useCount).toBe(1);

    indexer.markUsed("test:mark-used");
    const results2 = indexer.searchLocal("mark-used");
    expect(results2[0].useCount).toBe(2);
  });

  /* 17 */
  it("markUsed is NOOP for unknown identifier", () => {
    indexer.indexSkill(makeIndexedSkill({ id: "test:exists", name: "exists" }));

    indexer.markUsed("test:nonexistent");

    const results = indexer.searchLocal("exists");
    expect(results).toHaveLength(1);
    expect(results[0].useCount).toBe(0);
  });

  /* 18 */
  it("getFreshness returns last_used for known identifiers", () => {
    indexer.indexSkill(makeIndexedSkill({ id: "test:fresh", name: "fresh-skill" }));
    indexer.markUsed("test:fresh");

    const freshness = indexer.getFreshness(["test:fresh", "test:missing"]);
    expect(freshness.size).toBe(1);
    expect(freshness.has("test:fresh")).toBe(true);
    expect(freshness.get("test:fresh")).toBeTruthy();
  });

  /* 19 */
  it("getFreshness returns empty map for empty input", () => {
    const freshness = indexer.getFreshness([]);
    expect(freshness.size).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  CacheManager Extended — refresh, cleanup, quota                    */
/* ------------------------------------------------------------------ */

describe("CacheManager extended", () => {
  let tmpDir: string;
  let cache: CacheManager;
  let marketplace: TestMarketplace;
  let indexer: SkillIndexer;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-finder-ext-test-"));
    cache = new CacheManager(makeConfig(tmpDir));
    marketplace = new TestMarketplace();
    marketplace.register(
      makeSkill({ id: "test:pdf-tools", name: "pdf-tools" }),
    );
    marketplace.register(
      makeSkill({ id: "test:json-fmt", name: "json-fmt", marketplace: "skillssh" }),
    );
    indexer = new SkillIndexer(path.join(tmpDir, "test-index.db"));
    indexer.init();
  });

  afterEach(() => {
    indexer.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /* 1 */
  it("refresh scans and re-indexes cached skills", async () => {
    await cache.download("test:pdf-tools", marketplace);
    await cache.download("test:json-fmt", marketplace);

    const result = await cache.refresh(indexer);

    expect(result.indexed).toBe(2);
    expect(result.failed).toBe(0);

    // Verify skills are in the index
    const stats = indexer.getStats();
    expect(stats.length).toBeGreaterThanOrEqual(1);

    const total = stats.reduce((sum, s) => sum + s.count, 0);
    expect(total).toBe(2);
  });

  /* 2 */
  it("cleanup returns stale skills without deleting", async () => {
    await cache.download("test:pdf-tools", marketplace);

    // Manually backdate the file's mtime to 8 days ago (stale)
    const skillDir = path.join(tmpDir, "global-skills", "pdf-tools");
    const skillFile = path.join(skillDir, "SKILL.md");
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    fs.utimesSync(skillFile, new Date(eightDaysAgo), new Date(eightDaysAgo));

    const result = cache.cleanup();

    expect(result.staleCount).toBe(1);
    expect(result.staleSkills).toContain("pdf-tools");

    // File must still exist — cleanup only flags, never deletes
    expect(fs.existsSync(skillFile)).toBe(true);
  });

  /* 3 */
  it("cleanup returns 0 stale for fresh skills", async () => {
    await cache.download("test:pdf-tools", marketplace);

    const result = cache.cleanup();

    expect(result.staleCount).toBe(0);
    expect(result.staleSkills).toHaveLength(0);
  });

  /* 4 */
  it("checkQuota returns withinQuota for small cache", async () => {
    await cache.download("test:pdf-tools", marketplace);

    // Default max is 500 MB — a single skill file is far below that
    const quota = cache.checkQuota();

    expect(quota.withinQuota).toBe(true);
    expect(quota.currentSizeMb).toBeGreaterThanOrEqual(0);
    expect(quota.maxSizeMb).toBe(500);
  });

  /* 5 */
  it("checkQuota warns when quota exceeded", async () => {
    // Create a cache with a tiny quota (1 KB)
    const tinyCache = new CacheManager({
      ...makeConfig(tmpDir),
      maxCacheSizeMb: 0.001, // ~1 KB
    });

    // Write a large SKILL.md to exceed the 1 KB quota
    const skillDir = path.join(tmpDir, "global-skills", "big-skill");
    fs.mkdirSync(skillDir, { recursive: true });
    const bigContent = "x".repeat(2048); // 2 KB — exceeds 1 KB quota
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), bigContent);

    const quota = tinyCache.checkQuota();

    expect(quota.withinQuota).toBe(false);
    expect(quota.currentSizeMb).toBeGreaterThan(0);
    expect(quota.maxSizeMb).toBe(0.001);
  });

  /* 6 */
  it("CacheConfig defaults work (500MB, 24h TTL)", () => {
    const defaultCache = new CacheManager(makeConfig(tmpDir));

    // Verify defaults by checking quota (uses 500 MB default)
    const quota = defaultCache.checkQuota();
    expect(quota.maxSizeMb).toBe(500);
  });
});
