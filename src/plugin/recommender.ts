import type { SkillSearchResult } from "../types.js";
import type { DetectedContext } from "./detector.js";
import { SearchEngine } from "../search/index.js";
import { SkillIndexer } from "../cache/indexer.js";
import { MarketRegistry } from "../registry/index.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface Recommendation {
  identifier: string;
  name: string;
  marketplace: string;
  description: string;
  score: number;
  matchReasons: string[];
  fromCache: boolean;
  alreadyInstalled: boolean;
}

export interface RecommenderConfig {
  maxResults?: number;            // Default: 3
  localWeight?: number;           // Default: 0.6
  networkWeight?: number;         // Default: 0.4
  minScore?: number;              // Default: 0.3
  installedSkillNames?: string[]; // Names of already installed skills
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MAX_RESULTS = 3;
const DEFAULT_LOCAL_WEIGHT = 0.6;
const DEFAULT_NETWORK_WEIGHT = 0.4;
const DEFAULT_MIN_SCORE = 0.3;

// ---------------------------------------------------------------------------
// SkillRecommender
// ---------------------------------------------------------------------------

export class SkillRecommender {
  private searchEngine: SearchEngine;
  private indexer: SkillIndexer | null;
  private config: Required<RecommenderConfig>;
  private registry: MarketRegistry;
  private installedSkillNames: Set<string>;

  constructor(
    searchEngine: SearchEngine,
    registry: MarketRegistry,
    indexer: SkillIndexer | null,
    config?: RecommenderConfig,
  ) {
    this.searchEngine = searchEngine;
    this.registry = registry;
    this.indexer = indexer;
    this.config = {
      maxResults: config?.maxResults ?? DEFAULT_MAX_RESULTS,
      localWeight: config?.localWeight ?? DEFAULT_LOCAL_WEIGHT,
      networkWeight: config?.networkWeight ?? DEFAULT_NETWORK_WEIGHT,
      minScore: config?.minScore ?? DEFAULT_MIN_SCORE,
      installedSkillNames: config?.installedSkillNames ?? [],
    };
    this.installedSkillNames = new Set(
      this.config.installedSkillNames.map((n) => n.toLowerCase()),
    );
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  async recommend(context: DetectedContext): Promise<Recommendation[]> {
    const { categories } = context;

    // Empty categories → nothing to recommend
    if (categories.length === 0) return [];

    // 1. Local search (instant, offline)
    const localResults = await this.searchLocal(categories);

    // 2. Network search (marketplaces)
    const networkResults = await this.searchNetwork(categories);

    // 3. Merge — local gets higher weight, network fills gaps
    const merged = this.mergeResults(localResults, networkResults);

    // 4. Filter — remove installed, remove below minScore, cap to maxResults
    const filtered = this.filterResults(merged);

    return filtered;
  }

  // -----------------------------------------------------------------------
  // Private: local search
  // -----------------------------------------------------------------------

  private async searchLocal(categories: string[]): Promise<Recommendation[]> {
    if (!this.indexer) return [];

    const results: Recommendation[] = [];
    const seenIds = new Set<string>();

    for (const category of categories) {
      // Split category into individual tokens for better FTS5 matching
      // e.g., "pdf-processing" → ["pdf", "processing"]
      const tokens = category
        .toLowerCase()
        .split(/[-_\s]+/)
        .filter((t) => t.length > 1);

      // Search with each token individually, take the first meaningful result set
      for (const token of tokens) {
        const indexed = this.indexer.searchLocal(token, 10);
        for (const skill of indexed) {
          if (seenIds.has(skill.id)) continue;
          seenIds.add(skill.id);
          const rec = this.indexedToRecommendation(skill, categories);
          results.push(rec);
        }
      }
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // Private: network search
  // -----------------------------------------------------------------------

  private async searchNetwork(categories: string[]): Promise<Recommendation[]> {
    const results: Recommendation[] = [];

    for (const category of categories) {
      try {
        const searchResults = await this.searchEngine.search({
          query: category,
          limit: 10,
        });

        for (const skill of searchResults) {
          const cached = this.indexer
            ? this.indexer.searchLocal(skill.name, 1).length > 0
            : false;

          const rec = this.toRecommendation(skill, cached, categories);
          results.push(rec);
        }
      } catch {
        // Network failure is non-fatal — continue with other categories
      }
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // Private: merge & dedup
  // -----------------------------------------------------------------------

  private mergeResults(
    local: Recommendation[],
    network: Recommendation[],
  ): Recommendation[] {
    // Combine: local first (preferred on dedup)
    const combined = [...local, ...network];

    // Deduplicate by identifier — keep the local copy if same
    const seen = new Map<string, Recommendation>();
    for (const rec of combined) {
      const existing = seen.get(rec.identifier);
      if (!existing) {
        seen.set(rec.identifier, rec);
      } else if (rec.fromCache && !existing.fromCache) {
        // Prefer local cached version
        seen.set(rec.identifier, rec);
      }
    }

    // Sort by weighted score descending (weight doesn't mutate the object)
    const deduped = Array.from(seen.values());
    deduped.sort((a, b) => {
      const aWeight = a.fromCache ? this.config.localWeight : this.config.networkWeight;
      const bWeight = b.fromCache ? this.config.localWeight : this.config.networkWeight;
      return b.score * bWeight - a.score * aWeight;
    });

    return deduped;
  }

  // -----------------------------------------------------------------------
  // Private: filter
  // -----------------------------------------------------------------------

  private filterResults(results: Recommendation[]): Recommendation[] {
    return results
      .filter((r) => !this.installedSkillNames.has(r.name.toLowerCase()))
      .filter((r) => r.score >= this.config.minScore)
      .sort((a, b) => {
        // Sort by weighted score for final ranking
        const aWeight = a.fromCache ? this.config.localWeight : this.config.networkWeight;
        const bWeight = b.fromCache ? this.config.localWeight : this.config.networkWeight;
        return b.score * bWeight - a.score * aWeight;
      })
      .slice(0, this.config.maxResults);
  }

  // -----------------------------------------------------------------------
  // Private: convert indexed skill to Recommendation
  // -----------------------------------------------------------------------

  private indexedToRecommendation(
    skill: { id: string; name: string; description: string; marketplace: string; category: string | null; triggers: string[]; installCount: number; stars: number },
    categories: string[],
  ): Recommendation {
    const baseScore = this.scoreByCategoryMatch(
      {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        marketplace: skill.marketplace as SkillSearchResult["marketplace"],
        category: skill.category,
        triggers: skill.triggers,
        installCount: skill.installCount,
        stars: skill.stars,
        installCommand: "",
        homepageUrl: "",
        verified: false,
      },
      categories,
    );

    const matchReasons = this.generateMatchReasons(
      {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        marketplace: skill.marketplace as SkillSearchResult["marketplace"],
        category: skill.category,
        triggers: skill.triggers,
        installCount: skill.installCount,
        stars: skill.stars,
        installCommand: "",
        homepageUrl: "",
        verified: false,
      },
      categories,
    );

    return {
      identifier: skill.id,
      name: skill.name,
      marketplace: skill.marketplace,
      description: skill.description,
      score: baseScore,
      matchReasons,
      fromCache: true,
      alreadyInstalled: false,
    };
  }

  // -----------------------------------------------------------------------
  // Private: convert SkillSearchResult to Recommendation
  // -----------------------------------------------------------------------

  private toRecommendation(
    skill: SkillSearchResult,
    fromCache: boolean,
    categories: string[],
  ): Recommendation {
    const score = this.scoreByCategoryMatch(skill, categories);
    const matchReasons = this.generateMatchReasons(skill, categories);

    return {
      identifier: skill.id,
      name: skill.name,
      marketplace: skill.marketplace,
      description: skill.description,
      score,
      matchReasons,
      fromCache,
      alreadyInstalled: false,
    };
  }

  // -----------------------------------------------------------------------
  // Private: scoring
  // -----------------------------------------------------------------------

  private scoreByCategoryMatch(
    skill: SkillSearchResult,
    categories: string[],
  ): number {
    let score = 0;

    // Category match: +0.3
    if (skill.category) {
      const skillCat = skill.category.toLowerCase();
      for (const cat of categories) {
        if (skillCat === cat.toLowerCase()) {
          score += 0.3;
          break;
        }
      }
    }

    // Trigger match: +0.2 each (max 0.6)
    let triggerBonus = 0;
    for (const trigger of skill.triggers) {
      const tLower = trigger.toLowerCase();
      for (const cat of categories) {
        if (tLower.includes(cat.toLowerCase()) || cat.toLowerCase().includes(tLower)) {
          triggerBonus += 0.2;
          break;
        }
      }
    }
    score += Math.min(triggerBonus, 0.6);

    // Name/description keyword match: +0.1
    const nameLower = skill.name.toLowerCase();
    const descLower = skill.description.toLowerCase();
    for (const cat of categories) {
      const catLower = cat.toLowerCase();
      if (nameLower.includes(catLower) || descLower.includes(catLower)) {
        score += 0.1;
        break;
      }
    }

    // Popularity score: 0–0.4 based on install count
    // Normalized against a rough max (1000 installs → 0.4)
    const popularity = Math.min(skill.installCount / 1000, 1) * 0.4;
    score += popularity;

    // Cap at 1.0
    return Math.min(Math.round(score * 100) / 100, 1.0);
  }

  // -----------------------------------------------------------------------
  // Private: match reasons
  // -----------------------------------------------------------------------

  private generateMatchReasons(
    skill: SkillSearchResult,
    categories: string[],
  ): string[] {
    const reasons: string[] = [];

    // Category match
    if (skill.category) {
      const skillCat = skill.category.toLowerCase();
      for (const cat of categories) {
        if (skillCat === cat.toLowerCase()) {
          reasons.push(`Matches '${cat}' task category`);
          break;
        }
      }
    }

    // Trigger matches
    for (const trigger of skill.triggers) {
      const tLower = trigger.toLowerCase();
      for (const cat of categories) {
        if (tLower.includes(cat.toLowerCase()) || cat.toLowerCase().includes(tLower)) {
          reasons.push(`Has trigger '${trigger}' matching your task`);
          break;
        }
      }
    }

    // Popularity
    if (skill.installCount > 0) {
      reasons.push(`Popular with ${skill.installCount.toLocaleString()} installs`);
    }

    // Verified
    if (skill.verified) {
      reasons.push(`Verified by ${skill.marketplace}`);
    }

    // Stars
    if (skill.stars > 0) {
      reasons.push(`Star rating: ${skill.stars}/5`);
    }

    // Cache status
    // (handled externally via fromCache field, not as a reason string)

    return reasons;
  }
}
