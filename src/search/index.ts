import type { SkillSearchResult, MarketplaceConfig } from "../types.js";
import { MarketRegistry } from "../registry/index.js";
import { RelevanceRanker } from "./ranker.js";
import { SemanticSearch, type SemSearchResult } from "./semantic.js";

export interface SearchOptions {
  query: string;
  category?: string;
  limit?: number;
  timeoutMs?: number;
}

export class SearchEngine {
  private registry: MarketRegistry;
  private ranker: RelevanceRanker;
  private config: MarketplaceConfig;
  semanticSearch?: SemanticSearch;

  constructor(registry: MarketRegistry, config: MarketplaceConfig) {
    this.registry = registry;
    this.ranker = new RelevanceRanker();
    this.config = config;
  }

  async search(options: SearchOptions): Promise<SkillSearchResult[]> {
    const { query, category, limit } = options;

    if (!query) return [];

    try {
      const results = await this.registry.searchAll(query, { limit });
      return this.ranker.rank(results, query, limit);
    } catch {
      return [];
    }
  }

  async searchAllMarketplaces(options: SearchOptions): Promise<SkillSearchResult[]> {
    const { query, category, limit, timeoutMs } = options;

    if (!query) return [];

    const timeout = timeoutMs ?? this.config.searchTimeoutMs ?? 15_000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        // Create a promise that rejects when abort is triggered
        const abortPromise = new Promise<never>((_, reject) => {
          controller.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });

        // Race between the search and abort
        const searchPromise = this.registry.searchAll(query, {
          limit,
          signal: controller.signal,
        });

        const results = await Promise.race([searchPromise, abortPromise]);
        return this.ranker.rank(results, query, limit);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      return [];
    }
  }

  searchLocal(query: string): SemSearchResult[] {
    if (!this.semanticSearch) {
      return [];
    }
    return this.semanticSearch.search(query);
  }
}

export { SemanticSearch, type SemSearchResult } from "./semantic.js";