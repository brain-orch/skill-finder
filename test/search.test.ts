import { describe, it, expect, vi } from "vitest";
import { SearchEngine, type SearchOptions } from "../src/search/index.js";
import { MarketRegistry } from "../src/registry/index.js";
import { MockMarketplace } from "../src/registry/mock.js";
import type { MarketplaceConfig, SkillSearchResult } from "../src/types.js";

const createMockConfig = (overrides?: Partial<MarketplaceConfig>): MarketplaceConfig => ({
  marketplaces: ["mock"],
  searchTimeoutMs: 15_000,
  retryCount: 2,
  retryBackoffMs: 1000,
  ...overrides,
});

const createMockResults = (): SkillSearchResult[] => [
  {
    id: "mock:pdf-tools",
    name: "pdf-tools",
    description: "PDF processing toolkit",
    marketplace: "lobehub",
    category: "pdf-processing",
    triggers: ["pdf", "document"],
    installCount: 500,
    stars: 4.5,
    installCommand: "skill install mock:pdf-tools",
    homepageUrl: "https://example.com/pdf-tools",
    verified: true,
  },
  {
    id: "mock:document-parser",
    name: "document-parser",
    description: "Parse various document formats",
    marketplace: "lobehub",
    category: "document-processing",
    triggers: ["parser", "document"],
    installCount: 300,
    stars: 4.0,
    installCommand: "skill install mock:document-parser",
    homepageUrl: "https://example.com/document-parser",
    verified: false,
  },
];

describe("SearchEngine", () => {
  it("search returns results from registry", async () => {
    const config = createMockConfig();
    const registry = new MarketRegistry(config);
    const mockAdapter = new MockMarketplace("mock", createMockResults());
    registry.addAdapter(mockAdapter);

    const engine = new SearchEngine(registry, config);
    const results = await engine.search({ query: "pdf" });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain("pdf");
  });

  it("search handles empty query returns empty", async () => {
    const config = createMockConfig();
    const registry = new MarketRegistry(config);
    const engine = new SearchEngine(registry, config);

    const results = await engine.search({ query: "" });

    expect(results).toEqual([]);
  });

  it("search handles registry throwing gracefully", async () => {
    const config = createMockConfig();
    const registry = new MarketRegistry(config);

    // Add a failing adapter
    const failingAdapter = {
      name: "failing",
      search: vi.fn().mockRejectedValue(new Error("Network error")),
      getSkillInfo: vi.fn(),
      install: vi.fn(),
      isAvailable: vi.fn(),
    };
    registry.addAdapter(failingAdapter);

    const engine = new SearchEngine(registry, config);
    const results = await engine.search({ query: "test" });

    expect(results).toEqual([]);
  });

  it("searchAllMarketplaces returns merged results", async () => {
    const config = createMockConfig();
    const registry = new MarketRegistry(config);

    // Add multiple adapters with different results
    const adapter1 = new MockMarketplace("marketplace1", [
      createMockResults()[0],
    ]);
    const adapter2 = new MockMarketplace("marketplace2", [
      createMockResults()[1],
    ]);

    registry.addAdapter(adapter1);
    registry.addAdapter(adapter2);

    const engine = new SearchEngine(registry, config);
    const results = await engine.searchAllMarketplaces({ query: "document" });

    expect(results.length).toBeGreaterThan(0);
    // Results should come from both marketplaces
    const names = results.map((r) => r.name);
    expect(names).toContain("document-parser");
  });

  it("searchAllMarketplaces respects timeout", async () => {
    const config = createMockConfig({ searchTimeoutMs: 100 }); // Very short timeout
    const registry = new MarketRegistry(config);

    // Add a slow adapter
    const slowAdapter = {
      name: "slow",
      search: vi.fn().mockImplementation(
        () =>
          new Promise<SkillSearchResult[]>((resolve) => {
            setTimeout(() => {
              resolve([
                {
                  id: "slow:skill",
                  name: "slow-skill",
                  description: "A slow skill",
                  marketplace: "lobehub",
                  category: null,
                  triggers: [],
                  installCount: 0,
                  stars: 0,
                  installCommand: "skill install slow:skill",
                  homepageUrl: "https://example.com/slow",
                  verified: false,
                },
              ]);
            }, 500); // Takes 500ms, but timeout is 100ms
          }),
      ),
      getSkillInfo: vi.fn(),
      install: vi.fn(),
      isAvailable: vi.fn(),
    };

    registry.addAdapter(slowAdapter);

    const engine = new SearchEngine(registry, config);
    const results = await engine.searchAllMarketplaces({
      query: "test",
      timeoutMs: 100,
    });

    // Should timeout and return empty array
    expect(results).toEqual([]);
  });
});