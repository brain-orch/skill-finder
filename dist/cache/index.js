import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { getSkillNameFromIdentifier, validateSkillName, } from "../skill-name.js";
import { validateSkillContent } from "../validation/validator.js";
const DEFAULT_MAX_CACHE_SIZE_MB = 500;
const DEFAULT_CACHE_TTL_HOURS = 24;
const STALE_MAX_AGE_HOURS = 168; // 7 days
const REFRESH_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
export class CacheManager {
    config;
    resolvedMaxCacheSizeMb;
    resolvedCacheTtlHours;
    lastRefreshTime = 0;
    lastRefreshFailed = false;
    constructor(config) {
        this.config = {
            globalDir: config.globalDir,
            projectDir: config.projectDir,
            tempDir: config.tempDir ?? os.tmpdir(),
        };
        this.resolvedMaxCacheSizeMb =
            config.maxCacheSizeMb ?? DEFAULT_MAX_CACHE_SIZE_MB;
        this.resolvedCacheTtlHours =
            config.cacheTtlHours ?? DEFAULT_CACHE_TTL_HOURS;
    }
    async download(identifier, marketplace, targetDir) {
        const name = getSkillNameFromIdentifier(identifier);
        const destDir = targetDir ?? path.join(this.config.globalDir, name);
        // 1. Create destination directory
        fs.mkdirSync(destDir, { recursive: true });
        // 2. Download to temp dir first
        const tempDir = path.join(this.config.tempDir, `skill-finder-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        fs.mkdirSync(tempDir, { recursive: true });
        try {
            const result = await marketplace.install(identifier, tempDir);
            // Find the SKILL.md in the temp result directory
            const tempSkillFile = path.join(result.path, "SKILL.md");
            if (!fs.existsSync(tempSkillFile)) {
                throw new Error(`SKILL.md not found in ${result.path}`);
            }
            // Validate SKILL.md content before writing to destination
            const rawContent = fs.readFileSync(tempSkillFile);
            const validation = validateSkillContent(rawContent.toString(), {
                name,
                marketplace: typeof marketplace === 'string' ? marketplace : marketplace.name,
            });
            if (!validation.valid) {
                fs.rmSync(tempDir, { recursive: true, force: true });
                throw new Error(`Invalid skill content: ${validation.errors.join(', ')}`);
            }
            // 3. Atomic write: write to temp file then rename
            const tmpFile = path.join(destDir, `.${name}.tmp`);
            const content = rawContent;
            fs.writeFileSync(tmpFile, content);
            fs.renameSync(tmpFile, path.join(destDir, "SKILL.md"));
            // 4. Compute SHA256 (informational — stored when listCached runs)
            crypto.createHash("sha256").update(content).digest("hex");
            // 5. Clean up temp dir
            fs.rmSync(tempDir, { recursive: true, force: true });
            return { path: path.join(destDir, "SKILL.md"), files: ["SKILL.md"] };
        }
        catch (err) {
            // Clean up on failure
            fs.rmSync(tempDir, { recursive: true, force: true });
            const tmpFile = path.join(destDir, `.${name}.tmp`);
            if (fs.existsSync(tmpFile)) {
                fs.unlinkSync(tmpFile);
            }
            throw err;
        }
    }
    isCached(_identifier, name) {
        const safeName = validateSkillName(name);
        return (this.skillFileExists(this.config.globalDir, safeName) ||
            this.skillFileExists(this.config.projectDir, safeName));
    }
    getSkillPath(_identifier, name) {
        const safeName = validateSkillName(name);
        const globalPath = path.join(this.config.globalDir, safeName, "SKILL.md");
        if (fs.existsSync(globalPath))
            return globalPath;
        const projectPath = path.join(this.config.projectDir, safeName, "SKILL.md");
        if (fs.existsSync(projectPath))
            return projectPath;
        return null;
    }
    remove(_identifier, name) {
        const safeName = validateSkillName(name);
        let deleted = false;
        const globalDir = path.join(this.config.globalDir, safeName);
        if (fs.existsSync(globalDir)) {
            fs.rmSync(globalDir, { recursive: true, force: true });
            deleted = true;
        }
        const projectDir = path.join(this.config.projectDir, safeName);
        if (fs.existsSync(projectDir)) {
            fs.rmSync(projectDir, { recursive: true, force: true });
            deleted = true;
        }
        return deleted;
    }
    listCached() {
        const skills = [];
        this.scanDir(this.config.globalDir, skills);
        this.scanDir(this.config.projectDir, skills);
        return skills;
    }
    getCacheSize() {
        let total = 0;
        total += this.sumSize(this.config.globalDir);
        total += this.sumSize(this.config.projectDir);
        return total;
    }
    /**
     * Force refresh the marketplace index by re-scanning cached skills.
     * Guards against rapid re-refresh: if the last refresh failed, waits
     * at least 1 hour before allowing another attempt.
     */
    async refresh(indexer) {
        const now = Date.now();
        // Guard: skip if last refresh failed and cooldown hasn't elapsed
        if (this.lastRefreshFailed && now - this.lastRefreshTime < REFRESH_COOLDOWN_MS) {
            return { indexed: 0, failed: 1 };
        }
        try {
            this.lastRefreshTime = now;
            const cachedSkills = this.listCached();
            indexer.refreshFromCache(cachedSkills);
            this.lastRefreshFailed = false;
            return { indexed: cachedSkills.length, failed: 0 };
        }
        catch (err) {
            console.warn("[skill-finder] cache refresh failed:", err instanceof Error ? err.message : String(err));
            this.lastRefreshFailed = true;
            return { indexed: 0, failed: 1 };
        }
    }
    /**
     * Flag stale skills (installed > maxAge ago) without deleting them.
     * Default maxAge is 7 days (168 hours).
     */
    cleanup() {
        const now = Date.now();
        const maxAgeMs = STALE_MAX_AGE_HOURS * 60 * 60 * 1000;
        const cached = this.listCached();
        const staleSkills = [];
        for (const skill of cached) {
            const installedAt = new Date(skill.installedAt).getTime();
            if (now - installedAt > maxAgeMs) {
                staleSkills.push(skill.name);
            }
        }
        return { staleCount: staleSkills.length, staleSkills };
    }
    /**
     * Check disk quota against configured maximum.
     */
    checkQuota() {
        const currentBytes = this.getCacheSize();
        const currentSizeMb = currentBytes / (1024 * 1024);
        const maxSizeMb = this.resolvedMaxCacheSizeMb;
        return {
            withinQuota: currentSizeMb <= maxSizeMb,
            currentSizeMb: Math.round(currentSizeMb * 10000) / 10000,
            maxSizeMb,
        };
    }
    // --- private helpers ---
    skillFileExists(dir, name) {
        return fs.existsSync(path.join(dir, name, "SKILL.md"));
    }
    scanDir(dir, out) {
        if (!fs.existsSync(dir))
            return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            const skillFile = path.join(dir, entry.name, "SKILL.md");
            if (!fs.existsSync(skillFile))
                continue;
            const stat = fs.statSync(skillFile);
            const content = fs.readFileSync(skillFile);
            const hash = crypto.createHash("sha256").update(content).digest("hex");
            out.push({
                id: entry.name,
                name: entry.name,
                marketplace: "unknown", // heuristic — refined when FTS5 index lands
                filePath: skillFile,
                installedAt: stat.mtime.toISOString(),
                sizeBytes: stat.size,
                skillHash: hash,
            });
        }
    }
    sumSize(dir) {
        if (!fs.existsSync(dir))
            return 0;
        let total = 0;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            const skillFile = path.join(dir, entry.name, "SKILL.md");
            if (fs.existsSync(skillFile)) {
                total += fs.statSync(skillFile).size;
            }
        }
        return total;
    }
}
//# sourceMappingURL=index.js.map