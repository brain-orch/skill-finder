import { loadConfig } from "./config.js";
import { marketplaceRegistry } from "./registry/instance.js";
import { SkillLockManager } from "./cache/skill-lock.js";
import { ChangelogTracker } from "./cache/changelog-tracker.js";
import { SkillPlanComposer } from "./composer/skill-plan.js";
import { SkillFinderError, ErrorCode } from "./error.js";
/* ------------------------------------------------------------------ */
/*  SkillFinderAPI                                                     */
/* ------------------------------------------------------------------ */
export class SkillFinderAPI {
    config;
    lockManager;
    changelogTracker;
    planComposer;
    constructor(config) {
        this.config = loadConfig(config);
        this.lockManager = new SkillLockManager();
        this.changelogTracker = new ChangelogTracker();
        this.planComposer = new SkillPlanComposer();
    }
    /**
     * Search for skills across all marketplaces.
     */
    async search(query, options) {
        if (!query || !query.trim()) {
            throw new SkillFinderError("query is required and must be non-empty", ErrorCode.VALIDATION);
        }
        const limit = options?.limit ?? 5;
        if (limit < 1 || limit > 50) {
            throw new SkillFinderError("limit must be between 1 and 50", ErrorCode.VALIDATION);
        }
        return marketplaceRegistry.searchAll(query.trim(), {
            category: options?.category,
            limit,
        });
    }
    /**
     * Download and install a skill.
     */
    async install(identifier, marketplace, target) {
        if (!identifier || !identifier.trim()) {
            throw new SkillFinderError("identifier is required and must be non-empty", ErrorCode.VALIDATION);
        }
        if (!marketplace || !marketplace.trim()) {
            throw new SkillFinderError("marketplace is required and must be non-empty", ErrorCode.VALIDATION);
        }
        const adapter = marketplaceRegistry.getMarketplace(marketplace);
        if (!adapter) {
            throw new SkillFinderError(`Marketplace '${marketplace}' is not available. Available: ${marketplaceRegistry.listAvailable().join(", ")}`, ErrorCode.VALIDATION);
        }
        const targetDir = target ?? "opencode";
        // Download to temp dir
        const tmpDir = `/tmp/skill-install-${Date.now()}`;
        const result = await adapter.install(identifier, tmpDir);
        // Lock the skill
        try {
            this.lockManager.lockSkill(identifier, JSON.stringify(result.files), {
                installedAt: new Date().toISOString(),
                marketplace,
            }, [targetDir]);
        }
        catch (err) {
            console.warn("[skill-finder] lockfile write failed during installation:", err instanceof Error ? err.message : String(err));
        }
        return {
            path: result.path,
            files: result.files,
            targets: [targetDir],
        };
    }
    /**
     * List all locally cached/locked skills.
     */
    async list() {
        return this.lockManager.getLockedSkills();
    }
    /**
     * Get detailed info about a specific skill.
     * Returns null if not found.
     */
    async info(identifier) {
        if (!identifier || !identifier.trim()) {
            throw new SkillFinderError("identifier is required and must be non-empty", ErrorCode.VALIDATION);
        }
        const id = identifier.trim();
        // Try to find adapter by marketplace prefix
        if (id.includes(":")) {
            const [marketplace, skillId] = id.split(":", 2);
            const adapter = marketplaceRegistry.getMarketplace(marketplace);
            if (adapter) {
                const skill = await adapter.getSkillInfo(skillId);
                if (skill)
                    return skill;
            }
        }
        // Fallback: search all marketplaces
        const results = await marketplaceRegistry.searchAll(id, { limit: 5 });
        return results.find((r) => r.id === id) ?? results[0] ?? null;
    }
    /**
     * Remove a skill from the lockfile.
     * Returns true if successfully removed, false otherwise.
     */
    async remove(identifier) {
        if (!identifier || !identifier.trim()) {
            throw new SkillFinderError("identifier is required and must be non-empty", ErrorCode.VALIDATION);
        }
        try {
            this.lockManager.unlockSkill(identifier.trim());
            return true;
        }
        catch (err) {
            console.warn("[skill-finder] lockfile unlock failed:", err instanceof Error ? err.message : String(err));
            return false;
        }
    }
    /**
     * Check all locked skills for available updates.
     */
    async checkUpdates() {
        const lockedSkills = this.lockManager.getLockedSkills();
        const updates = [];
        for (const skill of lockedSkills) {
            const adapter = marketplaceRegistry.getMarketplace(skill.marketplace);
            if (!adapter)
                continue;
            try {
                const info = await adapter.getSkillInfo(skill.identifier);
                if (info) {
                    const hasBreaking = this.changelogTracker.hasBreakingChanges(skill.identifier);
                    updates.push({
                        identifier: skill.identifier,
                        currentVersion: skill.version ?? "unknown",
                        availableVersion: skill.version ?? "unknown",
                        breaking: hasBreaking,
                    });
                }
            }
            catch (err) {
                console.warn("[skill-finder] update check failed for", skill.identifier, err instanceof Error ? err.message : String(err));
            }
        }
        return updates;
    }
    /**
     * Get available skill plans, optionally filtered by stack.
     */
    async plan(stack) {
        const plans = this.planComposer.getAvailablePlans();
        if (!stack) {
            return plans.map((p) => ({
                key: p.key,
                name: p.name,
                skills: p.matchCategories,
                description: p.description,
            }));
        }
        const stacks = stack.split(",").map((s) => s.trim().toLowerCase());
        const matched = this.planComposer.composePlan(stacks);
        return matched.map((p) => ({
            key: p.key,
            name: p.name,
            skills: p.skills.map((s) => s.query),
            description: p.description,
        }));
    }
}
//# sourceMappingURL=api.js.map