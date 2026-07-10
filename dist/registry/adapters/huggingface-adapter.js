export class HuggingFaceMarketplace {
    name = "huggingface";
    async search(query, options) {
        if (!query)
            return [];
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
            if (!response.ok)
                return [];
            const json = await response.json();
            if (!json.models || !Array.isArray(json.models))
                return [];
            const results = json.models.map((model) => ({
                id: `huggingface:${model.modelId}`,
                name: model.modelId.replace(/\//g, " / "), // Clean up name for display
                description: model.cardData?.description?.slice(0, 1024) || `Hugging Face model: ${model.modelId}`,
                marketplace: "huggingface",
                category: model.pipeline_tag || null,
                triggers: [query, ...(model.tags || [])],
                installCount: model.downloads || 0,
                stars: model.likes || 0,
                installCommand: `git clone https://huggingface.co/${model.modelId}`,
                homepageUrl: `https://huggingface.co/${model.modelId}`,
                verified: false, // HF doesn't have verification badges like other marketplaces
                _meta: {
                    type: "ml-model",
                    note: "not a skill — use 'git clone' or 'pip install'",
                },
            }));
            return results.slice(0, limit);
        }
        catch (err) {
            console.warn("[skill-finder] huggingface search failed:", err.message);
            return [];
        }
    }
    async getSkillInfo(identifier) {
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
            if (!response.ok)
                return null;
            const model = await response.json();
            if (!model || !model.modelId)
                return null;
            return {
                id: `huggingface:${model.modelId}`,
                name: model.modelId.replace(/\//g, " / "),
                description: model.cardData?.description?.slice(0, 1024) || `Hugging Face model: ${model.modelId}`,
                marketplace: "huggingface",
                category: model.pipeline_tag || null,
                triggers: [model.modelId],
                installCount: model.downloads || 0,
                stars: model.likes || 0,
                installCommand: `git clone https://huggingface.co/${model.modelId}`,
                homepageUrl: `https://huggingface.co/${model.modelId}`,
                verified: false,
                _meta: {
                    type: "ml-model",
                    note: "not a skill — use 'git clone' or 'pip install'",
                },
            };
        }
        catch (err) {
            console.warn("[skill-finder] huggingface getSkillInfo failed:", err.message);
            return null;
        }
    }
    async install(identifier, targetDir) {
        // Hugging Face models cannot be installed as OpenCode skills
        throw new Error("Hugging Face models cannot be installed directly — use 'git clone' or 'pip install'");
    }
    isAvailable() {
        return true;
    }
}
//# sourceMappingURL=huggingface-adapter.js.map