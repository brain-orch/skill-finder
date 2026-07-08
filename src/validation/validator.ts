export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationMetadata {
  name: string;
  marketplace: string;
}

export function validateSkillContent(content: string, metadata: ValidationMetadata): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Metadata completeness — check parsed object
  // We receive raw content string. Check for required fields in the content text.
  const hasName = /name:\s*['"]?[a-zA-Z]/.test(content);  // YAML "name: something"
  const hasDescription = /description:\s*['"]?[a-zA-Z]/.test(content);
  const hasTags = /tags:\s*\n/.test(content) || /tags:\s*\[/.test(content);
  if (!hasName) errors.push("Missing required field: name");
  if (!hasDescription) errors.push("Missing required field: description");
  if (!hasTags) errors.push("Missing required field: tags");

  // 2. Shell injection patterns (ReDoS-safe, no nested quantifiers)
  const curlBash = /curl\s+\S*\s*\|\s*(bash|sh)/i;
  const wgetSh = /wget\s+\S*\s*\|\s*(bash|sh)/i;
  if (curlBash.test(content)) errors.push("Suspicious install command: curl pipe to shell");
  if (wgetSh.test(content)) errors.push("Suspicious install command: wget pipe to shell");
  if (content.includes('`')) errors.push("Suspicious backtick execution detected");
  if (/\$\(/.test(content)) errors.push("Suspicious command substitution detected");

  // 3. Path traversal
  if (content.includes('../') || content.includes('..\\')) {
    errors.push("Path traversal detected");
  }

  // 4. Suspicious patterns (warning only)
  if (content.includes('eval(')) warnings.push("Contains eval() — possible code execution");
  if (content.includes('exec(')) warnings.push("Contains exec() — possible code execution");
  if (content.includes("require('child_process')") || content.includes('require("child_process")')) {
    warnings.push("Contains child_process require — possible system access");
  }
  if (/[A-Za-z0-9+/]{40,}={0,2}/.test(content)) {
    warnings.push("Contains potential base64-encoded payload");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
