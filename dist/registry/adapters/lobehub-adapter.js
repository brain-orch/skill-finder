import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
export class LobeHubMarketplace {
    name = "lobehub";
    async search(query, options) {
        if (!query)
            return [];
        try {
            const cmd = `npx -y @lobehub/market-cli skills search --q "${query}" --output json`;
            const output = execSync(cmd, {
                encoding: "utf-8",
                timeout: 15_000,
                stdio: ["pipe", "pipe", "pipe"],
            });
            const parsed = JSON.parse(output);
            const items = Array.isArray(parsed.items) ? parsed.items : [];
            let results = items.map((item) => ({
                id: `lobehub:${item.name}`,
                name: item.name,
                description: item.description,
                marketplace: "lobehub",
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
                results = results.filter((r) => r.category?.toLowerCase() === cat);
            }
            if (options?.limit !== undefined) {
                results = results.slice(0, options.limit);
            }
            return results;
        }
        catch {
            return [];
        }
    }
    async getSkillInfo(identifier) {
        if (!identifier)
            return null;
        const results = await this.search(identifier);
        return results.find((r) => r.id === identifier) ?? null;
    }
    async install(identifier, targetDir) {
        const cmd = `npx -y @lobehub/market-cli skills install ${identifier} --agent codex`;
        try {
            execSync(cmd, {
                encoding: "utf-8",
                timeout: 30_000,
                stdio: ["pipe", "pipe", "pipe"],
            });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Failed to install skill "${identifier}": ${message}`);
        }
        const skillDir = path.join(targetDir, "lobehub", identifier);
        fs.mkdirSync(skillDir, { recursive: true });
        const files = ["SKILL.md"];
        fs.writeFileSync(path.join(skillDir, "SKILL.md"), `# ${identifier}\n\nInstalled from LobeHub marketplace.\n`, "utf-8");
        return { path: skillDir, files };
    }
    isAvailable() {
        return true;
    }
}
//# sourceMappingURL=lobehub-adapter.js.map