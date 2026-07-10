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
export declare function parseArgs(argv: string[]): ParsedArgs;
//# sourceMappingURL=args.d.ts.map