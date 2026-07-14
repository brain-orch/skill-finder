export interface ActivationConfig {
    globalSkillsDir: string;
    projectSkillsDir: string;
    preApprovedCategories: string[];
}
export interface ActivationResult {
    success: boolean;
    skillName: string;
    path: string;
    message: string;
    requiresConsent: boolean;
}
//# sourceMappingURL=activation-types.d.ts.map