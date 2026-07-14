import * as fs from "node:fs";
import * as path from "node:path";
import { PlanSerializer } from "./plan-serializer.js";
// ── Stack Plans ──────────────────────────────────────────
export const STACK_PLANS = {
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
function getPlansDir(projectRoot) {
    const base = projectRoot ?? process.cwd();
    return path.join(base, PLANS_DIR);
}
/**
 * Discover all saved plans from the plans directory.
 * Returns metadata for each plan found.
 */
export function discoverPlans(projectRoot) {
    const plansDir = getPlansDir(projectRoot);
    if (!fs.existsSync(plansDir)) {
        return [];
    }
    const metas = [];
    try {
        const entries = fs.readdirSync(plansDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            const planFile = path.join(plansDir, entry.name, "plan.json");
            if (!fs.existsSync(planFile))
                continue;
            try {
                const content = fs.readFileSync(planFile, "utf-8");
                const plan = serializer.importPlan(content);
                metas.push({
                    key: plan.key,
                    name: plan.name,
                    description: plan.description,
                    matchCategories: plan.matchCategories,
                });
            }
            catch (err) {
                console.warn("[skill-finder] skipping corrupt plan file:", err instanceof Error ? err.message : String(err));
                continue;
            }
        }
    }
    catch (err) {
        console.warn("[skill-finder] plans directory read failed:", err instanceof Error ? err.message : String(err));
        return [];
    }
    return metas;
}
/**
 * Load a plan by key from the plans directory.
 * Returns null if not found or if the plan is corrupt.
 */
export function loadPlan(key, projectRoot) {
    const plansDir = getPlansDir(projectRoot);
    const planFile = path.join(plansDir, key, "plan.json");
    if (!fs.existsSync(planFile)) {
        return null;
    }
    try {
        const content = fs.readFileSync(planFile, "utf-8");
        return serializer.importPlan(content);
    }
    catch (err) {
        console.warn("[skill-finder] failed to load plan:", err instanceof Error ? err.message : String(err));
        return null;
    }
}
/**
 * Save a plan to the plans directory.
 * Creates the directory structure if it doesn't exist.
 */
export function savePlan(plan, projectRoot) {
    const plansDir = getPlansDir(projectRoot);
    const planDir = path.join(plansDir, plan.key);
    // Only create directory on first save
    if (!fs.existsSync(planDir)) {
        fs.mkdirSync(planDir, { recursive: true });
    }
    const json = serializer.exportPlan(plan);
    fs.writeFileSync(path.join(planDir, "plan.json"), json, "utf-8");
}
//# sourceMappingURL=plan-helpers.js.map