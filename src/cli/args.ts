export interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Parse CLI arguments into a structured object.
 *
 * Handles:
 *   - Positional args (first non-flag tokens become `command` then `positional`)
 *   - `--flag value` and `--flag=value` (string flags)
 *   - `--flag` without value (boolean flag, stored as `true`)
 *   - `-h` / `--help` (boolean flag)
 *
 * Throws on unknown flags (flags not starting with `--` or `-` after a known pattern).
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--") {
      // Everything after `--` is positional
      i++;
      while (i < argv.length) {
        positional.push(argv[i]);
        i++;
      }
      break;
    }

    if (arg.startsWith("--")) {
      // Long flag: --flag, --flag=value, --flag value
      const eqIdx = arg.indexOf("=");
      if (eqIdx !== -1) {
        // --flag=value
        const key = arg.slice(2, eqIdx);
        const value = arg.slice(eqIdx + 1);
        flags[key] = value;
      } else {
        const key = arg.slice(2);
        // Check if next token is a value (not another flag)
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("-")) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      // Short flag: -h, -v
      const key = arg.slice(1);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("-")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }

    i++;
  }

  const [command, ...rest] = positional;

  return {
    command: command ?? "",
    positional: rest,
    flags,
  };
}
