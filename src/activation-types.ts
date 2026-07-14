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