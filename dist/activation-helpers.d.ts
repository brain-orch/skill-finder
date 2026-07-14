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
export declare function placeSkillFiles(config: ActivationConfig, skillName: string, sourcePath: string, targetDir: string): void;
/**
 * Lock an installed skill with a lockfile.
 * Takes config as parameter instead of using this.config
 */
export declare function lockInstalledSkill(skillName: string, skillPath: string): void;
//# sourceMappingURL=activation-helpers.d.ts.map