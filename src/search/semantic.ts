import type { SkillIndexer, IndexedSkill } from "../cache/indexer.js";

export interface SemSearchResult {
  id: string;
  name: string;
  description: string;
  marketplace: string;
  score: number;
  fieldScores: {
    name: number;
    description: number;
    triggers: number;
  };
}

const FIELD_WEIGHTS = {
  name: 3,
  description: 2,
  triggers: 1,
} as const;

export class SemanticSearch {
  private indexer: SkillIndexer;

  constructor(indexer: SkillIndexer) {
    this.indexer = indexer;
  }

  search(query: string): SemSearchResult[] {
    if (!query || !query.trim()) {
      return [];
    }

    const results = this.indexer.searchLocal(query, 50);
    if (results.length === 0) {
      return [];
    }

    const queryTerms = this.tokenize(query);
    if (queryTerms.length === 0) {
      return [];
    }

    return this.scoreResults(results, queryTerms);
  }

  private tokenize(query: string): string[] {
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }

  private scoreResults(
    results: IndexedSkill[],
    queryTerms: string[],
  ): SemSearchResult[] {
    const totalDocs = results.length;

    // Compute document frequency for each term across result set
    const termDF = new Map<string, number>();
    for (const term of queryTerms) {
      let df = 0;
      for (const result of results) {
        if (this.termAppearsInResult(term, result)) {
          df++;
        }
      }
      termDF.set(term, df);
    }

    // Score each result with BM25-like field-weighted ranking
    const scored = results.map((result) => {
      const fieldScores = { name: 0, description: 0, triggers: 0 };

      for (const term of queryTerms) {
        const df = termDF.get(term) ?? totalDocs;
        const idf = Math.log(1 + totalDocs / Math.max(df, 1));

        if (this.termInName(term, result.name)) {
          fieldScores.name += idf;
        }
        if (this.termInDescription(term, result.description)) {
          fieldScores.description += idf;
        }
        if (this.termInTriggers(term, result.triggers)) {
          fieldScores.triggers += idf;
        }
      }

      const combinedScore =
        fieldScores.name * FIELD_WEIGHTS.name +
        fieldScores.description * FIELD_WEIGHTS.description +
        fieldScores.triggers * FIELD_WEIGHTS.triggers;

      return {
        id: result.id,
        name: result.name,
        description: result.description,
        marketplace: result.marketplace,
        score: combinedScore,
        fieldScores,
      };
    });

    // Sort by combined score descending
    scored.sort((a, b) => b.score - a.score);

    return scored;
  }

  private termAppearsInResult(term: string, result: IndexedSkill): boolean {
    return (
      this.termInName(term, result.name) ||
      this.termInDescription(term, result.description) ||
      this.termInTriggers(term, result.triggers)
    );
  }

  private termInName(term: string, name: string): boolean {
    return name.toLowerCase().includes(term);
  }

  private termInDescription(term: string, description: string): boolean {
    return description.toLowerCase().includes(term);
  }

  private termInTriggers(term: string, triggers: string[]): boolean {
    return triggers.some((t) => t.toLowerCase().includes(term));
  }
}
