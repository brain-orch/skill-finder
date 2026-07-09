import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { SKILLS_DIR } from "../constants.js";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface LockMetadata {
  installedAt: string; // ISO date
  version?: string; // version string if available
  marketplace: string;
  versionRange?: string; // Semver range (e.g., "^1.0.0", ">=2.0.0 <3.0.0")
  changelog?: string; // URL or "unknown"
  breaking?: boolean; // Whether latest update is breaking
  dependencies?: string[]; // Skill IDs this skill depends on
}

export interface LockedSkill {
  identifier: string;
  installedAt: string;
  contentHash: string; // "sha256-<hex>"
  version?: string;
  marketplace: string;
  lastChecked: string; // ISO date
  targets: string[]; // Relative paths where skill is installed (e.g., [".opencode/skills", ".claude/skills"])
  versionRange?: string; // Semver range (e.g., "^1.0.0", ">=2.0.0 <3.0.0")
  changelog?: string; // URL or "unknown"
  breaking?: boolean; // Whether latest update is breaking
  dependencies?: string[]; // Skill IDs this skill depends on
}

export interface UpdateCheckResult {
  identifier: string;
  hasUpdate: boolean;
  currentHash: string;
  newHash?: string;
  checkedAt: string;
  breaking?: boolean;
}

interface LockfileData {
  version: number;
  skills: Record<string, LockedSkill>;
}

/* ------------------------------------------------------------------ */
/*  SkillLockManager                                                   */
/* ------------------------------------------------------------------ */

export class SkillLockManager {
  private lockfilePath: string;
  private skillsDir: string;

  constructor(baseDir?: string) {
    const base = baseDir ?? process.cwd();
    this.lockfilePath = path.join(base, ".opencode", "skill-finder-lock.json");
    this.skillsDir = path.join(base, SKILLS_DIR);
  }

  /**
   * Compute SHA-256 hash of content string, prefixed with "sha256-".
   */
  static computeHash(content: string): string {
    const hash = crypto.createHash("sha256").update(content, "utf-8").digest("hex");
    return `sha256-${hash}`;
  }

  /**
   * Lock a skill: compute SHA-256 of content and save to lockfile.
   */
  lockSkill(
    identifier: string,
    content: string,
    metadata: LockMetadata,
    targets: string[] = [],
  ): void {
    const data = this.readLockfile();
    const now = new Date().toISOString();

    // Merge targets: keep existing targets + add new ones (deduplicate)
    const existingTargets = data.skills[identifier]?.targets ?? [];
    const mergedTargets = [...new Set([...existingTargets, ...targets])];

    data.skills[identifier] = {
      identifier,
      installedAt: metadata.installedAt,
      contentHash: SkillLockManager.computeHash(content),
      version: metadata.version ?? "0.0.0",
      marketplace: metadata.marketplace,
      lastChecked: now,
      targets: mergedTargets,
      versionRange: metadata.versionRange,
      changelog: metadata.changelog,
      breaking: metadata.breaking,
      dependencies: metadata.dependencies,
    };

    this.writeLockfile(data);
  }

  /**
   * Unlock a skill: remove from lockfile.
   */
  unlockSkill(identifier: string): void {
    const data = this.readLockfile();
    delete data.skills[identifier];
    this.writeLockfile(data);
  }

  /**
   * Check if a skill has updates by comparing content hashes.
   */
  async checkForUpdates(
    identifier: string,
    newContent: string,
  ): Promise<UpdateCheckResult> {
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
      breaking: locked.breaking,
    };
  }

  /**
   * Return all locked skills.
   */
  getLockedSkills(): LockedSkill[] {
    const data = this.readLockfile();
    return Object.values(data.skills);
  }

  /**
   * Return skills not checked in N days (default 7).
   */
  getStaleSkills(days: number = 7): LockedSkill[] {
    const now = Date.now();
    const thresholdMs = days * 24 * 60 * 60 * 1000;
    const data = this.readLockfile();

    return Object.values(data.skills).filter((skill) => {
      const lastChecked = new Date(skill.lastChecked).getTime();
      return now - lastChecked > thresholdMs;
    });
  }

  /**
   * Get version of a locked skill.
   */
  getSkillVersion(identifier: string): string | null {
    const data = this.readLockfile();
    const skill = data.skills[identifier];
    return skill?.version ?? null;
  }

  /**
   * Get dependencies of a locked skill.
   */
  getDependencies(identifier: string): string[] {
    const data = this.readLockfile();
    const skill = data.skills[identifier];
    return skill?.dependencies ?? [];
  }

  /**
   * Scan all locked skills and return status with breaking changes flagged.
   */
  async checkAll(): Promise<UpdateCheckResult[]> {
    const lockedSkills = this.getLockedSkills();
    const now = new Date().toISOString();

    return lockedSkills.map((skill) => ({
      identifier: skill.identifier,
      hasUpdate: false,
      currentHash: skill.contentHash,
      checkedAt: now,
      breaking: skill.breaking,
    }));
  }

  /**
   * Rebuild lockfile from filesystem by scanning installed skills
   * and re-hashing their SKILL.md files.
   */
  rebuild(): void {
    const data: LockfileData = { version: 1, skills: {} };

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
        if (!fs.existsSync(skillFile)) continue;

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

  private readLockfile(): LockfileData {
    try {
      const raw = fs.readFileSync(this.lockfilePath, "utf-8");
      const parsed = JSON.parse(raw) as LockfileData;
      if (parsed && typeof parsed === "object" && parsed.skills) {
        return parsed;
      }
    } catch {
      // Missing or corrupt — treat as empty
    }
    return { version: 1, skills: {} };
  }

  private writeLockfile(data: LockfileData): void {
    const dir = path.dirname(this.lockfilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.lockfilePath, JSON.stringify(data, null, 2), "utf-8");
  }
}
