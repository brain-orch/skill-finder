import { QualityScorer } from "../scoring/quality.js";
const qualityScorer = new QualityScorer();
// ---------------------------------------------------------------------------
// SearchAggregator
// ---------------------------------------------------------------------------
export class SearchAggregator {
    /**
     * Aggregate raw marketplace results: dedup across marketplaces,
     * group by ParsedIntent categories, and rank by quality.
     *
     * @param results - Array of result arrays (one per marketplace/query)
     * @param intent - Parsed intent for category grouping
     * @returns Aggregated, deduplicated, categorized results
     */
    aggregateResults(results, intent) {
        const flat = results.flat();
        if (flat.length === 0) {
            return { categories: [], other: [], totalUnique: 0 };
        }
        const deduped = this.deduplicate(flat);
        const ranked = this.rankByQuality(deduped);
        const { matched, other } = this.groupByCategory(ranked, intent.categories);
        return {
            categories: matched,
            other,
            totalUnique: ranked.length,
        };
    }
    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------
    /**
     * Cross-marketplace deduplication: same normalized skill name
     * from multiple marketplaces → keep the one with highest quality+trust.
     */
    deduplicate(skills) {
        const byNormalized = new Map();
        for (const skill of skills) {
            const key = this.normalizeName(skill.name);
            const existing = byNormalized.get(key);
            if (!existing) {
                byNormalized.set(key, skill);
            }
            else {
                const scoreA = qualityScorer.score(existing);
                const scoreB = qualityScorer.score(skill);
                if (scoreB > scoreA) {
                    byNormalized.set(key, skill);
                }
                else if (scoreB === scoreA) {
                    // Tiebreak: prefer verified, then higher install count
                    if (skill.verified && !existing.verified) {
                        byNormalized.set(key, skill);
                    }
                    else if (skill.verified === existing.verified && skill.installCount > existing.installCount) {
                        byNormalized.set(key, skill);
                    }
                }
            }
        }
        return Array.from(byNormalized.values());
    }
    /** Rank results by quality score descending. */
    rankByQuality(skills) {
        return [...skills].sort((a, b) => qualityScorer.score(b) - qualityScorer.score(a));
    }
    /**
     * Group results by matching ParsedIntent categories.
     * Skills whose category matches an intent category go into that bucket.
     * Everything else goes into "other".
     */
    groupByCategory(skills, intentCategories) {
        const categoryMap = new Map();
        const other = [];
        for (const skill of skills) {
            const skillCat = skill.category?.toLowerCase() ?? "";
            const matchedIntent = intentCategories.find((ic) => ic.toLowerCase() === skillCat || skillCat.includes(ic.toLowerCase()));
            if (matchedIntent) {
                const bucket = categoryMap.get(matchedIntent) ?? [];
                bucket.push(skill);
                categoryMap.set(matchedIntent, bucket);
            }
            else {
                other.push(skill);
            }
        }
        const matched = Array.from(categoryMap.entries()).map(([category, results]) => ({ category, results }));
        return { matched, other };
    }
    normalizeName(name) {
        return name
            .toLowerCase()
            .replace(/[_\s]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
    }
}
//# sourceMappingURL=aggregator.js.map