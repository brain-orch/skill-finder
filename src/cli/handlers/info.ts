import { marketplaceRegistry } from "../../registry/instance.js";
import { BOLD, RESET, SEP, HELP_TEXT } from "../format.js";
import type { SkillSearchResult } from "../../types.js";

export async function handleInfo(positional: string[]): Promise<void> {
  const identifier = positional.join(" ").trim();
  if (!identifier) {
    process.stderr.write("Error: info requires an identifier.\n\n");
    process.stdout.write(HELP_TEXT);
    process.exit(1);
  }

  let skill: SkillSearchResult | null = null;

  // Try to find adapter by marketplace prefix
  if (identifier.includes(":")) {
    const [marketplace, skillId] = identifier.split(":", 2);
    const adapter = marketplaceRegistry.getMarketplace(marketplace);
    if (adapter) {
      skill = await adapter.getSkillInfo(skillId);
    }
  }

  // Fallback: search all marketplaces
  if (!skill) {
    const results = await marketplaceRegistry.searchAll(identifier, { limit: 5 });
    skill = results.find((r) => r.id === identifier) ?? results[0] ?? null;
  }

  if (!skill) {
    process.stderr.write(`Skill '${identifier}' was not found in any marketplace.\n`);
    process.exit(1);
  }

  process.stdout.write(`${BOLD}${skill.name}${RESET}\n`);
  process.stdout.write(`${SEP}\n`);
  process.stdout.write(`  ID:          ${skill.id}\n`);
  process.stdout.write(`  Marketplace: ${skill.marketplace}\n`);
  process.stdout.write(`  Category:    ${skill.category ?? "\u2014"}\n`);
  process.stdout.write(`  Stars:       \u2b50 ${skill.stars}\n`);
  process.stdout.write(`  Installs:    ${skill.installCount}\n`);
  process.stdout.write(`  Description: ${skill.description}\n`);
  process.stdout.write(`  Triggers:    ${skill.triggers.join(", ") || "\u2014"}\n`);
  process.stdout.write(`  Install:     ${skill.installCommand}\n`);
  process.stdout.write(`  Homepage:    ${skill.homepageUrl}\n`);
  if (skill.verified) {
    process.stdout.write(`  Verified:    \u2705\n`);
  }
}
