import type { SkillSearchResult } from "../types.js";
import { QualityScorer } from "../scoring/quality.js";

const qualityScorer = new QualityScorer();

export class RelevanceRanker {
  rank(results: SkillSearchResult[], query: string, limit?: number): SkillSearchResult[] {
    if (results.length === 0) return [];

    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    // Score each result
    const scored = results.map((result) => ({
      result,
      score: this.calculateScore(result, tokens, results),
    }));

    // Deduplicate by normalized name
    const deduplicated = this.deduplicate(scored);

    // Sort by score descending, then by installCount for ties
    deduplicated.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.result.installCount - a.result.installCount;
    });

    // Apply limit
    const limited = limit !== undefined ? deduplicated.slice(0, limit) : deduplicated;

    return limited.map((item) => item.result);
  }

  private calculateScore(
    result: SkillSearchResult,
    tokens: string[],
    allResults: SkillSearchResult[],
  ): number {
    const keywordScore = this.keywordMatchScore(result, tokens);
    const popularityScore = this.popularityScore(result, allResults);
    const verifiedScore = this.verifiedScore(result);
    const qualityScore = qualityScorer.score(result);

    return (
      keywordScore * 0.6 +
      popularityScore * 0.1 +
      qualityScore * 0.2 +
      verifiedScore * 0.1
    );
  }

  private keywordMatchScore(result: SkillSearchResult, tokens: string[]): number {
    if (tokens.length === 0) return 0;

    let score = 0;
    const name = result.name.toLowerCase();
    const description = result.description.toLowerCase();
    const category = result.category?.toLowerCase() ?? "";
    const triggers = result.triggers.map((t) => t.toLowerCase());

    for (const token of tokens) {
      // Exact name match
      if (name === token) {
        score += 10;
      } else if (name.includes(token)) {
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

  private popularityScore(result: SkillSearchResult, allResults: SkillSearchResult[]): number {
    if (allResults.length === 0) return 0;

    const installCounts = allResults.map((r) => r.installCount);
    const min = Math.min(...installCounts);
    const max = Math.max(...installCounts);

    // Avoid division by zero
    if (max === min) return 0.5;

    return (result.installCount - min) / (max - min);
  }

  private starsScore(result: SkillSearchResult): number {
    return result.stars / 5;
  }

  private verifiedScore(result: SkillSearchResult): number {
    return result.verified ? 1 : 0;
  }

  private deduplicate(
    scored: Array<{ result: SkillSearchResult; score: number }>,
  ): Array<{ result: SkillSearchResult; score: number }> {
    const map = new Map<string, { result: SkillSearchResult; score: number }>();

    for (const item of scored) {
      const normalizedName = this.normalizeName(item.result.name);
      const existing = map.get(normalizedName);

      if (!existing || item.score > existing.score) {
        map.set(normalizedName, item);
      }
    }

    return Array.from(map.values());
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[_\s]+/g, "-") // Replace underscores and spaces with hyphens
      .replace(/-+/g, "-") // Collapse multiple hyphens
      .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
  }
}