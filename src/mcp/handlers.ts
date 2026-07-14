import { marketplaceRegistry } from "../registry/instance.js";
import { QualityScorer } from "../scoring/quality.js";

const qualityScorer = new QualityScorer();

// ---------------------------------------------------------------------------
// Tool Implementations
// ---------------------------------------------------------------------------

export async function handleSearchSkills(params: Record<string, unknown>): Promise<string> {
  const query = params.query;
  if (typeof query !== "string" || query.trim().length === 0) {
    throw new Error("query is required and must be non-empty");
  }

  const limit = typeof params.limit === "number" ? params.limit : 5;
  if (limit < 1 || limit > 50) {
    throw new Error("limit must be between 1 and 50");
  }

  const category = typeof params.category === "string" ? params.category : undefined;

  const results = await marketplaceRegistry.searchAll(query.trim(), { limit, category });

  if (results.length === 0) {
    return "No matching skills found.";
  }

  // Group by marketplace
  const byMarketplace = new Map<string, typeof results>();
  for (const r of results) {
    if (!byMarketplace.has(r.marketplace)) {
      byMarketplace.set(r.marketplace, []);
    }
    byMarketplace.get(r.marketplace)!.push(r);
  }

  const lines: string[] = [`## Search Results for "${query.trim()}"`, ""];

  for (const [marketplace, items] of byMarketplace) {
    lines.push(`### 📦 ${marketplace} (${items.length} results)`);
    for (const item of items) {
      const stars = item.stars ? `⭐${item.stars}` : "⭐0";
      const installs = item.installCount ? `${item.installCount} installs` : "0 installs";
      lines.push(`- **${item.name}** — ${item.description} (${stars} · ${installs})`);
      const qScore = qualityScorer.score(item);
      lines.push(`  - Quality: ${Math.round(qScore * 100)}%`);
      lines.push(`  - ID: \`${item.id}\` | [View](${item.homepageUrl})`);
    }
    lines.push("");
  }

  lines.push(`**Total: ${results.length} skills found** (showing top ${limit})`);

  return lines.join("\n");
}

export async function handleRecommendSkills(params: Record<string, unknown>): Promise<string> {
  const context = params.context;
  if (typeof context !== "string" || context.trim().length === 0) {
    throw new Error("context is required and must be non-empty");
  }

  // Simple keyword-based recommendation
  const query = context.trim();
  const results = await marketplaceRegistry.searchAll(query, { limit: 5 });

  if (results.length === 0) {
    return "No skills found matching your context.";
  }

  const lines: string[] = [`## Recommended Skills for "${query}"`, ""];

  for (const skill of results) {
    const stars = skill.stars ? `⭐${skill.stars}` : "⭐0";
    const qScore = qualityScorer.score(skill);
    lines.push(`- **${skill.name}** (${skill.marketplace}) — ${skill.description}`);
    lines.push(`  - Quality: ${Math.round(qScore * 100)}% | ${stars}`);
    lines.push(`  - ID: \`${skill.id}\``);
  }

  return lines.join("\n");
}

export async function handleSkillInfo(params: Record<string, unknown>): Promise<string> {
  const identifier = params.identifier;
  if (typeof identifier !== "string" || identifier.trim().length === 0) {
    throw new Error("identifier is required and must be non-empty");
  }

  let skill = null;

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
    return `## ❌ Skill Not Found\nSkill '${identifier}' was not found in any marketplace.`;
  }

  const rows: string[] = [
    `## ${skill.name}`,
    "",
    "| Field | Value |",
    "|---|---|",
    `| **ID** | \`${skill.id}\` |`,
    `| **Marketplace** | ${skill.marketplace} |`,
    `| **Category** | ${skill.category ?? "—"} |`,
    `| **Stars** | ⭐ ${skill.stars} |`,
    `| **Installs** | ${skill.installCount} |`,
    `| **Description** | ${skill.description} |`,
    `| **Triggers** | ${skill.triggers.join(", ") || "—"} |`,
    `| **Install** | \`${skill.installCommand}\` |`,
    `| **Homepage** | [${skill.homepageUrl}](${skill.homepageUrl}) |`,
  ];

  if (skill.verified) {
    rows.push("| **Verified** | ✅ Verified |");
  }

  return rows.join("\n");
}

export async function handleInstallSkill(params: Record<string, unknown>): Promise<string> {
  const identifier = params.identifier;
  if (typeof identifier !== "string" || identifier.trim().length === 0) {
    throw new Error("identifier is required and must be non-empty");
  }

  const marketplace = params.marketplace;
  if (typeof marketplace !== "string" || marketplace.trim().length === 0) {
    throw new Error("marketplace is required and must be non-empty");
  }

  const adapter = marketplaceRegistry.getMarketplace(marketplace);
  if (!adapter) {
    return `## ❌ Unknown Marketplace\nMarketplace '${marketplace}' is not available. Available: ${marketplaceRegistry.listAvailable().join(", ")}`;
  }

  const targetDir = process.cwd();
  try {
    const result = await adapter.install(identifier.trim(), targetDir);
    return [
      `## ✅ Installed ${identifier}`,
      `- **Path:** ${result.path}`,
      `- **Files:** ${result.files.join(", ")}`,
      `- **Marketplace:** ${marketplace}`,
    ].join("\n");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `## ❌ Installation Failed\n${message}`;
  }
}

// ---------------------------------------------------------------------------
// Tool Dispatcher
// ---------------------------------------------------------------------------

export async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "search_skills":
      return handleSearchSkills(args);
    case "recommend_skills":
      return handleRecommendSkills(args);
    case "skill_info":
      return handleSkillInfo(args);
    case "install_skill":
      return handleInstallSkill(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
