import { RelevanceRanker } from "./ranker.js";
export class SearchEngine {
    registry;
    ranker;
    config;
    semanticSearch;
    constructor(registry, config) {
        this.registry = registry;
        this.ranker = new RelevanceRanker();
        this.config = config;
    }
    async search(options) {
        const { query, category, limit } = options;
        if (!query)
            return [];
        try {
            const results = await this.registry.searchAll(query, { limit });
            return this.ranker.rank(results, query, limit);
        }
        catch {
            return [];
        }
    }
    async searchAllMarketplaces(options) {
        const { query, category, limit, timeoutMs } = options;
        if (!query)
            return [];
        const timeout = timeoutMs ?? this.config.searchTimeoutMs ?? 15_000;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            try {
                // Create a promise that rejects when abort is triggered
                const abortPromise = new Promise((_, reject) => {
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
            }
            finally {
                clearTimeout(timeoutId);
            }
        }
        catch {
            return [];
        }
    }
    searchLocal(query) {
        if (!this.semanticSearch) {
            return [];
        }
        return this.semanticSearch.search(query);
    }
}
export { SemanticSearch } from "./semantic.js";
//# sourceMappingURL=index.js.map