import { SkillPlanSkill, SkillPlan, SkillPlanMeta, STACK_PLANS } from "./plan-helpers.js";
import { discoverPlans, loadPlan, savePlan } from "./plan-helpers.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { marketplaceRegistry } from "../registry/instance.js";
import type { SkillSearchResult } from "../types.js";
import { PlanSerializer } from "./plan-serializer.js";

// ── Composer Class ───────────────────────────────────────

export class SkillPlanComposer {
  /**
   * Compose skill plans based on detected stack categories.
   * Returns all plans whose matchCategories overlap with detectedStacks.
   * Includes both built-in STACK_PLANS and registry plans.
   */
  composePlan(detectedStacks: string[], projectRoot?: string): SkillPlan[] {
    const lower = detectedStacks.map((s) => s.toLowerCase());
    const matched: SkillPlan[] = [];

    for (const plan of Object.values(STACK_PLANS)) {
      const hasMatch = plan.matchCategories.some((cat) => lower.includes(cat));
      if (hasMatch) {
        matched.push({
          ...plan,
          skills: plan.skills.map((s) => ({ ...s })),
        });
      }
    }

    // Also include registry plans
    const registryPlans = discoverPlans(projectRoot);
    for (const meta of registryPlans) {
      const hasMatch = meta.matchCategories.some((cat) => lower.includes(cat));
      if (hasMatch) {
        const fullPlan = loadPlan(meta.key, projectRoot);
        if (fullPlan) {
          matched.push(fullPlan);
        }
      }
    }

    return matched;
  }

  /**
   * Return all available plan metadata (without search results).
   * Includes both built-in STACK_PLANS and registry plans.
   */
  getAvailablePlans(projectRoot?: string): SkillPlanMeta[] {
    const builtIn = Object.values(STACK_PLANS).map((plan) => ({
      key: plan.key,
      name: plan.name,
      description: plan.description,
      matchCategories: plan.matchCategories,
    }));

    const registry = discoverPlans(projectRoot);
    return [...builtIn, ...registry];
  }

  /**
   * Get a plan by key from either built-in STACK_PLANS or registry.
   * Returns null if not found.
   */
  getPlanByKey(key: string, projectRoot?: string): SkillPlan | null {
    const builtIn = STACK_PLANS[key];
    if (builtIn) {
      return { ...builtIn, skills: builtIn.skills.map((s) => ({ ...s })) };
    }

    return loadPlan(key, projectRoot);
  }

  /**
   * Search marketplace for each skill in the plan.
   * Returns the plan with searchResults populated.
   */
  async searchPlanSkills(plan: SkillPlan): Promise<SkillPlan> {
    const results: SkillSearchResult[][] = [];

    for (const skill of plan.skills) {
      try {
        const searchResults = await marketplaceRegistry.searchAll(skill.query, {
          category: skill.category,
          limit: 3,
        });
        results.push(searchResults);
      } catch (err) {
        console.warn(
          "[skill-finder] plan skill search failed:",
          err instanceof Error ? err.message : String(err),
        );
        results.push([]);
      }
    }

    return { ...plan, searchResults: results };
  }

  /**
   * Search all skills across all plans.
   */
  async searchAllPlansSkills(plans: SkillPlan[]): Promise<SkillPlan[]> {
    const results: SkillPlan[] = [];

    for (const plan of plans) {
      const enriched = await this.searchPlanSkills(plan);
      results.push(enriched);
    }

    return results;
  }
}

export type { SkillPlanSkill, SkillPlan, SkillPlanMeta } from "./plan-helpers.js";
export { discoverPlans, loadPlan, savePlan } from "./plan-helpers.js";
