import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { validateSkillName } from "./skill-name.js";

export interface ActivationConfig {
  globalSkillsDir: string; // ~/.config/opencode/skills/
  projectSkillsDir: string; // .opencode/skills/
  preApprovedCategories: string[];
}

export interface ActivationResult {
  success: boolean;
  skillName: string;
  path: string;
  message: string;
  requiresConsent: boolean;
}

export interface UserConsent {
  approved: boolean;
  autoApproveFuture: boolean;
  showDetails: boolean;
}

export class SkillActivator {
  private config: ActivationConfig;
  private warnedSessions: Set<string> = new Set();

  constructor(config: ActivationConfig) {
    this.config = config;
  }

  /**
   * Place a downloaded skill into the global or project skills directory.
   * Checks for conflicts before placement.
   */
  async activate(
    skillName: string,
    sourcePath: string,
    context: { categories: string[]; userConsent?: UserConsent },
  ): Promise<ActivationResult> {
    const safeSkillName = validateSkillName(skillName);

    // 1. Check if already installed
    const alreadyInstalled = this.isAlreadyInstalled(safeSkillName);
    if (alreadyInstalled.installed) {
      return {
        success: false,
        skillName: safeSkillName,
        path: alreadyInstalled.location!,
        message: "Already installed",
        requiresConsent: false,
      };
    }

    // 2. Check for conflicts
    const conflicts = this.detectConflicts(safeSkillName);
    if (conflicts.hasConflict) {
      const conflictPath = conflicts.conflictPaths[0];
      const warnKey = `${safeSkillName}:${conflictPath}`;
      if (!this.warnedSessions.has(warnKey)) {
        this.warnedSessions.add(warnKey);
      }
      return {
        success: false,
        skillName: safeSkillName,
        path: conflictPath,
        message: `Conflict detected at ${conflictPath}`,
        requiresConsent: true,
      };
    }

    // 3. Check if user consent is provided and approved
    if (context.userConsent?.approved) {
      const targetDir = this.config.projectSkillsDir;
      this.placeSkillFiles(safeSkillName, sourcePath, targetDir);
      const skillPath = path.join(targetDir, safeSkillName, "SKILL.md");
      return {
        success: true,
        skillName: safeSkillName,
        path: skillPath,
        message: "Activated",
        requiresConsent: false,
      };
    }

    // 4. Check if category is pre-approved
    const hasPreApproved = context.categories.some((cat) =>
      this.isPreApproved(cat),
    );
    if (hasPreApproved) {
      const targetDir = this.config.globalSkillsDir;
      this.placeSkillFiles(safeSkillName, sourcePath, targetDir);
      const skillPath = path.join(targetDir, safeSkillName, "SKILL.md");
      return {
        success: true,
        skillName: safeSkillName,
        path: skillPath,
        message: "Activated",
        requiresConsent: false,
      };
    }

    // 5. Requires consent
    return {
      success: false,
      skillName: safeSkillName,
      path: "",
      message: `Skill '${safeSkillName}' found. Load it?`,
      requiresConsent: true,
    };
  }

  /**
   * Check if skill is already installed in either global or project dirs.
   */
  isAlreadyInstalled(skillName: string): {
    installed: boolean;
    location?: string;
  } {
    const safeSkillName = validateSkillName(skillName);
    const globalPath = path.join(
      this.config.globalSkillsDir,
      safeSkillName,
      "SKILL.md",
    );
    if (fs.existsSync(globalPath)) {
      return { installed: true, location: globalPath };
    }

    const projectPath = path.join(
      this.config.projectSkillsDir,
      safeSkillName,
      "SKILL.md",
    );
    if (fs.existsSync(projectPath)) {
      return { installed: true, location: projectPath };
    }

    return { installed: false };
  }

  /**
   * Detect conflicts: check ~/.claude/skills/ and .claude/skills/ for same-name skills
   */
  detectConflicts(skillName: string): {
    hasConflict: boolean;
    conflictPaths: string[];
  } {
    const safeSkillName = validateSkillName(skillName);
    const conflictPaths: string[] = [];

    // Check ~/.claude/skills/
    const homeClaudePath = path.join(
      os.homedir(),
      ".claude",
      "skills",
      safeSkillName,
    );
    if (fs.existsSync(homeClaudePath)) {
      conflictPaths.push(homeClaudePath);
    }

    // Check .claude/skills/
    const cwdClaudePath = path.join(
      process.cwd(),
      ".claude",
      "skills",
      safeSkillName,
    );
    if (fs.existsSync(cwdClaudePath)) {
      conflictPaths.push(cwdClaudePath);
    }

    return {
      hasConflict: conflictPaths.length > 0,
      conflictPaths,
    };
  }

  /**
   * Check if a category is pre-approved for auto-activation
   */
  isPreApproved(category: string): boolean {
    return this.config.preApprovedCategories.includes(category);
  }

  /**
   * Get the path where a skill would be placed
   */
  getActivationPath(skillName: string, preferProject?: boolean): string {
    const safeSkillName = validateSkillName(skillName);
    if (preferProject) {
      return path.join(this.config.projectSkillsDir, safeSkillName, "SKILL.md");
    }
    return path.join(this.config.globalSkillsDir, safeSkillName, "SKILL.md");
  }

  /**
   * Place skill files from source to target directory.
   */
  private placeSkillFiles(
    skillName: string,
    sourcePath: string,
    targetDir: string,
  ): void {
    const safeSkillName = validateSkillName(skillName);
    const skillTargetDir = path.join(targetDir, safeSkillName);
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
   * Generate a consent prompt for the user.
   */
  generateConsentPrompt(
    skillName: string,
    details: { description: string; category: string },
  ): UserConsent {
    // This is a placeholder - in actual implementation, this would
    // trigger a UI prompt or callback
    return {
      approved: false,
      autoApproveFuture: false,
      showDetails: true,
    };
  }
}
