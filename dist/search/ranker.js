import { QualityScorer } from "../scoring/quality.js";
const qualityScorer = new QualityScorer();
export class RelevanceRanker {
    rank(results, query, limit, freshnessData) {
        if (results.length === 0)
            return [];
        const tokens = query
            .toLowerCase()
            .split(/\s+/)
            .filter((t) => t.length > 0);
        const scored = results.map((result) => {
            const baseScore = this.calculateScore(result, tokens, results);
            const freshnessBoost = this.freshnessBoost(result.id, freshnessData);
            return {
                result,
                score: baseScore + freshnessBoost,
            };
        });
        const deduplicated = this.deduplicate(scored);
        deduplicated.sort((a, b) => {
            if (b.score !== a.score)
                return b.score - a.score;
            return b.result.installCount - a.result.installCount;
        });
        const limited = limit !== undefined ? deduplicated.slice(0, limit) : deduplicated;
        return limited.map((item) => item.result);
    }
    freshnessBoost(id, freshnessData) {
        if (!freshnessData)
            return 0;
        const lastUsed = freshnessData.get(id);
        if (!lastUsed)
            return 0;
        const lastUsedMs = new Date(lastUsed).getTime();
        const nowMs = Date.now();
        const ageDays = (nowMs - lastUsedMs) / (1000 * 60 * 60 * 24);
        if (ageDays <= 7)
            return 0.1;
        if (ageDays <= 30)
            return 0.05;
        return 0;
    }
    calculateScore(result, tokens, allResults) {
        const keywordScore = this.keywordMatchScore(result, tokens);
        const popularityScore = this.popularityScore(result, allResults);
        const verifiedScore = this.verifiedScore(result);
        const qualityScore = qualityScorer.score(result);
        return (keywordScore * 0.6 +
            popularityScore * 0.1 +
            qualityScore * 0.2 +
            verifiedScore * 0.1);
    }
    keywordMatchScore(result, tokens) {
        if (tokens.length === 0)
            return 0;
        let score = 0;
        const name = result.name.toLowerCase();
        const description = result.description.toLowerCase();
        const category = result.category?.toLowerCase() ?? "";
        const triggers = result.triggers.map((t) => t.toLowerCase());
        for (const token of tokens) {
            // Exact name match
            if (name === token) {
                score += 10;
            }
            else if (name.includes(token)) {
                score += 5;
            }
            // Description includes token
            if (description.includes(token)) {
                score += 2;
            }
            // Category matches
            if (category.includes(token)) {
                score += 3;
            }
            // Any trigger matches
            if (triggers.some((t) => t.includes(token))) {
                score += 4;
            }
        }
        return score;
    }
    popularityScore(result, allResults) {
        if (allResults.length === 0)
            return 0;
        const installCounts = allResults.map((r) => r.installCount);
        const min = Math.min(...installCounts);
        const max = Math.max(...installCounts);
        // Avoid division by zero
        if (max === min)
            return 0.5;
        return (result.installCount - min) / (max - min);
    }
    starsScore(result) {
        return result.stars / 5;
    }
    verifiedScore(result) {
        return result.verified ? 1 : 0;
    }
    deduplicate(scored) {
        const map = new Map();
        for (const item of scored) {
            const normalizedName = this.normalizeName(item.result.name);
            const marketplace = item.result.marketplace;
            const key = `${normalizedName}::${marketplace}`;
            const existing = map.get(key);
            if (!existing || item.score > existing.score) {
                map.set(key, item);
            }
        }
        // Cross-marketplace dedup: when same normalized name exists in multiple marketplaces,
        // keep the one with higher quality score
        const nameMap = new Map();
        for (const item of map.values()) {
            const normalizedName = this.normalizeName(item.result.name);
            const existing = nameMap.get(normalizedName);
            if (!existing) {
                nameMap.set(normalizedName, item);
            }
            else {
                // Same name, different marketplace — use quality score as tiebreak
                const qualityA = qualityScorer.score(existing.result);
                const qualityB = qualityScorer.score(item.result);
                if (qualityB > qualityA) {
                    nameMap.set(normalizedName, item);
                }
            }
        }
        return Array.from(nameMap.values());
    }
    normalizeName(name) {
        return name
            .toLowerCase()
            .replace(/[_\s]+/g, "-") // Replace underscores and spaces with hyphens
            .replace(/-+/g, "-") // Collapse multiple hyphens
            .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
    }
}
//# sourceMappingURL=ranker.js.map