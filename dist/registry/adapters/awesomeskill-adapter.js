import * as fs from "node:fs";
import * as path from "node:path";
export class AwesomeSkillMarketplace {
    name = "awesomeskill";
    async search(query, options) {
        if (!query)
            return [];
        const limit = options?.limit ?? 20;
        try {
            const url = `https://awesomeskill.ai/api/agent/skills/search?q=${encodeURIComponent(query)}&limit=${limit}`;
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
            if (!json.skills || !Array.isArray(json.skills))
                return [];
            const results = json.skills.map((skill) => ({
                id: `awesomeskill:${skill.slug}`,
                name: skill.name,
                description: skill.description,
                marketplace: "awesomeskill",
                category: skill.categories?.[0] ?? null,
                triggers: [query],
                installCount: 0,
                stars: skill.githubStars || 0,
                installCommand: skill.githubRepo
                    ? `git clone https://github.com/${skill.githubRepo}.git`
                    : `# Install from ${skill.sourceUrl || skill.url}`,
                homepageUrl: `https://awesomeskill.ai/skills/${skill.slug}`,
                verified: false,
            }));
            return results.slice(0, limit);
        }
        catch {
            return [];
        }
    }
    async getSkillInfo(identifier) {
        try {
            const slug = identifier.startsWith("awesomeskill:")
                ? identifier.slice("awesomeskill:".length)
                : identifier;
            const results = await this.search(slug, { limit: 5 });
            return results.length > 0 ? results[0] : null;
        }
        catch {
            return null;
        }
    }
    async install(identifier, targetDir) {
        const slug = identifier.startsWith("awesomeskill:")
            ? identifier.slice("awesomeskill:".length)
            : identifier;
        const info = await this.getSkillInfo(identifier);
        if (!info) {
            throw new Error(`Skill not found: ${identifier}`);
        }
        // Extract github repo from install command if available
        const repoMatch = info.installCommand.match(/git clone https:\/\/github\.com\/(.+)\.git/);
        const githubRepo = repoMatch?.[1];
        const skillDir = path.join(targetDir, "awesomeskill", slug);
        fs.mkdirSync(skillDir, { recursive: true });
        const skillMd = [
            `# ${info.name}`,
            "",
            `> ${info.description}`,
            "",
            "## Source",
            "",
            `- Marketplace: awesomeskill.ai`,
            `- Homepage: ${info.homepageUrl}`,
            githubRepo ? `- GitHub: https://github.com/${githubRepo}` : null,
            "",
            "## Install Command",
            "",
            "```bash",
            info.installCommand,
            "```",
            "",
        ]
            .filter((line) => line !== null)
            .join("\n");
        const skillMdPath = path.join(skillDir, "SKILL.md");
        fs.writeFileSync(skillMdPath, skillMd, "utf-8");
        return { path: skillDir, files: ["SKILL.md"] };
    }
    isAvailable() {
        return true;
    }
}
//# sourceMappingURL=awesomeskill-adapter.js.map