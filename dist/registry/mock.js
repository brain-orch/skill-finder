import * as fs from "node:fs";
import * as path from "node:path";
export class MockMarketplace {
    name;
    results;
    constructor(name, results) {
        this.name = name;
        this.results = results ?? [];
    }
    async search(query, options) {
        const q = query.toLowerCase();
        let filtered = this.results.filter((skill) => {
            return (skill.name.toLowerCase().includes(q) ||
                skill.description.toLowerCase().includes(q) ||
                (skill.category?.toLowerCase().includes(q) ?? false) ||
                skill.triggers.some((t) => t.toLowerCase().includes(q)));
        });
        if (options?.category) {
            const cat = options.category.toLowerCase();
            filtered = filtered.filter((skill) => skill.category?.toLowerCase() === cat);
        }
        if (options?.limit !== undefined) {
            filtered = filtered.slice(0, options.limit);
        }
        return filtered;
    }
    async getSkillInfo(identifier) {
        return this.results.find((skill) => skill.id === identifier) ?? null;
    }
    async install(identifier, targetDir) {
        const skill = this.results.find((s) => s.id === identifier);
        const skillName = skill?.name ?? identifier;
        const skillDir = path.join(targetDir, skillName);
        fs.mkdirSync(skillDir, { recursive: true });
        const files = ["SKILL.md"];
        for (const file of files) {
            fs.writeFileSync(path.join(skillDir, file), `name: '${skillName}'\ndescription: 'Mock skill for ${skillName}'\ntags:\n  - test\n  - mock\n`, "utf-8");
        }
        return { path: skillDir, files };
    }
    isAvailable() {
        return true;
    }
}
//# sourceMappingURL=mock.js.map