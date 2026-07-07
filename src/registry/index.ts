import type { SkillSearchResult, SkillMarketplace, MarketplaceConfig } from "../types.js";

const DEFAULT_LIMIT = 20;

export class MarketRegistry {
  private readonly adapters: Map<string, SkillMarketplace> = new Map();
  private readonly config: MarketplaceConfig;

  constructor(config: MarketplaceConfig) {
    this.config = {
      searchTimeoutMs: config.searchTimeoutMs ?? 15_000,
      retryCount: config.retryCount ?? 2,
      retryBackoffMs: config.retryBackoffMs ?? 1000,
      marketplaces: config.marketplaces ?? [],
    };
  }

  addAdapter(adapter: SkillMarketplace): void {
    this.adapters.set(adapter.name, adapter);
  }

  async searchAll(
    query: string,
    options?: { limit?: number; signal?: AbortSignal },
  ): Promise<SkillSearchResult[]> {
    if (!query) return [];

    const limit = options?.limit ?? DEFAULT_LIMIT;
    const signal = options?.signal;

    const entries = Array.from(this.adapters.values());

    const results = await Promise.allSettled(
      entries.map((adapter) => adapter.search(query, { limit, signal })),
    );

    const merged: SkillSearchResult[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        merged.push(...result.value);
      }
    }

    return merged;
  }

  getMarketplace(name: string): SkillMarketplace | undefined {
    return this.adapters.get(name);
  }

  listAvailable(): string[] {
    return Array.from(this.adapters.keys());
  }
}
