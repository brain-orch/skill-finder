import { describe, it, expect, vi, beforeEach } from "vitest";
import { PluginHooks } from "../src/plugin/hooks.js";

describe("PluginHooks", () => {
  let hooks: PluginHooks;

  beforeEach(() => {
    vi.clearAllMocks();
    hooks = new PluginHooks({ debounceMs: 1000 });
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  // --- detectCategories ---

  describe("detectCategories", () => {
    it("returns matching categories for pdf keyword", () => {
      const cats = hooks.detectCategories("I need to extract text from a pdf");
      expect(cats).toContain("pdf-processing");
      expect(cats).toContain("document");
    });

    it("returns multiple categories for 'deploy the pdf'", () => {
      const cats = hooks.detectCategories("deploy the pdf to production");
      expect(cats).toContain("deployment");
      expect(cats).toContain("devops");
      expect(cats).toContain("pdf-processing");
      expect(cats).toContain("document");
    });

    it("returns empty for unrecognized text", () => {
      const cats = hooks.detectCategories("hello world foo bar");
      expect(cats).toEqual([]);
    });

    it("returns spreadsheet categories for excel keyword", () => {
      const cats = hooks.detectCategories("parse this spreadsheet csv");
      expect(cats).toContain("spreadsheet");
      expect(cats).toContain("data-analysis");
    });

    it("returns git categories", () => {
      const cats = hooks.detectCategories("commit and push");
      expect(cats).toContain("git-workflows");
      expect(cats).toContain("version-control");
    });

    it("returns testing categories", () => {
      const cats = hooks.detectCategories("write unit tests");
      expect(cats).toContain("testing");
      expect(cats).toContain("quality");
    });

    it("returns docker categories", () => {
      const cats = hooks.detectCategories("build the dockerfile");
      expect(cats).toContain("docker");
      expect(cats).toContain("containerization");
    });

    it("returns database categories", () => {
      const cats = hooks.detectCategories("write a postgres query");
      expect(cats).toContain("database");
      expect(cats).toContain("sql");
    });

    it("returns frontend categories", () => {
      const cats = hooks.detectCategories("create a react component");
      expect(cats).toContain("frontend");
      expect(cats).toContain("react");
    });

    it("returns api categories", () => {
      const cats = hooks.detectCategories("add a REST endpoint");
      expect(cats).toContain("api-development");
      expect(cats).toContain("backend");
    });

    it("returns security categories", () => {
      const cats = hooks.detectCategories("implement auth login");
      expect(cats).toContain("security");
      expect(cats).toContain("authentication");
    });

    it("deduplicates categories", () => {
      const cats = hooks.detectCategories("pdf document ocr");
      // pdf-processing and document should each appear once
      expect(cats.filter((c) => c === "pdf-processing")).toHaveLength(1);
      expect(cats.filter((c) => c === "document")).toHaveLength(1);
    });
  });

  // --- canSearch ---

  describe("canSearch", () => {
    it("returns true for first call (debounce not triggered)", () => {
      expect(hooks.canSearch("pdf-processing")).toBe(true);
    });

    it("returns false when called again within debounce period", () => {
      hooks.canSearch("pdf-processing");
      expect(hooks.canSearch("pdf-processing")).toBe(false);
    });

    it("respects debounce period and returns true after it passes", async () => {
      hooks = new PluginHooks({ debounceMs: 50 });
      hooks.canSearch("pdf-processing");

      await new Promise((r) => setTimeout(r, 60));
      expect(hooks.canSearch("pdf-processing")).toBe(true);
    });

    it("tracks different categories independently", () => {
      hooks.canSearch("pdf-processing");
      // Different category should still be allowed
      expect(hooks.canSearch("git-workflows")).toBe(true);
      // Original is still debounced
      expect(hooks.canSearch("pdf-processing")).toBe(false);
    });
  });

  // --- onSessionCreated ---

  describe("onSessionCreated", () => {
    it("logs session start", async () => {
      await hooks.onSessionCreated(null);
      expect(console.log).toHaveBeenCalledWith("skill-finder: session started");
    });

    it("resets debounce state", async () => {
      hooks.canSearch("pdf-processing");
      expect(hooks.canSearch("pdf-processing")).toBe(false);

      await hooks.onSessionCreated(null);
      // Should be true again after session reset
      expect(hooks.canSearch("pdf-processing")).toBe(true);
    });
  });

  // --- onMessagePartUpdated ---

  describe("onMessagePartUpdated", () => {
    it("detects categories from input text", async () => {
      await hooks.onMessagePartUpdated({ text: "help me with pdf" }, null);
      expect(console.log).toHaveBeenCalledWith(
        "skill-finder: detected category 'pdf-processing' from message",
      );
    });

    it("detects categories from output text", async () => {
      await hooks.onMessagePartUpdated(null, { content: "git commit" });
      expect(console.log).toHaveBeenCalledWith(
        "skill-finder: detected category 'git-workflows' from message",
      );
    });

    it("handles string input directly", async () => {
      await hooks.onMessagePartUpdated("deploy to production", null);
      expect(console.log).toHaveBeenCalledWith(
        "skill-finder: detected category 'deployment' from message",
      );
    });

    it("does not log when no categories match", async () => {
      await hooks.onMessagePartUpdated({ text: "hello" }, null);
      expect(console.log).not.toHaveBeenCalled();
    });

    it("respects debouncing", async () => {
      await hooks.onMessagePartUpdated({ text: "pdf tools" }, null);
      vi.mocked(console.log).mockClear();
      await hooks.onMessagePartUpdated({ text: "pdf tools" }, null);
      // Should not log again due to debounce
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  // --- onToolExecuteBefore ---

  describe("onToolExecuteBefore", () => {
    it("detects pdf from read tool", async () => {
      await hooks.onToolExecuteBefore(
        { toolName: "read", args: { filename: "/path/to/doc.pdf" } },
        null,
      );
      expect(console.log).toHaveBeenCalledWith(
        "skill-finder: detected category 'pdf-processing' from tool",
      );
    });

    it("detects git from bash tool", async () => {
      await hooks.onToolExecuteBefore(
        { toolName: "bash", args: { command: "git status" } },
        null,
      );
      expect(console.log).toHaveBeenCalledWith(
        "skill-finder: detected category 'git-workflows' from tool",
      );
    });

    it("detects npm from bash tool", async () => {
      await hooks.onToolExecuteBefore(
        { toolName: "bash", args: { command: "npm publish" } },
        null,
      );
      expect(console.log).toHaveBeenCalledWith(
        "skill-finder: detected category 'deployment' from tool",
      );
    });

    it("detects docker from bash tool", async () => {
      await hooks.onToolExecuteBefore(
        { toolName: "bash", args: { command: "docker build ." } },
        null,
      );
      expect(console.log).toHaveBeenCalledWith(
        "skill-finder: detected category 'docker' from tool",
      );
    });

    it("detects test from bash tool", async () => {
      await hooks.onToolExecuteBefore(
        { toolName: "bash", args: { command: "npx vitest run" } },
        null,
      );
      expect(console.log).toHaveBeenCalledWith(
        "skill-finder: detected category 'testing' from tool",
      );
    });

    it("does nothing for unknown tool", async () => {
      await hooks.onToolExecuteBefore({ toolName: "unknown_tool", args: {} }, null);
      expect(console.log).not.toHaveBeenCalled();
    });

    it("does nothing for null input", async () => {
      await hooks.onToolExecuteBefore(null, null);
      expect(console.log).not.toHaveBeenCalled();
    });

    it("respects debouncing for tools", async () => {
      await hooks.onToolExecuteBefore(
        { toolName: "read", args: { filename: "doc.pdf" } },
        null,
      );
      vi.mocked(console.log).mockClear();
      await hooks.onToolExecuteBefore(
        { toolName: "read", args: { filename: "doc.pdf" } },
        null,
      );
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  // --- adaptive throttle ---

  describe("adaptive throttle", () => {
    it("tracks recommendationCount when suppressOn is provided", () => {
      expect(hooks.getRecommendationCount()).toBe(0);
      hooks.canSearch("pdf-processing", { acceptanceRate: 0.5, consecutiveDismissals: 0 });
      expect(hooks.getRecommendationCount()).toBe(1);
      hooks.canSearch("pdf-processing", { acceptanceRate: 0.5, consecutiveDismissals: 0 });
      expect(hooks.getRecommendationCount()).toBe(2);
    });

    it("does not increment recommendationCount without suppressOn", () => {
      hooks.canSearch("pdf-processing");
      hooks.canSearch("pdf-processing");
      expect(hooks.getRecommendationCount()).toBe(0);
    });

    it("doubles debounce to 60s when acceptanceRate < 0.2", async () => {
      hooks = new PluginHooks({ debounceMs: 30_000 });
      hooks.canSearch("pdf-processing", { acceptanceRate: 0.1, consecutiveDismissals: 0 });
      vi.mocked(console.log).mockClear();
      const originalNow = Date.now;
      const baseTime = originalNow();
      let currentTime = baseTime;
      vi.spyOn(Date, "now").mockImplementation(() => currentTime);

      hooks.canSearch("pdf-processing", { acceptanceRate: 0.1, consecutiveDismissals: 0 });

      currentTime = baseTime + 31_000;
      expect(hooks.canSearch("pdf-processing", { acceptanceRate: 0.1, consecutiveDismissals: 0 })).toBe(false);

      currentTime = baseTime + 61_000;
      expect(hooks.canSearch("pdf-processing", { acceptanceRate: 0.1, consecutiveDismissals: 0 })).toBe(true);

      Date.now = originalNow;
    });

    it("halves debounce to 15s when acceptanceRate > 0.5", async () => {
      hooks = new PluginHooks({ debounceMs: 30_000 });
      const originalNow = Date.now;
      const baseTime = originalNow();
      let currentTime = baseTime;
      vi.spyOn(Date, "now").mockImplementation(() => currentTime);

      hooks.canSearch("pdf-processing", { acceptanceRate: 0.7, consecutiveDismissals: 0 });

      currentTime = baseTime + 16_000;
      expect(hooks.canSearch("pdf-processing", { acceptanceRate: 0.7, consecutiveDismissals: 0 })).toBe(true);

      Date.now = originalNow;
    });

    it("suppresses entirely when consecutiveDismissals >= 5", () => {
      hooks.canSearch("pdf-processing", { acceptanceRate: 0, consecutiveDismissals: 5 });
      expect(hooks.isSuppressed()).toBe(true);
      expect(hooks.canSearch("pdf-processing", { acceptanceRate: 1.0, consecutiveDismissals: 0 })).toBe(false);
    });

    it("recordAcceptance resets consecutiveDismissals", () => {
      hooks.recordDismissal();
      hooks.recordDismissal();
      hooks.recordDismissal();
      expect(hooks.getConsecutiveDismissals()).toBe(3);
      hooks.recordAcceptance();
      expect(hooks.getConsecutiveDismissals()).toBe(0);
      expect(hooks.getAcceptanceCount()).toBe(1);
    });

    it("recordDismissal increments consecutiveDismissals", () => {
      hooks.recordDismissal();
      hooks.recordDismissal();
      expect(hooks.getConsecutiveDismissals()).toBe(2);
    });

    it("zero acceptance rate leads to eventual suppression via adaptive debounce", () => {
      hooks.recordDismissal();
      hooks.recordDismissal();
      hooks.recordDismissal();
      const dismissed = hooks.getConsecutiveDismissals();
      hooks.canSearch("pdf-processing", { acceptanceRate: 0, consecutiveDismissals: dismissed });
      expect(hooks.getRecommendationCount()).toBe(1);
    });

    it("resets adaptive state on session created", async () => {
      hooks.recordDismissal();
      hooks.recordDismissal();
      hooks.recordDismissal();
      hooks.canSearch("pdf-processing", { acceptanceRate: 0, consecutiveDismissals: 3 });
      expect(hooks.getRecommendationCount()).toBe(1);
      expect(hooks.getConsecutiveDismissals()).toBe(3);

      await hooks.onSessionCreated(null);
      expect(hooks.getRecommendationCount()).toBe(0);
      expect(hooks.getAcceptanceCount()).toBe(0);
      expect(hooks.getConsecutiveDismissals()).toBe(0);
      expect(hooks.isSuppressed()).toBe(false);
    });

    it("acceptanceRate exactly 0.5 uses default debounce (no adjustment)", async () => {
      hooks = new PluginHooks({ debounceMs: 30_000 });
      const originalNow = Date.now;
      const baseTime = originalNow();
      let currentTime = baseTime;
      vi.spyOn(Date, "now").mockImplementation(() => currentTime);

      hooks.canSearch("pdf-processing", { acceptanceRate: 0.5, consecutiveDismissals: 0 });

      currentTime = baseTime + 31_000;
      expect(hooks.canSearch("pdf-processing", { acceptanceRate: 0.5, consecutiveDismissals: 0 })).toBe(true);

      Date.now = originalNow;
    });

    it("backward compatible: single-arg canSearch works unchanged", () => {
      expect(hooks.canSearch("pdf-processing")).toBe(true);
      expect(hooks.canSearch("pdf-processing")).toBe(false);
      expect(hooks.getRecommendationCount()).toBe(0);
    });
  });
});
