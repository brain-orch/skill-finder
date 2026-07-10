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
export class MCPServersMarketplace {
    name = "mcpservers";
    static BASE_URL = "https://registry.modelcontextprotocol.io";
    async search(query, options) {
        if (!query)
            return [];
        const limit = options?.limit ?? 20;
        try {
            const url = new URL(`${MCPServersMarketplace.BASE_URL}/v0.1/servers`);
            url.searchParams.set("search", query);
            url.searchParams.set("limit", String(limit));
            url.searchParams.set("version", "latest");
            const response = await fetch(url.toString(), {
                headers: {
                    "User-Agent": "skill-finder/1.0",
                    Accept: "application/json",
                },
                signal: options?.signal,
            });
            if (!response.ok)
                return [];
            const json = (await response.json());
            if (!json.servers || !Array.isArray(json.servers))
                return [];
            let servers = json.servers;
            // Client-side category filtering
            if (options?.category) {
                servers = servers.filter((s) => {
                    const cats = s.categories ?? [];
                    return cats.some((c) => c.toLowerCase() === options.category.toLowerCase());
                });
            }
            const results = servers.map((server) => ({
                id: `mcpservers:${server.name}`,
                name: server.name,
                description: server.description ?? "",
                marketplace: "mcpservers",
                category: server.categories?.[0] ?? "mcp-server",
                triggers: [query],
                installCount: 0,
                stars: 0,
                installCommand: "",
                homepageUrl: server.url ?? "",
                verified: false,
            }));
            return results.slice(0, limit);
        }
        catch (err) {
            console.warn("[skill-finder] mcpservers search failed:", err.message);
            return [];
        }
    }
    async getSkillInfo(identifier) {
        try {
            // Strip "mcpservers:" prefix if present
            const name = identifier.startsWith("mcpservers:")
                ? identifier.slice("mcpservers:".length)
                : identifier;
            const results = await this.search(name, { limit: 5 });
            if (results.length === 0)
                return null;
            // Return the first result whose name matches exactly
            const exact = results.find((r) => r.name === name);
            return exact ?? results[0];
        }
        catch (err) {
            console.warn("[skill-finder] mcpservers getSkillInfo failed:", err.message);
            return null;
        }
    }
    async install(_identifier, _targetDir) {
        throw new Error("MCP Servers cannot be installed as skills. MCP servers are server implementations, not SKILL.md files. Use the search result's homepage to find install instructions.");
    }
    isAvailable() {
        return true;
    }
}
//# sourceMappingURL=mcpservers-adapter.js.map