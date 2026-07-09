import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { SKILLS_DIR } from "../constants.js";
/* ------------------------------------------------------------------ */
/*  SkillLockManager                                                   */
/* ------------------------------------------------------------------ */
export class SkillLockManager {
    lockfilePath;
    skillsDir;
    constructor(baseDir) {
        const base = baseDir ?? process.cwd();
        this.lockfilePath = path.join(base, ".opencode", "skill-finder-lock.json");
        this.skillsDir = path.join(base, SKILLS_DIR);
    }
    /**
     * Compute SHA-256 hash of content string, prefixed with "sha256-".
     */
    static computeHash(content) {
        const hash = crypto.createHash("sha256").update(content, "utf-8").digest("hex");
        return `sha256-${hash}`;
    }
    /**
     * Lock a skill: compute SHA-256 of content and save to lockfile.
     */
    lockSkill(identifier, content, metadata, targets = []) {
        const data = this.readLockfile();
        const now = new Date().toISOString();
        // Merge targets: keep existing targets + add new ones (deduplicate)
        const existingTargets = data.skills[identifier]?.targets ?? [];
        const mergedTargets = [...new Set([...existingTargets, ...targets])];
        data.skills[identifier] = {
            identifier,
            installedAt: metadata.installedAt,
            contentHash: SkillLockManager.computeHash(content),
            version: metadata.version,
            marketplace: metadata.marketplace,
            lastChecked: now,
            targets: mergedTargets,
        };
        this.writeLockfile(data);
    }
    /**
     * Unlock a skill: remove from lockfile.
     */
    unlockSkill(identifier) {
        const data = this.readLockfile();
        delete data.skills[identifier];
        this.writeLockfile(data);
    }
    /**
     * Check if a skill has updates by comparing content hashes.
     */
    async checkForUpdates(identifier, newContent) {
        const data = this.readLockfile();
        const now = new Date().toISOString();
        const locked = data.skills[identifier];
        if (!locked) {
            return {
                identifier,
                hasUpdate: false,
                currentHash: "",
                checkedAt: now,
            };
        }
        const newHash = SkillLockManager.computeHash(newContent);
        const oldHash = locked.contentHash;
        const hasUpdate = oldHash !== newHash;
        locked.lastChecked = now;
        if (hasUpdate) {
            locked.contentHash = newHash;
        }
        this.writeLockfile(data);
        return {
            identifier,
            hasUpdate,
            currentHash: oldHash,
            newHash: hasUpdate ? newHash : undefined,
            checkedAt: now,
        };
    }
    /**
     * Return all locked skills.
     */
    getLockedSkills() {
        const data = this.readLockfile();
        return Object.values(data.skills);
    }
    /**
     * Return skills not checked in N days (default 7).
     */
    getStaleSkills(days = 7) {
        const now = Date.now();
        const thresholdMs = days * 24 * 60 * 60 * 1000;
        const data = this.readLockfile();
        return Object.values(data.skills).filter((skill) => {
            const lastChecked = new Date(skill.lastChecked).getTime();
            return now - lastChecked > thresholdMs;
        });
    }
    /**
     * Rebuild lockfile from filesystem by scanning installed skills
     * and re-hashing their SKILL.md files.
     */
    rebuild() {
        const data = { version: 1, skills: {} };
        if (!fs.existsSync(this.skillsDir)) {
            this.writeLockfile(data);
            return;
        }
        const marketplaces = fs.readdirSync(this.skillsDir).filter((d) => {
            const full = path.join(this.skillsDir, d);
            return fs.statSync(full).isDirectory();
        });
        for (const mp of marketplaces) {
            const mpDir = path.join(this.skillsDir, mp);
            const skills = fs.readdirSync(mpDir).filter((d) => {
                const full = path.join(mpDir, d);
                return fs.statSync(full).isDirectory();
            });
            for (const skillName of skills) {
                const skillFile = path.join(mpDir, skillName, "SKILL.md");
                if (!fs.existsSync(skillFile))
                    continue;
                const content = fs.readFileSync(skillFile, "utf-8");
                const identifier = `${mp}:${skillName}`;
                const stat = fs.statSync(skillFile);
                data.skills[identifier] = {
                    identifier,
                    installedAt: stat.mtime.toISOString(),
                    contentHash: SkillLockManager.computeHash(content),
                    marketplace: mp,
                    lastChecked: new Date().toISOString(),
                    targets: [],
                };
            }
        }
        this.writeLockfile(data);
    }
    /* -------------------------------------------------------------- */
    /*  Private helpers                                                */
    /* -------------------------------------------------------------- */
    readLockfile() {
        try {
            const raw = fs.readFileSync(this.lockfilePath, "utf-8");
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && parsed.skills) {
                return parsed;
            }
        }
        catch {
            // Missing or corrupt — treat as empty
        }
        return { version: 1, skills: {} };
    }
    writeLockfile(data) {
        const dir = path.dirname(this.lockfilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.lockfilePath, JSON.stringify(data, null, 2), "utf-8");
    }
}
//# sourceMappingURL=skill-lock.js.map