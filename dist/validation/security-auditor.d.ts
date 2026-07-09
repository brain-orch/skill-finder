import type { SkillSearchResult } from "../types.js";
export interface SecurityFinding {
    type: string;
    severity: "critical" | "high" | "medium" | "low";
    description: string;
}
export interface SecurityAuditResult {
    score: number;
    severity: "critical" | "high" | "medium" | "low" | "clean";
    findings: SecurityFinding[];
}
export declare class SecurityAuditor {
    audit(skill: SkillSearchResult): SecurityAuditResult;
}
//# sourceMappingURL=security-auditor.d.ts.map