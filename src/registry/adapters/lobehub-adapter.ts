import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { SkillSearchResult, SkillMarketplace } from "../../types.js";
import { validateSlug } from "../../safe-slug.js";

interface LobeHubItem {
  identifier?: string;
  name: string;
  description: string;
  author?: string;
  category?: string;
  version?: string;
  installCount?: number;
  ratingCount?: number;
  isFeatured?: boolean;
  github?: { url?: string };
}

interface LobeHubCliResponse {
  items: LobeHubItem[];
}

export class LobeHubMarketplace implements SkillMarketplace {
  readonly name = "lobehub";

  async search(
    query: string,
    options?: { category?: string; limit?: number; signal?: AbortSignal },
  ): Promise<SkillSearchResult[]> {
    if (!query) return [];

    try {
      const result = spawnSync("npx", ["-y", "@lobehub/market-cli", "skills", "search", "--q", query, "--output", "json"], {
        encoding: "utf-8",
        timeout: 15_000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      if (result.status !== 0) return [];
      const output = result.stdout;

      const parsed: LobeHubCliResponse = JSON.parse(output);
      const items = Array.isArray(parsed.items) ? parsed.items : [];

      let results: SkillSearchResult[] = items.map((item) => ({
        id: `lobehub:${item.name}`,
        name: item.name,
        description: item.description,
        marketplace: "lobehub" as const,
        category: item.category ?? null,
        triggers: [],
        installCount: item.installCount ?? 0,
        stars: item.ratingCount ?? 0,
        installCommand: `npx -y @lobehub/market-cli skills install ${item.name} --agent codex`,
        homepageUrl: item.github?.url ?? `https://lobehub.com/skills/${item.name}`,
        verified: item.isFeatured ?? false,
      }));

      if (options?.category) {
        const cat = options.category.toLowerCase();
        results = results.filter(
          (r) => r.category?.toLowerCase() === cat,
        );
      }

      if (options?.limit !== undefined) {
        results = results.slice(0, options.limit);
      }

      return results;
    } catch {
      return [];
    }
  }

  async getSkillInfo(identifier: string): Promise<SkillSearchResult | null> {
    if (!identifier) return null;

    const results = await this.search(identifier);
    return results.find((r) => r.id === identifier) ?? null;
  }

  async install(
    identifier: string,
    targetDir: string,
  ): Promise<{ path: string; files: string[] }> {
    const result = spawnSync("npx", ["-y", "@lobehub/market-cli", "skills", "install", identifier, "--agent", "codex"], {
      encoding: "utf-8",
      timeout: 30_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (result.status !== 0) {
      throw new Error(`Failed to install skill "${identifier}"`);
    }

    const name = identifier.startsWith("lobehub:") ? identifier.slice("lobehub:".length) : identifier;
    validateSlug(name);
    const skillDir = path.join(targetDir, "lobehub", name);
    fs.mkdirSync(skillDir, { recursive: true });

    const files = ["SKILL.md"];
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      `# ${identifier}\n\nInstalled from LobeHub marketplace.\n`,
      "utf-8",
    );

    return { path: skillDir, files };
  }

  isAvailable(): boolean {
    return true;
  }
}
