export const BOLD = "\x1b[1m";
export const RESET = "\x1b[0m";
export const SEP = "\u2500".repeat(60);

export const HELP_TEXT = `\
Usage: skill-finder <command> [options]

Commands:
  search <query>      Search for skills across all marketplaces
  install <id> <mp>   Install a skill from a marketplace
  list                List installed (cached) skills
  info <id>           Show detailed info about a skill
  remove <id>         Remove a cached skill
  check-updates       Check for available updates to installed skills
  plan                List available skill plans
  mcp                 Start MCP server (for agentic integration)

Options:
  -h, --help          Show this help message
`;
