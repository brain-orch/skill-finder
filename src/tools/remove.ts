import { z } from "zod";
import { tool } from "@opencode-ai/plugin";

const removeArgsSchema = z.object({
  identifier: z.string().describe("Skill identifier (required)"),
});

export const removeTool = tool({
  description: "Remove a cached skill",
  args: removeArgsSchema.shape,
  async execute(args, _ctx) {
    const identifier = args.identifier.trim();
    if (!identifier) {
      return "❌ Error: identifier is required and must be non-empty.";
    }

    // Stub: return formatted placeholder response
    return `✅ Removed ${identifier} from cache.`;
  },
});
