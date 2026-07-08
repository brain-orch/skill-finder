import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

vi.mock("../../src/registry/instance.js", () => ({
  marketplaceRegistry: {
    searchAll: vi.fn().mockResolvedValue([]),
  },
}));

import { ProjectScanner } from "../../src/scanner/project-scanner.js";

describe("ProjectScanner", () => {
  let scanner: ProjectScanner;
  let tmpDir: string;

  beforeEach(() => {
    scanner = new ProjectScanner();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("scan", () => {
    it("detects react, express, prisma from package.json", async () => {
      const pkg = {
        dependencies: {
          react: "^19.0.0",
          express: "^4.18.0",
          prisma: "^5.0.0",
        },
        devDependencies: {
          vitest: "^1.0.0",
        },
      };
      fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify(pkg));

      const result = await scanner.scan(tmpDir);

      expect(result.detectedStacks.length).toBeGreaterThanOrEqual(3);
      expect(result.detectedStacks.map((s) => s.name)).toContain("react");
      expect(result.detectedStacks.map((s) => s.name)).toContain("express");
      expect(result.detectedStacks.map((s) => s.name)).toContain("prisma");
      expect(result.detectedStacks.map((s) => s.name)).toContain("vitest");
      expect(result.projectRoot).toBe(tmpDir);
      expect(result.scannedAt).toBeGreaterThan(0);
    });

    it("returns empty detectedStacks for empty project", async () => {
      const result = await scanner.scan(tmpDir);

      expect(result.detectedStacks).toEqual([]);
      expect(result.skillRecommendations).toEqual([]);
    });

    it("handles corrupted package.json gracefully", async () => {
      fs.writeFileSync(path.join(tmpDir, "package.json"), "{ invalid json");

      const result = await scanner.scan(tmpDir);

      expect(result.detectedStacks).toEqual([]);
    });

    it("detects stacks from Cargo.toml", async () => {
      const cargoToml = `
[package]
name = "my-app"
version = "0.1.0"

[dependencies]
actix-web = "4"
serde = { version = "1", features = ["derive"] }
tokio = { version = "1", features = ["full"] }
`;
      fs.writeFileSync(path.join(tmpDir, "Cargo.toml"), cargoToml);

      const result = await scanner.scan(tmpDir);

      expect(result.detectedStacks.map((s) => s.name)).toContain("actix");
      expect(result.detectedStacks.find((s) => s.name === "actix")?.source).toBe("Cargo.toml");
    });

    it("detects stacks from pyproject.toml", async () => {
      const pyprojectToml = `
[project]
name = "my-app"
version = "0.1.0"
dependencies = [
    "django>=4.2",
    "requests>=2.28",
    "pytest>=7.0"
]
`;
      fs.writeFileSync(path.join(tmpDir, "pyproject.toml"), pyprojectToml);

      const result = await scanner.scan(tmpDir);

      expect(result.detectedStacks.map((s) => s.name)).toContain("django");
      expect(result.detectedStacks.map((s) => s.name)).toContain("pytest");
    });

    it("detects stacks from go.mod", async () => {
      const goMod = `
module github.com/example/myapp

go 1.21

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/stretchr/testify v1.8.4
)
`;
      fs.writeFileSync(path.join(tmpDir, "go.mod"), goMod);

      const result = await scanner.scan(tmpDir);

      expect(result.detectedStacks.map((s) => s.name)).toContain("go");
    });

    it("detects stacks from requirements.txt", async () => {
      const requirementsTxt = `
flask>=2.3
requests>=2.28
pytest>=7.0
`;
      fs.writeFileSync(path.join(tmpDir, "requirements.txt"), requirementsTxt);

      const result = await scanner.scan(tmpDir);

      expect(result.detectedStacks.map((s) => s.name)).toContain("flask");
      expect(result.detectedStacks.map((s) => s.name)).toContain("pytest");
    });

    it("deduplicates stacks by name", async () => {
      const pkg = {
        dependencies: {
          react: "^19.0.0",
        },
      };
      fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify(pkg));

      const result = await scanner.scan(tmpDir);

      const reactStacks = result.detectedStacks.filter((s) => s.name === "react");
      expect(reactStacks).toHaveLength(1);
    });
  });

  describe("detectStacks", () => {
    it("reads dependencies from package.json", () => {
      const pkg = {
        dependencies: { next: "^14.0.0" },
        devDependencies: { typescript: "^5.0.0" },
      };
      fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify(pkg));

      const stacks = scanner.detectStacks(tmpDir);

      expect(stacks.map((s) => s.name)).toContain("next.js");
      expect(stacks.map((s) => s.name)).toContain("typescript");
    });

    it("returns empty array when no config files exist", () => {
      const stacks = scanner.detectStacks(tmpDir);

      expect(stacks).toEqual([]);
    });

    it("skips corrupted files without throwing", () => {
      fs.writeFileSync(path.join(tmpDir, "package.json"), "not json at all");
      fs.writeFileSync(path.join(tmpDir, "Cargo.toml"), "[incomplete");

      const stacks = scanner.detectStacks(tmpDir);

      expect(stacks).toEqual([]);
    });

    it("returns correct source field for each stack", () => {
      const pkg = { dependencies: { vue: "^3.0.0" } };
      fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify(pkg));

      const stacks = scanner.detectStacks(tmpDir);

      expect(stacks[0].source).toBe("package.json");
    });
  });

  describe("getProjectContext", () => {
    it("returns null before any scan", () => {
      expect(scanner.getProjectContext()).toBeNull();
    });

    it("returns last scan result after scan", async () => {
      const pkg = { dependencies: { react: "^19.0.0" } };
      fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify(pkg));

      await scanner.scan(tmpDir);
      const context = scanner.getProjectContext();

      expect(context).not.toBeNull();
      expect(context!.projectRoot).toBe(tmpDir);
      expect(context!.detectedStacks.map((s) => s.name)).toContain("react");
    });

    it("updates after subsequent scans", async () => {
      const pkg1 = { dependencies: { react: "^19.0.0" } };
      fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify(pkg1));
      await scanner.scan(tmpDir);

      const pkg2 = { dependencies: { django: "^4.2.0" } };
      fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify(pkg2));
      await scanner.scan(tmpDir);

      const context = scanner.getProjectContext();
      expect(context!.detectedStacks.map((s) => s.name)).toContain("django");
      expect(context!.detectedStacks.map((s) => s.name)).not.toContain("react");
    });
  });

  describe("edge cases", () => {
    it("handles package.json with empty dependencies", async () => {
      const pkg = { dependencies: {}, devDependencies: {} };
      fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify(pkg));

      const result = await scanner.scan(tmpDir);

      expect(result.detectedStacks).toEqual([]);
    });

    it("handles Cargo.toml with no dependencies section", async () => {
      const cargoToml = `
[package]
name = "my-app"
version = "0.1.0"
`;
      fs.writeFileSync(path.join(tmpDir, "Cargo.toml"), cargoToml);

      const result = await scanner.scan(tmpDir);

      expect(result.detectedStacks).toEqual([]);
    });

    it("handles requirements.txt with comments and empty lines", async () => {
      const requirementsTxt = `
# This is a comment
flask>=2.3

# Another comment
requests>=2.28
`;
      fs.writeFileSync(path.join(tmpDir, "requirements.txt"), requirementsTxt);

      const result = await scanner.scan(tmpDir);

      expect(result.detectedStacks.map((s) => s.name)).toContain("flask");
    });

    it("detects go language from go.mod presence", async () => {
      const goMod = `
module github.com/example/myapp

go 1.21
`;
      fs.writeFileSync(path.join(tmpDir, "go.mod"), goMod);

      const result = await scanner.scan(tmpDir);

      expect(result.detectedStacks.map((s) => s.name)).toContain("go");
    });

    it("skips unknown dependencies without error", async () => {
      const pkg = {
        dependencies: {
          "unknown-package": "^1.0.0",
          "another-unknown": "^2.0.0",
        },
      };
      fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify(pkg));

      const result = await scanner.scan(tmpDir);

      expect(result.detectedStacks).toEqual([]);
    });

    it("detects frontend category for react", async () => {
      const pkg = { dependencies: { react: "^19.0.0" } };
      fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify(pkg));

      const stacks = scanner.detectStacks(tmpDir);

      expect(stacks[0].category).toBe("frontend");
      expect(stacks[0].confidence).toBe(0.9);
    });
  });
});
