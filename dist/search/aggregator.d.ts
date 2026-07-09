import type { SkillSearchResult } from "../types.js";
import type { ParsedIntent } from "./intent-parser.js";
export interface AggregatedCategory {
    category: string;
    results: SkillSearchResult[];
}
export interface AggregatedResults {
    categories: AggregatedCategory[];
    other: SkillSearchResult[];
    totalUnique: number;
}
export declare class SearchAggregator {
    /**
     * Aggregate raw marketplace results: dedup across marketplaces,
     * group by ParsedIntent categories, and rank by quality.
     *
     * @param results - Array of result arrays (one per marketplace/query)
     * @param intent - Parsed intent for category grouping
     * @returns Aggregated, deduplicated, categorized results
     */
    aggregateResults(results: SkillSearchResult[][], intent: ParsedIntent): AggregatedResults;
    /**
     * Cross-marketplace deduplication: same normalized skill name
     * from multiple marketplaces → keep the one with highest quality+trust.
     */
    private deduplicate;
    /** Rank results by quality score descending. */
    private rankByQuality;
    /**
     * Group results by matching ParsedIntent categories.
     * Skills whose category matches an intent category go into that bucket.
     * Everything else goes into "other".
     */
    private groupByCategory;
    private normalizeName;
}
//# sourceMappingURL=aggregator.d.ts.map