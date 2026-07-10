import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ClawHubMarketplace } from "../../../src/registry/adapters/clawhub-adapter.js";
import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

const MOCK_SEARCH_RESPONSE = [
  {
    slug: "pdf-tools",
    owner: "alice",
    name: "PDF Tools",
    description: "Extract text from PDF files",
    downloads: 250,
    stars: 18,
    category: "pdf-processing",
  },
  {
    slug: "markdown-parser",
    owner: "bob",
    name: "Markdown Parser",
    description: "Parse markdown to HTML",
    downloads: 90,
    stars: 7,
    category: "text-processing",
  },
];

describe("ClawHubMarketplace", () => {
  let adapter: ClawHubMarketplace;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new ClawHubMarketplace();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isAvailable", () => {
    it("returns true", () => {
      expect(adapter.isAvailable()).toBe(true);
    });
  });

  describe("name", () => {
    it("is 'clawhub'", () => {
      expect(adapter.name).toBe("clawhub");
    });
  });

  describe("search", () => {
    it("returns parsed results from valid API response", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const results = await adapter.search("pdf");

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("clawhub:alice/pdf-tools");
      expect(results[0].name).toBe("PDF Tools");
      expect(results[0].description).toBe("Extract text from PDF files");
      expect(results[0].marketplace).toBe("clawhub");
      expect(results[0].category).toBe("pdf-processing");
      expect(results[0].triggers).toEqual(["pdf"]);
      expect(results[0].installCount).toBe(250);
      expect(results[0].stars).toBe(18);
      expect(results[0].installCommand).toBe(
        "clawhub install @alice/pdf-tools",
      );
      expect(results[0].homepageUrl).toBe(
        "https://clawhub.ai/skills/pdf-tools",
      );
      expect(results[0].verified).toBe(false);

      expect(results[1].id).toBe("clawhub:bob/markdown-parser");
      expect(results[1].category).toBe("text-processing");
    });

    it("calls fetch with correct URL and headers", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      await adapter.search("test query", { limit: 5 });

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        "https://clawhub.ai/api/v1/search?q=test%20query&limit=5&nonSuspiciousOnly=true",
      );
      expect(init?.headers).toEqual({
        "User-Agent": "skill-finder/1.0",
        Accept: "application/json",
      });
    });

    it("returns [] on network error", async () => {
      fetchSpy.mockRejectedValue(new Error("Network failure"));

      const results = await adapter.search("pdf");

      expect(results).toEqual([]);
    });

    it("returns [] on non-200 response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const results = await adapter.search("pdf");

      expect(results).toEqual([]);
    });

    it("returns [] for empty query", async () => {
      const results = await adapter.search("");

      expect(results).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("category filter works (client-side)", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const results = await adapter.search("pdf", {
        category: "text-processing",
      });

      expect(results).toHaveLength(1);
      expect(results[0].category).toBe("text-processing");
    });

    it("respects limit parameter", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const results = await adapter.search("pdf", { limit: 1 });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("clawhub:alice/pdf-tools");
    });

    it("passes AbortSignal to fetch", async () => {
      const controller = new AbortController();
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      await adapter.search("pdf", { signal: controller.signal });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init?.signal).toBe(controller.signal);
    });

    it("handles missing name field by falling back to slug", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => [
          {
            slug: "fallback-skill",
            owner: "charlie",
            name: "",
            description: "No name skill",
            downloads: 5,
            stars: 1,
            category: "testing",
          },
        ],
      });

      const results = await adapter.search("fallback");

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("fallback-skill");
    });

    it("handles missing category by setting null", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => [
          {
            slug: "no-cat",
            owner: "dave",
            name: "No Category",
            description: "No category skill",
            downloads: 0,
            stars: 0,
          },
        ],
      });

      const results = await adapter.search("no-cat");

      expect(results).toHaveLength(1);
      expect(results[0].category).toBeNull();
    });

    it("handles verified field from API", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => [
          {
            slug: "verified-skill",
            owner: "eve",
            name: "Verified Skill",
            description: "Verified skill",
            downloads: 100,
            stars: 25,
            category: "testing",
            verified: true,
          },
        ],
      });

      const results = await adapter.search("verified");

      expect(results).toHaveLength(1);
      expect(results[0].verified).toBe(true);
    });

    it("defaults installs and stars to 0 when falsy", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => [
          {
            slug: "zero-stats",
            owner: "frank",
            name: "Zero Stats",
            description: "No stats",
            downloads: 0,
            stars: 0,
          },
        ],
      });

      const results = await adapter.search("zero");

      expect(results).toHaveLength(1);
      expect(results[0].installCount).toBe(0);
      expect(results[0].stars).toBe(0);
    });

    it("returns [] on non-array response", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ notAnArray: "unexpected" }),
      });

      const results = await adapter.search("test");

      expect(results).toEqual([]);
    });
  });

  describe("getSkillInfo", () => {
    it("returns first match for clawhub:owner/slug format", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const result = await adapter.getSkillInfo("clawhub:alice/pdf-tools");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("clawhub:alice/pdf-tools");
      expect(result?.name).toBe("PDF Tools");
    });

    it("returns first match for plain slug", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const result = await adapter.getSkillInfo("pdf-tools");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("clawhub:alice/pdf-tools");
    });

    it("returns null for not-found skill", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const result = await adapter.getSkillInfo("nonexistent");

      expect(result).toBeNull();
    });

    it("returns null on fetch error", async () => {
      fetchSpy.mockRejectedValue(new Error("Network error"));

      const result = await adapter.getSkillInfo("pdf-tools");

      expect(result).toBeNull();
    });
  });

  describe("install", () => {
    const spawnSyncMock = vi.mocked(spawnSync);
    const tmpDir = "/tmp/test-install";

    beforeEach(() => {
      spawnSyncMock.mockReset();
      spawnSyncMock.mockReturnValue({
        status: 0,
        error: undefined,
        stdout: "",
        stderr: "",
        pid: 123,
        output: ["", "", ""],
        signal: null,
      } as SpawnSyncReturns<Buffer>);
    });

    it("calls spawnSync with correct args for @owner/slug", async () => {
      const result = await adapter.install("@alice/pdf-tools", tmpDir);

      expect(spawnSyncMock).toHaveBeenCalledOnce();
      expect(spawnSyncMock).toHaveBeenCalledWith(
        "clawhub",
        ["install", "@alice/pdf-tools"],
        {
          encoding: "utf-8",
          timeout: 30_000,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      expect(result.path).toContain("clawhub");
      expect(result.files).toContain("SKILL.md");
    });

    it("calls spawnSync with correct args for clawhub:@owner/slug", async () => {
      const result = await adapter.install("clawhub:@alice/pdf-tools", tmpDir);

      expect(spawnSyncMock).toHaveBeenCalledOnce();
      expect(spawnSyncMock).toHaveBeenCalledWith(
        "clawhub",
        ["install", "@alice/pdf-tools"],
        {
          encoding: "utf-8",
          timeout: 30_000,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      expect(result.path).toContain("clawhub");
      expect(result.files).toContain("SKILL.md");
    });

    it("throws on invalid name with shell characters", async () => {
      await expect(
        adapter.install("@alice/malicious;rm -rf /", tmpDir),
      ).rejects.toThrow();
      expect(spawnSyncMock).not.toHaveBeenCalled();
    });

    it("throws on spawnSync non-zero exit", async () => {
      spawnSyncMock.mockReturnValue({
        status: 1,
        error: undefined,
        stdout: "",
        stderr: "install failed",
        pid: 123,
        output: ["", "", ""],
        signal: null,
      } as SpawnSyncReturns<Buffer>);

      await expect(
        adapter.install("@alice/failing-skill", tmpDir),
      ).rejects.toThrow("Failed to install skill");
    });

    it("throws on spawnSync error", async () => {
      spawnSyncMock.mockReturnValue({
        status: null,
        error: new Error("ENOENT: command not found"),
        stdout: "",
        stderr: "",
        pid: 123,
        output: ["", "", ""],
        signal: null,
      } as SpawnSyncReturns<Buffer>);

      await expect(
        adapter.install("@alice/failing-skill", tmpDir),
      ).rejects.toThrow("Failed to install skill");
    });
  });
});
