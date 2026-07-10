import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { validateSlug, validateOwner } from "../../safe-slug.js";
function mapSkill(skill) {
    return {
        id: `agentskillsh:${skill.slug}`,
        name: skill.name,
        description: skill.description,
        marketplace: "agentskillsh",
        category: skill.category || null,
        triggers: skill.tags || skill.skillTypes || [],
        installCount: skill.installCount || 0,
        stars: skill.contentQualityScore || 0,
        installCommand: `npx @agentskill.sh/cli@latest setup ${skill.owner}/${skill.name}`,
        homepageUrl: `https://agentskill.sh/@${skill.slug}`,
        verified: skill.isVerified || false,
    };
}
export class AgentSkillsMarketplace {
    name = "agentskillsh";
    async search(query, options) {
        if (!query || query.trim().length === 0)
            return [];
        try {
            const url = new URL("https://agentskill.sh/api/skills");
            url.searchParams.set("search", query);
            if (options?.limit)
                url.searchParams.set("limit", String(options.limit));
            if (options?.category)
                url.searchParams.set("category", options.category);
            const response = await fetch(url.toString(), { signal: options?.signal });
            if (!response.ok)
                return [];
            const json = (await response.json());
            return (json.data || []).map(mapSkill);
        }
        catch (err) {
            console.warn("[skill-finder] agentskillsh search failed:", err.message);
            return [];
        }
    }
    async getSkillInfo(identifier) {
        try {
            const slug = identifier.startsWith("agentskillsh:")
                ? identifier.slice("agentskillsh:".length)
                : identifier;
            const results = await this.search(slug, { limit: 5 });
            return results.length > 0 ? results[0] : null;
        }
        catch (err) {
            console.warn("[skill-finder] agentskillsh getSkillInfo failed:", err.message);
            return null;
        }
    }
    async install(identifier, targetDir) {
        const slug = identifier.startsWith("agentskillsh:")
            ? identifier.slice("agentskillsh:".length)
            : identifier;
        // Parse owner/name from slug (format: "owner/name" or just "name")
        let owner;
        let name;
        if (slug.includes("/")) {
            const parts = slug.split("/", 2);
            owner = parts[0];
            name = parts[1];
        }
        else {
            name = slug;
            // Look up owner via search
            const info = await this.getSkillInfo(slug);
            if (!info) {
                throw new Error(`Skill not found: ${identifier}`);
            }
            // Extract owner from install command: "npx @agentskill.sh/cli@latest setup owner/name"
            const match = info.installCommand.match(/setup\s+([^/]+)\//);
            owner = match?.[1];
        }
        if (!owner) {
            throw new Error(`Could not determine owner for skill: ${identifier}`);
        }
        // Validate slug components to prevent injection
        validateSlug(name);
        if (owner)
            validateOwner(owner);
        const skillDir = path.join(targetDir, "agentskillsh", slug);
        fs.mkdirSync(skillDir, { recursive: true });
        const result = spawnSync('npx', ['@agentskill.sh/cli@latest', 'setup', `${owner}/${name}`], {
            cwd: skillDir,
            stdio: 'pipe',
            timeout: 30_000,
        });
        if (result.status !== 0 || result.error) {
            throw new Error(`Failed to install skill "${identifier}": ${result.error?.message || `exit code ${result.status}`}`);
        }
        // Write SKILL.md with basic metadata
        const skillMd = `# ${name}

Owner: @${owner}
Marketplace: agentskill.sh
Installed via: skill-finder

## Install Command

\`\`\`bash
npx @agentskill.sh/cli@latest setup ${owner}/${name}
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
//# sourceMappingURL=agentskillsh-adapter.js.map