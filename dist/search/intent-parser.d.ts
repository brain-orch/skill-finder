/**
 * Intent parser for natural language search queries.
 *
 * Translates free-form queries into structured ParsedIntent objects
 * with category detection and query expansion. Regex-based only —
 * no LLM, ML, or external API dependencies.
 */
export interface ParsedIntent {
    primaryIntent: string;
    categories: string[];
    expandedQueries: string[];
    confidence: number;
}
export declare class IntentParser {
    /**
     * Parse a natural language query into a structured ParsedIntent.
     *
     * @param query - Free-form search query
     * @returns ParsedIntent with categories, expanded queries, and confidence
     */
    parse(query: string): ParsedIntent;
    /** Tokenize text into lowercase words. */
    private tokenize;
    /**
     * Detect categories from query using keyword matching.
     * Supports both single-token and multi-word keyword matching.
     */
    private detectCategories;
    /**
     * Expand the original query with synonyms from matched categories.
     * Deduplicates and preserves original query as first entry.
     */
    private expandQuery;
}
//# sourceMappingURL=intent-parser.d.ts.map