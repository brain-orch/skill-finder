import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HuggingFaceMarketplace } from "../../../src/registry/adapters/huggingface-adapter.js";

const MOCK_SEARCH_RESPONSE = {
  models: [
    {
      modelId: "gpt2",
      pipeline_tag: "text-generation",
      downloads: 1000000,
      likes: 500,
      tags: ["text-generation", "causal-lm"],
      cardData: {
        description: "A large language model for text generation",
        license: "mit",
      },
    },
    {
      modelId: "bert-base-uncased",
      pipeline_tag: "text-classification",
      downloads: 500000,
      likes: 300,
      tags: ["text-classification", "fill-mask"],
      cardData: {
        description: "Bidirectional Encoder Representations from Transformers",
        license: "apache-2.0",
      },
    },
  ],
};

const MOCK_MODEL_RESPONSE = {
  modelId: "gpt2",
  pipeline_tag: "text-generation",
  downloads: 1000000,
  likes: 500,
  tags: ["text-generation", "causal-lm"],
  cardData: {
    description: "A large language model for text generation",
    license: "mit",
  },
};

describe("HuggingFaceMarketplace", () => {
  let adapter: HuggingFaceMarketplace;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new HuggingFaceMarketplace();
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
    it("is 'huggingface'", () => {
      expect(adapter.name).toBe("huggingface");
    });
  });

  describe("search", () => {
    it("returns parsed results from valid API response", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      const results = await adapter.search("gpt");

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("huggingface:gpt2");
      expect(results[0].name).toBe("gpt2");
      expect(results[0].description).toBe("A large language model for text generation");
      expect(results[0].marketplace).toBe("huggingface");
      expect(results[0].category).toBe("text-generation");
      expect(results[0].triggers).toContain("gpt");
      expect(results[0].installCount).toBe(1000000);
      expect(results[0].stars).toBe(500);
      expect(results[0].installCommand).toBe("git clone https://huggingface.co/gpt2");
      expect(results[0].homepageUrl).toBe("https://huggingface.co/gpt2");
      expect(results[0].verified).toBe(false);
      expect(results[0]._meta).toEqual({
        type: "ml-model",
        note: "not a skill — use 'git clone' or 'pip install'",
      });

      expect(results[1].id).toBe("huggingface:bert-base-uncased");
      expect(results[1].category).toBe("text-classification");
    });

    it("calls fetch with correct URL and headers", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      });

      await adapter.search("test query", { limit: 5 });

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        "https://huggingface.co/api/models?search=test%20query&limit=5",
      );
      expect(init?.headers).toEqual({
        "User-Agent": "skill-finder/1.0",
        Accept: "application/json",
      });
    });

    it("returns [] on network error", async () => {
      fetchSpy.mockRejectedValue(new Error("Network failure"));

      const results = await adapter.search("gpt");

      expect(results).toEqual([]);
    });

    it("returns [] on non-200 response", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const results = await adapter.search("gpt");

      expect(results).toEqual([]);
    });

    it("returns [] on invalid JSON structure", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ notModels: "unexpected" }),
      });

      const results = await adapter.search("gpt");

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

      const results = await adapter.search("gpt", { limit: 1 });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("huggingface:gpt2");
    });

    it("uses AbortSignal when provided", async () => {
      const controller = new AbortController();
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_SEARCH_RESPONSE,
      });

      await adapter.search("gpt", { signal: controller.signal });

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init?.signal).toBe(controller.signal);
    });

    it("maps pipeline_tag to category", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              modelId: "test-model",
              pipeline_tag: "text-classification",
              downloads: 100,
              likes: 10,
              tags: ["text-classification"],
              cardData: { description: "Test model" },
            },
          ],
        }),
      });

      const results = await adapter.search("test");

      expect(results[0].category).toBe("text-classification");
    });

    it("defaults category to null when pipeline_tag is missing", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              modelId: "no-pipeline",
              downloads: 100,
              likes: 10,
              tags: [],
              cardData: { description: "No pipeline tag" },
            },
          ],
        }),
      });

      const results = await adapter.search("no-pipeline");

      expect(results[0].category).toBeNull();
    });

    it("truncates description to 1024 chars", async () => {
      const longDescription = "A".repeat(2000);
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              modelId: "long-desc",
              downloads: 100,
              likes: 10,
              tags: [],
              cardData: { description: longDescription },
            },
          ],
        }),
      });

      const results = await adapter.search("long-desc");

      expect(results[0].description).toHaveLength(1024);
    });

    it("uses fallback description when cardData is missing", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              modelId: "no-card",
              downloads: 100,
              likes: 10,
              tags: [],
            },
          ],
        }),
      });

      const results = await adapter.search("no-card");

      expect(results[0].description).toBe("Hugging Face model: no-card");
    });

    it("defaults installCount to 0 when downloads is falsy", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              modelId: "zero-downloads",
              downloads: 0,
              likes: 10,
              tags: [],
              cardData: { description: "Zero downloads" },
            },
          ],
        }),
      });

      const results = await adapter.search("zero-downloads");

      expect(results[0].installCount).toBe(0);
    });

    it("defaults stars to 0 when likes is falsy", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [
            {
              modelId: "zero-likes",
              downloads: 100,
              likes: 0,
              tags: [],
              cardData: { description: "Zero likes" },
            },
          ],
        }),
      });

      const results = await adapter.search("zero-likes");

      expect(results[0].stars).toBe(0);
    });
  });

  describe("getSkillInfo", () => {
    it("returns model info for huggingface:modelId format", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_MODEL_RESPONSE,
      });

      const result = await adapter.getSkillInfo("huggingface:gpt2");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("huggingface:gpt2");
      expect(result?.name).toBe("gpt2");
      expect(result?.category).toBe("text-generation");
      expect(result?._meta).toEqual({
        type: "ml-model",
        note: "not a skill — use 'git clone' or 'pip install'",
      });
    });

    it("returns model info for plain modelId", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => MOCK_MODEL_RESPONSE,
      });

      const result = await adapter.getSkillInfo("gpt2");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("huggingface:gpt2");
    });

    it("returns null for not-found model", async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      });

      const result = await adapter.getSkillInfo("nonexistent");

      expect(result).toBeNull();
    });

    it("returns null on fetch error", async () => {
      fetchSpy.mockRejectedValue(new Error("Network error"));

      const result = await adapter.getSkillInfo("gpt2");

      expect(result).toBeNull();
    });
  });

  describe("install", () => {
    it("throws descriptive error", async () => {
      await expect(
        adapter.install("huggingface:gpt2", "/tmp/skills"),
      ).rejects.toThrow(
        "Hugging Face models cannot be installed directly — use 'git clone' or 'pip install'",
      );
    });

    it("throws for any identifier", async () => {
      await expect(
        adapter.install("any-model", "/tmp/skills"),
      ).rejects.toThrow(
        "Hugging Face models cannot be installed directly — use 'git clone' or 'pip install'",
      );
    });
  });
});
