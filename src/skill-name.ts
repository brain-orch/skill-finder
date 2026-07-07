import * as path from "node:path";

export function getSkillNameFromIdentifier(identifier: string): string {
  const name = identifier.split(":").pop() ?? identifier;
  return validateSkillName(name);
}

export function validateSkillName(name: string): string {
  if (
    name.length === 0 ||
    name === "." ||
    name === ".." ||
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("\0") ||
    path.isAbsolute(name)
  ) {
    throw new Error(`Invalid skill name: ${name}`);
  }

  return name;
}
