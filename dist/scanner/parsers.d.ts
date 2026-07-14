export interface DetectedStack {
    name: string;
    category: string;
    confidence: number;
    source: string;
}
export declare const FILE_READ_TIMEOUT_MS = 5000;
/** Dependency name → stack metadata mapping. */
export declare const DEP_STACK_MAP: Record<string, {
    stack: string;
    category: string;
}>;
/**
 * Read a file with a timeout. Returns null if file doesn't exist, is unreadable,
 * or exceeds the timeout.
 */
export declare function readFileWithTimeout(filePath: string, timeoutMs?: number): string | null;
/**
 * Read package.json and extract dependency names (dependencies + devDependencies).
 */
export declare function readPackageJson(root: string): string[];
/**
 * Read Cargo.toml and extract dependency names from [dependencies] section.
 * Uses regex — no TOML parser dependency.
 */
export declare function readCargoToml(root: string): string[];
/**
 * Read pyproject.toml and extract dependency names from [project] section.
 * Uses regex — no TOML parser dependency.
 */
export declare function readPyprojectToml(root: string): string[];
/**
 * Read go.mod and extract module names from require block.
 */
export declare function readGoMod(root: string): string[];
/**
 * Read requirements.txt and extract package names.
 */
export declare function readRequirementsTxt(root: string): string[];
/**
 * Map a dependency name to a DetectedStack using DEP_STACK_MAP.
 */
export declare function depToStack(depName: string, source: string): DetectedStack | null;
/**
 * Deduplicate stacks by name, keeping highest confidence.
 */
export declare function deduplicateStacks(stacks: DetectedStack[]): DetectedStack[];
//# sourceMappingURL=parsers.d.ts.map