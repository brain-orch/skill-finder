import type { SkillSearchResult, SkillMarketplace } from "../../types.js";

// Hugging Face API response interfaces
interface HuggingFaceModel {
  modelId: string;
  pipeline_tag?: string;
  downloads?: number;
  likes?: number;
  tags?: string[];
  cardData?: {
    description?: string;
    license?: string;
  };
}

interface HuggingFaceSearchResponse {
  models: HuggingFaceModel[];
}

// Extended result type with _meta field for HF models
export interface HuggingFaceSearchResult extends SkillSearchResult {
  _meta: {
    type: "ml-model";
    note: "not a skill — use 'git clone' or 'pip install'";
  };
}

export class HuggingFaceMarketplace implements SkillMarketplace {
  name = "huggingface" as const;

  async search(
    query: string,
    options?: { category?: string; limit?: number; signal?: AbortSignal },
  ): Promise<HuggingFaceSearchResult[]> {
    if (!query) return [];

    const limit = options?.limit ?? 20;

    try {
      const url = `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&limit=${limit}`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": "skill-finder/1.0",
          Accept: "application/json",
        },
        signal: options?.signal,
      });

      if (!response.ok) return [];

      const json: HuggingFaceSearchResponse = await response.json() as HuggingFaceSearchResponse;

      if (!json.models || !Array.isArray(json.models)) return [];

      const results: HuggingFaceSearchResult[] = json.models.map((model) => ({
        id: `huggingface:${model.modelId}`,
        name: model.modelId.replace(/\//g, " / "),  // Clean up name for display
        description: model.cardData?.description?.slice(0, 1024) || `Hugging Face model: ${model.modelId}`,
        marketplace: "huggingface" as const,
        category: model.pipeline_tag || null,
        triggers: [query, ...(model.tags || [])],
        installCount: model.downloads || 0,
        stars: model.likes || 0,
        installCommand: `git clone https://huggingface.co/${model.modelId}`,
        homepageUrl: `https://huggingface.co/${model.modelId}`,
        verified: false,  // HF doesn't have verification badges like other marketplaces
        _meta: {
          type: "ml-model" as const,
          note: "not a skill — use 'git clone' or 'pip install'" as const,
        },
      }));

      return results.slice(0, limit);
    } catch (err) {
      console.warn(
        "[skill-finder] huggingface search failed:",
        (err as Error).message,
      );
      return [];
    }
  }

  async getSkillInfo(identifier: string): Promise<HuggingFaceSearchResult | null> {
    try {
      // Strip "huggingface:" prefix if present
      const modelId = identifier.startsWith("huggingface:")
        ? identifier.slice("huggingface:".length)
        : identifier;

      const url = `https://huggingface.co/api/models/${encodeURIComponent(modelId)}`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": "skill-finder/1.0",
          Accept: "application/json",
        },
      });

      if (!response.ok) return null;

      const model: HuggingFaceModel = await response.json() as HuggingFaceModel;

      if (!model || !model.modelId) return null;

      return {
        id: `huggingface:${model.modelId}`,
        name: model.modelId.replace(/\//g, " / "),
        description: model.cardData?.description?.slice(0, 1024) || `Hugging Face model: ${model.modelId}`,
        marketplace: "huggingface" as const,
        category: model.pipeline_tag || null,
        triggers: [model.modelId],
        installCount: model.downloads || 0,
        stars: model.likes || 0,
        installCommand: `git clone https://huggingface.co/${model.modelId}`,
        homepageUrl: `https://huggingface.co/${model.modelId}`,
        verified: false,
        _meta: {
          type: "ml-model" as const,
          note: "not a skill — use 'git clone' or 'pip install'" as const,
        },
      };
    } catch (err) {
      console.warn(
        "[skill-finder] huggingface getSkillInfo failed:",
        (err as Error).message,
      );
      return null;
    }
  }

  async install(
    identifier: string,
    targetDir: string,
  ): Promise<{ path: string; files: string[] }> {
    // Hugging Face models cannot be installed as OpenCode skills
    throw new Error("Hugging Face models cannot be installed directly — use 'git clone' or 'pip install'");
  }

  isAvailable(): boolean {
    return true;
  }
}
