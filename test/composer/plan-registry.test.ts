import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { discoverPlans, loadPlan, savePlan, SkillPlanComposer } from "../../src/composer/skill-plan.js";

vi.mock("../../src/registry/instance.js", () => ({
  marketplaceRegistry: {
    searchAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../src/index.js", () => ({
  getScanner: vi.fn().mockReturnValue(null),
}));

const testPlan = {
  key: "test-registry",
  name: "Test Registry Plan",
  description: "A plan for testing the registry",
  matchCategories: ["react", "frontend"],
  skills: [
    { query: "react component", reason: "React dev", category: "frontend" },
  ],
};

describe("Plan Registry", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-finder-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("discoverPlans", () => {
    it("returns empty array when directory does not exist", () => {
      const plans = discoverPlans(path.join(tmpDir, "nonexistent"));
      expect(plans).toEqual([]);
    });

    it("discovers saved plans from directory", () => {
      savePlan(testPlan, tmpDir);
      const plans = discoverPlans(tmpDir);

      expect(plans).toHaveLength(1);
      expect(plans[0].key).toBe("test-registry");
      expect(plans[0].name).toBe("Test Registry Plan");
    });

    it("skips corrupt plan files", () => {
      const plansDir = path.join(tmpDir, ".opencode", "skill-finder-plans");
      fs.mkdirSync(path.join(plansDir, "corrupt"), { recursive: true });
      fs.writeFileSync(path.join(plansDir, "corrupt", "plan.json"), "not valid json");

      savePlan(testPlan, tmpDir);
      const plans = discoverPlans(tmpDir);

      expect(plans).toHaveLength(1);
      expect(plans[0].key).toBe("test-registry");
    });
  });

  describe("loadPlan", () => {
    it("returns null for non-existent plan", () => {
      const plan = loadPlan("nonexistent", tmpDir);
      expect(plan).toBeNull();
    });

    it("loads existing plan by key", () => {
      savePlan(testPlan, tmpDir);
      const loaded = loadPlan("test-registry", tmpDir);

      expect(loaded).not.toBeNull();
      expect(loaded!.key).toBe("test-registry");
      expect(loaded!.name).toBe("Test Registry Plan");
      expect(loaded!.skills).toHaveLength(1);
    });

    it("returns null for corrupt plan file", () => {
      const plansDir = path.join(tmpDir, ".opencode", "skill-finder-plans");
      fs.mkdirSync(path.join(plansDir, "corrupt"), { recursive: true });
      fs.writeFileSync(path.join(plansDir, "corrupt", "plan.json"), "invalid");

      const plan = loadPlan("corrupt", tmpDir);
      expect(plan).toBeNull();
    });
  });

  describe("savePlan", () => {
    it("creates directory and saves plan", () => {
      savePlan(testPlan, tmpDir);

      const planFile = path.join(tmpDir, ".opencode", "skill-finder-plans", "test-registry", "plan.json");
      expect(fs.existsSync(planFile)).toBe(true);

      const content = JSON.parse(fs.readFileSync(planFile, "utf-8"));
      expect(content.key).toBe("test-registry");
      expect(content.version).toBe(1);
    });

    it("overwrites existing plan on re-save", () => {
      savePlan(testPlan, tmpDir);

      const updatedPlan = { ...testPlan, name: "Updated Name" };
      savePlan(updatedPlan, tmpDir);

      const loaded = loadPlan("test-registry", tmpDir);
      expect(loaded!.name).toBe("Updated Name");
    });
  });
});

describe("SkillPlanComposer with registry", () => {
  let tmpDir: string;
  let composer: SkillPlanComposer;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-finder-composer-"));
    composer = new SkillPlanComposer();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("getAvailablePlans includes registry plans", () => {
    savePlan(testPlan, tmpDir);
    const plans = composer.getAvailablePlans(tmpDir);

    const keys = plans.map((p) => p.key);
    expect(keys).toContain("test-registry");
    expect(keys).toContain("nextjs-prisma");
  });

  it("getPlanByKey returns registry plan", () => {
    savePlan(testPlan, tmpDir);
    const plan = composer.getPlanByKey("test-registry", tmpDir);

    expect(plan).not.toBeNull();
    expect(plan!.key).toBe("test-registry");
  });

  it("getPlanByKey returns built-in plan", () => {
    const plan = composer.getPlanByKey("nextjs-prisma");

    expect(plan).not.toBeNull();
    expect(plan!.key).toBe("nextjs-prisma");
  });

  it("getPlanByKey returns null for unknown key", () => {
    const plan = composer.getPlanByKey("nonexistent", tmpDir);
    expect(plan).toBeNull();
  });

  it("composePlan includes registry plans with matching categories", () => {
    savePlan(testPlan, tmpDir);
    const plans = composer.composePlan(["react"], tmpDir);

    const keys = plans.map((p) => p.key);
    expect(keys).toContain("test-registry");
  });
});

describe("list-plans tool", () => {
  it("lists available plans", async () => {
    const { listPlansTool } = await import("../../src/tools/plan.js");
    const result = await listPlansTool.execute({}, {} as any);

    expect(result).toContain("Available Skill Plans");
    expect(result).toContain("nextjs-prisma");
  });
});

describe("plan tool with planKey", () => {
  it("loads plan by key", async () => {
    const { planTool } = await import("../../src/tools/plan.js");

    vi.mocked(await import("../../src/registry/instance.js")).marketplaceRegistry.searchAll.mockResolvedValue([]);

    const result = await planTool.execute({ planKey: "nextjs-prisma" }, {} as any);
    expect(result).toContain("Skill Plan");
    expect(result).toContain("Next.js + Prisma");
  });

  it("returns error for unknown plan key", async () => {
    const { planTool } = await import("../../src/tools/plan.js");
    const result = await planTool.execute({ planKey: "nonexistent" }, {} as any);
    expect(result).toContain("not found");
  });
});
