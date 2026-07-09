import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

vi.mock("../../src/registry/instance.js", () => ({
  marketplaceRegistry: {
    searchAll: vi.fn().mockResolvedValue([]),
    getMarketplace: vi.fn(),
    listAvailable: vi.fn(() => ["lobehub"]),
  },
}));

import {
  AGENT_TARGETS,
  detectActiveAgents,
  targetExists,
  getTargetPath,
  loadConfigTargets,
  getAllTargets,
  probeAgentDirs,
} from "../../src/installer/agent-targets.js";
import { installTool } from "../../src/tools/install.js";
import { removeTool } from "../../src/tools/remove.js";
import { listTool } from "../../src/tools/list.js";
import { marketplaceRegistry } from "../../src/registry/instance.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agent-targets-test-"));
}

const mockCtx = (dir: string) => ({
  sessionID: "test-session",
  messageID: "test-message",
  agent: "test",
  directory: dir,
  worktree: dir,
  abort: new AbortController().signal,
  metadata: () => {},
  ask: async () => {},
});

describe("agent-targets", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("AGENT_TARGETS config", () => {
    it("has all expected agent targets", () => {
      expect(AGENT_TARGETS.opencode).toBeDefined();
      expect(AGENT_TARGETS.claude).toBeDefined();
      expect(AGENT_TARGETS.cursor).toBeDefined();
      expect(AGENT_TARGETS.codex).toBeDefined();
      expect(AGENT_TARGETS.generic).toBeDefined();
    });

    it("each target has dir and priority", () => {
      for (const [, info] of Object.entries(AGENT_TARGETS)) {
        expect(info.dir).toBeTruthy();
        expect(typeof info.priority).toBe("number");
      }
    });
  });

  describe("detectActiveAgents", () => {
    it("returns ['opencode'] when only .opencode/skills/ exists", () => {
      fs.mkdirSync(path.join(tmpDir, ".opencode", "skills"), { recursive: true });
      const result = detectActiveAgents(tmpDir);
      expect(result).toEqual(["opencode"]);
    });

    it("returns [] when no agent directories exist", () => {
      const result = detectActiveAgents(tmpDir);
      expect(result).toEqual([]);
    });

    it("returns ['claude', 'cursor'] in priority order when both exist", () => {
      fs.mkdirSync(path.join(tmpDir, ".claude", "skills"), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, ".cursor", "skills"), { recursive: true });
      const result = detectActiveAgents(tmpDir);
      expect(result).toContain("claude");
      expect(result).toContain("cursor");
      expect(result.indexOf("claude")).toBeLessThan(result.indexOf("cursor"));
    });

    it("returns all active agents sorted by priority", () => {
      fs.mkdirSync(path.join(tmpDir, ".opencode", "skills"), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, ".claude", "skills"), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, ".cursor", "skills"), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, ".agents", "skills"), { recursive: true });

      const result = detectActiveAgents(tmpDir);
      expect(result).toContain("opencode");
      expect(result).toContain("claude");
      expect(result).toContain("cursor");
      expect(result).toContain("codex");
      expect(result).toContain("generic");
      expect(result.indexOf("opencode")).toBeLessThan(result.indexOf("claude"));
      expect(result.indexOf("claude")).toBeLessThan(result.indexOf("cursor"));
    });
  });

  describe("targetExists", () => {
    it("returns true when target directory exists", () => {
      fs.mkdirSync(path.join(tmpDir, ".opencode", "skills"), { recursive: true });
      expect(targetExists(tmpDir, "opencode")).toBe(true);
    });

    it("returns false when target directory does not exist", () => {
      expect(targetExists(tmpDir, "opencode")).toBe(false);
    });

    it("returns false for unknown target", () => {
      // @ts-expect-error testing invalid target
      expect(targetExists(tmpDir, "nonexistent")).toBe(false);
    });
  });

  describe("getTargetPath", () => {
    it("returns correct path for opencode", () => {
      const expected = path.join(tmpDir, ".opencode", "skills");
      expect(getTargetPath(tmpDir, "opencode")).toBe(expected);
    });

    it("returns correct path for claude", () => {
      const expected = path.join(tmpDir, ".claude", "skills");
      expect(getTargetPath(tmpDir, "claude")).toBe(expected);
    });

    it("throws for unknown target", () => {
      // @ts-expect-error testing invalid target
      expect(() => getTargetPath(tmpDir, "nonexistent")).toThrow("Unknown agent target");
    });
  });
});

describe("install tool with targets", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("install with target='opencode' installs to .opencode/skills/", async () => {
    fs.mkdirSync(path.join(tmpDir, ".opencode", "skills"), { recursive: true });

    vi.mocked(marketplaceRegistry.getMarketplace).mockReturnValue({
      name: "lobehub",
      install: vi.fn().mockImplementation(async (_id: string, targetDir: string) => {
        const skillDir = path.join(targetDir, "lobehub", "pdf-tools");
        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# PDF Tools\n");
        return { path: skillDir, files: ["SKILL.md"] };
      }),
    } as any);

    const result = await installTool.execute(
      { identifier: "lobehub:pdf-tools", marketplace: "lobehub", confirm: true, target: "opencode" },
      mockCtx(tmpDir),
    );

    expect(result).toContain("✅ Installed lobehub:pdf-tools");
    expect(result).toContain("opencode");
    expect(fs.existsSync(path.join(tmpDir, ".opencode", "skills", "lobehub", "pdf-tools", "SKILL.md"))).toBe(true);
  });

  it("install with target='all' installs to all detected targets", async () => {
    fs.mkdirSync(path.join(tmpDir, ".opencode", "skills"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, ".claude", "skills"), { recursive: true });

    vi.mocked(marketplaceRegistry.getMarketplace).mockReturnValue({
      name: "lobehub",
      install: vi.fn().mockImplementation(async (_id: string, targetDir: string) => {
        const skillDir = path.join(targetDir, "lobehub", "pdf-tools");
        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# PDF Tools\n");
        return { path: skillDir, files: ["SKILL.md"] };
      }),
    } as any);

    const result = await installTool.execute(
      { identifier: "lobehub:pdf-tools", marketplace: "lobehub", confirm: true, target: "all" },
      mockCtx(tmpDir),
    );

    expect(result).toContain("✅ Installed lobehub:pdf-tools");
    expect(result).toContain("opencode");
    expect(result).toContain("claude");
    expect(fs.existsSync(path.join(tmpDir, ".opencode", "skills", "lobehub", "pdf-tools", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".claude", "skills", "lobehub", "pdf-tools", "SKILL.md"))).toBe(true);
  });

  it("install without target defaults to opencode (backward compat)", async () => {
    fs.mkdirSync(path.join(tmpDir, ".opencode", "skills"), { recursive: true });

    vi.mocked(marketplaceRegistry.getMarketplace).mockReturnValue({
      name: "lobehub",
      install: vi.fn().mockImplementation(async (_id: string, targetDir: string) => {
        const skillDir = path.join(targetDir, "lobehub", "pdf-tools");
        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# PDF Tools\n");
        return { path: skillDir, files: ["SKILL.md"] };
      }),
    } as any);

    const result = await installTool.execute(
      { identifier: "lobehub:pdf-tools", marketplace: "lobehub", confirm: true },
      mockCtx(tmpDir),
    );

    expect(result).toContain("✅ Installed lobehub:pdf-tools");
    expect(result).toContain("opencode");
  });

  it("install with target='auto' installs to highest priority detected", async () => {
    fs.mkdirSync(path.join(tmpDir, ".opencode", "skills"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, ".claude", "skills"), { recursive: true });

    vi.mocked(marketplaceRegistry.getMarketplace).mockReturnValue({
      name: "lobehub",
      install: vi.fn().mockImplementation(async (_id: string, targetDir: string) => {
        const skillDir = path.join(targetDir, "lobehub", "pdf-tools");
        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# PDF Tools\n");
        return { path: skillDir, files: ["SKILL.md"] };
      }),
    } as any);

    const result = await installTool.execute(
      { identifier: "lobehub:pdf-tools", marketplace: "lobehub", confirm: true, target: "auto" },
      mockCtx(tmpDir),
    );

    expect(result).toContain("✅ Installed lobehub:pdf-tools");
    expect(fs.existsSync(path.join(tmpDir, ".opencode", "skills", "lobehub", "pdf-tools", "SKILL.md"))).toBe(true);
  });
});

describe("remove tool with multiple targets", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("removes skill from all target directories", async () => {
    const skillDir1 = path.join(tmpDir, ".opencode", "skills", "lobehub", "pdf-tools");
    const skillDir2 = path.join(tmpDir, ".claude", "skills", "lobehub", "pdf-tools");

    fs.mkdirSync(skillDir1, { recursive: true });
    fs.writeFileSync(path.join(skillDir1, "SKILL.md"), "# PDF Tools\n");
    fs.mkdirSync(skillDir2, { recursive: true });
    fs.writeFileSync(path.join(skillDir2, "SKILL.md"), "# PDF Tools\n");

    const result = await removeTool.execute(
      { identifier: "lobehub:pdf-tools" },
      mockCtx(tmpDir),
    );

    expect(result).toContain("✅ Removed lobehub:pdf-tools");
    expect(result).toContain("opencode");
    expect(result).toContain("claude");
    expect(fs.existsSync(skillDir1)).toBe(false);
    expect(fs.existsSync(skillDir2)).toBe(false);
  });

  it("returns not found when skill not in any target", async () => {
    const result = await removeTool.execute(
      { identifier: "lobehub:nonexistent" },
      mockCtx(tmpDir),
    );

    expect(result).toContain("❌ Not Found");
  });
});

describe("list tool with multiple targets", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("lists skills from all active agent directories", async () => {
    const skillDir1 = path.join(tmpDir, ".opencode", "skills", "lobehub", "pdf-tools");
    const skillDir2 = path.join(tmpDir, ".claude", "skills", "lobehub", "git-master");

    fs.mkdirSync(skillDir1, { recursive: true });
    fs.writeFileSync(path.join(skillDir1, "SKILL.md"), "# PDF Tools\n");
    fs.mkdirSync(skillDir2, { recursive: true });
    fs.writeFileSync(path.join(skillDir2, "SKILL.md"), "# Git Master\n");

    const result = await listTool.execute({}, mockCtx(tmpDir));

    expect(result).toContain("## Installed Skills");
    expect(result).toContain("opencode");
    expect(result).toContain("claude");
    expect(result).toContain("pdf-tools");
    expect(result).toContain("git-master");
  });

  it("returns empty message when no skills in any target", async () => {
    fs.mkdirSync(path.join(tmpDir, ".opencode", "skills"), { recursive: true });

    const result = await listTool.execute({}, mockCtx(tmpDir));

    expect(result).toContain("No skills installed");
  });
});

describe("configurable agent targets", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    loadConfigTargets({});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns built-in targets when no config targets", () => {
    const targets = getAllTargets();
    expect(targets.opencode).toBeDefined();
    expect(targets.claude).toBeDefined();
    expect(targets.cursor).toBeDefined();
    expect(targets.codex).toBeDefined();
    expect(targets.generic).toBeDefined();
    expect(Object.keys(targets).length).toBe(5);
  });

  it("adds custom targets from config", () => {
    loadConfigTargets({ agentTargets: { "team-agent": ".team/skills" } });
    const targets = getAllTargets();
    expect(targets["team-agent"]).toBeDefined();
    expect(targets["team-agent"].dir).toBe(".team/skills");
    expect(targets.opencode).toBeDefined();
    expect(Object.keys(targets).length).toBe(6);
  });

  it("custom target overrides built-in with same name", () => {
    loadConfigTargets({ agentTargets: { opencode: "custom/opencode/path" } });
    const targets = getAllTargets();
    expect(targets.opencode.dir).toBe("custom/opencode/path");
    expect(targets.claude).toBeDefined();
    expect(targets.cursor).toBeDefined();
  });

  it("detectActiveAgents includes config targets", () => {
    loadConfigTargets({ agentTargets: { "team-agent": ".team/skills" } });
    fs.mkdirSync(path.join(tmpDir, ".team", "skills"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, ".opencode", "skills"), { recursive: true });

    const active = detectActiveAgents(tmpDir);
    expect(active).toContain("team-agent");
    expect(active).toContain("opencode");
  });

  it("reset config targets clears custom targets", () => {
    loadConfigTargets({ agentTargets: { "team-agent": ".team/skills" } });
    let targets = getAllTargets();
    expect(targets["team-agent"]).toBeDefined();

    loadConfigTargets({});
    targets = getAllTargets();
    expect(targets["team-agent"]).toBeUndefined();
    expect(Object.keys(targets).length).toBe(5);
  });
});

describe("probeAgentDirs", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("detects project-level agent directories", () => {
    fs.mkdirSync(path.join(tmpDir, ".opencode", "skills"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, ".claude", "skills"), { recursive: true });

    const detected = probeAgentDirs(tmpDir);
    expect(detected.some((a) => a.name === "opencode")).toBe(true);
    expect(detected.some((a) => a.name === "claude")).toBe(true);
  });

  it("returns empty array when no agent directories exist in project", () => {
    const detected = probeAgentDirs(tmpDir);
    const projectDetected = detected.filter((a) => a.source === "project");
    expect(projectDetected).toEqual([]);
  });

  it("detects windsurf and github-agents directories", () => {
    fs.mkdirSync(path.join(tmpDir, ".windsurf", "skills"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, ".github", "agents"), { recursive: true });

    const detected = probeAgentDirs(tmpDir);
    expect(detected.some((a) => a.name === "windsurf")).toBe(true);
    expect(detected.some((a) => a.name === "github-agents")).toBe(true);
  });

  it("sets correct confidence levels", () => {
    fs.mkdirSync(path.join(tmpDir, ".opencode", "skills"), { recursive: true });

    const detected = probeAgentDirs(tmpDir);
    const opencode = detected.find((a) => a.name === "opencode");
    expect(opencode).toBeDefined();
    expect(opencode!.confidence).toBe("high");
    expect(opencode!.source).toBe("project");
  });

  it("does not create directories that don't exist", () => {
    const before = fs.readdirSync(tmpDir);
    probeAgentDirs(tmpDir);
    const after = fs.readdirSync(tmpDir);
    expect(after.length).toBe(before.length);
  });
});
