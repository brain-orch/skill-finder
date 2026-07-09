import { describe, it, expect, vi, beforeEach } from "vitest";
import { SkillPlanComposer } from "../../src/composer/skill-plan.js";
import { planTool } from "../../src/tools/plan.js";

vi.mock("../../src/registry/instance.js", () => ({
  marketplaceRegistry: {
    searchAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../src/index.js", () => ({
  getScanner: vi.fn().mockReturnValue(null),
}));

import { marketplaceRegistry } from "../../src/registry/instance.js";
import { getScanner } from "../../src/index.js";

const mockSkill = {
  id: "lobehub:test-skill",
  name: "test-skill",
  description: "A test skill",
  marketplace: "lobehub" as const,
  category: "frontend",
  triggers: ["test"],
  installCount: 100,
  stars: 4.0,
  installCommand: "npx install test-skill",
  homepageUrl: "https://example.com/test-skill",
  verified: true,
};

describe("SkillPlanComposer", () => {
  let composer: SkillPlanComposer;

  beforeEach(() => {
    vi.clearAllMocks();
    composer = new SkillPlanComposer();
  });

  describe("composePlan", () => {
    it("returns react-express-postgres plan for matching stacks", () => {
      const plans = composer.composePlan(["react", "express", "postgres"]);
      expect(plans.length).toBeGreaterThanOrEqual(1);
      expect(plans.map((p) => p.key)).toContain("react-express-postgres");
    });

    it("returns nextjs-prisma plan for matching stacks", () => {
      const plans = composer.composePlan(["next", "prisma", "react", "frontend"]);
      expect(plans.length).toBeGreaterThanOrEqual(1);
      expect(plans.map((p) => p.key)).toContain("nextjs-prisma");
    });

    it("returns empty array for unknown stacks", () => {
      const plans = composer.composePlan(["unknown-stack"]);
      expect(plans).toEqual([]);
    });

    it("returns multiple plans for broad stack list", () => {
      const plans = composer.composePlan(["react", "testing", "docker"]);
      const keys = plans.map((p) => p.key);
      expect(keys).toContain("react-express-postgres");
      expect(keys).toContain("react-testing");
      expect(keys).toContain("docker-deploy");
    });

    it("returns empty array for empty input", () => {
      const plans = composer.composePlan([]);
      expect(plans).toEqual([]);
    });

    it("matches case-insensitively", () => {
      const plans = composer.composePlan(["REACT", "Express"]);
      expect(plans.length).toBeGreaterThanOrEqual(1);
    });

    it("returns plans with skills populated", () => {
      const plans = composer.composePlan(["react"]);
      expect(plans.length).toBeGreaterThan(0);
      for (const plan of plans) {
        expect(plan.skills.length).toBeGreaterThan(0);
        for (const skill of plan.skills) {
          expect(skill.query).toBeTruthy();
          expect(skill.reason).toBeTruthy();
        }
      }
    });
  });

  describe("getAvailablePlans", () => {
    it("returns all plan metadata", () => {
      const plans = composer.getAvailablePlans();
      expect(plans.length).toBeGreaterThanOrEqual(5);
      for (const plan of plans) {
        expect(plan.key).toBeTruthy();
        expect(plan.name).toBeTruthy();
        expect(plan.description).toBeTruthy();
        expect(plan.matchCategories.length).toBeGreaterThan(0);
      }
    });

    it("does not include skills in metadata", () => {
      const plans = composer.getAvailablePlans();
      for (const plan of plans) {
        expect(plan).not.toHaveProperty("skills");
        expect(plan).not.toHaveProperty("searchResults");
      }
    });
  });

  describe("searchPlanSkills", () => {
    it("populates searchResults for each skill", async () => {
      vi.mocked(marketplaceRegistry.searchAll).mockResolvedValue([mockSkill]);

      const plans = composer.composePlan(["react", "express", "postgres"]);
      const plan = plans.find((p) => p.key === "react-express-postgres");
      expect(plan).toBeDefined();

      const enriched = await composer.searchPlanSkills(plan!);

      expect(enriched.searchResults).toBeDefined();
      expect(enriched.searchResults!.length).toBe(plan!.skills.length);
      for (const results of enriched.searchResults!) {
        expect(results.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("handles marketplace errors gracefully", async () => {
      vi.mocked(marketplaceRegistry.searchAll).mockRejectedValue(new Error("timeout"));

      const plans = composer.composePlan(["react"]);
      const plan = plans[0];
      const enriched = await composer.searchPlanSkills(plan);

      expect(enriched.searchResults).toBeDefined();
      expect(enriched.searchResults!.length).toBe(plan.skills.length);
      for (const results of enriched.searchResults!) {
        expect(results).toEqual([]);
      }
    });
  });

  describe("searchAllPlansSkills", () => {
    it("searches all matched plans", async () => {
      vi.mocked(marketplaceRegistry.searchAll).mockResolvedValue([mockSkill]);

      const plans = composer.composePlan(["react", "testing"]);
      const enriched = await composer.searchAllPlansSkills(plans);

      expect(enriched.length).toBe(plans.length);
      for (const plan of enriched) {
        expect(plan.searchResults).toBeDefined();
        expect(plan.searchResults!.length).toBe(plan.skills.length);
      }
    });
  });

  describe("plan structure", () => {
    it("each plan has required fields", () => {
      const plans = composer.composePlan(["react", "express", "postgres"]);
      for (const plan of plans) {
        expect(plan.key).toBeTruthy();
        expect(plan.name).toBeTruthy();
        expect(plan.description).toBeTruthy();
        expect(plan.matchCategories.length).toBeGreaterThan(0);
        expect(plan.skills.length).toBeGreaterThan(0);
      }
    });

    it("skills have query and reason", () => {
      const plans = composer.composePlan(["docker"]);
      for (const plan of plans) {
        for (const skill of plan.skills) {
          expect(typeof skill.query).toBe("string");
          expect(skill.query.length).toBeGreaterThan(0);
          expect(typeof skill.reason).toBe("string");
          expect(skill.reason.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("planTool", () => {
    const mockCtx = {
      sessionID: "test-session",
      messageID: "test-message",
      agent: "test",
      directory: process.cwd(),
      worktree: process.cwd(),
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async () => {},
    };

    it("returns plan with explicit stacks param", async () => {
      vi.mocked(marketplaceRegistry.searchAll).mockResolvedValue([mockSkill]);
      const result = await planTool.execute({ stacks: "react,express,postgres" }, mockCtx);
      expect(result).toContain("Skill Plan Recommendations");
      expect(result).toContain("React + Express + PostgreSQL");
    });

    it("returns empty message when no stacks and no scanner", async () => {
      vi.mocked(getScanner).mockReturnValue(null);
      const result = await planTool.execute({}, mockCtx);
      expect(result).toContain("No tech stack detected");
    });

    it("falls back to scanner when no stacks param", async () => {
      vi.mocked(getScanner).mockReturnValue({
        getProjectContext: () => ({
          detectedStacks: [
            { name: "react", category: "frontend", confidence: 0.9, source: "package.json" },
            { name: "express", category: "backend", confidence: 0.9, source: "package.json" },
          ],
          skillRecommendations: [],
          scannedAt: Date.now(),
          projectRoot: "/tmp",
        }),
      } as any);
      vi.mocked(marketplaceRegistry.searchAll).mockResolvedValue([]);

      const result = await planTool.execute({}, mockCtx);
      expect(result).toContain("Skill Plan Recommendations");
      expect(result).toContain("react");
    });

    it("returns message for unknown stacks", async () => {
      const result = await planTool.execute({ stacks: "unknown-stack" }, mockCtx);
      expect(result).toContain("No skill plans found");
    });

    it("tool definition has correct structure", () => {
      expect(planTool.description).toBe("Generate skill plan recommendations based on detected tech stack or specific plan key");
      expect(planTool.args).toBeDefined();
    });
  });
});
