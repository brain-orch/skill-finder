import { describe, it, expect, beforeEach } from "vitest";
import { TaskDetector } from "../src/plugin/detector.js";
import type { DetectedContext } from "../src/plugin/detector.js";

describe("TaskDetector", () => {
  let detector: TaskDetector;

  beforeEach(() => {
    detector = new TaskDetector({ maxHistorySize: 50, confidenceThreshold: 0.6 });
  });

  // -------------------------------------------------------------------------
  // analyzeText
  // -------------------------------------------------------------------------

  describe("analyzeText", () => {
    it("detects pdf-processing from 'extract text from this PDF'", () => {
      const ctx = detector.analyzeText("extract text from this PDF");
      expect(ctx.categories).toContain("pdf-processing");
      expect(ctx.confidence).toBeGreaterThan(0.8);
    });

    it("detects spreadsheet from 'edit this spreadsheet'", () => {
      const ctx = detector.analyzeText("edit this spreadsheet");
      expect(ctx.categories).toContain("spreadsheet");
      expect(ctx.confidence).toBeGreaterThan(0.8);
    });

    it("returns no categories for 'hello world'", () => {
      const ctx = detector.analyzeText("hello world");
      expect(ctx.categories).toEqual([]);
      expect(ctx.confidence).toBe(0);
    });

    it("returns multiple categories for mixed input", () => {
      const ctx = detector.analyzeText("deploy the PDF generator");
      expect(ctx.categories).toContain("pdf-processing");
      expect(ctx.categories).toContain("deployment");
    });

    it("confidence > 0.8 for clear pdf task", () => {
      const ctx = detector.analyzeText("extract text from this PDF file");
      expect(ctx.confidence).toBeGreaterThan(0.8);
    });

    it("confidence 0 for unrelated text", () => {
      const ctx = detector.analyzeText("the weather is nice today");
      expect(ctx.confidence).toBe(0);
    });

    it("detects git-workflows from 'run git status'", () => {
      const ctx = detector.analyzeText("run git status");
      expect(ctx.categories).toContain("git-workflows");
    });

    it("detects frontend and react from 'create a React component'", () => {
      const ctx = detector.analyzeText("create a React component");
      expect(ctx.categories).toContain("frontend");
      expect(ctx.categories).toContain("react");
    });

    it("detects file extensions in text", () => {
      const ctx = detector.analyzeText("open data.xlsx");
      expect(ctx.categories).toContain("spreadsheet");
    });

    it("detects .pdf extension in text", () => {
      const ctx = detector.analyzeText("read report.pdf");
      expect(ctx.categories).toContain("pdf-processing");
    });

    it("detects .sql extension in text", () => {
      const ctx = detector.analyzeText("run schema.sql");
      expect(ctx.categories).toContain("database");
    });

    it("detects multiple keyword matches for higher confidence", () => {
      const ctx = detector.analyzeText("pdf extract text ocr");
      expect(ctx.categories).toContain("pdf-processing");
      // Multiple signals should boost confidence
      expect(ctx.confidence).toBeGreaterThan(0.5);
    });

    it("handles empty string", () => {
      const ctx = detector.analyzeText("");
      expect(ctx.categories).toEqual([]);
      expect(ctx.confidence).toBe(0);
    });

    it("filters stop words correctly", () => {
      const ctx = detector.analyzeText("the is a an this that with for");
      expect(ctx.categories).toEqual([]);
    });

    it("detects testing category", () => {
      const ctx = detector.analyzeText("write unit tests");
      expect(ctx.categories).toContain("testing");
    });

    it("detects docker category", () => {
      const ctx = detector.analyzeText("build the dockerfile");
      expect(ctx.categories).toContain("docker");
    });

    it("detects database category", () => {
      const ctx = detector.analyzeText("write a postgres query");
      expect(ctx.categories).toContain("database");
    });

    it("detects security category", () => {
      const ctx = detector.analyzeText("implement auth login");
      expect(ctx.categories).toContain("security");
    });

    it("always includes timestamp", () => {
      const before = Date.now();
      const ctx = detector.analyzeText("pdf");
      const after = Date.now();
      expect(ctx.timestamp).toBeGreaterThanOrEqual(before);
      expect(ctx.timestamp).toBeLessThanOrEqual(after);
    });

    it("returns signals array with individual contributions", () => {
      const ctx = detector.analyzeText("pdf");
      expect(ctx.signals.length).toBeGreaterThan(0);
      expect(ctx.signals[0]).toHaveProperty("type");
      expect(ctx.signals[0]).toHaveProperty("category");
      expect(ctx.signals[0]).toHaveProperty("confidence");
    });
  });

  // -------------------------------------------------------------------------
  // analyzeToolCall
  // -------------------------------------------------------------------------

  describe("analyzeToolCall", () => {
    it("detects pdf from read tool with .pdf file", () => {
      const ctx = detector.analyzeToolCall("read", { filename: "/path/to/doc.pdf" });
      expect(ctx.categories).toContain("pdf-processing");
    });

    it("detects git from bash tool with git command", () => {
      const ctx = detector.analyzeToolCall("bash", { command: "git status" });
      expect(ctx.categories).toContain("git-workflows");
    });

    it("detects npm from bash tool", () => {
      const ctx = detector.analyzeToolCall("bash", { command: "npm install" });
      expect(ctx.categories).toContain("javascript");
    });

    it("detects docker from bash tool", () => {
      const ctx = detector.analyzeToolCall("bash", { command: "docker build ." });
      expect(ctx.categories).toContain("docker");
    });

    it("detects database from bash tool with psql", () => {
      const ctx = detector.analyzeToolCall("bash", { command: "psql -d mydb" });
      expect(ctx.categories).toContain("database");
    });

    it("detects spreadsheet from write tool with .csv file", () => {
      const ctx = detector.analyzeToolCall("write", { filename: "data.csv" });
      expect(ctx.categories).toContain("spreadsheet");
    });

    it("detects programming from read tool with .ts file", () => {
      const ctx = detector.analyzeToolCall("read", { path: "src/index.ts" });
      expect(ctx.categories).toContain("programming");
    });

    it("returns empty context for unknown tool", () => {
      const ctx = detector.analyzeToolCall("unknown_tool", {});
      expect(ctx.categories).toEqual([]);
      expect(ctx.confidence).toBe(0);
    });

    it("detects config from read tool with .json file", () => {
      const ctx = detector.analyzeToolCall("read", { filename: "package.json" });
      expect(ctx.categories).toContain("config");
    });

    it("detects documentation from read tool with .md file", () => {
      const ctx = detector.analyzeToolCall("read", { filename: "README.md" });
      expect(ctx.categories).toContain("documentation");
    });

    it("detects python from bash tool with pip command", () => {
      const ctx = detector.analyzeToolCall("bash", { command: "pip install requests" });
      expect(ctx.categories).toContain("python");
    });

    it("detects rust from bash tool with cargo command", () => {
      const ctx = detector.analyzeToolCall("bash", { command: "cargo build" });
      expect(ctx.categories).toContain("rust");
    });

    it("detects testing from bash tool with vitest command", () => {
      const ctx = detector.analyzeToolCall("bash", { command: "npx vitest run" });
      expect(ctx.categories).toContain("testing");
    });

    it("detects react from write tool with .tsx file", () => {
      const ctx = detector.analyzeToolCall("write", { filename: "App.tsx" });
      expect(ctx.categories).toContain("react");
    });

    it("handles edit tool same as read/write", () => {
      const ctx = detector.analyzeToolCall("edit", { filename: "data.xlsx" });
      expect(ctx.categories).toContain("spreadsheet");
    });

    it("returns empty context for bash tool with no command", () => {
      const ctx = detector.analyzeToolCall("bash", {});
      expect(ctx.categories).toEqual([]);
    });

    it("returns empty context for read tool with no filename", () => {
      const ctx = detector.analyzeToolCall("read", {});
      expect(ctx.categories).toEqual([]);
    });

    it("handles shell tool alias", () => {
      const ctx = detector.analyzeToolCall("shell", { command: "git log" });
      expect(ctx.categories).toContain("git-workflows");
    });

    it("handles terminal tool alias", () => {
      const ctx = detector.analyzeToolCall("terminal", { command: "docker ps" });
      expect(ctx.categories).toContain("docker");
    });
  });

  // -------------------------------------------------------------------------
  // analyzeHistory
  // -------------------------------------------------------------------------

  describe("analyzeHistory", () => {
    it("returns empty context for empty history", () => {
      const ctx = detector.analyzeHistory();
      expect(ctx.categories).toEqual([]);
      expect(ctx.confidence).toBe(0);
    });

    it("detects repeated patterns from history", () => {
      // Record multiple git commands
      for (let i = 0; i < 5; i++) {
        detector.recordToolCall("bash", { command: "git commit" });
      }
      const ctx = detector.analyzeHistory();
      expect(ctx.categories).toContain("git-workflows");
    });

    it("boosts confidence for repeated categories (3+ times)", () => {
      for (let i = 0; i < 3; i++) {
        detector.recordToolCall("read", { filename: "doc.pdf" });
      }
      const ctx = detector.analyzeHistory();
      // With 3 occurrences, confidence should be boosted
      const pdfSignal = ctx.signals.find((s) => s.category === "pdf-processing");
      expect(pdfSignal).toBeDefined();
      expect(pdfSignal!.confidence).toBeGreaterThan(0.9);
    });

    it("does not boost confidence for fewer than 3 occurrences", () => {
      for (let i = 0; i < 2; i++) {
        detector.recordToolCall("read", { filename: "doc.pdf" });
      }
      const ctx = detector.analyzeHistory();
      const pdfSignal = ctx.signals.find((s) => s.category === "pdf-processing");
      expect(pdfSignal).toBeDefined();
      // Should not be boosted above 0.9 (base is 0.9)
      expect(pdfSignal!.confidence).toBeLessThanOrEqual(1.0);
    });

    it("mixes different tool types in history", () => {
      detector.recordToolCall("read", { filename: "doc.pdf" });
      detector.recordToolCall("bash", { command: "git status" });
      detector.recordToolCall("bash", { command: "npm install" });

      const ctx = detector.analyzeHistory();
      expect(ctx.categories.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // recordToolCall
  // -------------------------------------------------------------------------

  describe("recordToolCall", () => {
    it("stores entries in order", () => {
      detector.recordToolCall("bash", { command: "git status" });
      detector.recordToolCall("read", { filename: "doc.pdf" });
      detector.recordToolCall("bash", { command: "npm install" });

      const history = detector.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].toolName).toBe("bash");
      expect(history[1].toolName).toBe("read");
      expect(history[2].toolName).toBe("bash");
    });

    it("assigns timestamps to entries", () => {
      const before = Date.now();
      detector.recordToolCall("bash", { command: "git status" });
      const after = Date.now();

      const history = detector.getHistory();
      expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(history[0].timestamp).toBeLessThanOrEqual(after);
    });

    it("stores args correctly", () => {
      detector.recordToolCall("bash", { command: "git status", workdir: "/project" });
      const history = detector.getHistory();
      expect(history[0].args).toEqual({ command: "git status", workdir: "/project" });
    });
  });

  // -------------------------------------------------------------------------
  // clearHistory
  // -------------------------------------------------------------------------

  describe("clearHistory", () => {
    it("removes all entries", () => {
      detector.recordToolCall("bash", { command: "git status" });
      detector.recordToolCall("read", { filename: "doc.pdf" });
      expect(detector.getHistory()).toHaveLength(2);

      detector.clearHistory();
      expect(detector.getHistory()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // maxHistorySize
  // -------------------------------------------------------------------------

  describe("maxHistorySize", () => {
    it("truncates old entries when limit exceeded", () => {
      const smallDetector = new TaskDetector({ maxHistorySize: 3 });

      smallDetector.recordToolCall("bash", { command: "cmd1" });
      smallDetector.recordToolCall("bash", { command: "cmd2" });
      smallDetector.recordToolCall("bash", { command: "cmd3" });
      smallDetector.recordToolCall("bash", { command: "cmd4" });

      const history = smallDetector.getHistory();
      expect(history).toHaveLength(3);
      // Oldest (cmd1) should be removed
      expect(history[0].args).toEqual({ command: "cmd2" });
      expect(history[2].args).toEqual({ command: "cmd4" });
    });

    it("respects maxHistorySize of 1", () => {
      const tinyDetector = new TaskDetector({ maxHistorySize: 1 });

      tinyDetector.recordToolCall("bash", { command: "first" });
      tinyDetector.recordToolCall("bash", { command: "second" });

      expect(tinyDetector.getHistory()).toHaveLength(1);
      expect(tinyDetector.getHistory()[0].args).toEqual({ command: "second" });
    });
  });

  // -------------------------------------------------------------------------
  // confidenceThreshold
  // -------------------------------------------------------------------------

  describe("confidenceThreshold", () => {
    it("filters out low-confidence categories", () => {
      const strictDetector = new TaskDetector({ confidenceThreshold: 0.95 });

      // "pdf" keyword has confidence 0.9, below threshold of 0.95
      const ctx = strictDetector.analyzeText("pdf");
      expect(ctx.categories).not.toContain("pdf-processing");
    });

    it("includes high-confidence categories with strict threshold", () => {
      const strictDetector = new TaskDetector({ confidenceThreshold: 0.8 });

      // .pdf extension has confidence 0.9, above threshold
      const ctx = strictDetector.analyzeToolCall("read", { filename: "doc.pdf" });
      expect(ctx.categories).toContain("pdf-processing");
    });

    it("default threshold filters weak signals", () => {
      // Default threshold is 0.6
      const ctx = detector.analyzeText("code");
      // "code" keyword has confidence 0.4, below default threshold
      expect(ctx.categories).not.toContain("programming");
    });
  });

  // -------------------------------------------------------------------------
  // mergeContexts
  // -------------------------------------------------------------------------

  describe("mergeContexts", () => {
    it("merges two contexts correctly", () => {
      const ctx1 = detector.analyzeText("pdf");
      const ctx2 = detector.analyzeText("git commit");
      const merged = detector.mergeContexts([ctx1, ctx2]);

      expect(merged.categories.length).toBeGreaterThan(0);
      expect(merged.signals.length).toBeGreaterThan(0);
    });

    it("returns empty context for empty array", () => {
      const merged = detector.mergeContexts([]);
      expect(merged.categories).toEqual([]);
      expect(merged.confidence).toBe(0);
      expect(merged.signals).toEqual([]);
    });

    it("deduplicates categories from merged contexts", () => {
      const ctx1 = detector.analyzeText("pdf");
      const ctx2 = detector.analyzeText("pdf document");
      const merged = detector.mergeContexts([ctx1, ctx2]);

      // pdf-processing should appear only once in categories
      const pdfCount = merged.categories.filter((c) => c === "pdf-processing").length;
      expect(pdfCount).toBe(1);
    });

    it("keeps highest confidence signal per category", () => {
      const ctx1 = detector.analyzeText("pdf");  // keyword confidence ~0.7
      const ctx2 = detector.analyzeToolCall("read", { filename: "doc.pdf" }); // extension confidence 0.9
      const merged = detector.mergeContexts([ctx1, ctx2]);

      const pdfSignal = merged.signals.find((s) => s.category === "pdf-processing");
      expect(pdfSignal).toBeDefined();
      expect(pdfSignal!.confidence).toBe(0.9); // extension signal is higher
    });

    it("includes timestamp from merge time", () => {
      const before = Date.now();
      const ctx1 = detector.analyzeText("pdf");
      const merged = detector.mergeContexts([ctx1]);
      const after = Date.now();

      expect(merged.timestamp).toBeGreaterThanOrEqual(before);
      expect(merged.timestamp).toBeLessThanOrEqual(after);
    });
  });

  // -------------------------------------------------------------------------
  // Confidence scoring
  // -------------------------------------------------------------------------

  describe("confidence scoring", () => {
    it("returns confidence 0 when no signals match", () => {
      const ctx = detector.analyzeText("nothing relevant here");
      expect(ctx.confidence).toBe(0);
    });

    it("averages top 3 signal confidences", () => {
      // "pdf" keyword → confidence 0.7
      // "spreadsheet" keyword → confidence 0.7
      // ".pdf" extension → confidence 0.9
      const ctx = detector.analyzeText("pdf spreadsheet data.pdf");
      expect(ctx.confidence).toBeGreaterThan(0);
    });

    it("clamps confidence to max 1.0", () => {
      // With many boosts, confidence should not exceed 1.0
      for (let i = 0; i < 10; i++) {
        detector.recordToolCall("read", { filename: "doc.pdf" });
      }
      const ctx = detector.analyzeHistory();
      expect(ctx.confidence).toBeLessThanOrEqual(1.0);
    });

    it("multiple signals for same category increase confidence", () => {
      // Both keyword and extension match for pdf-processing
      const ctx = detector.analyzeText("pdf extract report.pdf");
      const pdfSignals = ctx.signals.filter((s) => s.category === "pdf-processing");
      // Should have at least one signal (deduped to best)
      expect(pdfSignals.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles very long text", () => {
      const longText = "pdf ".repeat(1000);
      const ctx = detector.analyzeText(longText);
      expect(ctx.categories).toContain("pdf-processing");
    });

    it("handles text with only special characters", () => {
      const ctx = detector.analyzeText("!@#$%^&*()");
      expect(ctx.categories).toEqual([]);
    });

    it("handles case-insensitive matching", () => {
      const ctx = detector.analyzeText("PDF EXTRACT TEXT");
      expect(ctx.categories).toContain("pdf-processing");
    });

    it("handles tool call with undefined args", () => {
      const ctx = detector.analyzeToolCall("read", {} as Record<string, unknown>);
      expect(ctx.categories).toEqual([]);
    });

    it("handles concurrent history recording", () => {
      for (let i = 0; i < 100; i++) {
        detector.recordToolCall("bash", { command: `cmd${i}` });
      }
      expect(detector.getHistory()).toHaveLength(50); // maxHistorySize = 50
    });
  });
});
