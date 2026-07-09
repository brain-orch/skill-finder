import { describe, it, expect, vi, beforeEach } from "vitest";
import { MCPServer } from "../../src/mcp/server.js";

// Mock the registry instance to avoid real network calls
vi.mock("../../src/registry/instance.js", () => ({
  marketplaceRegistry: {
    searchAll: vi.fn(),
    getMarketplace: vi.fn(),
    listAvailable: vi.fn(() => ["lobehub", "skillssh", "agentskillsh"]),
  },
}));

import { marketplaceRegistry } from "../../src/registry/instance.js";

describe("MCP Server", () => {
  let server: MCPServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new MCPServer();
  });

  describe("tools/list", () => {
    it("returns array of 4 tool definitions", async () => {
      const response = await server.processLine(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }));

      expect(response).not.toBeNull();
      expect(response!.result).toBeDefined();
      expect((response!.result as any).tools).toHaveLength(4);

      const toolNames = (response!.result as any).tools.map((t: any) => t.name);
      expect(toolNames).toContain("search_skills");
      expect(toolNames).toContain("recommend_skills");
      expect(toolNames).toContain("skill_info");
      expect(toolNames).toContain("install_skill");
    });
  });

  describe("initialize", () => {
    it("returns server info and capabilities", async () => {
      const response = await server.processLine(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }));

      expect(response).not.toBeNull();
      expect(response!.result).toBeDefined();
      expect((response!.result as any).serverInfo.name).toBe("skill-finder");
      expect((response!.result as any).capabilities.tools).toBeDefined();
    });
  });

  describe("tools/call", () => {
    it("calls search_skills with valid query", async () => {
      vi.mocked(marketplaceRegistry.searchAll).mockResolvedValue([
        {
          id: "lobehub:pdf-tools",
          name: "pdf-tools",
          description: "PDF processing toolkit",
          marketplace: "lobehub",
          category: "pdf",
          triggers: ["pdf"],
          installCount: 500,
          stars: 4.5,
          installCommand: "npx install pdf-tools",
          homepageUrl: "https://lobehub.com/skills/pdf-tools",
          verified: true,
        },
      ]);

      const response = await server.processLine(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "search_skills",
          arguments: { query: "pdf" },
        },
      }));

      expect(response).not.toBeNull();
      expect(response!.result).toBeDefined();
      expect((response!.result as any).content[0].text).toContain("Search Results");
      expect((response!.result as any).content[0].text).toContain("pdf-tools");
    });

    it("returns error for unknown tool name", async () => {
      const response = await server.processLine(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "unknown_tool",
          arguments: {},
        },
      }));

      expect(response).not.toBeNull();
      expect(response!.error).toBeDefined();
      expect(response!.error!.code).toBe(-32601);
    });

    it("returns error for missing required params", async () => {
      const response = await server.processLine(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "search_skills",
          arguments: {},
        },
      }));

      expect(response).not.toBeNull();
      // Should return error in result.content, not JSON-RPC error
      expect(response!.result).toBeDefined();
      expect((response!.result as any).content[0].text).toContain("Error");
      expect((response!.result as any).isError).toBe(true);
    });
  });

  describe("error handling", () => {
    it("returns parse error for invalid JSON", async () => {
      const response = await server.processLine("invalid json {{{");

      expect(response).not.toBeNull();
      expect(response!.error).toBeDefined();
      expect(response!.error!.code).toBe(-32700);
    });

    it("returns method not found for unknown method", async () => {
      const response = await server.processLine(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "unknown/method",
      }));

      expect(response).not.toBeNull();
      expect(response!.error).toBeDefined();
      expect(response!.error!.code).toBe(-32601);
    });

    it("returns invalid request for bad jsonrpc version", async () => {
      const response = await server.processLine(JSON.stringify({
        jsonrpc: "1.0",
        id: 1,
        method: "initialize",
      }));

      expect(response).not.toBeNull();
      expect(response!.error).toBeDefined();
      expect(response!.error!.code).toBe(-32600);
    });
  });

  describe("notifications/initialized", () => {
    it("does not respond to notifications", async () => {
      const response = await server.processLine(JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }));

      expect(response).toBeNull();
    });
  });

  describe("tool definitions", () => {
    it("search_skills has correct schema", async () => {
      const response = await server.processLine(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }));

      const tools = (response!.result as any).tools;
      const searchTool = tools.find((t: any) => t.name === "search_skills");

      expect(searchTool).toBeDefined();
      expect(searchTool.description).toBe("Search for skills across all marketplaces");
      expect(searchTool.inputSchema.required).toContain("query");
      expect(searchTool.inputSchema.properties.query.type).toBe("string");
      expect(searchTool.inputSchema.properties.category.type).toBe("string");
      expect(searchTool.inputSchema.properties.limit.type).toBe("number");
    });

    it("recommend_skills has correct schema", async () => {
      const response = await server.processLine(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }));

      const tools = (response!.result as any).tools;
      const recommendTool = tools.find((t: any) => t.name === "recommend_skills");

      expect(recommendTool).toBeDefined();
      expect(recommendTool.description).toBe("Get skill recommendations based on context");
      expect(recommendTool.inputSchema.required).toContain("context");
      expect(recommendTool.inputSchema.properties.context.type).toBe("string");
    });

    it("skill_info has correct schema", async () => {
      const response = await server.processLine(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }));

      const tools = (response!.result as any).tools;
      const infoTool = tools.find((t: any) => t.name === "skill_info");

      expect(infoTool).toBeDefined();
      expect(infoTool.description).toBe("Get detailed information about a specific skill");
      expect(infoTool.inputSchema.required).toContain("identifier");
      expect(infoTool.inputSchema.properties.identifier.type).toBe("string");
    });

    it("install_skill has correct schema", async () => {
      const response = await server.processLine(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }));

      const tools = (response!.result as any).tools;
      const installTool = tools.find((t: any) => t.name === "install_skill");

      expect(installTool).toBeDefined();
      expect(installTool.description).toBe("Install a skill from a marketplace");
      expect(installTool.inputSchema.required).toContain("identifier");
      expect(installTool.inputSchema.required).toContain("marketplace");
      expect(installTool.inputSchema.properties.identifier.type).toBe("string");
      expect(installTool.inputSchema.properties.marketplace.type).toBe("string");
      expect(installTool.inputSchema.properties.target.type).toBe("string");
    });
  });
});
