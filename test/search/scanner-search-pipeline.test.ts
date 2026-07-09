import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchTool, setScanResult } from "../../src/tools/search.js";
import type { ScanResult } from "../../src/scanner/project-scanner.js";

// Mock the marketplace registry
vi.mock("../../src/registry/instance.js", () => {
  const mockResults: Record<string, Array<{ id: string; name: string; description: string; marketplace: string; category: string | null; triggers: string[]; installCount: number; stars: number; installCommand: string; homepageUrl: string; verified: boolean }>> = {
    "react": [
      {
        id: "lobehub:react-tools",
        name: "react-tools",
        description: "React development utilities",
        marketplace: "lobehub",
        category: "frontend",
        triggers: ["react", "component"],
        installCount: 100,
        stars: 4.0,
        installCommand: "skill install lobehub:react-tools",
        homepageUrl: "https://example.com/react-tools",
        verified: true,
      },
    ],
    "prisma": [
      {
        id: "lobehub:prisma-helper",
        name: "prisma-helper",
        description: "Prisma ORM helper",
        marketplace: "lobehub",
        category: "database",
        triggers: ["prisma", "orm"],
        installCount: 50,
        stars: 3.5,
        installCommand: "skill install lobehub:prisma-helper",
        homepageUrl: "https://example.com/prisma-helper",
        verified: false,
      },
    ],
    "database": [
      {
        id: "lobehub:db-tools",
        name: "db-tools",
        description: "Database management tools",
        marketplace: "lobehub",
        category: "database",
        triggers: ["database", "sql"],
        installCount: 200,
        stars: 4.2,
        installCommand: "skill install lobehub:db-tools",
        homepageUrl: "https://example.com/db-tools",
        verified: true,
      },
    ],
  };

  return {
    marketplaceRegistry: {
      searchAll: vi.fn(async (query: string) => {
        return mockResults[query] ?? [];
      }),
    },
  };
});

describe("Scanner→Search Pipeline", () => {
  beforeEach(() => {
    setScanResult(null);
  });

  it("includes detected stack names as expanded queries", async () => {
    const scanResult: ScanResult = {
      detectedStacks: [
        { name: "react", category: "frontend", confidence: 0.9, source: "package.json" },
        { name: "prisma", category: "database", confidence: 0.9, source: "package.json" },
      ],
      skillRecommendations: [],
      scannedAt: Date.now(),
      projectRoot: "/test",
    };
    setScanResult(scanResult);

    const ctx = { abort: new AbortController().signal };
    const result = await searchTool.execute(
      { query: "database", limit: 10 },
      ctx as never,
    );

    // Should contain results from original query AND stack-expanded queries
    expect(result).toContain("db-tools");
    expect(result).toContain("prisma-helper");
    expect(result).toContain("Search Results for");
  });

  it("falls back to original query only when no scan result", async () => {
    setScanResult(null);

    const ctx = { abort: new AbortController().signal };
    const result = await searchTool.execute(
      { query: "database", limit: 10 },
      ctx as never,
    );

    expect(result).toContain("db-tools");
    // Should NOT contain prisma results since no scan was performed
    expect(result).not.toContain("prisma-helper");
  });

  it("handles empty detected stacks gracefully", async () => {
    const scanResult: ScanResult = {
      detectedStacks: [],
      skillRecommendations: [],
      scannedAt: Date.now(),
      projectRoot: "/test",
    };
    setScanResult(scanResult);

    const ctx = { abort: new AbortController().signal };
    const result = await searchTool.execute(
      { query: "database", limit: 10 },
      ctx as never,
    );

    expect(result).toContain("db-tools");
  });

  it("deduplicates results from overlapping queries", async () => {
    const scanResult: ScanResult = {
      detectedStacks: [
        { name: "database", category: "database", confidence: 0.9, source: "package.json" },
      ],
      skillRecommendations: [],
      scannedAt: Date.now(),
      projectRoot: "/test",
    };
    setScanResult(scanResult);

    const ctx = { abort: new AbortController().signal };
    const result = await searchTool.execute(
      { query: "database", limit: 10 },
      ctx as never,
    );

    // db-tools result line should appear only once (deduplication)
    const resultLines = result.split("\n").filter((l) => l.startsWith("- **db-tools**"));
    expect(resultLines.length).toBe(1);
  });
});
