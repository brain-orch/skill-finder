import * as readline from "node:readline";
import { marketplaceRegistry } from "../registry/instance.js";
import { QualityScorer } from "../scoring/quality.js";
const qualityScorer = new QualityScorer();
// JSON-RPC Error Codes
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;
// ---------------------------------------------------------------------------
// MCP Tool Definitions
// ---------------------------------------------------------------------------
const MCP_TOOLS = [
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
// ---------------------------------------------------------------------------
// Tool Implementations
// ---------------------------------------------------------------------------
async function handleSearchSkills(params) {
    const query = params.query;
    if (typeof query !== "string" || query.trim().length === 0) {
        throw new Error("query is required and must be non-empty");
    }
    const limit = typeof params.limit === "number" ? params.limit : 5;
    if (limit < 1 || limit > 50) {
        throw new Error("limit must be between 1 and 50");
    }
    const category = typeof params.category === "string" ? params.category : undefined;
    const results = await marketplaceRegistry.searchAll(query.trim(), { limit, category });
    if (results.length === 0) {
        return "No matching skills found.";
    }
    // Group by marketplace
    const byMarketplace = new Map();
    for (const r of results) {
        if (!byMarketplace.has(r.marketplace)) {
            byMarketplace.set(r.marketplace, []);
        }
        byMarketplace.get(r.marketplace).push(r);
    }
    const lines = [`## Search Results for "${query.trim()}"`, ""];
    for (const [marketplace, items] of byMarketplace) {
        lines.push(`### 📦 ${marketplace} (${items.length} results)`);
        for (const item of items) {
            const stars = item.stars ? `⭐${item.stars}` : "⭐0";
            const installs = item.installCount ? `${item.installCount} installs` : "0 installs";
            lines.push(`- **${item.name}** — ${item.description} (${stars} · ${installs})`);
            const qScore = qualityScorer.score(item);
            lines.push(`  - Quality: ${Math.round(qScore * 100)}%`);
            lines.push(`  - ID: \`${item.id}\` | [View](${item.homepageUrl})`);
        }
        lines.push("");
    }
    lines.push(`**Total: ${results.length} skills found** (showing top ${limit})`);
    return lines.join("\n");
}
async function handleRecommendSkills(params) {
    const context = params.context;
    if (typeof context !== "string" || context.trim().length === 0) {
        throw new Error("context is required and must be non-empty");
    }
    // Simple keyword-based recommendation
    const query = context.trim();
    const results = await marketplaceRegistry.searchAll(query, { limit: 5 });
    if (results.length === 0) {
        return "No skills found matching your context.";
    }
    const lines = [`## Recommended Skills for "${query}"`, ""];
    for (const skill of results) {
        const stars = skill.stars ? `⭐${skill.stars}` : "⭐0";
        const qScore = qualityScorer.score(skill);
        lines.push(`- **${skill.name}** (${skill.marketplace}) — ${skill.description}`);
        lines.push(`  - Quality: ${Math.round(qScore * 100)}% | ${stars}`);
        lines.push(`  - ID: \`${skill.id}\``);
    }
    return lines.join("\n");
}
async function handleSkillInfo(params) {
    const identifier = params.identifier;
    if (typeof identifier !== "string" || identifier.trim().length === 0) {
        throw new Error("identifier is required and must be non-empty");
    }
    let skill = null;
    // Try to find adapter by marketplace prefix
    if (identifier.includes(":")) {
        const [marketplace, skillId] = identifier.split(":", 2);
        const adapter = marketplaceRegistry.getMarketplace(marketplace);
        if (adapter) {
            skill = await adapter.getSkillInfo(skillId);
        }
    }
    // Fallback: search all marketplaces
    if (!skill) {
        const results = await marketplaceRegistry.searchAll(identifier, { limit: 5 });
        skill = results.find((r) => r.id === identifier) ?? results[0] ?? null;
    }
    if (!skill) {
        return `## ❌ Skill Not Found\nSkill '${identifier}' was not found in any marketplace.`;
    }
    const rows = [
        `## ${skill.name}`,
        "",
        "| Field | Value |",
        "|---|---|",
        `| **ID** | \`${skill.id}\` |`,
        `| **Marketplace** | ${skill.marketplace} |`,
        `| **Category** | ${skill.category ?? "—"} |`,
        `| **Stars** | ⭐ ${skill.stars} |`,
        `| **Installs** | ${skill.installCount} |`,
        `| **Description** | ${skill.description} |`,
        `| **Triggers** | ${skill.triggers.join(", ") || "—"} |`,
        `| **Install** | \`${skill.installCommand}\` |`,
        `| **Homepage** | [${skill.homepageUrl}](${skill.homepageUrl}) |`,
    ];
    if (skill.verified) {
        rows.push("| **Verified** | ✅ Verified |");
    }
    return rows.join("\n");
}
async function handleInstallSkill(params) {
    const identifier = params.identifier;
    if (typeof identifier !== "string" || identifier.trim().length === 0) {
        throw new Error("identifier is required and must be non-empty");
    }
    const marketplace = params.marketplace;
    if (typeof marketplace !== "string" || marketplace.trim().length === 0) {
        throw new Error("marketplace is required and must be non-empty");
    }
    const adapter = marketplaceRegistry.getMarketplace(marketplace);
    if (!adapter) {
        return `## ❌ Unknown Marketplace\nMarketplace '${marketplace}' is not available. Available: ${marketplaceRegistry.listAvailable().join(", ")}`;
    }
    const targetDir = process.cwd();
    try {
        const result = await adapter.install(identifier.trim(), targetDir);
        return [
            `## ✅ Installed ${identifier}`,
            `- **Path:** ${result.path}`,
            `- **Files:** ${result.files.join(", ")}`,
            `- **Marketplace:** ${marketplace}`,
        ].join("\n");
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return `## ❌ Installation Failed\n${message}`;
    }
}
// ---------------------------------------------------------------------------
// Tool Dispatcher
// ---------------------------------------------------------------------------
async function callTool(name, args) {
    switch (name) {
        case "search_skills":
            return handleSearchSkills(args);
        case "recommend_skills":
            return handleRecommendSkills(args);
        case "skill_info":
            return handleSkillInfo(args);
        case "install_skill":
            return handleInstallSkill(args);
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}
// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
export class MCPServer {
    readlineInterface = null;
    initialized = false;
    /**
     * Start the MCP server, reading JSON-RPC requests from stdin
     * and writing responses to stdout.
     */
    async start() {
        this.readlineInterface = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false,
        });
        for await (const line of this.readlineInterface) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            const response = await this.processLine(trimmed);
            if (response) {
                process.stdout.write(JSON.stringify(response) + "\n");
            }
        }
    }
    /**
     * Process a single line of input and return a JSON-RPC response.
     * This method is public for testing purposes.
     */
    async processLine(line) {
        try {
            const request = JSON.parse(line);
            return await this.handleRequest(request);
        }
        catch (err) {
            // JSON parse error
            return {
                jsonrpc: "2.0",
                id: null,
                error: {
                    code: PARSE_ERROR,
                    message: "Parse error",
                    data: err instanceof Error ? err.message : String(err),
                },
            };
        }
    }
    /**
     * Handle a single JSON-RPC request.
     */
    async handleRequest(request) {
        // Validate basic structure
        if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
            return {
                jsonrpc: "2.0",
                id: request.id ?? null,
                error: {
                    code: INVALID_REQUEST,
                    message: "Invalid request",
                },
            };
        }
        const { id, method, params } = request;
        // Notifications don't require a response
        if (method === "notifications/initialized") {
            this.initialized = true;
            return null;
        }
        // Handle methods
        try {
            switch (method) {
                case "initialize":
                    return this.handleInitialize(id, params);
                case "tools/list":
                    return this.handleToolsList(id);
                case "tools/call":
                    return await this.handleToolsCall(id, params);
                default:
                    return {
                        jsonrpc: "2.0",
                        id,
                        error: {
                            code: METHOD_NOT_FOUND,
                            message: `Method not found: ${method}`,
                        },
                    };
            }
        }
        catch (err) {
            return {
                jsonrpc: "2.0",
                id,
                error: {
                    code: INTERNAL_ERROR,
                    message: "Internal error",
                    data: err instanceof Error ? err.message : String(err),
                },
            };
        }
    }
    /**
     * Handle initialize method.
     */
    handleInitialize(id, params) {
        return {
            jsonrpc: "2.0",
            id,
            result: {
                protocolVersion: "2024-11-05",
                capabilities: {
                    tools: {},
                },
                serverInfo: {
                    name: "skill-finder",
                    version: "1.0.0",
                },
            },
        };
    }
    /**
     * Handle tools/list method.
     */
    handleToolsList(id) {
        return {
            jsonrpc: "2.0",
            id,
            result: {
                tools: MCP_TOOLS,
            },
        };
    }
    /**
     * Handle tools/call method.
     */
    async handleToolsCall(id, params) {
        if (!params || typeof params.name !== "string") {
            return {
                jsonrpc: "2.0",
                id,
                error: {
                    code: INVALID_PARAMS,
                    message: "Missing or invalid 'name' parameter",
                },
            };
        }
        const { name, arguments: args } = params;
        const toolArgs = (typeof args === "object" && args !== null ? args : {});
        try {
            const result = await callTool(name, toolArgs);
            return {
                jsonrpc: "2.0",
                id,
                result: {
                    content: [
                        {
                            type: "text",
                            text: result,
                        },
                    ],
                },
            };
        }
        catch (err) {
            // Check if it's a tool-not-found error
            if (err instanceof Error && err.message.startsWith("Unknown tool:")) {
                return {
                    jsonrpc: "2.0",
                    id,
                    error: {
                        code: METHOD_NOT_FOUND,
                        message: err.message,
                    },
                };
            }
            // Other tool execution errors
            return {
                jsonrpc: "2.0",
                id,
                result: {
                    content: [
                        {
                            type: "text",
                            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
                        },
                    ],
                    isError: true,
                },
            };
        }
    }
}
//# sourceMappingURL=server.js.map