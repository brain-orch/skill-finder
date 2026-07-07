import { z } from "zod";
import { tool } from "@opencode-ai/plugin";

const infoArgsSchema = z.object({
  identifier: z.string().describe("Skill identifier (required)"),
});

export const infoTool = tool({
  description: "Show skill details",
  args: infoArgsSchema.shape,
  async execute(args, _ctx) {
    const identifier = args.identifier.trim();
    if (!identifier) {
      return "❌ Error: identifier is required and must be non-empty.";
    }

    // Stub: return formatted placeholder response
    return `❌ Skill '${identifier}' not found.`;
  },
});
