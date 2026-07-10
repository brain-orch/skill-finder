import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { validateSlug } from "../../safe-slug.js";
const SOURCE_REGEX = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/;
const SOURCE_MAX = 200;
export class SkillShMarketplace {
    name = "skillssh";
    async search(query, options) {
        if (!query)
            return [];
        // Skills.sh doesn't support category filtering
        if (options?.category)
            return [];
        const limit = options?.limit ?? 20;
        try {
            const url = `https://skills.sh/api/v1/skills/search?q=${encodeURIComponent(query)}&limit=${limit}`;
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "skill-finder/1.0",
                    Accept: "application/json",
                },
                signal: options?.signal,
            });
            if (!response.ok)
                return [];
            const json = await response.json();
            if (!json.data || !Array.isArray(json.data))
                return [];
            const results = json.data.map((skill) => ({
                id: `skillssh:${skill.slug}`,
                name: skill.name,
                description: skill.name,
                marketplace: "skillssh",
                category: null,
                triggers: [query],
                installCount: skill.installs || 0,
                stars: 0,
                installCommand: `npx skills add https://github.com/${skill.source} --skill ${skill.slug}`,
                homepageUrl: skill.url || `https://skills.sh/${skill.source}/${skill.slug}`,
                verified: skill.sourceType === "github",
            }));
            return results.slice(0, limit);
        }
        catch (err) {
            console.warn("[skill-finder] skillssh search failed:", err.message);
            return [];
        }
    }
    async getSkillInfo(identifier) {
        try {
            // Strip "skillssh:" prefix if present
            const slug = identifier.startsWith("skillssh:")
                ? identifier.slice("skillssh:".length)
                : identifier;
            const results = await this.search(slug, { limit: 5 });
            return results.length > 0 ? results[0] : null;
        }
        catch (err) {
            console.warn("[skill-finder] skillssh getSkillInfo failed:", err.message);
            return null;
        }
    }
    async install(identifier, targetDir) {
        // Parse identifier: "skillssh:{slug}" or "{source}/{slug}"
        let slug;
        let source;
        if (identifier.startsWith("skillssh:")) {
            slug = identifier.slice("skillssh:".length);
            // Try to find source via search
            const info = await this.getSkillInfo(identifier);
            if (!info) {
                throw new Error(`Skill not found: ${identifier}`);
            }
            // Extract source from install command
            const match = info.installCommand.match(/github\.com\/([^/]+)\//);
            source = match?.[1];
        }
        else if (identifier.includes("/")) {
            const lastSlash = identifier.lastIndexOf("/");
            source = identifier.slice(0, lastSlash);
            slug = identifier.slice(lastSlash + 1);
        }
        else {
            slug = identifier;
            const info = await this.getSkillInfo(identifier);
            if (!info) {
                throw new Error(`Skill not found: ${identifier}`);
            }
            const match = info.installCommand.match(/github\.com\/([^/]+)\//);
            source = match?.[1];
        }
        if (!source) {
            throw new Error(`Could not determine source for skill: ${identifier}`);
        }
        validateSlug(slug);
        if (source.length === 0 || source.length > SOURCE_MAX || !SOURCE_REGEX.test(source)) {
            throw new Error(`Invalid source: ${source}`);
        }
        const skillDir = path.join(targetDir, "skillssh", slug);
        fs.mkdirSync(skillDir, { recursive: true });
        const installUrl = `https://github.com/${source}`;
        const result = spawnSync("npx", ["-y", "skills", "add", installUrl, "--skill", slug], {
            cwd: skillDir,
            stdio: "pipe",
            timeout: 30_000,
        });
        if (result.status !== 0 || result.error) {
            throw new Error(`Failed to install skill "${identifier}": ${result.error?.message || `exit code ${result.status}`}`);
        }
        // Write SKILL.md with basic metadata
        const skillMd = `# ${slug}

Source: ${installUrl}
Marketplace: skills.sh
Installed via: skill-finder

## Install Command

\`\`\`bash
npx -y skills add ${installUrl} --skill ${slug}
\`\`\`
`;
        const skillMdPath = path.join(skillDir, "SKILL.md");
        fs.writeFileSync(skillMdPath, skillMd, "utf-8");
        return { path: skillDir, files: ["SKILL.md"] };
    }
    isAvailable() {
        return true;
    }
}
//# sourceMappingURL=skillssh-adapter.js.map