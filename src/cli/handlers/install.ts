import { marketplaceRegistry } from "../../registry/instance.js";
import { BOLD, RESET, HELP_TEXT } from "../format.js";

export async function handleInstall(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
  const identifier = positional[0]?.trim();
  const marketplace = positional[1]?.trim();

  if (!identifier || !marketplace) {
    process.stderr.write("Error: install requires <identifier> <marketplace>.\n\n");
    process.stdout.write(HELP_TEXT);
    process.exit(1);
  }

  const adapter = marketplaceRegistry.getMarketplace(marketplace);
  if (!adapter) {
    process.stderr.write(`Unknown marketplace '${marketplace}'. Available: ${marketplaceRegistry.listAvailable().join(", ")}\n`);
    process.exit(1);
  }

  const targetDir = typeof flags["target"] === "string" ? flags["target"] : process.cwd();

  try {
    const result = await adapter.install(identifier, targetDir);
    process.stdout.write(`${BOLD}\u2705 Installed ${identifier}${RESET}\n`);
    process.stdout.write(`  Path: ${result.path}\n`);
    process.stdout.write(`  Files: ${result.files.join(", ")}\n`);
    process.stdout.write(`  Marketplace: ${marketplace}\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Installation failed: ${message}\n`);
    process.exit(1);
  }
}
