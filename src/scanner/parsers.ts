import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DetectedStack {
  name: string;       // e.g., "react", "next.js", "prisma"
  category: string;   // e.g., "frontend", "database"
  confidence: number; // 0.0-1.0
  source: string;     // which file: "package.json", "Cargo.toml"
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const FILE_READ_TIMEOUT_MS = 5000;

/** Dependency name → stack metadata mapping. */
export const DEP_STACK_MAP: Record<string, { stack: string; category: string }> = {
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
// File readers
// ---------------------------------------------------------------------------

/**
 * Read a file with a timeout. Returns null if file doesn't exist, is unreadable,
 * or exceeds the timeout.
 */
export function readFileWithTimeout(
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
export function readPackageJson(root: string): string[] {
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
export function readCargoToml(root: string): string[] {
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
export function readPyprojectToml(root: string): string[] {
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
export function readGoMod(root: string): string[] {
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
export function readRequirementsTxt(root: string): string[] {
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
// Stack resolution
// ---------------------------------------------------------------------------

/**
 * Map a dependency name to a DetectedStack using DEP_STACK_MAP.
 */
export function depToStack(depName: string, source: string): DetectedStack | null {
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
export function deduplicateStacks(stacks: DetectedStack[]): DetectedStack[] {
  const bestByName = new Map<string, DetectedStack>();
  for (const stack of stacks) {
    const existing = bestByName.get(stack.name);
    if (!existing || stack.confidence > existing.confidence) {
      bestByName.set(stack.name, stack);
    }
  }
  return Array.from(bestByName.values());
}
