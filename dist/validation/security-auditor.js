import { validateSkillContent } from "./validator.js";
export class SecurityAuditor {
    audit(skill) {
        const findings = [];
        // Combine relevant text for scanning
        const content = `${skill.description} ${skill.installCommand}`;
        const metadata = { name: skill.name, marketplace: skill.marketplace };
        // 1. Compose with existing validator
        const validation = validateSkillContent(content, metadata);
        // Map validation errors/warnings to findings
        for (const error of validation.errors) {
            if (error.includes("curl pipe") || error.includes("wget pipe") || error.includes("backtick") || error.includes("command substitution")) {
                findings.push({ type: "shell-injection", severity: "critical", description: error });
            }
            else if (error.includes("Path traversal")) {
                findings.push({ type: "path-traversal", severity: "high", description: error });
            }
            else if (!error.includes("Missing required field")) {
                findings.push({ type: "validation-error", severity: "medium", description: error });
            }
        }
        for (const warning of validation.warnings) {
            if (warning.includes("eval") || warning.includes("exec") || warning.includes("child_process")) {
                findings.push({ type: "code-execution", severity: "medium", description: warning });
            }
            else if (warning.includes("base64")) {
                findings.push({ type: "obfuscated-payload", severity: "low", description: warning });
            }
            else {
                findings.push({ type: "validation-warning", severity: "low", description: warning });
            }
        }
        // 2. Additional checks (obfuscated URLs, etc.)
        // Check for obfuscated URLs (e.g., using IP addresses or suspicious TLDs)
        if (/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(content)) {
            findings.push({ type: "obfuscated-url", severity: "medium", description: "Contains IP address instead of domain" });
        }
        // Scoring: -30 critical, -20 high, -10 medium, -5 low. Starting 100, floor 0.
        let score = 100;
        for (const finding of findings) {
            switch (finding.severity) {
                case "critical":
                    score -= 30;
                    break;
                case "high":
                    score -= 20;
                    break;
                case "medium":
                    score -= 10;
                    break;
                case "low":
                    score -= 5;
                    break;
            }
        }
        score = Math.max(0, score);
        // Severity level
        let severity = "clean";
        if (findings.some(f => f.severity === "critical"))
            severity = "critical";
        else if (findings.some(f => f.severity === "high"))
            severity = "high";
        else if (findings.some(f => f.severity === "medium"))
            severity = "medium";
        else if (findings.some(f => f.severity === "low"))
            severity = "low";
        return { score, severity, findings };
    }
}
//# sourceMappingURL=security-auditor.js.map