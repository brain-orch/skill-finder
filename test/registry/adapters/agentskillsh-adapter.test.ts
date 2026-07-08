import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AgentSkillsMarketplace } from "../../../src/registry/adapters/agentskillsh-adapter.js";

const MOCK_SEARCH_RESPONSE = {
  data: [
    {
      name: "pdf-tools",
      slug: "alice/pdf-tools",
      owner: "alice",
      description: "Extract and manipulate PDF documents",
      category: "pdf-processing",
      githubStars: 120,
      installCount: 250,
      contentQualityScore: 85,
      securityScore: 100,
      platforms: ["codex"],
      avatarUrl: "https://agentskill.sh/avatars/alice.png",
      repositoryUrl: "https://github.com/alice/pdf-tools",
      isVerified: true,
      isFeatured: false,
      tags: ["pdf", "documents"],
      skillTypes: ["frontend"],
    },
    {
      name: "markdown-parser",
      slug: "bob/markdown-parser",
      owner: "bob",
      description: "Parse markdown into structured data",
      category: "text-processing",
      githubStars: 45,
      installCount: 80,
      contentQualityScore: 70,
      securityScore: 95,
      platforms: ["codex"],
      avatarUrl: "https://agentskill.sh/avatars/bob.png",
      repositoryUrl: "https://github.com/bob/markdown-parser",
      isVerified: false,
      isFeatured: false,
      tags: ["markdown", "parser"],
      skillTypes: ["backend"],
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
  totalPages: 1,
  hasMore: false,
};

describe("AgentSkillsMarketplace", () => {
  let adapter: AgentSkillsMarketplace;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new AgentSkillsMarketplace();
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
    it('has name "agentskillsh"', () => {
      expect(adapter.name).toBe("agentskillsh");
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
      expect(results[0].id).toBe("agentskillsh:alice/pdf-tools");
      expect(results[0].name).toBe("pdf-tools");
      expect(results[0].description).toBe(
        "Extract and manipulate PDF documents",
      );
      expect(results[0].marketplace).toBe("agentskillsh");
      expect(results[0].category).toBe("pdf-processing");
      expect(results[0].triggers).toEqual(["pdf", "documents"]);
      expect(results[0].installCount).toBe(250);
      expect(results[0].stars).toBe(85);
      expect(results[0].installCommand).toBe(
        "npx @agentskill.sh/cli@latest setup alice/pdf-tools",
      );
      expect(results[0].homepageUrl).toBe(
        "https://agentskill.sh/@alice/pdf-tools",
      );
      expect(results[0].verified).toBe(true);

      expect(results[1].id).toBe("agentskillsh:bob/markdown-parser");
      expect(results[1].verified).toBe(false);
    });

    it("calls fetch with correct URL", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], total: 0 }),
      });

      await adapter.search("test query", { limit: 5 });

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("https://agentskill.sh/api/skills");
      expect(url).toContain("search=test+query");
      expect(url).toContain("limit=5");
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

    it("returns [] for whitespace-only query", async () => {
      const results = await adapter.search("   ");

      expect(results).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("passes category to URL params", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], total: 0 }),
      });

      await adapter.search("pdf", { category: "text-processing" });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("category=text-processing");
    });

    it("passes limit to URL params", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], total: 0 }),
      });

      await adapter.search("pdf", { limit: 5 });

      const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("limit=5");
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

    it("defaults triggers to skillTypes when tags is absent", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              name: "no-tags",
              slug: "dev/no-tags",
              owner: "dev",
              description: "No tags skill",
              skillTypes: ["frontend", "testing"],
            },
          ],
          total: 1,
        }),
      });

      const results = await adapter.search("no-tags");

      expect(results[0].triggers).toEqual(["frontend", "testing"]);
    });

    it("defaults triggers to empty array when both tags and skillTypes are absent", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              name: "bare",
              slug: "dev/bare",
              owner: "dev",
              description: "Bare skill",
            },
          ],
          total: 1,
        }),
      });

      const results = await adapter.search("bare");

      expect(results[0].triggers).toEqual([]);
    });

    it("defaults category to null when absent", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              name: "uncategorized",
              slug: "dev/uncategorized",
              owner: "dev",
              description: "No category",
            },
          ],
          total: 1,
        }),
      });

      const results = await adapter.search("uncategorized");

      expect(results[0].category).toBeNull();
    });
  });

  describe("getSkillInfo", () => {
    it("returns first match for agentskillsh:slug format", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const result = await adapter.getSkillInfo(
        "agentskillsh:alice/pdf-tools",
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe("agentskillsh:alice/pdf-tools");
      expect(result?.name).toBe("pdf-tools");
    });

    it("returns first match for plain slug", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const result = await adapter.getSkillInfo("alice/pdf-tools");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("agentskillsh:alice/pdf-tools");
    });

    it("returns null for not-found skill", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], total: 0 }),
      });

      const result = await adapter.getSkillInfo("nonexistent");

      expect(result).toBeNull();
    });

    it("returns null on fetch error", async () => {
      fetchSpy.mockRejectedValue(new Error("Network error"));

      const result = await adapter.getSkillInfo("alice/pdf-tools");

      expect(result).toBeNull();
    });
  });

  describe("install", () => {
    it("throws error when skill not found", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], total: 0 }),
      });

      await expect(
        adapter.install("agentskillsh:nonexistent", "/tmp/skills"),
      ).rejects.toThrow("Skill not found");
    });

    it("throws error when owner cannot be determined", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              name: "no-owner",
              slug: "no-owner",
              owner: "",
              description: "No owner",
            },
          ],
          total: 1,
        }),
      });

      await expect(
        adapter.install("agentskillsh:no-owner", "/tmp/skills"),
      ).rejects.toThrow("Could not determine owner");
    });
  });

  describe("conforms to SkillMarketplace interface", () => {
    it("has all required methods", () => {
      expect(typeof adapter.name).toBe("string");
      expect(typeof adapter.search).toBe("function");
      expect(typeof adapter.getSkillInfo).toBe("function");
      expect(typeof adapter.install).toBe("function");
      expect(typeof adapter.isAvailable).toBe("function");
    });
  });
});
