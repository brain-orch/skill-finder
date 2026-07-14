import { ActivationConfig, ActivationResult } from "./activation-types.js";
import { UserConsent } from "./activation-helpers.js";
export type { ActivationConfig, ActivationResult } from "./activation-types.js";
export { UserConsent } from "./activation-helpers.js";
export declare class SkillActivator {
    private config;
    private warnedSessions;
    constructor(config: ActivationConfig);
    /**
     * Place a downloaded skill into the global or project skills directory.
     * Checks for conflicts before placement.
     */
    activate(skillName: string, sourcePath: string, context: {
        categories: string[];
        userConsent?: UserConsent;
    }): Promise<ActivationResult>;
    /**
     * Check if skill is already installed in either global or project dirs.
     */
    isAlreadyInstalled(skillName: string): {
        installed: boolean;
        location?: string;
    };
    /**
     * Detect conflicts: check ~/.claude/skills/ and .claude/skills/ for same-name skills
     */
    detectConflicts(skillName: string): {
        hasConflict: boolean;
        conflictPaths: string[];
    };
    /**
     * Check if a category is pre-approved for auto-activation
     */
    isPreApproved(category: string): boolean;
    /**
     * Get the path where a skill would be placed
     */
    getActivationPath(skillName: string, preferProject?: boolean): string;
    /**
     * Generate a consent prompt for the user.
     */
    generateConsentPrompt(skillName: string, details: {
        description: string;
        category: string;
    }): UserConsent;
}
//# sourceMappingURL=activation.d.ts.map