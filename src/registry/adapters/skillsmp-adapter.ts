import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { SkillSearchResult, SkillMarketplace } from "../../types.js";

interface SkillsMPSkill {
  slug: string;
  name: string;
  description: string;
  category?: string;
  installs?: number;
  stars?: number;
  source_type?: string;
  owner?: string;
  url?: string;
}

interface SkillsMPSearchResponse {
  data: {
    skills: SkillsMPSkill[];
  };
}

export class SkillsMPMarketplace implements SkillMarketplace {
  name = "skillsmp" as const;

  async search(
    query: string,
    options?: { category?: string; limit?: number; signal?: AbortSignal },
  ): Promise<SkillSearchResult[]> {
    if (!query) return [];

    const limit = options?.limit ?? 20;

    try {
      const url = `https://skillsmp.com/api/v1/skills/search?q=${encodeURIComponent(query)}&limit=${limit}`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": "skill-finder/1.0",
          Accept: "application/json",
        },
        signal: options?.signal,
      });

      if (!response.ok) return [];

      const json: SkillsMPSearchResponse =
        (await response.json()) as SkillsMPSearchResponse;

      const skills = json?.data?.skills;
      if (!skills || !Array.isArray(skills)) return [];

      let results: SkillSearchResult[] = skills.map((skill) => {
        const owner = skill.owner ?? "unknown";
        return {
          id: `skillsmp:${skill.slug}`,
          name: skill.name,
          description: skill.description,
          marketplace: "skillsmp" as const,
          category: skill.category ?? null,
          triggers: [query],
          installCount: skill.installs || 0,
          stars: skill.stars || 0,
          installCommand: `npx add-skill @${owner}/${skill.slug}`,
          homepageUrl:
            skill.url || `https://skillsmp.com/skills/@${owner}/${skill.slug}`,
          verified: skill.source_type === "github",
        };
      });

      // Client-side category filtering
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
      // Strip "skillsmp:" prefix if present
      const slug = identifier.startsWith("skillsmp:")
        ? identifier.slice("skillsmp:".length)
        : identifier;

      const results = await this.search(slug, { limit: 5 });
      return results.length > 0 ? results[0] : null;
    } catch {
      return null;
    }
  }

  async install(
    identifier: string,
    targetDir: string,
  ): Promise<{ path: string; files: string[] }> {
    // Parse identifier: "skillsmp:@{owner}/{slug}" or "@{owner}/{slug}" or just slug
    let owner: string | undefined;
    let slug: string;

    const raw = identifier.startsWith("skillsmp:")
      ? identifier.slice("skillsmp:".length)
      : identifier;

    if (raw.startsWith("@") && raw.includes("/")) {
      // "@owner/slug" format
      const withoutAt = raw.slice(1);
      const slashIdx = withoutAt.indexOf("/");
      owner = withoutAt.slice(0, slashIdx);
      slug = withoutAt.slice(slashIdx + 1);
    } else if (raw.includes("/")) {
      // "owner/slug" format
      const parts = raw.split("/", 2);
      owner = parts[0];
      slug = parts[1];
    } else {
      // Plain slug — look up owner via search
      slug = raw;
      const info = await this.getSkillInfo(raw);
      if (!info) {
        throw new Error(`Skill not found: ${identifier}`);
      }
      // Extract owner from install command: "npx add-skill @owner/slug"
      const match = info.installCommand.match(/@([^/]+)\//);
      owner = match?.[1];
    }

    if (!owner) {
      throw new Error(`Could not determine owner for skill: ${identifier}`);
    }

    const skillDir = path.join(targetDir, "skillsmp", slug);
    fs.mkdirSync(skillDir, { recursive: true });

    // Run the skillsmp install command
    const cmd = `npx -y add-skill @${owner}/${slug}`;

    try {
      execSync(cmd, {
        cwd: skillDir,
        stdio: "pipe",
        timeout: 30_000,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to install skill "${identifier}": ${message}`);
    }

    // Write SKILL.md with basic metadata
    const skillMd = `# ${slug}

Owner: @${owner}
Marketplace: skillsmp.com
Installed via: skill-finder

## Install Command

\`\`\`bash
${cmd}
\`\`\`
`;

    const skillMdPath = path.join(skillDir, "SKILL.md");
    fs.writeFileSync(skillMdPath, skillMd, "utf-8");

    return { path: skillDir, files: ["SKILL.md"] };
  }

  isAvailable(): boolean {
    return true;
  }
}
