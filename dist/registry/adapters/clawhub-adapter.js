import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { validateSlug } from "../../safe-slug.js";
export class ClawHubMarketplace {
    name = "clawhub";
    async search(query, options) {
        if (!query)
            return [];
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
            if (!response.ok)
                return [];
            const json = (await response.json());
            if (!Array.isArray(json))
                return [];
            let results = json.map((skill) => ({
                id: `clawhub:${skill.owner}/${skill.slug}`,
                name: skill.name || skill.slug,
                description: skill.description,
                marketplace: "clawhub",
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
                results = results.filter((r) => r.category?.toLowerCase() === cat);
            }
            return results.slice(0, limit);
        }
        catch {
            return [];
        }
    }
    async getSkillInfo(identifier) {
        try {
            // Strip "clawhub:" prefix if present
            const raw = identifier.startsWith("clawhub:")
                ? identifier.slice("clawhub:".length)
                : identifier;
            // If it contains "/", search by owner/slug; otherwise search by slug
            const query = raw.includes("/") ? raw.split("/")[1] : raw;
            const results = await this.search(query, { limit: 5 });
            return results.length > 0 ? results[0] : null;
        }
        catch {
            return null;
        }
    }
    async install(identifier, targetDir) {
        // Parse identifier: "clawhub:@owner/slug" or "clawhub:owner/slug" or "@owner/slug"
        let installArg;
        let name;
        if (identifier.startsWith("clawhub:")) {
            const raw = identifier.slice("clawhub:".length);
            installArg = raw.startsWith("@") ? raw : `@${raw}`;
            name = raw.split("/")[1] || raw;
        }
        else if (identifier.includes("/")) {
            installArg = identifier.startsWith("@") ? identifier : `@${identifier}`;
            name = identifier.split("/")[1];
        }
        else {
            installArg = identifier;
            name = identifier;
        }
        validateSlug(name);
        const skillDir = path.join(targetDir, "clawhub", name);
        fs.mkdirSync(skillDir, { recursive: true });
        const result = spawnSync('clawhub', ['install', installArg], {
            encoding: 'utf-8',
            timeout: 30_000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        if (result.status !== 0 || result.error) {
            throw new Error(`Failed to install skill "${identifier}": ${result.error?.message || `exit code ${result.status}`}`);
        }
        // Write SKILL.md with basic metadata
        const skillMd = `# ${name}

Source: ClawHub
Marketplace: clawhub
Installed via: skill-finder

## Install Command

\`\`\`bash
clawhub install ${installArg}
\`\`\`
`;
        fs.writeFileSync(path.join(skillDir, "SKILL.md"), skillMd, "utf-8");
        return { path: skillDir, files: ["SKILL.md"] };
    }
    isAvailable() {
        return true;
    }
}
//# sourceMappingURL=clawhub-adapter.js.map