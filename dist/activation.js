import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { validateSkillName } from "./skill-name.js";
import { validateSkillContent } from "./validation/validator.js";
import { SkillLockManager } from "./cache/skill-lock.js";
export class SkillActivator {
    config;
    warnedSessions = new Set();
    constructor(config) {
        this.config = config;
    }
    /**
     * Place a downloaded skill into the global or project skills directory.
     * Checks for conflicts before placement.
     */
    async activate(skillName, sourcePath, context) {
        const safeSkillName = validateSkillName(skillName);
        // 1. Check if already installed
        const alreadyInstalled = this.isAlreadyInstalled(safeSkillName);
        if (alreadyInstalled.installed) {
            return {
                success: false,
                skillName: safeSkillName,
                path: alreadyInstalled.location,
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
            this.lockInstalledSkill(safeSkillName, skillPath);
            return {
                success: true,
                skillName: safeSkillName,
                path: skillPath,
                message: "Activated",
                requiresConsent: false,
            };
        }
        // 4. Check if category is pre-approved
        const hasPreApproved = context.categories.some((cat) => this.isPreApproved(cat));
        if (hasPreApproved) {
            const targetDir = this.config.globalSkillsDir;
            this.placeSkillFiles(safeSkillName, sourcePath, targetDir);
            const skillPath = path.join(targetDir, safeSkillName, "SKILL.md");
            this.lockInstalledSkill(safeSkillName, skillPath);
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
    isAlreadyInstalled(skillName) {
        const safeSkillName = validateSkillName(skillName);
        const globalPath = path.join(this.config.globalSkillsDir, safeSkillName, "SKILL.md");
        if (fs.existsSync(globalPath)) {
            return { installed: true, location: globalPath };
        }
        const projectPath = path.join(this.config.projectSkillsDir, safeSkillName, "SKILL.md");
        if (fs.existsSync(projectPath)) {
            return { installed: true, location: projectPath };
        }
        return { installed: false };
    }
    /**
     * Detect conflicts: check ~/.claude/skills/ and .claude/skills/ for same-name skills
     */
    detectConflicts(skillName) {
        const safeSkillName = validateSkillName(skillName);
        const conflictPaths = [];
        // Check ~/.claude/skills/
        const homeClaudePath = path.join(os.homedir(), ".claude", "skills", safeSkillName);
        if (fs.existsSync(homeClaudePath)) {
            conflictPaths.push(homeClaudePath);
        }
        // Check .claude/skills/
        const cwdClaudePath = path.join(process.cwd(), ".claude", "skills", safeSkillName);
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
    isPreApproved(category) {
        return this.config.preApprovedCategories.includes(category);
    }
    /**
     * Get the path where a skill would be placed
     */
    getActivationPath(skillName, preferProject) {
        const safeSkillName = validateSkillName(skillName);
        if (preferProject) {
            return path.join(this.config.projectSkillsDir, safeSkillName, "SKILL.md");
        }
        return path.join(this.config.globalSkillsDir, safeSkillName, "SKILL.md");
    }
    /**
     * Place skill files from source to target directory.
     */
    placeSkillFiles(skillName, sourcePath, targetDir) {
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
        }
        else if (fs.existsSync(sourcePath)) {
            // Source is a single file (e.g., SKILL.md)
            fs.copyFileSync(sourcePath, path.join(skillTargetDir, "SKILL.md"));
        }
    }
    lockInstalledSkill(skillName, skillPath) {
        try {
            if (!fs.existsSync(skillPath))
                return;
            const content = fs.readFileSync(skillPath, "utf-8");
            const lockManager = new SkillLockManager();
            lockManager.lockSkill(skillName, content, {
                installedAt: new Date().toISOString(),
                marketplace: "unknown",
            });
        }
        catch {
            // Lockfile write failure should not block activation
        }
    }
    /**
     * Generate a consent prompt for the user.
     */
    generateConsentPrompt(skillName, details) {
        // This is a placeholder - in actual implementation, this would
        // trigger a UI prompt or callback
        return {
            approved: false,
            autoApproveFuture: false,
            showDetails: true,
        };
    }
}
//# sourceMappingURL=activation.js.map