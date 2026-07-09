import type { SkillSearchResult, SkillMarketplace } from "../../types.js";
/**
 * MCP Servers registry adapter.
 *
 * The official Model Context Protocol registry lists server implementations
 * at https://registry.modelcontextprotocol.io. These are NOT installable
 * skills — they are server implementations that users configure separately.
 *
 * API docs: https://modelcontextprotocol.info/tools/registry/consuming/
 * Base URL: https://registry.modelcontextprotocol.io
 * Endpoint: GET /v0.1/servers?search={query}&limit={N}&version=latest
 * No auth required — fully public, read-only.
 */
export declare class MCPServersMarketplace implements SkillMarketplace {
    readonly name: "mcpservers";
    private static readonly BASE_URL;
    search(query: string, options?: {
        category?: string;
        limit?: number;
        signal?: AbortSignal;
    }): Promise<SkillSearchResult[]>;
    getSkillInfo(identifier: string): Promise<SkillSearchResult | null>;
    install(_identifier: string, _targetDir: string): Promise<{
        path: string;
        files: string[];
    }>;
    isAvailable(): boolean;
}
//# sourceMappingURL=mcpservers-adapter.d.ts.map