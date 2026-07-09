import { describe, it, expect, vi } from "vitest";
import { PlanSerializer, type PlanExportFormat } from "../../src/composer/plan-serializer.js";
import { exportPlanTool, importPlanTool } from "../../src/tools/plan-share.js";

vi.mock("../../src/registry/instance.js", () => ({
  marketplaceRegistry: {
    searchAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../src/index.js", () => ({
  getScanner: vi.fn().mockReturnValue(null),
}));

const testPlan = {
  key: "test-stack",
  name: "Test Stack",
  description: "A test stack for unit tests",
  matchCategories: ["react", "frontend"],
  skills: [
    { query: "react component", reason: "React dev", category: "frontend" },
    { query: "frontend styling", reason: "Styling", category: "css" },
  ],
};

describe("PlanSerializer", () => {
  const serializer = new PlanSerializer();

  describe("exportPlan", () => {
    it("exports plan to valid JSON string", () => {
      const json = serializer.exportPlan(testPlan);
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe(1);
      expect(parsed.key).toBe("test-stack");
      expect(parsed.name).toBe("Test Stack");
      expect(parsed.description).toBe("A test stack for unit tests");
      expect(parsed.matchCategories).toEqual(["react", "frontend"]);
      expect(parsed.skills).toHaveLength(2);
      expect(parsed.exportedAt).toBeTruthy();
      expect(parsed.exporter).toBe("skill-finder");
    });

    it("preserves skill categories in export", () => {
      const json = serializer.exportPlan(testPlan);
      const parsed = JSON.parse(json);

      expect(parsed.skills[0].category).toBe("frontend");
      expect(parsed.skills[1].category).toBe("css");
    });

    it("handles plan without optional category", () => {
      const planNoCategory = {
        ...testPlan,
        skills: [{ query: "test", reason: "test reason" }],
      };
      const json = serializer.exportPlan(planNoCategory);
      const parsed = JSON.parse(json);

      expect(parsed.skills[0]).not.toHaveProperty("category");
    });
  });

  describe("importPlan", () => {
    it("imports plan from valid JSON", () => {
      const json = serializer.exportPlan(testPlan);
      const imported = serializer.importPlan(json);

      expect(imported.key).toBe(testPlan.key);
      expect(imported.name).toBe(testPlan.name);
      expect(imported.description).toBe(testPlan.description);
      expect(imported.matchCategories).toEqual(testPlan.matchCategories);
      expect(imported.skills).toHaveLength(testPlan.skills.length);
    });

    it("roundtrip export→import preserves all fields", () => {
      const json = serializer.exportPlan(testPlan);
      const imported = serializer.importPlan(json);

      expect(imported).toEqual({
        key: testPlan.key,
        name: testPlan.name,
        description: testPlan.description,
        matchCategories: testPlan.matchCategories,
        skills: testPlan.skills,
      });
    });

    it("throws on invalid JSON", () => {
      expect(() => serializer.importPlan("not valid json")).toThrow("Invalid JSON");
    });

    it("throws on missing required fields", () => {
      const incomplete = JSON.stringify({ version: 1, key: "test" });
      expect(() => serializer.importPlan(incomplete)).toThrow("missing or invalid required field");
    });

    it("throws on unknown version", () => {
      const wrongVersion = JSON.stringify({
        version: 99,
        key: "test",
        name: "Test",
        description: "Test",
        matchCategories: [],
        skills: [],
      });
      expect(() => serializer.importPlan(wrongVersion)).toThrow("Unsupported plan version");
    });

    it("handles empty skills array", () => {
      const planEmpty = { ...testPlan, skills: [] };
      const json = serializer.exportPlan(planEmpty);
      const imported = serializer.importPlan(json);

      expect(imported.skills).toEqual([]);
    });

    it("preserves special characters in fields", () => {
      const specialPlan = {
        ...testPlan,
        name: "Plan with <special> & \"characters\"",
        description: "Description with\nnewlines and\ttabs",
      };
      const json = serializer.exportPlan(specialPlan);
      const imported = serializer.importPlan(json);

      expect(imported.name).toBe("Plan with <special> & \"characters\"");
      expect(imported.description).toBe("Description with\nnewlines and\ttabs");
    });

    it("throws on non-object root", () => {
      expect(() => serializer.importPlan('"just a string"')).toThrow("root must be an object");
    });

    it("throws on missing version field", () => {
      const noVersion = JSON.stringify({ key: "test", name: "Test" });
      expect(() => serializer.importPlan(noVersion)).toThrow("missing required field 'version'");
    });
  });
});

describe("export-plan tool", () => {
  it("exports a known plan", async () => {
    const result = await exportPlanTool.execute({ planKey: "nextjs-prisma" }, {} as any);
    expect(result).toContain("Exported Plan");
    expect(result).toContain("nextjs-prisma");
    expect(result).toContain("```json");
  });

  it("returns error for unknown plan", async () => {
    const result = await exportPlanTool.execute({ planKey: "nonexistent" }, {} as any);
    expect(result).toContain("not found");
  });
});

describe("import-plan tool", () => {
  const serializer = new PlanSerializer();

  it("imports valid plan JSON", async () => {
    const json = serializer.exportPlan(testPlan);
    const result = await importPlanTool.execute({ json }, {} as any);
    expect(result).toContain("Imported Plan");
    expect(result).toContain("Test Stack");
  });

  it("returns error for invalid JSON", async () => {
    const result = await importPlanTool.execute({ json: "bad json" }, {} as any);
    expect(result).toContain("Import failed");
  });
});
