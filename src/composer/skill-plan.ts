import * as fs from "node:fs";
import * as path from "node:path";
import { marketplaceRegistry } from "../registry/instance.js";
import type { SkillSearchResult } from "../types.js";
import { PlanSerializer } from "./plan-serializer.js";

// ── Types ────────────────────────────────────────────────

export interface SkillPlanSkill {
  query: string;
  reason: string;
  category?: string;
}

export interface SkillPlan {
  key: string;
  name: string;
  description: string;
  matchCategories: string[];
  skills: SkillPlanSkill[];
  /** Populated after searchPlanSkills() */
  searchResults?: SkillSearchResult[][];
}

export interface SkillPlanMeta {
  key: string;
  name: string;
  description: string;
  matchCategories: string[];
}

// ── Stack Plans ──────────────────────────────────────────

const STACK_PLANS: Record<string, SkillPlan> = {
  "nextjs-prisma": {
    key: "nextjs-prisma",
    name: "Next.js + Prisma",
    description: "Full-stack Next.js application with Prisma ORM for database access",
    matchCategories: ["next", "react", "frontend", "prisma", "database", "sql"],
    skills: [
      { query: "next.js react component", reason: "React/Next.js component development", category: "frontend" },
      { query: "prisma database schema", reason: "Prisma ORM schema management", category: "database" },
      { query: "api route endpoint", reason: "API route development for Next.js", category: "api-development" },
    ],
  },
  "react-express-postgres": {
    key: "react-express-postgres",
    name: "React + Express + PostgreSQL",
    description: "Full-stack JavaScript application with React frontend and Express backend",
    matchCategories: ["react", "frontend", "express", "backend", "postgres", "database", "sql"],
    skills: [
      { query: "react component frontend", reason: "React component development", category: "frontend" },
      { query: "express api backend", reason: "Express.js API backend", category: "api-development" },
      { query: "postgres sql database", reason: "PostgreSQL database queries", category: "database" },
    ],
  },
  "python-ml": {
    key: "python-ml",
    name: "Python + Machine Learning",
    description: "Python data science and machine learning pipeline",
    matchCategories: ["python", "data-science", "machine-learning"],
    skills: [
      { query: "python data science", reason: "Python data processing and analysis", category: "data-science" },
      { query: "machine learning model", reason: "ML model training and deployment", category: "machine-learning" },
    ],
  },
  "react-testing": {
    key: "react-testing",
    name: "React Testing Stack",
    description: "React component testing with testing library and Vitest",
    matchCategories: ["react", "frontend", "testing", "vitest", "jest"],
    skills: [
      { query: "react testing library", reason: "React component testing", category: "testing" },
      { query: "vitest unit test", reason: "Unit testing with Vitest", category: "testing" },
    ],
  },
  "docker-deploy": {
    key: "docker-deploy",
    name: "Docker + Deployment",
    description: "Containerization and deployment pipeline",
    matchCategories: ["docker", "containerization", "devops"],
    skills: [
      { query: "docker container", reason: "Docker container setup", category: "containerization" },
      { query: "ci cd pipeline", reason: "CI/CD pipeline automation", category: "devops" },
    ],
  },
};

// ── Plan Registry ─────────────────────────────────────────

const PLANS_DIR = ".opencode/skill-finder-plans";
const serializer = new PlanSerializer();

/**
 * Get the absolute path to the plans directory.
 */
function getPlansDir(projectRoot?: string): string {
  const base = projectRoot ?? process.cwd();
  return path.join(base, PLANS_DIR);
}

/**
 * Discover all saved plans from the plans directory.
 * Returns metadata for each plan found.
 */
export function discoverPlans(projectRoot?: string): SkillPlanMeta[] {
  const plansDir = getPlansDir(projectRoot);

  if (!fs.existsSync(plansDir)) {
    return [];
  }

  const metas: SkillPlanMeta[] = [];

  try {
    const entries = fs.readdirSync(plansDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const planFile = path.join(plansDir, entry.name, "plan.json");
      if (!fs.existsSync(planFile)) continue;

      try {
        const content = fs.readFileSync(planFile, "utf-8");
        const plan = serializer.importPlan(content);
        metas.push({
          key: plan.key,
          name: plan.name,
          description: plan.description,
          matchCategories: plan.matchCategories,
        });
      } catch (err) {
        console.warn(
          "[skill-finder] skipping corrupt plan file:",
          err instanceof Error ? err.message : String(err),
        );
        continue;
      }
    }
  } catch (err) {
    console.warn(
      "[skill-finder] plans directory read failed:",
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }

  return metas;
}

/**
 * Load a plan by key from the plans directory.
 * Returns null if not found or if the plan is corrupt.
 */
export function loadPlan(key: string, projectRoot?: string): SkillPlan | null {
  const plansDir = getPlansDir(projectRoot);
  const planFile = path.join(plansDir, key, "plan.json");

  if (!fs.existsSync(planFile)) {
    return null;
  }

  try {
    const content = fs.readFileSync(planFile, "utf-8");
    return serializer.importPlan(content);
  } catch (err) {
    console.warn(
      "[skill-finder] failed to load plan:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Save a plan to the plans directory.
 * Creates the directory structure if it doesn't exist.
 */
export function savePlan(plan: SkillPlan, projectRoot?: string): void {
  const plansDir = getPlansDir(projectRoot);
  const planDir = path.join(plansDir, plan.key);

  // Only create directory on first save
  if (!fs.existsSync(planDir)) {
    fs.mkdirSync(planDir, { recursive: true });
  }

  const json = serializer.exportPlan(plan);
  fs.writeFileSync(path.join(planDir, "plan.json"), json, "utf-8");
}

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
