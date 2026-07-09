import { marketplaceRegistry } from "../registry/instance.js";
// ── Stack Plans ──────────────────────────────────────────
const STACK_PLANS = {
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
// ── Composer Class ───────────────────────────────────────
export class SkillPlanComposer {
    /**
     * Compose skill plans based on detected stack categories.
     * Returns all plans whose matchCategories overlap with detectedStacks.
     */
    composePlan(detectedStacks) {
        const lower = detectedStacks.map((s) => s.toLowerCase());
        const matched = [];
        for (const plan of Object.values(STACK_PLANS)) {
            const hasMatch = plan.matchCategories.some((cat) => lower.includes(cat));
            if (hasMatch) {
                matched.push({
                    ...plan,
                    skills: plan.skills.map((s) => ({ ...s })),
                });
            }
        }
        return matched;
    }
    /**
     * Return all available plan metadata (without search results).
     */
    getAvailablePlans() {
        return Object.values(STACK_PLANS).map((plan) => ({
            key: plan.key,
            name: plan.name,
            description: plan.description,
            matchCategories: plan.matchCategories,
        }));
    }
    /**
     * Search marketplace for each skill in the plan.
     * Returns the plan with searchResults populated.
     */
    async searchPlanSkills(plan) {
        const results = [];
        for (const skill of plan.skills) {
            try {
                const searchResults = await marketplaceRegistry.searchAll(skill.query, {
                    category: skill.category,
                    limit: 3,
                });
                results.push(searchResults);
            }
            catch {
                results.push([]);
            }
        }
        return { ...plan, searchResults: results };
    }
    /**
     * Search all skills across all plans.
     */
    async searchAllPlansSkills(plans) {
        const results = [];
        for (const plan of plans) {
            const enriched = await this.searchPlanSkills(plan);
            results.push(enriched);
        }
        return results;
    }
}
//# sourceMappingURL=skill-plan.js.map