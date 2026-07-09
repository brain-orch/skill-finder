#!/usr/bin/env node

import { MCPServer } from "../mcp/server.js";

const HELP_TEXT = `
skill-finder - OpenCode skill discovery and management

Usage:
  skill-finder <command> [options]

Commands:
  mcp         Start MCP server mode (stdio JSON-RPC 2.0)
  --help      Show this help message

Examples:
  skill-finder mcp          Start MCP server for client integration
  skill-finder --help       Show help
`;

export class SkillFinderCLI {
  async run(args: string[]): Promise<void> {
    // Handle --help flag
    if (args.includes("--help") || args.includes("-h")) {
      process.stdout.write(HELP_TEXT);
      return;
    }

    // Get the first non-flag argument as the command
    const command = args.find((arg) => !arg.startsWith("-"));

    switch (command) {
      case "mcp": {
        const server = new MCPServer();
        await server.start();
        break;
      }

      case undefined:
        process.stdout.write(HELP_TEXT);
        break;

      default:
        process.stderr.write(`Unknown command: ${command}\n\n`);
        process.stdout.write(HELP_TEXT);
        process.exit(1);
    }
  }
}

// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new SkillFinderCLI();
  cli.run(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
}
