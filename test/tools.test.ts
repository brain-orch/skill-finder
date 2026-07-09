import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchTool } from "../src/tools/search.js";
import { installTool } from "../src/tools/install.js";
import { listTool } from "../src/tools/list.js";
import { removeTool } from "../src/tools/remove.js";
import { infoTool } from "../src/tools/info.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// Mock context for tool execution
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

// Mock the registry instance to avoid real network calls
vi.mock("../src/registry/instance.js", () => ({
  marketplaceRegistry: {
    searchAll: vi.fn(),
    getMarketplace: vi.fn(),
    listAvailable: vi.fn(() => ["lobehub", "skillssh", "agentskillsh"]),
  },
}));

import { marketplaceRegistry } from "../src/registry/instance.js";

describe("skill-finder tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── search ────────────────────────────────────────────────────────
  describe("search tool", () => {
    it("returns markdown results for valid query", async () => {
      vi.mocked(marketplaceRegistry.searchAll).mockResolvedValue([
        {
          id: "lobehub:pdf-tools",
          name: "pdf-tools",
          description: "PDF processing toolkit",
          marketplace: "lobehub",
          category: "pdf",
          triggers: ["pdf"],
          installCount: 500,
          stars: 4.5,
          installCommand: "npx -y @lobehub/market-cli skills install pdf-tools --agent codex",
          homepageUrl: "https://lobehub.com/skills/pdf-tools",
          verified: true,
        },
      ]);

      const result = await searchTool.execute({ query: "pdf tools" }, mockCtx);
      expect(result).toContain('## Search Results for "pdf tools"');
      expect(result).toContain("📦 lobehub");
      expect(result).toContain("**pdf-tools**");
      expect(result).toContain("Total: 1 skills found");
    });

    it("returns no results message when empty", async () => {
      vi.mocked(marketplaceRegistry.searchAll).mockResolvedValue([]);
      const result = await searchTool.execute({ query: "xyz" }, mockCtx);
      expect(result).toContain("No matching skills found");
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
      vi.mocked(marketplaceRegistry.searchAll).mockResolvedValue([
        {
          id: "lobehub:test-skill",
          name: "test-skill",
          description: "A test skill",
          marketplace: "lobehub",
          category: null,
          triggers: [],
          installCount: 10,
          stars: 3,
          installCommand: "npx install test-skill",
          homepageUrl: "https://example.com/test-skill",
          verified: false,
        },
      ]);
      const result = await searchTool.execute({ query: "test", limit: 10 }, mockCtx);
      expect(result).toContain("showing top 10");
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
      expect(result).toContain("⚠️ Confirmation Required");
      expect(result).toContain("confirm=true");
    });

    it("returns success message with confirm=true", async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tools-install-test-"));
      const skillsDir = path.join(tmpDir, ".opencode", "skills");
      fs.mkdirSync(skillsDir, { recursive: true });

      vi.mocked(marketplaceRegistry.getMarketplace).mockReturnValue({
        name: "lobehub",
        install: vi.fn().mockImplementation(async (_id: string, targetDir: string) => {
          const skillDir = path.join(targetDir, "lobehub", "pdf-tools");
          fs.mkdirSync(skillDir, { recursive: true });
          fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# PDF Tools\n");
          return { path: skillDir, files: ["SKILL.md"] };
        }),
      } as any);

      const result = await installTool.execute({
        identifier: "pdf-tools",
        marketplace: "lobehub",
        confirm: true,
      }, { ...mockCtx, directory: tmpDir, worktree: tmpDir });
      expect(result).toContain("✅ Installed pdf-tools");
      expect(result).toContain("**Marketplace:** lobehub");

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("returns error for unknown marketplace", async () => {
      vi.mocked(marketplaceRegistry.getMarketplace).mockReturnValue(undefined);
      const result = await installTool.execute({
        identifier: "pdf-tools",
        marketplace: "unknown",
        confirm: true,
      }, mockCtx);
      expect(result).toContain("❌ Unknown Marketplace");
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
    const tmpBase = path.join(os.tmpdir(), `skill-finder-test-${Date.now()}`);

    afterEach(() => {
      try {
        fs.rmSync(tmpBase, { recursive: true, force: true });
      } catch {
        // ignore
      }
    });

    it("returns empty message when no skills cached", async () => {
      const result = await listTool.execute({}, { ...mockCtx, directory: tmpBase, worktree: tmpBase });
      expect(result).toContain("No skills installed");
    });

    it("lists installed skills from filesystem", async () => {
      const skillDir = path.join(tmpBase, ".opencode", "skills", "lobehub", "pdf-tools");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# PDF Tools\n");

      const result = await listTool.execute({}, { ...mockCtx, directory: tmpBase, worktree: tmpBase });
      expect(result).toContain("## Installed Skills");
      expect(result).toContain("opencode");
      expect(result).toContain("**lobehub:pdf-tools**");
      expect(result).toContain("Total: 1 skills installed");
    });

    it("toolDefinition has correct structure", () => {
      expect(listTool.description).toBe("List locally cached skills");
      expect(listTool.args).toBeDefined();
    });
  });

  // ── remove ────────────────────────────────────────────────────────
  describe("remove tool", () => {
    const tmpBase = path.join(os.tmpdir(), `skill-finder-remove-${Date.now()}`);

    afterEach(() => {
      try {
        fs.rmSync(tmpBase, { recursive: true, force: true });
      } catch {
        // ignore
      }
    });

    it("returns success message for valid identifier", async () => {
      const skillDir = path.join(tmpBase, ".opencode", "skills", "lobehub", "pdf-tools");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# PDF Tools\n");

      const result = await removeTool.execute(
        { identifier: "lobehub:pdf-tools" },
        { ...mockCtx, directory: tmpBase, worktree: tmpBase },
      );
      expect(result).toContain("✅ Removed lobehub:pdf-tools");
      expect(fs.existsSync(skillDir)).toBe(false);
    });

    it("returns not found for non-existent skill", async () => {
      const result = await removeTool.execute(
        { identifier: "lobehub:nonexistent" },
        { ...mockCtx, directory: tmpBase, worktree: tmpBase },
      );
      expect(result).toContain("❌ Not Found");
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
      vi.mocked(marketplaceRegistry.getMarketplace).mockReturnValue(undefined);
      vi.mocked(marketplaceRegistry.searchAll).mockResolvedValue([]);

      const result = await infoTool.execute({ identifier: "pdf-tools" }, mockCtx);
      expect(result).toContain("❌ Skill Not Found");
      expect(result).toContain("pdf-tools");
    });

    it("returns skill details when found", async () => {
      const skill = {
        id: "lobehub:pdf-tools",
        name: "pdf-tools",
        description: "PDF processing toolkit",
        marketplace: "lobehub",
        category: "pdf",
        triggers: ["pdf"],
        installCount: 500,
        stars: 4.5,
        installCommand: "npx -y @lobehub/market-cli skills install pdf-tools --agent codex",
        homepageUrl: "https://lobehub.com/skills/pdf-tools",
        verified: true,
      };

      vi.mocked(marketplaceRegistry.getMarketplace).mockReturnValue({
        name: "lobehub",
        getSkillInfo: vi.fn().mockResolvedValue(skill),
      } as any);

      const result = await infoTool.execute({ identifier: "lobehub:pdf-tools" }, mockCtx);
      expect(result).toContain("## pdf-tools");
      expect(result).toContain("**Marketplace**");
      expect(result).toContain("lobehub");
      expect(result).toContain("**Verified**");
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
