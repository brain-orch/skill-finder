import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AwesomeSkillMarketplace } from "../../../src/registry/adapters/awesomeskill-adapter.js";

const MOCK_SEARCH_RESPONSE = {
  query: "browser",
  count: 2,
  skills: [
    {
      name: "chrome-devtools",
      slug: "claudekit-skills-chrome-devtools",
      url: "https://awesomeskill.ai/skills/claudekit-skills-chrome-devtools",
      description:
        "Browser automation, debugging, and performance analysis using Puppeteer CLI scripts.",
      sourceUrl: "https://github.com/mrgoonie/claudekit-skills",
      githubRepo: "mrgoonie/claudekit-skills",
      githubStars: 1439,
      categories: ["developer-tools"],
      tags: ["web-testing", "puppeteer", "browser-automation"],
    },
    {
      name: "agent-browser",
      slug: "vercel-labs-agent-browser-agent-browser",
      url: "https://awesomeskill.ai/skills/vercel-labs-agent-browser-agent-browser",
      description:
        "Browser automation CLI for AI agents. Use when the user needs to interact with websites.",
      sourceUrl:
        "https://github.com/vercel-labs/agent-browser/tree/main/skills/agent-browser",
      githubRepo: "vercel-labs/agent-browser",
      githubStars: 28079,
      categories: ["productivity-workflow", "testing-qa"],
      tags: ["web-scraping", "cli", "testing", "browser-automation"],
    },
  ],
};

describe("AwesomeSkillMarketplace", () => {
  let adapter: AwesomeSkillMarketplace;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new AwesomeSkillMarketplace();
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
    it("is 'awesomeskill'", () => {
      expect(adapter.name).toBe("awesomeskill");
    });
  });

  describe("search", () => {
    it("returns parsed results from valid API response", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const results = await adapter.search("browser");

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe(
        "awesomeskill:claudekit-skills-chrome-devtools",
      );
      expect(results[0].name).toBe("chrome-devtools");
      expect(results[0].description).toBe(
        "Browser automation, debugging, and performance analysis using Puppeteer CLI scripts.",
      );
      expect(results[0].marketplace).toBe("awesomeskill");
      expect(results[0].category).toBe("developer-tools");
      expect(results[0].triggers).toEqual(["browser"]);
      expect(results[0].installCount).toBe(0);
      expect(results[0].stars).toBe(1439);
      expect(results[0].installCommand).toBe(
        "git clone https://github.com/mrgoonie/claudekit-skills.git",
      );
      expect(results[0].homepageUrl).toBe(
        "https://awesomeskill.ai/skills/claudekit-skills-chrome-devtools",
      );
      expect(results[0].verified).toBe(false);

      expect(results[1].id).toBe(
        "awesomeskill:vercel-labs-agent-browser-agent-browser",
      );
      expect(results[1].name).toBe("agent-browser");
      expect(results[1].category).toBe("productivity-workflow");
      expect(results[1].stars).toBe(28079);
    });

    it("calls fetch with correct URL and headers", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ query: "test", count: 0, skills: [] }),
      });

      await adapter.search("test query", { limit: 5 });

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        "https://awesomeskill.ai/api/agent/skills/search?q=test%20query&limit=5",
      );
      expect(init?.headers).toEqual({
        "User-Agent": "skill-finder/1.0",
        Accept: "application/json",
      });
    });

    it("returns [] on network error", async () => {
      fetchSpy.mockRejectedValue(new Error("Network failure"));

      const results = await adapter.search("browser");

      expect(results).toEqual([]);
    });

    it("returns [] on non-200 response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const results = await adapter.search("browser");

      expect(results).toEqual([]);
    });

    it("returns [] on invalid JSON structure", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ notSkills: "unexpected" }),
      });

      const results = await adapter.search("browser");

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
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const results = await adapter.search("browser", { limit: 1 });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(
        "awesomeskill:claudekit-skills-chrome-devtools",
      );
    });

    it("uses AbortSignal when provided", async () => {
      const controller = new AbortController();
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      await adapter.search("browser", { signal: controller.signal });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init?.signal).toBe(controller.signal);
    });

    it("sets category to null when categories array is empty", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          query: "empty",
          count: 1,
          skills: [
            {
              name: "no-cats",
              slug: "no-cats",
              url: "https://awesomeskill.ai/skills/no-cats",
              description: "A skill with no categories",
              sourceUrl: "https://github.com/test/repo",
              githubRepo: "test/repo",
              githubStars: 0,
              categories: [],
              tags: [],
            },
          ],
        }),
      });

      const results = await adapter.search("empty");

      expect(results).toHaveLength(1);
      expect(results[0].category).toBeNull();
    });

    it("uses sourceUrl fallback when githubRepo is empty", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          query: "no-repo",
          count: 1,
          skills: [
            {
              name: "no-repo",
              slug: "no-repo",
              url: "https://awesomeskill.ai/skills/no-repo",
              description: "A skill without a github repo",
              sourceUrl: "https://example.com/skill",
              githubRepo: "",
              githubStars: 5,
              categories: [],
              tags: [],
            },
          ],
        }),
      });

      const results = await adapter.search("no-repo");

      expect(results).toHaveLength(1);
      expect(results[0].installCommand).toBe(
        "# Install from https://example.com/skill",
      );
      expect(results[0].stars).toBe(5);
    });

    it("defaults stars to 0 when githubStars is falsy", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          query: "zero-stars",
          count: 1,
          skills: [
            {
              name: "zero-stars",
              slug: "zero-stars",
              url: "https://awesomeskill.ai/skills/zero-stars",
              description: "Zero stars skill",
              sourceUrl: "https://github.com/test/repo",
              githubRepo: "test/repo",
              githubStars: 0,
              categories: [],
              tags: [],
            },
          ],
        }),
      });

      const results = await adapter.search("zero-stars");

      expect(results[0].stars).toBe(0);
    });
  });

  describe("getSkillInfo", () => {
    it("returns first match for awesomeskill:slug format", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const result = await adapter.getSkillInfo(
        "awesomeskill:claudekit-skills-chrome-devtools",
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe(
        "awesomeskill:claudekit-skills-chrome-devtools",
      );
      expect(result?.name).toBe("chrome-devtools");
    });

    it("returns first match for plain slug", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const result = await adapter.getSkillInfo(
        "claudekit-skills-chrome-devtools",
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe(
        "awesomeskill:claudekit-skills-chrome-devtools",
      );
    });

    it("returns null for not-found skill", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          query: "nonexistent",
          count: 0,
          skills: [],
        }),
      });

      const result = await adapter.getSkillInfo("nonexistent");

      expect(result).toBeNull();
    });

    it("returns null on fetch error", async () => {
      fetchSpy.mockRejectedValue(new Error("Network error"));

      const result = await adapter.getSkillInfo(
        "claudekit-skills-chrome-devtools",
      );

      expect(result).toBeNull();
    });
  });

  describe("conforms to SkillMarketplace interface", () => {
    it("has all required methods", () => {
      expect(typeof adapter.search).toBe("function");
      expect(typeof adapter.getSkillInfo).toBe("function");
      expect(typeof adapter.install).toBe("function");
      expect(typeof adapter.isAvailable).toBe("function");
    });

    it("search returns SkillSearchResult-compatible objects", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const results = await adapter.search("browser");

      for (const result of results) {
        expect(typeof result.id).toBe("string");
        expect(typeof result.name).toBe("string");
        expect(typeof result.description).toBe("string");
        expect(result.marketplace).toBe("awesomeskill");
        expect(
          result.category === null || typeof result.category === "string",
        ).toBe(true);
        expect(Array.isArray(result.triggers)).toBe(true);
        expect(typeof result.installCount).toBe("number");
        expect(typeof result.stars).toBe("number");
        expect(typeof result.installCommand).toBe("string");
        expect(typeof result.homepageUrl).toBe("string");
        expect(typeof result.verified).toBe("boolean");
      }
    });
  });
});
