import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { SkillSearchResult, SkillMarketplace } from "../../types.js";

interface ClawHubSkill {
  slug: string;
  owner: string;
  name: string;
  description: string;
  downloads: number;
  stars: number;
  category: string;
  verified?: boolean;
}

export class ClawHubMarketplace implements SkillMarketplace {
  readonly name = "clawhub" as const;

  async search(
    query: string,
    options?: { category?: string; limit?: number; signal?: AbortSignal },
  ): Promise<SkillSearchResult[]> {
    if (!query) return [];

    const limit = options?.limit ?? 20;

    try {
      const url = `https://clawhub.ai/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}&nonSuspiciousOnly=true`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": "skill-finder/1.0",
          Accept: "application/json",
        },
        signal: options?.signal,
      });

      if (!response.ok) return [];

      const json = (await response.json()) as ClawHubSkill[];

      if (!Array.isArray(json)) return [];

      let results: SkillSearchResult[] = json.map((skill) => ({
        id: `clawhub:${skill.owner}/${skill.slug}`,
        name: skill.name || skill.slug,
        description: skill.description,
        marketplace: "clawhub" as const,
        category: skill.category || null,
        triggers: [query],
        installCount: skill.downloads || 0,
        stars: skill.stars || 0,
        installCommand: `clawhub install @${skill.owner}/${skill.slug}`,
        homepageUrl: `https://clawhub.ai/skills/${skill.slug}`,
        verified: skill.verified ?? false,
      }));

      if (options?.category) {
        const cat = options.category.toLowerCase();
        results = results.filter(
          (r) => r.category?.toLowerCase() === cat,
        );
      }

      return results.slice(0, limit);
    } catch {
      return [];
    }
  }

  async getSkillInfo(identifier: string): Promise<SkillSearchResult | null> {
    try {
      // Strip "clawhub:" prefix if present
      const raw = identifier.startsWith("clawhub:")
        ? identifier.slice("clawhub:".length)
        : identifier;

      // If it contains "/", search by owner/slug; otherwise search by slug
      const query = raw.includes("/") ? raw.split("/")[1] : raw;

      const results = await this.search(query, { limit: 5 });
      return results.length > 0 ? results[0] : null;
    } catch {
      return null;
    }
  }

  async install(
    identifier: string,
    targetDir: string,
  ): Promise<{ path: string; files: string[] }> {
    // Parse identifier: "clawhub:@owner/slug" or "clawhub:owner/slug" or "@owner/slug"
    let installArg: string;
    let name: string;

    if (identifier.startsWith("clawhub:")) {
      const raw = identifier.slice("clawhub:".length);
      installArg = raw.startsWith("@") ? raw : `@${raw}`;
      name = raw.split("/")[1] || raw;
    } else if (identifier.includes("/")) {
      installArg = identifier.startsWith("@") ? identifier : `@${identifier}`;
      name = identifier.split("/")[1];
    } else {
      installArg = identifier;
      name = identifier;
    }

    const skillDir = path.join(targetDir, "clawhub", name);
    fs.mkdirSync(skillDir, { recursive: true });

    const cmd = `clawhub install ${installArg}`;

    try {
      execSync(cmd, {
        encoding: "utf-8",
        timeout: 30_000,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to install skill "${identifier}": ${message}`);
    }

    // Write SKILL.md with basic metadata
    const skillMd = `# ${name}

Source: ClawHub
Marketplace: clawhub
Installed via: skill-finder

## Install Command

\`\`\`bash
${cmd}
\`\`\`
`;

    fs.writeFileSync(path.join(skillDir, "SKILL.md"), skillMd, "utf-8");

    return { path: skillDir, files: ["SKILL.md"] };
  }

  isAvailable(): boolean {
    return true;
  }
}
