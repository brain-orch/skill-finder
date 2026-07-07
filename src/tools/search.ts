import { z } from "zod";
import { tool } from "@opencode-ai/plugin";

const searchArgsSchema = z.object({
  query: z.string().describe("Search query (required)"),
  category: z.string().optional().describe("Filter by category (optional)"),
  limit: z.number().int().optional().describe("Max results 1-50 (default 5)"),
});

export const searchTool = tool({
  description: "Search for skills across all marketplaces",
  args: searchArgsSchema.shape,
  async execute(args, _ctx) {
    const query = args.query.trim();
    if (!query) {
      return "❌ Error: query is required and must be non-empty.";
    }

    const limit = args.limit ?? 5;
    if (limit < 1 || limit > 50) {
      return "❌ Error: limit must be between 1 and 50.";
    }

    const categoryNote = args.category ? `\n   Category filter: ${args.category}` : "";

    // Stub: return formatted placeholder response
    return `Results for "${query}":${categoryNote}\n   No matching skills found.\n\n   Found 0 skills (showing top ${limit})`;
  },
});
