import { z } from "zod";
import { tool } from "@opencode-ai/plugin";
import { SkillFinderError, ErrorCode } from "../error.js";
import { marketplaceRegistry } from "../registry/instance.js";
import { QualityScorer } from "../scoring/quality.js";
import { TrustScorer } from "../scoring/trust-scorer.js";
import { SecurityAuditor } from "../validation/security-auditor.js";
import type { SkillIndexer } from "../cache/indexer.js";
import type { ScanResult } from "../scanner/project-scanner.js";

const qualityScorer = new QualityScorer();
const trustScorer = new TrustScorer();
const securityAuditor = new SecurityAuditor();

let sharedIndexer: SkillIndexer | null = null;

export function setSearchIndexer(indexer: SkillIndexer | null): void {
  sharedIndexer = indexer;
}

let sharedScanResult: ScanResult | null = null;

/**
 * Provide the latest project scan result so the search tool can
 * auto-expand queries with detected stack names.
 */
export function setScanResult(result: ScanResult | null): void {
  sharedScanResult = result;
}

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

    // Build search queries: original + detected stack names from project scan
    const queries: string[] = [query];
    if (sharedScanResult?.detectedStacks?.length) {
      for (const stack of sharedScanResult.detectedStacks) {
        if (!queries.includes(stack.name)) {
          queries.push(stack.name);
        }
      }
    }

    try {
      const allResults: Awaited<ReturnType<typeof marketplaceRegistry.searchAll>> = [];
      for (const q of queries) {
        const results = await marketplaceRegistry.searchAll(q, {
          limit,
          category: args.category,
          signal: _ctx.abort,
        });
        allResults.push(...results);
      }

      // Deduplicate by id
      const seen = new Set<string>();
      const results = allResults.filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });

      if (results.length === 0) {
        return "No matching skills found.";
      }

      if (sharedIndexer) {
        for (const result of results) {
          sharedIndexer.markUsed(result.id);
        }
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
          
          const securityResult = securityAuditor.audit(item);
          const trustResult = trustScorer.score(item, securityResult.score);
          const hasContent = item.description || item.installCommand;
          const securityBadge = hasContent ? `🔒 ${securityResult.severity}` : "🔒 not scanned";
          const trustBadge = `🛡️ Grade ${trustResult.grade}`;
          
          let prefix = "";
          if (trustResult.grade === "A" && securityResult.severity === "clean") {
            prefix = "✅ Fully Trusted ";
          }
          
          lines.push(`- ${prefix}**${item.name}** — ${item.description} (${stars} · ${trustBadge} · ${securityBadge})`);
          const qScore = qualityScorer.score(item);
          lines.push(`  - Quality: ${Math.round(qScore * 100)}% | Trust: ${trustResult.label}`);
          lines.push(`  - ID: \`${item.id}\` | [View](${item.homepageUrl})`);
        }
        lines.push("");
      }

      lines.push(`**Total: ${results.length} skills found** (showing top ${limit})`);

      return lines.join("\n");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[skill-finder] search failed:", message);
      throw new SkillFinderError(
        "Search failed. All marketplaces returned errors. Please try again later.",
        ErrorCode.NETWORK,
        err,
      );
    }
  },
});
