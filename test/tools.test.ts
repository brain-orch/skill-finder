import { describe, it, expect } from "vitest";
import { searchTool } from "../src/tools/search.js";
import { installTool } from "../src/tools/install.js";
import { listTool } from "../src/tools/list.js";
import { removeTool } from "../src/tools/remove.js";
import { infoTool } from "../src/tools/info.js";

// Mock context for tool execution
const mockCtx = {
  sessionID: "test-session",
  messageID: "test-message",
  agent: "test",
  directory: "/test",
  worktree: "/test",
  abort: new AbortController().signal,
  metadata: () => {},
  ask: async () => {},
};

describe("skill-finder tools", () => {
  // ── search ────────────────────────────────────────────────────────
  describe("search tool", () => {
    it("returns formatted results for valid query", async () => {
      const result = await searchTool.execute({ query: "pdf tools" }, mockCtx);
      expect(result).toContain('Results for "pdf tools"');
      expect(result).toContain("Found 0 skills");
    });

    it("returns error for empty query", async () => {
      const result = await searchTool.execute({ query: "" }, mockCtx);
      expect(result).toContain("❌ Error");
      expect(result).toContain("query is required");
    });

    it("returns error for whitespace-only query", async () => {
      const result = await searchTool.execute({ query: "   " }, mockCtx);
      expect(result).toContain("❌ Error");
    });

    it("validates limit bounds - too low", async () => {
      const result = await searchTool.execute({ query: "test", limit: 0 }, mockCtx);
      expect(result).toContain("❌ Error");
      expect(result).toContain("limit must be between");
    });

    it("validates limit bounds - too high", async () => {
      const result = await searchTool.execute({ query: "test", limit: 100 }, mockCtx);
      expect(result).toContain("❌ Error");
      expect(result).toContain("limit must be between");
    });

    it("accepts valid limit", async () => {
      const result = await searchTool.execute({ query: "test", limit: 10 }, mockCtx);
      expect(result).toContain("showing top 10");
    });

    it("includes category filter in output when provided", async () => {
      const result = await searchTool.execute({ query: "test", category: "pdf" }, mockCtx);
      expect(result).toContain("Category filter: pdf");
    });

    it("does not include category filter when not provided", async () => {
      const result = await searchTool.execute({ query: "test" }, mockCtx);
      expect(result).not.toContain("Category filter");
    });

    it("toolDefinition has correct structure", () => {
      expect(searchTool.description).toBe("Search for skills across all marketplaces");
      expect(searchTool.args).toBeDefined();
    });
  });

  // ── install ───────────────────────────────────────────────────────
  describe("install tool", () => {
    it("returns confirmation message when confirm=false", async () => {
      const result = await installTool.execute({
        identifier: "pdf-tools",
        marketplace: "lobehub",
        confirm: false,
      }, mockCtx);
      expect(result).toContain("Installation requires confirmation");
      expect(result).toContain("confirm=true");
    });

    it("returns success message with confirm=true", async () => {
      const result = await installTool.execute({
        identifier: "pdf-tools",
        marketplace: "lobehub",
        confirm: true,
      }, mockCtx);
      expect(result).toContain("Installing pdf-tools from lobehub");
      expect(result).toContain("✅ Successfully installed");
    });

    it("returns success message with default confirm (undefined)", async () => {
      const result = await installTool.execute({
        identifier: "pdf-tools",
        marketplace: "lobehub",
      }, mockCtx);
      expect(result).toContain("✅ Successfully installed");
    });

    it("returns error for missing identifier", async () => {
      const result = await installTool.execute({
        identifier: "",
        marketplace: "lobehub",
      }, mockCtx);
      expect(result).toContain("❌ Error");
      expect(result).toContain("identifier is required");
    });

    it("returns error for missing marketplace", async () => {
      const result = await installTool.execute({
        identifier: "pdf-tools",
        marketplace: "",
      }, mockCtx);
      expect(result).toContain("❌ Error");
      expect(result).toContain("marketplace is required");
    });

    it("toolDefinition has correct structure", () => {
      expect(installTool.description).toBe("Download and install a skill");
      expect(installTool.args).toBeDefined();
    });
  });

  // ── list ──────────────────────────────────────────────────────────
  describe("list tool", () => {
    it("returns empty message when no skills cached", async () => {
      const result = await listTool.execute({}, mockCtx);
      expect(result).toContain("No cached skills found");
    });

    it("includes marketplace filter when provided", async () => {
      const result = await listTool.execute({ marketplace: "lobehub" }, mockCtx);
      expect(result).toContain('marketplace="lobehub"');
    });

    it("includes category filter when provided", async () => {
      const result = await listTool.execute({ category: "pdf" }, mockCtx);
      expect(result).toContain('category="pdf"');
    });

    it("includes both filters when both provided", async () => {
      const result = await listTool.execute({ marketplace: "lobehub", category: "pdf" }, mockCtx);
      expect(result).toContain('marketplace="lobehub"');
      expect(result).toContain('category="pdf"');
    });

    it("toolDefinition has correct structure", () => {
      expect(listTool.description).toBe("List locally cached skills");
      expect(listTool.args).toBeDefined();
    });
  });

  // ── remove ────────────────────────────────────────────────────────
  describe("remove tool", () => {
    it("returns success message for valid identifier", async () => {
      const result = await removeTool.execute({ identifier: "pdf-tools" }, mockCtx);
      expect(result).toContain("✅ Removed pdf-tools from cache");
    });

    it("returns error for missing identifier", async () => {
      const result = await removeTool.execute({ identifier: "" }, mockCtx);
      expect(result).toContain("❌ Error");
      expect(result).toContain("identifier is required");
    });

    it("returns error for whitespace-only identifier", async () => {
      const result = await removeTool.execute({ identifier: "   " }, mockCtx);
      expect(result).toContain("❌ Error");
    });

    it("toolDefinition has correct structure", () => {
      expect(removeTool.description).toBe("Remove a cached skill");
      expect(removeTool.args).toBeDefined();
    });
  });

  // ── info ──────────────────────────────────────────────────────────
  describe("info tool", () => {
    it("returns not-found for unknown skill", async () => {
      const result = await infoTool.execute({ identifier: "pdf-tools" }, mockCtx);
      expect(result).toContain("❌ Skill 'pdf-tools' not found");
    });

    it("returns error for missing identifier", async () => {
      const result = await infoTool.execute({ identifier: "" }, mockCtx);
      expect(result).toContain("❌ Error");
      expect(result).toContain("identifier is required");
    });

    it("returns error for whitespace-only identifier", async () => {
      const result = await infoTool.execute({ identifier: "   " }, mockCtx);
      expect(result).toContain("❌ Error");
    });

    it("toolDefinition has correct structure", () => {
      expect(infoTool.description).toBe("Show skill details");
      expect(infoTool.args).toBeDefined();
    });
  });
});
