#!/usr/bin/env node
import { MCPServer } from "../mcp/server.js";
import { parseArgs } from "./args.js";
import { HELP_TEXT } from "./format.js";
import { handleSearch } from "./handlers/search.js";
import { handleInstall } from "./handlers/install.js";
import { handleList } from "./handlers/list.js";
import { handleInfo } from "./handlers/info.js";
import { handleRemove } from "./handlers/remove.js";
import { handleCheckUpdates } from "./handlers/check-updates.js";
import { handlePlan } from "./handlers/plan.js";
export class SkillFinderCLI {
    async run(args) {
        const parsed = parseArgs(args);
        if (parsed.flags["h"] === true || parsed.flags["help"] === true || parsed.command === "help") {
            process.stdout.write(HELP_TEXT);
            return;
        }
        if (!parsed.command) {
            process.stdout.write(HELP_TEXT);
            return;
        }
        switch (parsed.command) {
            case "search":
                await handleSearch(parsed.positional);
                break;
            case "install":
                await handleInstall(parsed.positional, parsed.flags);
                break;
            case "list":
                await handleList(parsed.positional);
                break;
            case "info":
                await handleInfo(parsed.positional);
                break;
            case "remove":
                await handleRemove(parsed.positional);
                break;
            case "check-updates":
                await handleCheckUpdates();
                break;
            case "plan":
                await handlePlan();
                break;
            case "mcp": {
                const server = new MCPServer();
                await server.start();
                break;
            }
            default:
                process.stderr.write(`Unknown command: ${parsed.command}\n\n`);
                process.stdout.write(HELP_TEXT);
                process.exit(1);
        }
    }
}
// Run CLI if this file is executed directly
import { fileURLToPath, pathToFileURL } from "node:url";
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    const cli = new SkillFinderCLI();
    cli.run(process.argv.slice(2)).catch((err) => {
        process.stderr.write(`Error: ${err.message}\n`);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map