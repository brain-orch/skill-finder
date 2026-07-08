import { z } from "zod";
import { tool } from "@opencode-ai/plugin";
import { marketplaceRegistry } from "../registry/instance.js";
import { QualityScorer } from "../scoring/quality.js";

const qualityScorer = new QualityScorer();

const searchArgsSchema = z.object({
  query: z.string().describe("Search query (required)"),
  category: z.string().optional().describe("Filter by category (optional)"),
  limit: z.number().int().optional().describe("Max results 1-50 (default 5)"),
});

export const searchTool = tool({
  description: "Search for skills across all marketplaces",
  args: searchArgsSchema.shape,
  async execute(args, _ctx) {
    const query = args.query.trim();
    if (!query) {
      return "❌ Error: query is required and must be non-empty.";
    }

    const limit = args.limit ?? 5;
    if (limit < 1 || limit > 50) {
      return "❌ Error: limit must be between 1 and 50.";
    }

    try {
      const results = await marketplaceRegistry.searchAll(query, {
        limit,
        category: args.category,
        signal: _ctx.abort,
      });

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

      const lines: string[] = [`## Search Results for "${query}"`, ""];

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
    } catch {
      return "Search failed. All marketplaces returned errors.";
    }
  },
});
