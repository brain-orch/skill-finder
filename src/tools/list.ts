import { z } from "zod";
import { tool } from "@opencode-ai/plugin";

const listArgsSchema = z.object({
  marketplace: z.string().optional().describe("Filter by marketplace (optional)"),
  category: z.string().optional().describe("Filter by category (optional)"),
});

export const listTool = tool({
  description: "List locally cached skills",
  args: listArgsSchema.shape,
  async execute(args, _ctx) {
    const marketplace = args.marketplace?.trim() || undefined;
    const category = args.category?.trim() || undefined;

    // Stub: return formatted placeholder response
    const filters: string[] = [];
    if (marketplace) filters.push(`marketplace="${marketplace}"`);
    if (category) filters.push(`category="${category}"`);

    if (filters.length === 0) {
      return "No cached skills found.";
    }

    return `No cached skills found (filtered by ${filters.join(", ")}).`;
  },
});
