import { z } from "zod";
import type { SkillIndexer } from "../cache/indexer.js";
import type { ScanResult } from "../scanner/project-scanner.js";
export declare function setSearchIndexer(indexer: SkillIndexer | null): void;
/**
 * Provide the latest project scan result so the search tool can
 * auto-expand queries with detected stack names.
 */
export declare function setScanResult(result: ScanResult | null): void;
export declare const searchTool: {
    description: string;
    args: {
        query: z.ZodString;
        category: z.ZodOptional<z.ZodString>;
        limit: z.ZodOptional<z.ZodNumber>;
    };
    execute(args: {
        query: string;
        category?: string | undefined;
        limit?: number | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<import("@opencode-ai/plugin").ToolResult>;
};
//# sourceMappingURL=search.d.ts.map