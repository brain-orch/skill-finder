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
        const results = await Promise.allSettled(entries.map((adapter) => this.searchWithRetry(adapter, query, { limit, signal, category })));
        const merged = [];
        for (const result of results) {
            if (result.status === "fulfilled") {
                merged.push(...result.value);
            }
            else {
                const reason = result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason);
                console.warn("[skill-finder] marketplace search rejected:", reason);
            }
        }
        return merged;
    }
    async searchWithRetry(adapter, query, options) {
        const maxRetries = this.config.retryCount;
        const baseMs = this.config.retryBackoffMs;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await adapter.search(query, options);
            }
            catch (err) {
                if (attempt === maxRetries) {
                    // All retries exhausted — log and return empty
                    console.warn(`[skill-finder] ${adapter.name} search failed after ${maxRetries + 1} attempts:`, err instanceof Error ? err.message : String(err));
                    return [];
                }
                // Exponential backoff with ±20% jitter
                const delay = baseMs * Math.pow(2, attempt);
                const jitter = delay * 0.2 * (Math.random() * 2 - 1); // ±20%
                const waitMs = Math.max(0, delay + jitter);
                await new Promise((resolve) => setTimeout(resolve, waitMs));
            }
        }
        // Unreachable — TypeScript needs this
        return [];
    }
    getMarketplace(name) {
        return this.adapters.get(name);
    }
    listAvailable() {
        return Array.from(this.adapters.keys());
    }
}
//# sourceMappingURL=index.js.map