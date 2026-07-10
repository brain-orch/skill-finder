import * as fs from "node:fs";
import * as path from "node:path";
import type { SkillSearchResult } from "../types.js";
import { marketplaceRegistry } from "../registry/instance.js";
import { SkillPlanComposer, type SkillPlan } from "../composer/skill-plan.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DetectedStack {
  name: string;       // e.g., "react", "next.js", "prisma"
  category: string;   // e.g., "frontend", "database"
  confidence: number; // 0.0-1.0
  source: string;     // which file: "package.json", "Cargo.toml"
}

export interface ScanResult {
  detectedStacks: DetectedStack[];
  skillRecommendations: SkillSearchResult[];
  composedPlans?: SkillPlan[];
  scannedAt: number;
  projectRoot: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILE_READ_TIMEOUT_MS = 5000;

/** Dependency name → stack metadata mapping. */
const DEP_STACK_MAP: Record<string, { stack: string; category: string }> = {
  // Frontend
  "react": { stack: "react", category: "frontend" },
  "next": { stack: "next.js", category: "frontend" },
  "vue": { stack: "vue", category: "frontend" },
  "nuxt": { stack: "nuxt", category: "frontend" },
  "svelte": { stack: "svelte", category: "frontend" },
  "angular": { stack: "angular", category: "frontend" },
  // Backend
  "express": { stack: "express", category: "backend" },
  "fastify": { stack: "fastify", category: "backend" },
  "hono": { stack: "hono", category: "backend" },
  "django": { stack: "django", category: "backend" },
  "flask": { stack: "flask", category: "backend" },
  "fastapi": { stack: "fastapi", category: "backend" },
  "actix-web": { stack: "actix", category: "backend" },
  "axum": { stack: "axum", category: "backend" },
  // Database
  "prisma": { stack: "prisma", category: "database" },
  "drizzle-orm": { stack: "drizzle", category: "database" },
  "typeorm": { stack: "typeorm", category: "database" },
  "sequelize": { stack: "sequelize", category: "database" },
  "sqlx": { stack: "sqlx", category: "database" },
  "diesel": { stack: "diesel", category: "database" },
  // Testing
  "jest": { stack: "jest", category: "testing" },
  "vitest": { stack: "vitest", category: "testing" },
  "playwright": { stack: "playwright", category: "testing" },
  "pytest": { stack: "pytest", category: "testing" },
  "mocha": { stack: "mocha", category: "testing" },
  // Infrastructure
  "docker": { stack: "docker", category: "docker" },
  "docker-compose": { stack: "docker-compose", category: "containerization" },
  "kubernetes": { stack: "kubernetes", category: "devops" },
  "terraform": { stack: "terraform", category: "devops" },
  // Languages
  "typescript": { stack: "typescript", category: "typescript" },
  "python": { stack: "python", category: "python" },
  "rust": { stack: "rust", category: "rust" },
  "go": { stack: "go", category: "go" },
  // Mobile
  "react-native": { stack: "react-native", category: "mobile" },
  "flutter": { stack: "flutter", category: "mobile" },
  // Other
  "tailwindcss": { stack: "tailwind", category: "frontend" },
  "shadcn": { stack: "shadcn-ui", category: "frontend" },
};

// ---------------------------------------------------------------------------
// File readers (private)
// ---------------------------------------------------------------------------

/**
 * Read a file with a timeout. Returns null if file doesn't exist, is unreadable,
 * or exceeds the timeout.
 */
function readFileWithTimeout(
  filePath: string,
  timeoutMs: number = FILE_READ_TIMEOUT_MS,
): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return content;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    console.warn(
      "[skill-finder] file read failed:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Read package.json and extract dependency names (dependencies + devDependencies).
 */
function readPackageJson(root: string): string[] {
  const filePath = path.join(root, "package.json");
  const content = readFileWithTimeout(filePath);
  if (!content) return [];

  try {
    const pkg = JSON.parse(content) as Record<string, unknown>;
    const deps = (pkg.dependencies ?? {}) as Record<string, unknown>;
    const devDeps = (pkg.devDependencies ?? {}) as Record<string, unknown>;
    return [...Object.keys(deps), ...Object.keys(devDeps)];
  } catch (err) {
    console.warn(
      "[skill-finder] package.json parse failed:",
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}

/**
 * Read Cargo.toml and extract dependency names from [dependencies] section.
 * Uses regex — no TOML parser dependency.
 */
function readCargoToml(root: string): string[] {
  const filePath = path.join(root, "Cargo.toml");
  const content = readFileWithTimeout(filePath);
  if (!content) return [];

  // Find [dependencies] section (or [dependencies.xxx] subsections)
  const depsSection = content.match(/\[dependencies\]([\s\S]*?)(?:\[|$)/);
  if (!depsSection) return [];

  const section = depsSection[1];
  // Match dependency names: `name = "..."` or `name = { ... }`
  const depNames = section.match(/^([a-z][a-z0-9_-]*)\s*=/gm) ?? [];
  return depNames.map((line) => {
    const match = line.match(/^([a-z][a-z0-9_-]*)\s*=/);
    return match?.[1] ?? "";
  }).filter((name) => name.length > 0);
}

/**
 * Read pyproject.toml and extract dependency names from [project] section.
 * Uses regex — no TOML parser dependency.
 */
function readPyprojectToml(root: string): string[] {
  const filePath = path.join(root, "pyproject.toml");
  const content = readFileWithTimeout(filePath);
  if (!content) return [];

  const projectSection = content.match(/\[project\]([\s\S]*?)(?:\n\[|$)/);
  if (!projectSection) return [];

  const section = projectSection[1];
  const depsMatch = section.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
  if (!depsMatch) return [];

  const deps = depsMatch[1];
  const packageNames = deps.match(/"([a-zA-Z][a-zA-Z0-9_-]*)/g) ?? [];
  return packageNames.map((p) => p.replace(/^"/, ""));
}

/**
 * Read go.mod and extract module names from require block.
 */
function readGoMod(root: string): string[] {
  const filePath = path.join(root, "go.mod");
  const content = readFileWithTimeout(filePath);
  if (!content) return [];

  // Find require block
  const requireBlock = content.match(/require\s*\(([\s\S]*?)\)/);
  if (!requireBlock) return [];

  const block = requireBlock[1];
  // Match module paths: `github.com/foo/bar v1.0.0`
  const modules = block.match(/^\s+([\w.-]+(?:\/[\w.-]+)*)\s+v/gm) ?? [];
  return modules.map((line) => {
    const match = line.trim().match(/^([\w.-]+(?:\/[\w.-]+)*)\s+/);
    return match?.[1] ?? "";
  }).filter((name) => name.length > 0);
}

/**
 * Read requirements.txt and extract package names.
 */
function readRequirementsTxt(root: string): string[] {
  const filePath = path.join(root, "requirements.txt");
  const content = readFileWithTimeout(filePath);
  if (!content) return [];

  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith("-"))
    .map((line) => {
      // Extract package name: "requests>=2.0" → "requests"
      const match = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*)/);
      return match?.[1] ?? "";
    })
    .filter((name) => name.length > 0);
}

// ---------------------------------------------------------------------------
// Stack resolution (private)
// ---------------------------------------------------------------------------

/**
 * Map a dependency name to a DetectedStack using DEP_STACK_MAP.
 */
function depToStack(depName: string, source: string): DetectedStack | null {
  const mapping = DEP_STACK_MAP[depName];
  if (!mapping) return null;

  return {
    name: mapping.stack,
    category: mapping.category,
    confidence: 0.9, // High confidence — explicit dependency
    source,
  };
}

/**
 * Deduplicate stacks by name, keeping highest confidence.
 */
function deduplicateStacks(stacks: DetectedStack[]): DetectedStack[] {
  const bestByName = new Map<string, DetectedStack>();
  for (const stack of stacks) {
    const existing = bestByName.get(stack.name);
    if (!existing || stack.confidence > existing.confidence) {
      bestByName.set(stack.name, stack);
    }
  }
  return Array.from(bestByName.values());
}

// ---------------------------------------------------------------------------
// ProjectScanner
// ---------------------------------------------------------------------------

export class ProjectScanner {
  private lastScanResult: ScanResult | null = null;
  private planComposer: SkillPlanComposer;

  constructor() {
    this.planComposer = new SkillPlanComposer();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Scan a project root: detect tech stacks and search for relevant skills.
   */
  async scan(projectRoot: string): Promise<ScanResult> {
    const detectedStacks = this.detectStacks(projectRoot);
    const skillRecommendations = await this.searchSkills(detectedStacks);

    const result: ScanResult = {
      detectedStacks,
      skillRecommendations,
      scannedAt: Date.now(),
      projectRoot,
    };

    // Auto-compose plans if stacks detected (fire-and-forget)
    if (detectedStacks.length > 0) {
      try {
        const stackNames = detectedStacks.map((s) => s.name);
        result.composedPlans = this.planComposer.composePlan(stackNames);
      } catch (err) {
        console.warn(
          "[skill-finder] plan composition failed:",
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    this.lastScanResult = result;
    return result;
  }

  /**
   * Detect tech stacks by reading config files synchronously.
   */
  detectStacks(projectRoot: string): DetectedStack[] {
    const stacks: DetectedStack[] = [];

    // package.json
    const npmDeps = readPackageJson(projectRoot);
    for (const dep of npmDeps) {
      const stack = depToStack(dep, "package.json");
      if (stack) stacks.push(stack);
    }

    // Cargo.toml
    const cargoDeps = readCargoToml(projectRoot);
    for (const dep of cargoDeps) {
      const stack = depToStack(dep, "Cargo.toml");
      if (stack) stacks.push(stack);
    }

    // pyproject.toml
    const pyprojectDeps = readPyprojectToml(projectRoot);
    for (const dep of pyprojectDeps) {
      const stack = depToStack(dep, "pyproject.toml");
      if (stack) stacks.push(stack);
    }

  // go.mod
  const goModPath = path.join(projectRoot, "go.mod");
  if (fs.existsSync(goModPath)) {
    stacks.push({
      name: "go",
      category: "go",
      confidence: 0.95,
      source: "go.mod",
    });
  }
  const goDeps = readGoMod(projectRoot);
  for (const dep of goDeps) {
    const stack = depToStack(dep, "go.mod");
    if (stack) stacks.push(stack);
  }

    // requirements.txt
    const reqDeps = readRequirementsTxt(projectRoot);
    for (const dep of reqDeps) {
      const stack = depToStack(dep, "requirements.txt");
      if (stack) stacks.push(stack);
    }

    return deduplicateStacks(stacks);
  }

  /**
   * Search skill marketplaces for each detected stack.
   */
  async searchSkills(stacks: DetectedStack[]): Promise<SkillSearchResult[]> {
    if (stacks.length === 0) return [];

    const results: SkillSearchResult[] = [];
    const seenIds = new Set<string>();

    for (const stack of stacks) {
      try {
        const searchResults = await marketplaceRegistry.searchAll(stack.name, {
          limit: 3,
        });
        for (const result of searchResults) {
          if (!seenIds.has(result.id)) {
            seenIds.add(result.id);
            results.push(result);
          }
        }
      } catch (err) {
        console.warn(
          "[skill-finder] stack search failed, continuing with other stacks:",
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    return results;
  }

  /**
   * Return the last scan result, or null if no scan has been performed.
   */
  getProjectContext(): ScanResult | null {
    return this.lastScanResult;
  }
}
