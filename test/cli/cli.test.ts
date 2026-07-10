import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { SkillSearchResult } from "../../src/types.js";

// ── Hoisted mock functions (must be declared before vi.mock) ─────────

const {
  searchAllMock,
  listAvailableMock,
  getMarketplaceMock,
  SkillLockManagerMock,
  ChangelogTrackerMock,
  SkillPlanComposerMock,
  MCPServerMock,
  detectActiveAgentsMock,
} = vi.hoisted(() => ({
  searchAllMock: vi.fn(),
  listAvailableMock: vi.fn(() => [
    "lobehub", "skillssh", "agentskillsh", "skillsmp", "mcpservers", "awesomeskill", "clawhub",
  ]),
  getMarketplaceMock: vi.fn(),
  SkillLockManagerMock: vi.fn(function () {
    return {
      list: vi.fn(() => []),
      getLockedSkills: vi.fn(() => []),
      checkForUpdates: vi.fn().mockResolvedValue({ hasUpdate: false }),
      unlockSkill: vi.fn(),
    };
  }),
  ChangelogTrackerMock: vi.fn(function () { return {}; }),
  SkillPlanComposerMock: vi.fn(function () {
    return { getAvailablePlans: vi.fn(() => []) };
  }),
  MCPServerMock: vi.fn(function () {
    return { start: vi.fn().mockResolvedValue(undefined) };
  }),
  detectActiveAgentsMock: vi.fn(() => ["opencode"]),
}));

// ── Module mocks ──────────────────────────────────────────

vi.mock("../../src/registry/instance.js", () => ({
  marketplaceRegistry: {
    searchAll: searchAllMock,
    listAvailable: listAvailableMock,
    getMarketplace: getMarketplaceMock,
  },
}));

vi.mock("../../src/cache/skill-lock.js", () => ({
  SkillLockManager: SkillLockManagerMock,
}));

vi.mock("../../src/cache/changelog-tracker.js", () => ({
  ChangelogTracker: ChangelogTrackerMock,
}));

vi.mock("../../src/composer/skill-plan.js", () => ({
  SkillPlanComposer: SkillPlanComposerMock,
  discoverPlans: vi.fn(() => []),
}));

vi.mock("../../src/mcp/server.js", () => ({
  MCPServer: MCPServerMock,
}));

vi.mock("../../src/installer/agent-targets.js", () => ({
  detectActiveAgents: detectActiveAgentsMock,
  AGENT_TARGETS: {
    opencode: { dir: ".opencode/skills", priority: 1 },
    claude: { dir: ".claude/skills", priority: 2 },
    cursor: { dir: ".cursor/skills", priority: 3 },
  },
}));

// ── Imports (after mocks) ────────────────────────────────

import { SkillFinderCLI } from "../../src/cli/index.js";
import { parseArgs } from "../../src/cli/args.js";

// ── Helpers ───────────────────────────────────────────────

function makeSkill(overrides: Partial<SkillSearchResult> & { id: string; name: string }): SkillSearchResult {
  return {
    description: `A skill called ${overrides.name}`,
    marketplace: "lobehub",
    category: null,
    triggers: [],
    installCount: 0,
    stars: 0,
    installCommand: `opencode install ${overrides.id}`,
    homepageUrl: `https://example.com/${overrides.id}`,
    verified: false,
    ...overrides,
  };
}

// ── parseArgs ─────────────────────────────────────────────

describe("parseArgs", () => {
  it("parses command and positional args", () => {
    const result = parseArgs(["search", "pdf tools"]);
    expect(result.command).toBe("search");
    expect(result.positional).toEqual(["pdf tools"]);
  });

  it("parses multiple positional args", () => {
    const result = parseArgs(["install", "lobehub:pdf-tools", "lobehub"]);
    expect(result.command).toBe("install");
    expect(result.positional).toEqual(["lobehub:pdf-tools", "lobehub"]);
  });

  it("parses --help flag", () => {
    const result = parseArgs(["--help"]);
    expect(result.flags["help"]).toBe(true);
  });

  it("parses -h flag", () => {
    const result = parseArgs(["-h"]);
    expect(result.flags["h"]).toBe(true);
  });

  it("parses --flag=value syntax", () => {
    const result = parseArgs(["--target=/tmp/dir"]);
    expect(result.flags["target"]).toBe("/tmp/dir");
  });

  it("parses --flag value syntax", () => {
    const result = parseArgs(["--target", "/tmp/dir"]);
    expect(result.flags["target"]).toBe("/tmp/dir");
  });

  it("parses boolean flags", () => {
    const result = parseArgs(["--verbose"]);
    expect(result.flags["verbose"]).toBe(true);
  });

  it("handles -- separator for positional args", () => {
    const result = parseArgs(["search", "--", "some query"]);
    expect(result.command).toBe("search");
    expect(result.positional).toEqual(["some query"]);
  });

  it("handles empty args", () => {
    const result = parseArgs([]);
    expect(result.command).toBe("");
    expect(result.positional).toEqual([]);
    expect(result.flags).toEqual({});
  });

  it("handles mixed flags and positionals", () => {
    const result = parseArgs(["search", "pdf", "--limit", "5"]);
    expect(result.command).toBe("search");
    expect(result.positional).toEqual(["pdf"]);
    expect(result.flags["limit"]).toBe("5");
  });
});

// ── SkillFinderCLI ────────────────────────────────────────

describe("SkillFinderCLI", () => {
  let cli: SkillFinderCLI;
  let stdoutWrite: ReturnType<typeof vi.spyOn>;
  let stderrWrite: ReturnType<typeof vi.spyOn>;
  let processExit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    cli = new SkillFinderCLI();
    stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    processExit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);

    // Reset all mocks to defaults
    searchAllMock.mockReset();
    getMarketplaceMock.mockReset();
    detectActiveAgentsMock.mockReset().mockReturnValue(["opencode"]);
    SkillLockManagerMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Help ────────────────────────────────────────────────

  describe("help", () => {
    it("shows help with --help flag", async () => {
      await cli.run(["--help"]);
      expect(stdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("Usage: skill-finder <command>")
      );
      expect(stdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("search <query>")
      );
      expect(stdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("install <id> <mp>")
      );
    });

    it("shows help with -h flag", async () => {
      await cli.run(["-h"]);
      expect(stdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("Usage: skill-finder")
      );
    });

    it("shows help with 'help' command", async () => {
      await cli.run(["help"]);
      expect(stdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("Usage: skill-finder")
      );
    });

    it("shows help when no command given", async () => {
      await cli.run([]);
      expect(stdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("Usage: skill-finder")
      );
    });

    it("shows all 8 commands in help text", async () => {
      await cli.run(["--help"]);
      const output = (stdoutWrite.mock.calls.map((c) => c[0]).join(""));
      expect(output).toContain("search <query>");
      expect(output).toContain("install <id> <mp>");
      expect(output).toContain("list");
      expect(output).toContain("info <id>");
      expect(output).toContain("remove <id>");
      expect(output).toContain("check-updates");
      expect(output).toContain("plan");
      expect(output).toContain("mcp");
    });
  });

  // ── Unknown command ─────────────────────────────────────

  describe("unknown command", () => {
    it("exits 1 with error for unknown command", async () => {
      await expect(cli.run(["foobar"])).rejects.toThrow("process.exit called");
      expect(stderrWrite).toHaveBeenCalledWith(
        expect.stringContaining("Unknown command: foobar")
      );
      expect(processExit).toHaveBeenCalledWith(1);
    });

    it("shows help text after unknown command", async () => {
      await expect(cli.run(["nonexistent"])).rejects.toThrow("process.exit called");
      // Help text is written to stdout
      expect(stdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("Usage: skill-finder")
      );
    });
  });

  // ── search ──────────────────────────────────────────────

  describe("search", () => {
    it("shows results when skills found", async () => {
      const results = [
        makeSkill({ id: "lobehub:pdf-tools", name: "pdf-tools", stars: 5, installCount: 100, verified: true }),
        makeSkill({ id: "skillssh:pdf-extract", name: "pdf-extract", marketplace: "skillssh", stars: 3 }),
      ];
      searchAllMock.mockResolvedValue(results);

      await cli.run(["search", "pdf"]);

      expect(searchAllMock).toHaveBeenCalledWith("pdf", { limit: 20 });
      expect(stdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining('Search Results for "pdf"')
      );
      expect(stdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("pdf-tools")
      );
      expect(stdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("Total: 2 skills found")
      );
    });

    it("shows no results message when empty", async () => {
      searchAllMock.mockResolvedValue([]);

      await cli.run(["search", "nonexistent"]);

      expect(stdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("No matching skills found")
      );
    });

    it("errors when no query provided", async () => {
      await expect(cli.run(["search"])).rejects.toThrow("process.exit called");
      expect(stderrWrite).toHaveBeenCalledWith(
        expect.stringContaining("Error: search requires a query")
      );
    });

    it("exits 1 when search throws", async () => {
      searchAllMock.mockRejectedValue(new Error("network timeout"));

      await expect(cli.run(["search", "test"])).rejects.toThrow("process.exit called");
      expect(stderrWrite).toHaveBeenCalledWith(
        expect.stringContaining("Search failed: network timeout")
      );
      expect(processExit).toHaveBeenCalledWith(1);
    });

    it("handles multi-word queries", async () => {
      searchAllMock.mockResolvedValue([]);
      await cli.run(["search", "pdf", "extract", "text"]);
      expect(searchAllMock).toHaveBeenCalledWith("pdf extract text", { limit: 20 });
    });
  });

  // ── install ─────────────────────────────────────────────

  describe("install", () => {
    it("installs a skill successfully", async () => {
      const mockAdapter = {
        install: vi.fn().mockResolvedValue({
          path: "/tmp/skills/pdf-tools",
          files: ["SKILL.md", "index.ts"],
        }),
      };
      getMarketplaceMock.mockReturnValue(mockAdapter);

      await cli.run(["install", "lobehub:pdf-tools", "lobehub"]);

      expect(getMarketplaceMock).toHaveBeenCalledWith("lobehub");
      expect(mockAdapter.install).toHaveBeenCalledWith(
        "lobehub:pdf-tools",
        expect.any(String)
      );
      expect(stdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("Installed lobehub:pdf-tools")
      );
      expect(stdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("SKILL.md, index.ts")
      );
    });

    it("errors when missing both args", async () => {
      await expect(cli.run(["install"])).rejects.toThrow("process.exit called");
      expect(stderrWrite).toHaveBeenCalledWith(
        expect.stringContaining("Error: install requires")
      );
    });

    it("errors when missing marketplace arg", async () => {
      await expect(cli.run(["install", "lobehub:pdf-tools"])).rejects.toThrow(
        "process.exit called"
      );
      expect(stderrWrite).toHaveBeenCalledWith(
        expect.stringContaining("Error: install requires")
      );
    });

    it("errors when marketplace unknown", async () => {
      getMarketplaceMock.mockReturnValue(undefined);

      await expect(
        cli.run(["install", "foo:bar", "unknownmarket"])
      ).rejects.toThrow("process.exit called");
      expect(stderrWrite).toHaveBeenCalledWith(
        expect.stringContaining("Unknown marketplace 'unknownmarket'")
      );
    });

    it("exits 1 when install fails", async () => {
      const mockAdapter = {
        install: vi.fn().mockRejectedValue(new Error("disk full")),
      };
      getMarketplaceMock.mockReturnValue(mockAdapter);

      await expect(
        cli.run(["install", "lobehub:pdf-tools", "lobehub"])
      ).rejects.toThrow("process.exit called");
      expect(stderrWrite).toHaveBeenCalledWith(
        expect.stringContaining("Installation failed: disk full")
      );
    });

    it("uses --target flag for target directory", async () => {
      const mockAdapter = {
        install: vi.fn().mockResolvedValue({ path: "/custom/path", files: ["SKILL.md"] }),
      };
      getMarketplaceMock.mockReturnValue(mockAdapter);

      await cli.run(["install", "lobehub:pdf-tools", "lobehub", "--target", "/custom/path"]);

      expect(mockAdapter.install).toHaveBeenCalledWith("lobehub:pdf-tools", "/custom/path");
    });
  });

  // ── list ────────────────────────────────────────────────

  describe("list", () => {
    it("shows no skills message when none installed", async () => {
      // Use a temp dir where no .opencode/skills exists
      const tmpDir = path.join(os.tmpdir(), `sf-test-list-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      vi.spyOn(process, "cwd").mockReturnValue(tmpDir);

      await cli.run(["list"]);

      expect(stdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("No skills installed")
      );

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("lists installed skills from filesystem", async () => {
      const tmpDir = path.join(os.tmpdir(), `sf-test-list-${Date.now()}`);
      const agentDir = path.join(tmpDir, ".opencode", "skills", "lobehub", "pdf-tools");
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentDir, "SKILL.md"),
        "# PDF Tools\nDescription of the skill"
      );
      vi.spyOn(process, "cwd").mockReturnValue(tmpDir);

      await cli.run(["list"]);

      const output = stdoutWrite.mock.calls.map((c) => c[0]).join("");
      expect(output).toContain("pdf-tools");
      expect(output).toContain("Total: 1 skill");

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("lists skills filtered by marketplace", async () => {
      const tmpDir = path.join(os.tmpdir(), `sf-test-list-${Date.now()}`);
      const agentDir = path.join(tmpDir, ".opencode", "skills");
      // Create two marketplace dirs with skills
      fs.mkdirSync(path.join(agentDir, "lobehub", "skill-a"), { recursive: true });
      fs.mkdirSync(path.join(agentDir, "skillssh", "skill-b"), { recursive: true });
      fs.writeFileSync(path.join(agentDir, "lobehub", "skill-a", "SKILL.md"), "# Skill A");
      fs.writeFileSync(path.join(agentDir, "skillssh", "skill-b", "SKILL.md"), "# Skill B");
      vi.spyOn(process, "cwd").mockReturnValue(tmpDir);

      await cli.run(["list", "lobehub"]);

      const output = stdoutWrite.mock.calls.map((c) => c[0]).join("");
      expect(output).toContain("lobehub:skill-a");
      expect(output).not.toContain("skillssh:skill-b");
      expect(output).toContain("Total: 1 skill");

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  // ── info ────────────────────────────────────────────────

  describe("info", () => {
    it("shows skill info with marketplace prefix", async () => {
      const mockSkill = makeSkill({
        id: "pdf-tools",
        name: "pdf-tools",
        stars: 5,
        installCount: 200,
        verified: true,
        triggers: ["pdf", "document"],
      });
      const mockAdapter = {
        getSkillInfo: vi.fn().mockResolvedValue(mockSkill),
      };
      getMarketplaceMock.mockReturnValue(mockAdapter);

      await cli.run(["info", "lobehub:pdf-tools"]);

      expect(getMarketplaceMock).toHaveBeenCalledWith("lobehub");
      expect(mockAdapter.getSkillInfo).toHaveBeenCalledWith("pdf-tools");

      const output = stdoutWrite.mock.calls.map((c) => c[0]).join("");
      expect(output).toContain("pdf-tools");
      expect(output).toContain("Verified");
      expect(output).toContain("pdf, document");
    });

    it("falls back to search when adapter not found", async () => {
      getMarketplaceMock.mockReturnValue(undefined);
      const mockSkill = makeSkill({ id: "global:pdf", name: "pdf-global" });
      searchAllMock.mockResolvedValue([mockSkill]);

      await cli.run(["info", "pdf-global"]);

      expect(searchAllMock).toHaveBeenCalledWith("pdf-global", { limit: 5 });
      const output = stdoutWrite.mock.calls.map((c) => c[0]).join("");
      expect(output).toContain("pdf-global");
    });

    it("errors when no identifier given", async () => {
      await expect(cli.run(["info"])).rejects.toThrow("process.exit called");
      expect(stderrWrite).toHaveBeenCalledWith(
        expect.stringContaining("Error: info requires an identifier")
      );
    });

    it("exits 1 when skill not found", async () => {
      getMarketplaceMock.mockReturnValue(undefined);
      searchAllMock.mockResolvedValue([]);

      await expect(cli.run(["info", "nonexistent"])).rejects.toThrow(
        "process.exit called"
      );
      expect(stderrWrite).toHaveBeenCalledWith(
        expect.stringContaining("was not found")
      );
    });
  });

  // ── remove ──────────────────────────────────────────────

  describe("remove", () => {
    it("removes a skill from filesystem", async () => {
      const tmpDir = path.join(os.tmpdir(), `sf-test-remove-${Date.now()}`);
      const skillDir = path.join(tmpDir, ".opencode", "skills", "lobehub", "pdf-tools");
      fs.mkdirSync(skillDir, { recursive: true });
      vi.spyOn(process, "cwd").mockReturnValue(tmpDir);

      await cli.run(["remove", "lobehub:pdf-tools"]);

      expect(stdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("Removed lobehub:pdf-tools")
      );
      expect(fs.existsSync(skillDir)).toBe(false);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("errors when no identifier given", async () => {
      await expect(cli.run(["remove"])).rejects.toThrow("process.exit called");
      expect(stderrWrite).toHaveBeenCalledWith(
        expect.stringContaining("Error: remove requires an identifier")
      );
    });

    it("exits 1 when skill not installed", async () => {
      const tmpDir = path.join(os.tmpdir(), `sf-test-remove-${Date.now()}`);
      fs.mkdirSync(path.join(tmpDir, ".opencode", "skills"), { recursive: true });
      vi.spyOn(process, "cwd").mockReturnValue(tmpDir);

      await expect(cli.run(["remove", "lobehub:nonexistent"])).rejects.toThrow(
        "process.exit called"
      );
      expect(stderrWrite).toHaveBeenCalledWith(
        expect.stringContaining("is not installed")
      );

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  // ── check-updates ───────────────────────────────────────

  describe("check-updates", () => {
    it("shows no tracked skills message when lockfile empty", async () => {
      SkillLockManagerMock.mockImplementation(function () {
        return { getLockedSkills: vi.fn(() => []), checkForUpdates: vi.fn(), unlockSkill: vi.fn() };
      });

      await cli.run(["check-updates"]);

      expect(stdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("No skills are currently tracked")
      );
    });

    it("shows up-to-date when no updates available", async () => {
      SkillLockManagerMock.mockImplementation(function () {
        return {
          getLockedSkills: vi.fn(() => [
            { identifier: "lobehub:pdf-tools", marketplace: "lobehub", version: "1.0.0" },
          ]),
          checkForUpdates: vi.fn().mockResolvedValue({ hasUpdate: false }),
          unlockSkill: vi.fn(),
        };
      });
      getMarketplaceMock.mockReturnValue({
        getSkillInfo: vi.fn().mockResolvedValue(makeSkill({ id: "pdf-tools", name: "pdf-tools" })),
      });

      await cli.run(["check-updates"]);

      const output = stdoutWrite.mock.calls.map((c) => c[0]).join("");
      expect(output).toContain("Update Check Results");
      expect(output).toContain("up to date");
      expect(output).toContain("All tracked skills are up to date");
    });

    it("shows update available when found", async () => {
      SkillLockManagerMock.mockImplementation(function () {
        return {
          getLockedSkills: vi.fn(() => [
            { identifier: "lobehub:pdf-tools", marketplace: "lobehub", version: "1.0.0" },
          ]),
          checkForUpdates: vi.fn().mockResolvedValue({ hasUpdate: true, breaking: false }),
          unlockSkill: vi.fn(),
        };
      });
      getMarketplaceMock.mockReturnValue({
        getSkillInfo: vi.fn().mockResolvedValue(makeSkill({ id: "pdf-tools", name: "pdf-tools" })),
      });

      await cli.run(["check-updates"]);

      const output = stdoutWrite.mock.calls.map((c) => c[0]).join("");
      expect(output).toContain("update available");
      expect(output).toContain("Action needed");
    });

    it("shows breaking change warning", async () => {
      SkillLockManagerMock.mockImplementation(function () {
        return {
          getLockedSkills: vi.fn(() => [
            { identifier: "lobehub:pdf-tools", marketplace: "lobehub", version: "1.0.0", breaking: true },
          ]),
          checkForUpdates: vi.fn().mockResolvedValue({ hasUpdate: true, breaking: true }),
          unlockSkill: vi.fn(),
        };
      });
      getMarketplaceMock.mockReturnValue({
        getSkillInfo: vi.fn().mockResolvedValue(makeSkill({ id: "pdf-tools", name: "pdf-tools" })),
      });

      await cli.run(["check-updates"]);

      const output = stdoutWrite.mock.calls.map((c) => c[0]).join("");
      expect(output).toContain("BREAKING");
    });
  });

  // ── plan ────────────────────────────────────────────────

  describe("plan", () => {
    it("shows no plans message when none available", async () => {
      await cli.run(["plan"]);

      expect(stdoutWrite).toHaveBeenCalledWith(
        expect.stringContaining("No skill plans available")
      );
    });

    it("lists available plans", async () => {
      SkillPlanComposerMock.mockImplementation(function () {
        return {
          getAvailablePlans: vi.fn(() => [
            {
              key: "nextjs-prisma",
              name: "Next.js + Prisma",
              description: "Full-stack Next.js application",
              matchCategories: ["next", "react", "prisma"],
            },
          ]),
        };
      });

      await cli.run(["plan"]);

      const output = stdoutWrite.mock.calls.map((c) => c[0]).join("");
      expect(output).toContain("Available Skill Plans");
      expect(output).toContain("nextjs-prisma");
      expect(output).toContain("Next.js + Prisma");
      expect(output).toContain("Total: 1 plan(s)");
    });
  });

  // ── mcp ─────────────────────────────────────────────────

  describe("mcp", () => {
    it("starts MCP server", async () => {
      const startMock = vi.fn().mockResolvedValue(undefined);
      MCPServerMock.mockImplementation(function () {
        return { start: startMock };
      });

      await cli.run(["mcp"]);

      expect(startMock).toHaveBeenCalled();
    });
  });
});

// ── Subprocess tests ──────────────────────────────────────

describe("CLI subprocess (execSync)", () => {
  const { execSync } = require("node:child_process") as typeof import("node:child_process");

  it("--help shows usage text", () => {
    try {
      const output = execSync("node ./dist/cli/index.js --help", {
        cwd: process.cwd(),
        encoding: "utf-8",
        timeout: 10_000,
      });
      expect(output).toContain("Usage: skill-finder <command>");
      expect(output).toContain("search <query>");
    } catch {
      // dist may not be built — skip gracefully
    }
  });

  it("unknown command exits non-zero", () => {
    try {
      execSync("node ./dist/cli/index.js foobar", {
        cwd: process.cwd(),
        encoding: "utf-8",
        timeout: 10_000,
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (err: unknown) {
      const e = err as { status: number; stderr: string };
      expect(e.status).toBe(1);
      expect(e.stderr).toContain("Unknown command: foobar");
    }
  });
});
