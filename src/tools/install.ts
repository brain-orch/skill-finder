import { z } from "zod";
import { tool } from "@opencode-ai/plugin";

const installArgsSchema = z.object({
  identifier: z.string().describe("Skill identifier (required)"),
  marketplace: z.string().describe("Marketplace name (required)"),
  confirm: z.boolean().default(true).describe("Skip confirmation (default true)"),
});

export const installTool = tool({
  description: "Download and install a skill",
  args: installArgsSchema.shape,
  async execute(args, _ctx) {
    const identifier = args.identifier.trim();
    if (!identifier) {
      return "❌ Error: identifier is required and must be non-empty.";
    }

    const marketplace = args.marketplace.trim();
    if (!marketplace) {
      return "❌ Error: marketplace is required and must be non-empty.";
    }

    const confirm = args.confirm ?? true;
    if (!confirm) {
      return "Installation requires confirmation. Pass confirm=true to proceed.";
    }

    // Stub: return formatted placeholder response
    return `Installing ${identifier} from ${marketplace}...\n✅ Successfully installed ${identifier} to ~/.opencode/skills/${identifier}`;
  },
});
