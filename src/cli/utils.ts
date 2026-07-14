import * as fs from "node:fs";
import * as path from "node:path";

export interface SkillEntry {
  name: string;
  description: string;
}

export function readSkillsFromDir(baseDir: string, marketplace?: string): SkillEntry[] {
  if (!fs.existsSync(baseDir)) return [];

  const marketplaces = marketplace
    ? [marketplace]
    : fs.readdirSync(baseDir).filter((d) => {
        const full = path.join(baseDir, d);
        return fs.statSync(full).isDirectory();
      });

  const skills: SkillEntry[] = [];

  for (const mp of marketplaces) {
    const mpDir = path.join(baseDir, mp);
    if (!fs.existsSync(mpDir) || !fs.statSync(mpDir).isDirectory()) continue;

    const skillDirs = fs.readdirSync(mpDir).filter((d) => {
      const full = path.join(mpDir, d);
      return fs.statSync(full).isDirectory();
    });

    for (const skill of skillDirs) {
      const skillDir = path.join(mpDir, skill);
      const skillMdPath = path.join(skillDir, "SKILL.md");
      let description = "";
      if (fs.existsSync(skillMdPath)) {
        const content = fs.readFileSync(skillMdPath, "utf-8");
        const firstLine = content.split("\n").find((l) => l.trim().length > 0);
        if (firstLine) {
          description = firstLine.replace(/^#+\s*/, "").trim();
        }
      }
      skills.push({ name: `${mp}:${skill}`, description });
    }
  }

  return skills;
}
