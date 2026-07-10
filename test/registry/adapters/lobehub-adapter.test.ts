import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SkillSearchResult } from "../../../src/types.js";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

import { spawnSync } from "node:child_process";
import { LobeHubMarketplace } from "../../../src/registry/adapters/lobehub-adapter.js";

const mockSpawnSync = vi.mocked(spawnSync);

function makeCliResponse(items: Record<string, unknown>[]) {
  return JSON.stringify({ items });
}

describe("LobeHubMarketplace", () => {
  let adapter: LobeHubMarketplace;

  beforeEach(() => {
    adapter = new LobeHubMarketplace();
    vi.clearAllMocks();
  });

  it("search returns parsed results from valid JSON", async () => {
    const cliOutput = makeCliResponse([
      {
        name: "pdf-tools",
        description: "Extract text from PDFs",
        category: "pdf-processing",
        installCount: 42,
        ratingCount: 10,
        isFeatured: true,
        github: { url: "https://github.com/example/pdf-tools" },
      },
      {
        name: "markdown-parser",
        description: "Parse markdown files",
        category: null,
        installCount: 5,
        ratingCount: 0,
      },
    ]);

    mockSpawnSync.mockReturnValue({ status: 0, stdout: cliOutput, stderr: "" });

    const results = await adapter.search("pdf");

    expect(results).toHaveLength(2);

    const first = results[0]!;
    expect(first.id).toBe("lobehub:pdf-tools");
    expect(first.name).toBe("pdf-tools");
    expect(first.description).toBe("Extract text from PDFs");
    expect(first.marketplace).toBe("lobehub");
    expect(first.category).toBe("pdf-processing");
    expect(first.triggers).toEqual([]);
    expect(first.installCount).toBe(42);
    expect(first.stars).toBe(10);
    expect(first.installCommand).toBe(
      "npx -y @lobehub/market-cli skills install pdf-tools --agent codex",
    );
    expect(first.homepageUrl).toBe("https://github.com/example/pdf-tools");
    expect(first.verified).toBe(true);

    const second = results[1]!;
    expect(second.id).toBe("lobehub:markdown-parser");
    expect(second.category).toBeNull();
    expect(second.homepageUrl).toBe("https://lobehub.com/skills/markdown-parser");
    expect(second.verified).toBe(false);
  });

  it("search returns [] on exec error", async () => {
    mockSpawnSync.mockReturnValue({ status: 1, stdout: "", stderr: "command not found" });

    const results = await adapter.search("pdf");
    expect(results).toEqual([]);
  });

  it("search returns [] for empty query", async () => {
    const results = await adapter.search("");
    expect(results).toEqual([]);
    expect(mockSpawnSync).not.toHaveBeenCalled();
  });

  it("isAvailable returns true", () => {
    expect(adapter.isAvailable()).toBe(true);
  });

  it("getSkillInfo returns null for not-found identifier", async () => {
    const cliOutput = makeCliResponse([
      {
        name: "other-skill",
        description: "Something else",
      },
    ]);

    mockSpawnSync.mockReturnValue({ status: 0, stdout: cliOutput, stderr: "" });

    const result = await adapter.getSkillInfo("lobehub:nonexistent");
    expect(result).toBeNull();
  });

  it("getSkillInfo returns skill when identifier matches", async () => {
    const cliOutput = makeCliResponse([
      {
        name: "pdf-tools",
        description: "Extract text from PDFs",
        category: "pdf-processing",
      },
    ]);

    mockSpawnSync.mockReturnValue({ status: 0, stdout: cliOutput, stderr: "" });

    const result = await adapter.getSkillInfo("lobehub:pdf-tools");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("lobehub:pdf-tools");
  });

  it("search applies category filter", async () => {
    const cliOutput = makeCliResponse([
      { name: "skill-a", description: "A", category: "pdf" },
      { name: "skill-b", description: "B", category: "git" },
      { name: "skill-c", description: "C", category: "pdf" },
    ]);

    mockSpawnSync.mockReturnValue({ status: 0, stdout: cliOutput, stderr: "" });

    const results = await adapter.search("skill", { category: "pdf" });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.category === "pdf")).toBe(true);
  });

  it("search applies limit", async () => {
    const cliOutput = makeCliResponse([
      { name: "a", description: "A" },
      { name: "b", description: "B" },
      { name: "c", description: "C" },
    ]);

    mockSpawnSync.mockReturnValue({ status: 0, stdout: cliOutput, stderr: "" });

    const results = await adapter.search("a", { limit: 2 });
    expect(results).toHaveLength(2);
  });
});
