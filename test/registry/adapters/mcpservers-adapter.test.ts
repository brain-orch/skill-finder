import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MCPServersMarketplace } from "../../../src/registry/adapters/mcpservers-adapter.js";
import type { SkillMarketplace } from "../../../src/types.js";

const MOCK_SERVERS_RESPONSE = {
  servers: [
    {
      name: "github-mcp-server",
      description: "GitHub API integration via MCP",
      categories: ["source-control"],
      url: "https://github.com/github/github-mcp-server",
    },
    {
      name: "postgres-mcp-server",
      description: "PostgreSQL database access via MCP",
      categories: ["database"],
      url: "https://github.com/org/postgres-mcp-server",
    },
  ],
  metadata: { nextCursor: undefined },
};

describe("MCPServersMarketplace", () => {
  let adapter: SkillMarketplace;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new MCPServersMarketplace();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("name", () => {
    it('has name "mcpservers"', () => {
      expect(adapter.name).toBe("mcpservers");
    });
  });

  describe("isAvailable", () => {
    it("returns true", () => {
      expect(adapter.isAvailable()).toBe(true);
    });
  });

  describe("search", () => {
    it("returns parsed results from valid API response", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SERVERS_RESPONSE,
      });

      const results = await adapter.search("github");

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("mcpservers:github-mcp-server");
      expect(results[0].name).toBe("github-mcp-server");
      expect(results[0].description).toBe("GitHub API integration via MCP");
      expect(results[0].marketplace).toBe("mcpservers");
      expect(results[0].category).toBe("source-control");
      expect(results[0].triggers).toEqual(["github"]);
      expect(results[0].installCount).toBe(0);
      expect(results[0].stars).toBe(0);
      expect(results[0].installCommand).toBe("");
      expect(results[0].homepageUrl).toBe(
        "https://github.com/github/github-mcp-server",
      );
      expect(results[0].verified).toBe(false);

      expect(results[1].id).toBe("mcpservers:postgres-mcp-server");
      expect(results[1].category).toBe("database");
    });

    it("calls fetch with correct URL and headers", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ servers: [], metadata: {} }),
      });

      await adapter.search("query test", { limit: 5 });

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain(
        "https://registry.modelcontextprotocol.io/v0.1/servers?",
      );
      expect(url).toContain("search=query+test");
      expect(url).toContain("limit=5");
      expect(url).toContain("version=latest");
      expect(init?.headers).toEqual({
        "User-Agent": "skill-finder/1.0",
        Accept: "application/json",
      });
    });

    it("returns [] on network error", async () => {
      fetchSpy.mockRejectedValue(new Error("Network failure"));

      const results = await adapter.search("github");

      expect(results).toEqual([]);
    });

    it("returns [] on non-200 response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const results = await adapter.search("github");

      expect(results).toEqual([]);
    });

    it("returns [] for empty query", async () => {
      const results = await adapter.search("");

      expect(results).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("respects limit parameter", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SERVERS_RESPONSE,
      });

      const results = await adapter.search("mcp", { limit: 1 });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("mcpservers:github-mcp-server");
    });

    it("passes AbortSignal to fetch", async () => {
      const controller = new AbortController();
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ servers: [], metadata: {} }),
      });

      await adapter.search("query", { signal: controller.signal });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init?.signal).toBe(controller.signal);
    });

    it("returns [] on invalid JSON structure", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ notServers: "unexpected" }),
      });

      const results = await adapter.search("test");

      expect(results).toEqual([]);
    });

    it("filters by category client-side", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SERVERS_RESPONSE,
      });

      const results = await adapter.search("mcp", { category: "database" });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("postgres-mcp-server");
    });

    it("defaults description to empty string when missing", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          servers: [
            { name: "no-desc-server", categories: ["test"] },
          ],
          metadata: {},
        }),
      });

      const results = await adapter.search("no-desc");

      expect(results).toHaveLength(1);
      expect(results[0].description).toBe("");
    });

    it("defaults category to mcp-server when categories array is empty", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          servers: [{ name: "no-cat-server", description: "A server", categories: [] }],
          metadata: {},
        }),
      });

      const results = await adapter.search("no-cat");

      expect(results[0].category).toBe("mcp-server");
    });

    it("defaults homepageUrl to empty string when url is missing", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          servers: [{ name: "no-url-server", description: "No URL" }],
          metadata: {},
        }),
      });

      const results = await adapter.search("no-url");

      expect(results[0].homepageUrl).toBe("");
    });
  });

  describe("getSkillInfo", () => {
    it("returns first match for mcpservers:name format", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SERVERS_RESPONSE,
      });

      const result = await adapter.getSkillInfo(
        "mcpservers:github-mcp-server",
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe("mcpservers:github-mcp-server");
      expect(result?.name).toBe("github-mcp-server");
    });

    it("returns first match for plain name", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SERVERS_RESPONSE,
      });

      const result = await adapter.getSkillInfo("github-mcp-server");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("mcpservers:github-mcp-server");
    });

    it("returns null for not-found server", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ servers: [], metadata: {} }),
      });

      const result = await adapter.getSkillInfo("nonexistent");

      expect(result).toBeNull();
    });

    it("returns null on fetch error", async () => {
      fetchSpy.mockRejectedValue(new Error("Network error"));

      const result = await adapter.getSkillInfo("github-mcp-server");

      expect(result).toBeNull();
    });
  });

  describe("install", () => {
    it("throws descriptive error", async () => {
      await expect(
        adapter.install("mcpservers:github-mcp-server", "/tmp/skills"),
      ).rejects.toThrow("MCP Servers cannot be installed as skills");
    });

    it("includes explanation in error message", async () => {
      await expect(
        adapter.install("mcpservers:any-server", "/tmp"),
      ).rejects.toThrow("not SKILL.md files");
    });

    it("mentions homepage in error message", async () => {
      await expect(
        adapter.install("mcpservers:any-server", "/tmp"),
      ).rejects.toThrow("homepage");
    });
  });

  describe("conforms to SkillMarketplace interface", () => {
    it("has all required method signatures", () => {
      expect(typeof adapter.search).toBe("function");
      expect(typeof adapter.getSkillInfo).toBe("function");
      expect(typeof adapter.install).toBe("function");
      expect(typeof adapter.isAvailable).toBe("function");
    });

    it("is assignable to SkillMarketplace", () => {
      const _: SkillMarketplace = adapter;
      expect(_.name).toBe("mcpservers");
    });
  });
});
