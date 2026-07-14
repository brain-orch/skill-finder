export interface JsonRpcRequest {
    jsonrpc: "2.0";
    id: string | number | null;
    method: string;
    params?: Record<string, unknown>;
}
export interface JsonRpcResponse {
    jsonrpc: "2.0";
    id: string | number | null;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}
export declare const PARSE_ERROR = -32700;
export declare const INVALID_REQUEST = -32600;
export declare const METHOD_NOT_FOUND = -32601;
export declare const INVALID_PARAMS = -32602;
export declare const INTERNAL_ERROR = -32603;
export declare const MCP_TOOLS: ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
            category: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            context?: undefined;
            identifier?: undefined;
            marketplace?: undefined;
            target?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query?: undefined;
            category?: undefined;
            limit?: undefined;
            context: {
                type: string;
                description: string;
            };
            identifier?: undefined;
            marketplace?: undefined;
            target?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query?: undefined;
            category?: undefined;
            limit?: undefined;
            context?: undefined;
            identifier: {
                type: string;
                description: string;
            };
            marketplace?: undefined;
            target?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query?: undefined;
            category?: undefined;
            limit?: undefined;
            context?: undefined;
            identifier: {
                type: string;
                description: string;
            };
            marketplace: {
                type: string;
                description: string;
            };
            target: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
})[];
//# sourceMappingURL=constants.d.ts.map