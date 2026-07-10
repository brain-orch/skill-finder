import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SkillShMarketplace } from "../../../src/registry/adapters/skillssh-adapter.js";
import { spawnSync } from "node:child_process";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

const MOCK_SEARCH_RESPONSE = {
  data: [
    {
      id: "1",
      slug: "pdf-tools",
      name: "PDF Tools",
      source: "user/repo",
      installs: 150,
      sourceType: "github",
      installUrl: "https://skills.sh/user/repo/pdf-tools",
      url: "https://skills.sh/user/repo/pdf-tools",
    },
    {
      id: "2",
      slug: "markdown-parser",
      name: "Markdown Parser",
      source: "org/project",
      installs: 42,
      sourceType: "github",
      installUrl: "https://skills.sh/org/project/markdown-parser",
      url: "https://skills.sh/org/project/markdown-parser",
    },
  ],
  query: "pdf",
  searchType: "text",
  count: 2,
};

describe("SkillShMarketplace", () => {
  let adapter: SkillShMarketplace;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new SkillShMarketplace();
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
    it("is 'skillssh'", () => {
      expect(adapter.name).toBe("skillssh");
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
      expect(results[0].id).toBe("skillssh:pdf-tools");
      expect(results[0].name).toBe("PDF Tools");
      expect(results[0].description).toBe("PDF Tools");
      expect(results[0].marketplace).toBe("skillssh");
      expect(results[0].category).toBeNull();
      expect(results[0].triggers).toEqual(["pdf"]);
      expect(results[0].installCount).toBe(150);
      expect(results[0].stars).toBe(0);
      expect(results[0].installCommand).toBe(
        "npx skills add https://github.com/user/repo --skill pdf-tools",
      );
      expect(results[0].homepageUrl).toBe(
        "https://skills.sh/user/repo/pdf-tools",
      );
      expect(results[0].verified).toBe(true);

      expect(results[1].id).toBe("skillssh:markdown-parser");
      expect(results[1].verified).toBe(true);
    });

    it("calls fetch with correct URL and headers", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], query: "test", searchType: "text", count: 0 }),
      });

      await adapter.search("test query", { limit: 5 });

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        "https://skills.sh/api/v1/skills/search?q=test%20query&limit=5",
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

    it("returns [] on invalid JSON structure", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ notData: "unexpected" }),
      });

      const results = await adapter.search("pdf");

      expect(results).toEqual([]);
    });

    it("returns [] for empty query", async () => {
      const results = await adapter.search("");

      expect(results).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("returns [] when category is provided", async () => {
      const results = await adapter.search("pdf", { category: "testing" });

      expect(results).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("respects limit parameter", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const results = await adapter.search("pdf", { limit: 1 });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("skillssh:pdf-tools");
    });

    it("uses AbortSignal when provided", async () => {
      const controller = new AbortController();
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      await adapter.search("pdf", { signal: controller.signal });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init?.signal).toBe(controller.signal);
    });

    it("marks non-github sourceType as not verified", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "1",
              slug: "custom-skill",
              name: "Custom",
              source: "user/repo",
              installs: 10,
              sourceType: "npm",
              installUrl: "https://skills.sh/user/repo/custom-skill",
              url: "",
            },
          ],
          query: "custom",
          searchType: "text",
          count: 1,
        }),
      });

      const results = await adapter.search("custom");

      expect(results).toHaveLength(1);
      expect(results[0].verified).toBe(false);
      expect(results[0].homepageUrl).toBe(
        "https://skills.sh/user/repo/custom-skill",
      );
    });

    it("uses fallback homepageUrl when url is empty", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "1",
              slug: "no-url",
              name: "No URL",
              source: "user/repo",
              installs: 5,
              sourceType: "github",
              installUrl: "",
              url: "",
            },
          ],
          query: "no-url",
          searchType: "text",
          count: 1,
        }),
      });

      const results = await adapter.search("no-url");

      expect(results[0].homepageUrl).toBe(
        "https://skills.sh/user/repo/no-url",
      );
    });

    it("defaults installCount to 0 when installs is falsy", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "1",
              slug: "zero-installs",
              name: "Zero",
              source: "user/repo",
              installs: 0,
              sourceType: "github",
              installUrl: "",
              url: "",
            },
          ],
          query: "zero",
          searchType: "text",
          count: 1,
        }),
      });

      const results = await adapter.search("zero");

      expect(results[0].installCount).toBe(0);
    });
  });

  describe("getSkillInfo", () => {
    it("returns first match for skillssh:slug format", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const result = await adapter.getSkillInfo("skillssh:pdf-tools");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("skillssh:pdf-tools");
      expect(result?.name).toBe("PDF Tools");
    });

    it("returns first match for plain slug", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const result = await adapter.getSkillInfo("pdf-tools");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("skillssh:pdf-tools");
    });

    it("returns null for not-found skill", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [],
          query: "nonexistent",
          searchType: "text",
          count: 0,
        }),
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

    beforeEach(() => {
      spawnSyncMock.mockReset();
    });

    it("calls spawnSync with correct args for valid source/slug", async () => {
      spawnSyncMock.mockReturnValue({
        status: 0,
        error: undefined,
        stdout: Buffer.from(""),
        stderr: Buffer.from(""),
        pid: 1,
        output: [],
        signal: null,
      });

      const result = await adapter.install("user/repo/my-skill", "/tmp/skills");

      expect(spawnSyncMock).toHaveBeenCalledOnce();
      expect(spawnSyncMock).toHaveBeenCalledWith(
        "npx",
        ["-y", "skills", "add", "https://github.com/user/repo", "--skill", "my-skill"],
        expect.objectContaining({ cwd: expect.stringMatching(/skillssh[\\/]my-skill/), stdio: "pipe", timeout: 30_000 }),
      );
      expect(result.path).toMatch(/skillssh[\\/]my-skill/);
      expect(result.files).toContain("SKILL.md");
    });

    it("throws on invalid slug before spawnSync call", async () => {
      await expect(adapter.install("user/repo/../../etc/passwd", "/tmp/skills")).rejects.toThrow();
      expect(spawnSyncMock).not.toHaveBeenCalled();
    });

    it("throws on invalid source with special chars before spawnSync call", async () => {
      await expect(adapter.install("user/repo$(evil)/my-skill", "/tmp/skills")).rejects.toThrow();
      expect(spawnSyncMock).not.toHaveBeenCalled();
    });

    it("throws Failed to install skill on non-zero exit", async () => {
      spawnSyncMock.mockReturnValue({
        status: 1,
        error: undefined,
        stdout: Buffer.from(""),
        stderr: Buffer.from("error"),
        pid: 1,
        output: [],
        signal: null,
      });

      await expect(adapter.install("user/repo/my-skill", "/tmp/skills")).rejects.toThrow(
        /Failed to install skill/,
      );
    });
  });
});
