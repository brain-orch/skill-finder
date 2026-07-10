import { QualityScorer } from "../scoring/quality.js";
import { TrustScorer } from "../scoring/trust-scorer.js";
const qualityScorer = new QualityScorer();
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
    dismissedSkills = new Set();
    acceptedSkills = new Set();
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
        this.acceptedSkills.add(identifier);
        this.dismissedSkills.delete(identifier);
    }
    dismissSkill(identifier) {
        this.dismissedSkills.add(identifier);
        this.acceptedSkills.delete(identifier);
    }
    resetFeedback() {
        this.dismissedSkills.clear();
        this.acceptedSkills.clear();
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
                    const rec = this.toRecommendation(skill, cached, categories);
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
            .filter((r) => !this.dismissedSkills.has(r.identifier))
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
    // -----------------------------------------------------------------------
    // Private: convert indexed skill to Recommendation
    // -----------------------------------------------------------------------
    indexedToRecommendation(skill, categories) {
        const skillSearch = {
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
        };
        return {
            identifier: skill.id,
            name: skill.name,
            marketplace: skill.marketplace,
            description: skill.description,
            score: this.scoreByCategoryMatch(skillSearch, categories),
            trustGrade: this.trustScorer.score(skillSearch).grade,
            matchReasons: this.generateMatchReasons(skillSearch, categories),
            fromCache: true,
            alreadyInstalled: false,
        };
    }
    // -----------------------------------------------------------------------
    // Private: convert SkillSearchResult to Recommendation
    // -----------------------------------------------------------------------
    toRecommendation(skill, fromCache, categories) {
        return {
            identifier: skill.id,
            name: skill.name,
            marketplace: skill.marketplace,
            description: skill.description,
            score: this.scoreByCategoryMatch(skill, categories),
            trustGrade: this.trustScorer.score(skill).grade,
            matchReasons: this.generateMatchReasons(skill, categories),
            fromCache,
            alreadyInstalled: false,
        };
    }
    // -----------------------------------------------------------------------
    // Private: scoring
    // -----------------------------------------------------------------------
    scoreByCategoryMatch(skill, categories) {
        let score = 0;
        // Category match: +0.25
        if (skill.category) {
            const skillCat = skill.category.toLowerCase();
            for (const cat of categories) {
                if (skillCat === cat.toLowerCase()) {
                    score += 0.25;
                    break;
                }
            }
        }
        // Trigger match: +0.15 each (max 0.45)
        let triggerBonus = 0;
        for (const trigger of skill.triggers) {
            const tLower = trigger.toLowerCase();
            for (const cat of categories) {
                if (tLower.includes(cat.toLowerCase()) || cat.toLowerCase().includes(tLower)) {
                    triggerBonus += 0.15;
                    break;
                }
            }
        }
        score += Math.min(triggerBonus, 0.45);
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
        // Quality score: 0–0.2 based on quality score
        const qualityBonus = qualityScorer.score(skill) * 0.2; // max 0.2
        score += qualityBonus;
        // Cap at 1.0
        return Math.min(Math.round(score * 100) / 100, 1.0);
    }
    // -----------------------------------------------------------------------
    // Private: match reasons
    // -----------------------------------------------------------------------
    generateMatchReasons(skill, categories) {
        const reasons = [];
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
        // Quality score
        const qScore = qualityScorer.score(skill);
        if (qScore > 0.7) {
            reasons.push(`Quality score: ${Math.round(qScore * 100)}%`);
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
//# sourceMappingURL=recommender.js.map