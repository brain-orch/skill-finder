const DEFAULT_LIMIT = 20;
export class MarketRegistry {
    adapters = new Map();
    config;
    constructor(config) {
        this.config = {
            searchTimeoutMs: config.searchTimeoutMs ?? 15_000,
            retryCount: config.retryCount ?? 2,
            retryBackoffMs: config.retryBackoffMs ?? 1000,
            marketplaces: config.marketplaces ?? [],
        };
    }
    addAdapter(adapter) {
        this.adapters.set(adapter.name, adapter);
    }
    async searchAll(query, options) {
        if (!query)
            return [];
        const limit = options?.limit ?? DEFAULT_LIMIT;
        const signal = options?.signal;
        const category = options?.category;
        const entries = Array.from(this.adapters.values());
        const results = await Promise.allSettled(entries.map((adapter) => adapter.search(query, { limit, signal, category })));
        const merged = [];
        for (const result of results) {
            if (result.status === "fulfilled") {
                merged.push(...result.value);
            }
        }
        return merged;
    }
    getMarketplace(name) {
        return this.adapters.get(name);
    }
    listAvailable() {
        return Array.from(this.adapters.keys());
    }
}
//# sourceMappingURL=index.js.map