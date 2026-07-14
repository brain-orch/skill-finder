// ---------------------------------------------------------------------------
// JSON-RPC 2.0 Types
// ---------------------------------------------------------------------------
// JSON-RPC Error Codes
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;
// ---------------------------------------------------------------------------
// MCP Tool Definitions
// ---------------------------------------------------------------------------
export const MCP_TOOLS = [
    {
        name: "search_skills",
        description: "Search for skills across all marketplaces",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query (required)" },
                category: { type: "string", description: "Filter by category (optional)" },
                limit: { type: "number", description: "Max results 1-50 (default 5)" },
            },
            required: ["query"],
        },
    },
    {
        name: "recommend_skills",
        description: "Get skill recommendations based on context",
        inputSchema: {
            type: "object",
            properties: {
                context: { type: "string", description: "Context description for recommendations (required)" },
            },
            required: ["context"],
        },
    },
    {
        name: "skill_info",
        description: "Get detailed information about a specific skill",
        inputSchema: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Skill identifier (required)" },
            },
            required: ["identifier"],
        },
    },
    {
        name: "install_skill",
        description: "Install a skill from a marketplace",
        inputSchema: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Skill identifier (required)" },
                marketplace: { type: "string", description: "Marketplace name (required)" },
                target: { type: "string", description: "Target directory (default: opencode)" },
            },
            required: ["identifier", "marketplace"],
        },
    },
];
//# sourceMappingURL=constants.js.map