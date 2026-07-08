import { z } from "zod";
import { tool } from "@opencode-ai/plugin";
import * as path from "node:path";
import { marketplaceRegistry } from "../registry/instance.js";
import { SKILLS_DIR } from "../constants.js";

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
      return "## ⚠️ Confirmation Required\nPass `confirm=true` to proceed with installation.";
    }

    const adapter = marketplaceRegistry.getMarketplace(marketplace);
    if (!adapter) {
      return `## ❌ Unknown Marketplace\nMarketplace '${marketplace}' is not available. Available: ${marketplaceRegistry.listAvailable().join(", ")}`;
    }

    const targetDir = path.join(process.cwd(), SKILLS_DIR);
    try {
      const result = await adapter.install(identifier, targetDir);
      return [
        `## ✅ Installed ${identifier}`,
        `- **Path:** ${result.path}`,
        `- **Files:** ${result.files.join(", ")}`,
        `- **Marketplace:** ${marketplace}`,
      ].join("\n");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `## ❌ Installation Failed\n${message}`;
    }
  },
});
