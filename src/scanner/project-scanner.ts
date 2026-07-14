import * as fs from "node:fs";
import * as path from "node:path";
import type { SkillSearchResult } from "../types.js";
import { marketplaceRegistry } from "../registry/instance.js";
import { SkillPlanComposer, type SkillPlan } from "../composer/skill-plan.js";
import {
  type DetectedStack,
  readPackageJson,
  readCargoToml,
  readPyprojectToml,
  readGoMod,
  readRequirementsTxt,
  depToStack,
  deduplicateStacks,
} from "./parsers.js";

// Re-export DetectedStack so existing external consumers keep working
export type { DetectedStack } from "./parsers.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScanResult {
  detectedStacks: DetectedStack[];
  skillRecommendations: SkillSearchResult[];
  composedPlans?: SkillPlan[];
  scannedAt: number;
  projectRoot: string;
}

// ---------------------------------------------------------------------------
// ProjectScanner
// ---------------------------------------------------------------------------

export class ProjectScanner {
  private lastScanResult: ScanResult | null = null;
  private planComposer: SkillPlanComposer;

  constructor() {
    this.planComposer = new SkillPlanComposer();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Scan a project root: detect tech stacks and search for relevant skills.
   */
  async scan(projectRoot: string): Promise<ScanResult> {
    const detectedStacks = this.detectStacks(projectRoot);
    const skillRecommendations = await this.searchSkills(detectedStacks);

    const result: ScanResult = {
      detectedStacks,
      skillRecommendations,
      scannedAt: Date.now(),
      projectRoot,
    };

    // Auto-compose plans if stacks detected (fire-and-forget)
    if (detectedStacks.length > 0) {
      try {
        const stackNames = detectedStacks.map((s) => s.name);
        result.composedPlans = this.planComposer.composePlan(stackNames);
      } catch (err) {
        console.warn(
          "[skill-finder] plan composition failed:",
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    this.lastScanResult = result;
    return result;
  }

  /**
   * Detect tech stacks by reading config files synchronously.
   */
  detectStacks(projectRoot: string): DetectedStack[] {
    const stacks: DetectedStack[] = [];

    // package.json
    const npmDeps = readPackageJson(projectRoot);
    for (const dep of npmDeps) {
      const stack = depToStack(dep, "package.json");
      if (stack) stacks.push(stack);
    }

    // Cargo.toml
    const cargoDeps = readCargoToml(projectRoot);
    for (const dep of cargoDeps) {
      const stack = depToStack(dep, "Cargo.toml");
      if (stack) stacks.push(stack);
    }

    // pyproject.toml
    const pyprojectDeps = readPyprojectToml(projectRoot);
    for (const dep of pyprojectDeps) {
      const stack = depToStack(dep, "pyproject.toml");
      if (stack) stacks.push(stack);
    }

    // go.mod
    const goModPath = path.join(projectRoot, "go.mod");
    if (fs.existsSync(goModPath)) {
      stacks.push({
        name: "go",
        category: "go",
        confidence: 0.95,
        source: "go.mod",
      });
    }
    const goDeps = readGoMod(projectRoot);
    for (const dep of goDeps) {
      const stack = depToStack(dep, "go.mod");
      if (stack) stacks.push(stack);
    }

    // requirements.txt
    const reqDeps = readRequirementsTxt(projectRoot);
    for (const dep of reqDeps) {
      const stack = depToStack(dep, "requirements.txt");
      if (stack) stacks.push(stack);
    }

    return deduplicateStacks(stacks);
  }

  /**
   * Search skill marketplaces for each detected stack.
   */
  async searchSkills(stacks: DetectedStack[]): Promise<SkillSearchResult[]> {
    if (stacks.length === 0) return [];

    const results: SkillSearchResult[] = [];
    const seenIds = new Set<string>();

    for (const stack of stacks) {
      try {
        const searchResults = await marketplaceRegistry.searchAll(stack.name, {
          limit: 3,
        });
        for (const result of searchResults) {
          if (!seenIds.has(result.id)) {
            seenIds.add(result.id);
            results.push(result);
          }
        }
      } catch (err) {
        console.warn(
          "[skill-finder] stack search failed, continuing with other stacks:",
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return results;
  }

  /**
   * Return the last scan result, or null if no scan has been performed.
   */
  getProjectContext(): ScanResult | null {
    return this.lastScanResult;
  }
}
