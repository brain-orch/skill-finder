import { TrustScorer } from "../scoring/trust-scorer.js";
import { FeedbackManager, indexedToRecommendation, toRecommendation, } from "./feedback.js";
// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------
const DEFAULT_MAX_RESULTS = 3;
const DEFAULT_LOCAL_WEIGHT = 0.6;
const DEFAULT_NETWORK_WEIGHT = 0.4;
const DEFAULT_MIN_SCORE = 0.3;
const DEFAULT_MIN_TRUST_GRADE = "C";
// ---------------------------------------------------------------------------
// SkillRecommender
// ---------------------------------------------------------------------------
export class SkillRecommender {
    searchEngine;
    indexer;
    config;
    registry;
    installedSkillNames;
    trustScorer = new TrustScorer();
    feedback = new FeedbackManager();
    constructor(searchEngine, registry, indexer, config) {
        this.searchEngine = searchEngine;
        this.registry = registry;
        this.indexer = indexer;
        this.config = {
            maxResults: config?.maxResults ?? DEFAULT_MAX_RESULTS,
            localWeight: config?.localWeight ?? DEFAULT_LOCAL_WEIGHT,
            networkWeight: config?.networkWeight ?? DEFAULT_NETWORK_WEIGHT,
            minScore: config?.minScore ?? DEFAULT_MIN_SCORE,
            installedSkillNames: config?.installedSkillNames ?? [],
            minTrustGrade: config?.minTrustGrade ?? DEFAULT_MIN_TRUST_GRADE,
        };
        this.installedSkillNames = new Set(this.config.installedSkillNames.map((n) => n.toLowerCase()));
    }
    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------
    async recommend(context) {
        const { categories } = context;
        // Empty categories → nothing to recommend
        if (categories.length === 0)
            return [];
        // 1. Local search (instant, offline)
        const localResults = await this.searchLocal(categories);
        // 2. Network search (marketplaces)
        const networkResults = await this.searchNetwork(categories);
        // 3. Merge — local gets higher weight, network fills gaps
        const merged = this.mergeResults(localResults, networkResults);
        // 4. Filter — remove installed, remove below minScore, cap to maxResults
        const filtered = this.filterResults(merged);
        // 5. Final dedup by identifier (belt-and-suspenders)
        return this.deduplicateByIdentifier(filtered);
    }
    // -----------------------------------------------------------------------
    // Public: feedback tracking
    // -----------------------------------------------------------------------
    acceptSkill(identifier) {
        this.feedback.acceptSkill(identifier);
    }
    dismissSkill(identifier) {
        this.feedback.dismissSkill(identifier);
    }
    resetFeedback() {
        this.feedback.resetFeedback();
    }
    // -----------------------------------------------------------------------
    // Private: local search
    // -----------------------------------------------------------------------
    async searchLocal(categories) {
        if (!this.indexer)
            return [];
        const results = [];
        const seenIds = new Set();
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
                    if (seenIds.has(skill.id))
                        continue;
                    seenIds.add(skill.id);
                    const grade = this.trustScorer.score({
                        id: skill.id,
                        name: skill.name,
                        description: skill.description,
                        marketplace: skill.marketplace,
                        category: skill.category,
                        triggers: skill.triggers,
                        installCount: skill.installCount,
                        stars: skill.stars,
                        installCommand: "",
                        homepageUrl: "",
                        verified: false,
                    }).grade;
                    const rec = indexedToRecommendation(skill, categories, grade);
                    results.push(rec);
                }
            }
        }
        return results;
    }
    // -----------------------------------------------------------------------
    // Private: network search
    // -----------------------------------------------------------------------
    async searchNetwork(categories) {
        const results = [];
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
                    const grade = this.trustScorer.score(skill).grade;
                    const rec = toRecommendation(skill, cached, categories, grade);
                    results.push(rec);
                }
            }
            catch (err) {
                console.warn("[skill-finder] recommendation search failed, continuing with other categories:", err instanceof Error ? err.message : String(err));
            }
        }
        return results;
    }
    // -----------------------------------------------------------------------
    // Private: merge & dedup
    // -----------------------------------------------------------------------
    mergeResults(local, network) {
        // Combine: local first (preferred on dedup)
        const combined = [...local, ...network];
        // Deduplicate by identifier — keep the local copy if same
        const seen = new Map();
        for (const rec of combined) {
            const existing = seen.get(rec.identifier);
            if (!existing) {
                seen.set(rec.identifier, rec);
            }
            else if (rec.fromCache && !existing.fromCache) {
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
    filterResults(results) {
        const gradeOrder = ["A", "B", "C", "D", "F"];
        const minIndex = gradeOrder.indexOf(this.config.minTrustGrade);
        return results
            .filter((r) => !this.installedSkillNames.has(r.name.toLowerCase()))
            .filter((r) => !this.feedback.isDismissed(r.identifier))
            .filter((r) => r.score >= this.config.minScore)
            .filter((r) => gradeOrder.indexOf(r.trustGrade) <= minIndex)
            .sort((a, b) => {
            const aWeight = a.fromCache ? this.config.localWeight : this.config.networkWeight;
            const bWeight = b.fromCache ? this.config.localWeight : this.config.networkWeight;
            return b.score * bWeight - a.score * aWeight;
        })
            .slice(0, this.config.maxResults);
    }
    deduplicateByIdentifier(results) {
        const seen = new Map();
        for (const rec of results) {
            if (!seen.has(rec.identifier)) {
                seen.set(rec.identifier, rec);
            }
        }
        return Array.from(seen.values());
    }
}
//# sourceMappingURL=recommender.js.map