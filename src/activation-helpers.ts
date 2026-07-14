import * as fs from "node:fs";
import * as path from "node:path";
import { validateSkillName } from "./skill-name.js";
import { validateSkillContent } from "./validation/validator.js";
import { SkillLockManager } from "./cache/skill-lock.js";
import { ActivationConfig } from "./activation-types.js";

export interface UserConsent {
  approved: boolean;
  autoApproveFuture: boolean;
  showDetails: boolean;
}

/**
 * Place skill files from source to target directory.
 * Takes config as parameter instead of using this.config
 */
export function placeSkillFiles(
  config: ActivationConfig,
  skillName: string,
  sourcePath: string,
  targetDir: string,
): void {
  const safeSkillName = validateSkillName(skillName);
  const skillTargetDir = path.join(targetDir, safeSkillName);

  // Validate source SKILL.md before creating target directory
  const skillFile = path.join(sourcePath, 'SKILL.md');
  if (fs.existsSync(skillFile)) {
    const content = fs.readFileSync(skillFile, 'utf-8');
    const result = validateSkillContent(content, { name: skillName, marketplace: 'local' });
    if (!result.valid) {
      throw new Error(`Invalid skill content: ${result.errors.join(', ')}`);
    }
  }

  fs.mkdirSync(skillTargetDir, { recursive: true });

  // Get all files in source directory
  if (fs.existsSync(sourcePath) && fs.statSync(sourcePath).isDirectory()) {
    const files = fs.readdirSync(sourcePath);
    for (const file of files) {
      const srcFile = path.join(sourcePath, file);
      const destFile = path.join(skillTargetDir, file);
      fs.copyFileSync(srcFile, destFile);
    }
  } else if (fs.existsSync(sourcePath)) {
    // Source is a single file (e.g., SKILL.md)
    fs.copyFileSync(sourcePath, path.join(skillTargetDir, "SKILL.md"));
  }
}

/**
 * Lock an installed skill with a lockfile.
 * Takes config as parameter instead of using this.config
 */
export function lockInstalledSkill(
  skillName: string,
  skillPath: string,
): void {
  try {
    if (!fs.existsSync(skillPath)) return;
    const content = fs.readFileSync(skillPath, "utf-8");
    const lockManager = new SkillLockManager();
    lockManager.lockSkill(skillName, content, {
      installedAt: new Date().toISOString(),
      marketplace: "unknown",
    });
  } catch (err) {
    console.warn(
      "[skill-finder] lockfile write failed during activation:",
      err instanceof Error ? err.message : String(err),
    );
  }
}


