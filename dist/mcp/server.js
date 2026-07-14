import * as readline from "node:readline";
import { PARSE_ERROR, INVALID_REQUEST, METHOD_NOT_FOUND, INVALID_PARAMS, INTERNAL_ERROR, MCP_TOOLS, } from "./constants.js";
import { callTool } from "./handlers.js";
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
    handleInitialize(id, _params) {
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