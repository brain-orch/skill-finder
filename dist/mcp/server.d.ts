import { type JsonRpcResponse } from "./constants.js";
export declare class MCPServer {
    private readlineInterface;
    private initialized;
    /**
     * Start the MCP server, reading JSON-RPC requests from stdin
     * and writing responses to stdout.
     */
    start(): Promise<void>;
    /**
     * Process a single line of input and return a JSON-RPC response.
     * This method is public for testing purposes.
     */
    processLine(line: string): Promise<JsonRpcResponse | null>;
    /**
     * Handle a single JSON-RPC request.
     */
    private handleRequest;
    /**
     * Handle initialize method.
     */
    private handleInitialize;
    /**
     * Handle tools/list method.
     */
    private handleToolsList;
    /**
     * Handle tools/call method.
     */
    private handleToolsCall;
}
//# sourceMappingURL=server.d.ts.map