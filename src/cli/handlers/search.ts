import { marketplaceRegistry } from "../../registry/instance.js";
import { QualityScorer } from "../../scoring/quality.js";
import { BOLD, RESET, SEP, HELP_TEXT } from "../format.js";

const qualityScorer = new QualityScorer();

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "\u2026";
}

export async function handleSearch(positional: string[]): Promise<void> {
  const query = positional.join(" ").trim();
  if (!query) {
    process.stderr.write("Error: search requires a query.\n\n");
    process.stdout.write(HELP_TEXT);
    process.exit(1);
  }

  try {
    const results = await marketplaceRegistry.searchAll(query, { limit: 20 });

    if (results.length === 0) {
      process.stdout.write("No matching skills found.\n");
      return;
    }

    process.stdout.write(`${BOLD}Search Results for "${query}"${RESET}\n`);
    process.stdout.write(`${SEP}\n\n`);

    for (const item of results) {
      const desc = truncate(item.description, 120);
      const qScore = qualityScorer.score(item);
      const stars = item.stars ? `\u2b50${item.stars}` : "\u2b500";
      const installs = item.installCount ? `${item.installCount} installs` : "0 installs";
      const verified = item.verified ? " \u2705" : "";

      process.stdout.write(`${BOLD}${item.name}${RESET}${verified}\n`);
      process.stdout.write(`  ${desc}\n`);
      process.stdout.write(`  Quality: ${Math.round(qScore * 100)}% | ${stars} | ${installs} | ${item.marketplace}\n`);
      process.stdout.write(`  ID: ${item.id}\n`);
      process.stdout.write(`${SEP}\n\n`);
    }

    process.stdout.write(`${BOLD}Total: ${results.length} skills found${RESET}\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Search failed: ${message}\n`);
    process.exit(1);
  }
}
