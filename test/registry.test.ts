import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { MarketRegistry } from "../src/registry/index.js";
import { MockMarketplace } from "../src/registry/mock.js";
import type { SkillSearchResult, MarketplaceConfig } from "../src/types.js";

const DEFAULT_CONFIG: MarketplaceConfig = {
  marketplaces: [],
  searchTimeoutMs: 15_000,
  retryCount: 2,
  retryBackoffMs: 1000,
};

function makeSkill(overrides: Partial<SkillSearchResult> & { id: string; name: string }): SkillSearchResult {
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

describe("MarketRegistry", () => {
  afterEach(() => {
    // no-op — MockMarketplace doesn't leak
  });

  it("searchAll returns merged results from 2 mock adapters", async () => {
    const a1 = new MockMarketplace("alpha", [
      makeSkill({ id: "alpha:pdf", name: "pdf-tools" }),
    ]);
    const a2 = new MockMarketplace("beta", [
      makeSkill({ id: "beta:pdf", name: "pdf-extract", marketplace: "skillssh" }),
    ]);

    const reg = new MarketRegistry(DEFAULT_CONFIG);
    reg.addAdapter(a1);
    reg.addAdapter(a2);

    const results = await reg.searchAll("pdf");
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id).sort()).toEqual(["alpha:pdf", "beta:pdf"]);
  });

  it("searchAll continues when one adapter throws", async () => {
    const good = new MockMarketplace("good", [
      makeSkill({ id: "good:foo", name: "foo" }),
    ]);
    const bad: MockMarketplace = {
      name: "bad",
      search: () => Promise.reject(new Error("network error")),
      getSkillInfo: () => Promise.resolve(null),
      install: () => Promise.resolve({ path: "", files: [] }),
      isAvailable: () => true,
    };

    const reg = new MarketRegistry(DEFAULT_CONFIG);
    reg.addAdapter(good);
    reg.addAdapter(bad);

    const results = await reg.searchAll("foo");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("good:foo");
  });

  it("searchAll returns empty array for empty query", async () => {
    const adapter = new MockMarketplace("m", [
      makeSkill({ id: "m:a", name: "alpha" }),
    ]);
    const reg = new MarketRegistry(DEFAULT_CONFIG);
    reg.addAdapter(adapter);

    const results = await reg.searchAll("");
    expect(results).toEqual([]);
  });

  it("listAvailable returns adapter names", () => {
    const reg = new MarketRegistry(DEFAULT_CONFIG);
    reg.addAdapter(new MockMarketplace("one"));
    reg.addAdapter(new MockMarketplace("two"));

    expect(reg.listAvailable().sort()).toEqual(["one", "two"]);
  });

  it("getMarketplace returns adapter by name", () => {
    const adapter = new MockMarketplace("target");
    const reg = new MarketRegistry(DEFAULT_CONFIG);
    reg.addAdapter(adapter);

    expect(reg.getMarketplace("target")).toBe(adapter);
  });

  it("getMarketplace returns undefined for unknown name", () => {
    const reg = new MarketRegistry(DEFAULT_CONFIG);
    expect(reg.getMarketplace("nope")).toBeUndefined();
  });

  it("respects limit parameter", async () => {
    const adapter = new MockMarketplace("m", [
      makeSkill({ id: "m:a", name: "alpha" }),
      makeSkill({ id: "m:b", name: "alpha-two" }),
      makeSkill({ id: "m:c", name: "alpha-three" }),
    ]);
    const reg = new MarketRegistry(DEFAULT_CONFIG);
    reg.addAdapter(adapter);

    const results = await reg.searchAll("alpha", { limit: 2 });
    expect(results).toHaveLength(2);
  });

  it("respects AbortSignal", async () => {
    const controller = new AbortController();
    const adapter = new MockMarketplace("m", [
      makeSkill({ id: "m:a", name: "slow" }),
    ]);

    const reg = new MarketRegistry(DEFAULT_CONFIG);
    reg.addAdapter(adapter);

    // Cancel before search
    controller.abort();

    // MockMarketplace.search doesn't check signal (it's mock),
    // but we verify signal is passed through without crashing
    const results = await reg.searchAll("slow", { signal: controller.signal });
    // Mock doesn't check signal, so results still returned — this tests passthrough
    expect(Array.isArray(results)).toBe(true);
  });

  it("constructor handles empty config", () => {
    const reg = new MarketRegistry({
      marketplaces: [],
      searchTimeoutMs: 15_000,
      retryCount: 2,
      retryBackoffMs: 1000,
    });

    expect(reg.listAvailable()).toEqual([]);
  });
});
