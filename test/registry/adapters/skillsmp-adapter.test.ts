import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SkillsMPMarketplace } from "../../../src/registry/adapters/skillsmp-adapter.js";

const MOCK_SEARCH_RESPONSE = {
  data: {
    skills: [
      {
        slug: "pdf-tools",
        name: "PDF Tools",
        description: "Extract and manipulate PDF documents",
        category: "pdf-processing",
        installs: 250,
        stars: 15,
        source_type: "github",
        owner: "alice",
        url: "https://skillsmp.com/skills/@alice/pdf-tools",
      },
      {
        slug: "markdown-parser",
        name: "Markdown Parser",
        description: "Parse markdown into structured data",
        category: "text-processing",
        installs: 80,
        stars: 5,
        source_type: "github",
        owner: "bob",
        url: "",
      },
    ],
  },
};

describe("SkillsMPMarketplace", () => {
  let adapter: SkillsMPMarketplace;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new SkillsMPMarketplace();
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
    it("is 'skillsmp'", () => {
      expect(adapter.name).toBe("skillsmp");
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
      expect(results[0].id).toBe("skillsmp:pdf-tools");
      expect(results[0].name).toBe("PDF Tools");
      expect(results[0].description).toBe("Extract and manipulate PDF documents");
      expect(results[0].marketplace).toBe("skillsmp");
      expect(results[0].category).toBe("pdf-processing");
      expect(results[0].triggers).toEqual(["pdf"]);
      expect(results[0].installCount).toBe(250);
      expect(results[0].stars).toBe(15);
      expect(results[0].installCommand).toBe(
        "npx add-skill @alice/pdf-tools",
      );
      expect(results[0].homepageUrl).toBe(
        "https://skillsmp.com/skills/@alice/pdf-tools",
      );
      expect(results[0].verified).toBe(true);

      expect(results[1].id).toBe("skillsmp:markdown-parser");
      expect(results[1].verified).toBe(true);
    });

    it("calls fetch with correct URL and headers", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { skills: [] } }),
      });

      await adapter.search("test query", { limit: 5 });

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        "https://skillsmp.com/api/v1/skills/search?q=test%20query&limit=5",
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

    it("filters results by category (client-side)", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const results = await adapter.search("pdf", {
        category: "text-processing",
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("skillsmp:markdown-parser");
    });

    it("respects limit parameter", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const results = await adapter.search("pdf", { limit: 1 });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("skillsmp:pdf-tools");
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

    it("marks non-github sourceType as not verified", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            skills: [
              {
                slug: "custom-skill",
                name: "Custom",
                description: "A custom skill",
                category: null,
                installs: 10,
                stars: 2,
                source_type: "npm",
                owner: "dev",
                url: "",
              },
            ],
          },
        }),
      });

      const results = await adapter.search("custom");

      expect(results).toHaveLength(1);
      expect(results[0].verified).toBe(false);
    });

    it("uses fallback homepageUrl when url is empty", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            skills: [
              {
                slug: "no-url",
                name: "No URL",
                description: "Skill without URL",
                installs: 5,
                stars: 0,
                source_type: "github",
                owner: "someone",
                url: "",
              },
            ],
          },
        }),
      });

      const results = await adapter.search("no-url");

      expect(results[0].homepageUrl).toBe(
        "https://skillsmp.com/skills/@someone/no-url",
      );
    });

    it("defaults installCount to 0 when installs is falsy", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            skills: [
              {
                slug: "zero-installs",
                name: "Zero",
                description: "Zero installs",
                installs: 0,
                stars: 0,
                source_type: "github",
                owner: "dev",
                url: "",
              },
            ],
          },
        }),
      });

      const results = await adapter.search("zero");

      expect(results[0].installCount).toBe(0);
    });

    it("defaults owner to 'unknown' when not provided", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            skills: [
              {
                slug: "orphan",
                name: "Orphan",
                description: "No owner",
                installs: 0,
                stars: 0,
                source_type: "github",
                url: "",
              },
            ],
          },
        }),
      });

      const results = await adapter.search("orphan");

      expect(results[0].installCommand).toBe(
        "npx add-skill @unknown/orphan",
      );
      expect(results[0].homepageUrl).toBe(
        "https://skillsmp.com/skills/@unknown/orphan",
      );
    });
  });

  describe("getSkillInfo", () => {
    it("returns first match for skillsmp:slug format", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const result = await adapter.getSkillInfo("skillsmp:pdf-tools");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("skillsmp:pdf-tools");
      expect(result?.name).toBe("PDF Tools");
    });

    it("returns first match for plain slug", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const result = await adapter.getSkillInfo("pdf-tools");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("skillsmp:pdf-tools");
    });

    it("returns null for not-found skill", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { skills: [] } }),
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
