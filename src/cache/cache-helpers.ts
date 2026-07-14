import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

export interface CachedSkillInfo {
  id: string;
  name: string;
  marketplace: string;
  filePath: string;
  installedAt: string;
  sizeBytes: number;
  skillHash: string;
}

export function skillFileExists(dir: string, name: string): boolean {
  return fs.existsSync(path.join(dir, name, "SKILL.md"));
}

export function scanDir(dir: string, out: CachedSkillInfo[]): void {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillFile = path.join(dir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillFile)) continue;

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

export function sumSize(dir: string): number {
  if (!fs.existsSync(dir)) return 0;

  let total = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillFile = path.join(dir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillFile)) {
      continue;
    }
    total += fs.statSync(skillFile).size;
  }
  return total;
}

export function checkQuota(
  currentBytes: number,
  maxSizeMb: number,
): {
  withinQuota: boolean;
  currentSizeMb: number;
  maxSizeMb: number;
} {
  const currentSizeMb = currentBytes / (1024 * 1024);

  return {
    withinQuota: currentSizeMb <= maxSizeMb,
    currentSizeMb: Math.round(currentSizeMb * 10000) / 10000,
    maxSizeMb,
  };
}
