import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { SkillSearchResult, SkillMarketplace } from "../types.js";

export class MockMarketplace implements SkillMarketplace {
  name: string;
  private readonly results: SkillSearchResult[];

  constructor(name: string, results?: SkillSearchResult[]) {
    this.name = name;
    this.results = results ?? [];
  }

  async search(
    query: string,
    options?: { category?: string; limit?: number; signal?: AbortSignal },
  ): Promise<SkillSearchResult[]> {
    const q = query.toLowerCase();
    let filtered = this.results.filter((skill) => {
      return (
        skill.name.toLowerCase().includes(q) ||
        skill.description.toLowerCase().includes(q) ||
        (skill.category?.toLowerCase().includes(q) ?? false) ||
        skill.triggers.some((t) => t.toLowerCase().includes(q))
      );
    });

    if (options?.category) {
      const cat = options.category.toLowerCase();
      filtered = filtered.filter(
        (skill) => skill.category?.toLowerCase() === cat,
      );
    }

    if (options?.limit !== undefined) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  async getSkillInfo(identifier: string): Promise<SkillSearchResult | null> {
    return this.results.find((skill) => skill.id === identifier) ?? null;
  }

  async install(
    identifier: string,
    targetDir: string,
  ): Promise<{ path: string; files: string[] }> {
    const skill = this.results.find((s) => s.id === identifier);
    const skillName = skill?.name ?? identifier;

    const skillDir = path.join(targetDir, skillName);
    fs.mkdirSync(skillDir, { recursive: true });

    const files = ["SKILL.md"];
    for (const file of files) {
      fs.writeFileSync(path.join(skillDir, file), `# ${skillName}\n`, "utf-8");
    }

    return { path: skillDir, files };
  }

  isAvailable(): boolean {
    return true;
  }
}
