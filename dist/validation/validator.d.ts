export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export interface ValidationMetadata {
    name: string;
    marketplace: string;
}
export declare function validateSkillContent(content: string, metadata: ValidationMetadata): ValidationResult;
//# sourceMappingURL=validator.d.ts.map