import * as fs from "node:fs";
import * as path from "node:path";
import type { LockedSkill } from "../cache/lock-types.js";

export interface SkillInfo {
  identifier: string;
  marketplace: string;
  skillName: string;
  trustGrade: string;
}

export class SkillUsageTracker {
  private baseDir: string;
  private pathMap: Map<string, SkillInfo> | null = null;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? process.cwd();
  }

  loadInstalledSkills(): SkillInfo[] {
    const lockfilePath = path.join(this.baseDir, ".opencode", "skill-finder-lock.json");
    try {
      const raw = fs.readFileSync(lockfilePath, "utf-8");
      const parsed = JSON.parse(raw) as { version: number; skills: Record<string, LockedSkill> };
      if (!parsed?.skills) return [];

      return Object.values(parsed.skills).map((skill) => ({
        identifier: skill.identifier,
        marketplace: skill.marketplace,
        skillName: skill.identifier.includes(":") ? skill.identifier.split(":")[1] : skill.identifier,
        trustGrade: skill.trustGrade ?? "N/A",
      }));
    } catch {
      return [];
    }
  }

  buildPathMap(): Map<string, SkillInfo> {
    if (this.pathMap) return this.pathMap;

    const skills = this.loadInstalledSkills();
    this.pathMap = new Map();

    for (const skill of skills) {
      // Expected path: .opencode/skills/<marketplace>/<skillName>/SKILL.md
      const skillPath = path.join(
        this.baseDir,
        ".opencode",
        "skills",
        skill.marketplace,
        skill.skillName,
        "SKILL.md",
      );
      // Store both forward-slash and OS-native paths for matching
      const normalizedPath = skillPath.split(path.sep).join("/");
      this.pathMap.set(normalizedPath, skill);
    }

    return this.pathMap;
  }

  detect(filePath: string): SkillInfo | null {
    const map = this.buildPathMap();
    // Normalize the incoming path
    const normalized = filePath.split(path.sep).join("/");

    // Direct match
    const direct = map.get(normalized);
    if (direct) return direct;

    // Check if any map key is a suffix of the normalized path
    // (handles cases where agent passes relative vs absolute paths)
    for (const [key, info] of map) {
      if (normalized.endsWith(key) || key.endsWith(normalized)) {
        return info;
      }
    }

    return null;
  }

  formatDisplay(info: SkillInfo): string {
    return `📖 Using skill: ${info.skillName} (${info.marketplace} · Trust Grade ${info.trustGrade})`;
  }
}
