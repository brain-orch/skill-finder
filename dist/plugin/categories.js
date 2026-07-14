/**
 * Category definitions, mapping tables, and shared types for task context detection.
 *
 * Extracted from detector.ts for maintainability.
 * These are pure data — no detection logic.
 */
// ---------------------------------------------------------------------------
// Stop words
// ---------------------------------------------------------------------------
/** Common English stop-words filtered during text analysis. */
export const STOP_WORDS = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "here", "there", "when", "where", "why", "how", "all", "each",
    "every", "both", "few", "more", "most", "other", "some", "such", "no",
    "nor", "not", "only", "own", "same", "so", "than", "too", "very",
    "just", "because", "but", "and", "or", "if", "while", "that", "this",
    "it", "its", "i", "me", "my", "we", "our", "you", "your", "he", "him",
    "his", "she", "her", "they", "them", "their", "what", "which", "who",
    "whom", "these", "those", "about", "up", "also", "like", "get", "got",
    "make", "let", "please", "want", "need", "try", "use", "using",
]);
export const KEYWORD_MAP = [
    // pdf / document
    { keywords: ["pdf", "extract text", "ocr", "document"], category: "pdf-processing", confidence: 0.9 },
    { keywords: ["pdf", "document"], category: "document", confidence: 0.8 },
    // spreadsheet
    { keywords: ["excel", "spreadsheet", "csv", "sheet", "tsv"], category: "spreadsheet", confidence: 0.9 },
    { keywords: ["excel", "spreadsheet", "csv"], category: "data-analysis", confidence: 0.8 },
    // git
    { keywords: ["git", "commit", "push", "pull", "merge", "rebase"], category: "git-workflows", confidence: 0.6 },
    { keywords: ["git", "commit", "push"], category: "version-control", confidence: 0.5 },
    // deployment
    { keywords: ["deploy", "publish", "release", "npm publish", "docker push"], category: "deployment", confidence: 0.65 },
    { keywords: ["deploy", "publish", "release"], category: "devops", confidence: 0.5 },
    // testing
    { keywords: ["test", "testing", "unit test", "e2e", "vitest", "jest"], category: "testing", confidence: 0.6 },
    { keywords: ["test", "testing"], category: "quality", confidence: 0.5 },
    // docker
    { keywords: ["docker", "container", "dockerfile", "docker-compose"], category: "docker", confidence: 0.6 },
    { keywords: ["docker", "container"], category: "containerization", confidence: 0.5 },
    // database
    { keywords: ["sql", "database", "query", "postgres", "mysql", "sqlite"], category: "database", confidence: 0.6 },
    { keywords: ["sql", "database", "query"], category: "sql", confidence: 0.5 },
    // frontend / react
    { keywords: ["react", "component", "frontend", "ui", "jsx", "tsx"], category: "frontend", confidence: 0.6 },
    { keywords: ["react", "component", "jsx", "tsx"], category: "react", confidence: 0.6 },
    // api
    { keywords: ["api", "rest", "endpoint", "route"], category: "api-development", confidence: 0.6 },
    { keywords: ["api", "rest", "endpoint"], category: "backend", confidence: 0.5 },
    // security
    { keywords: ["security", "auth", "login", "password"], category: "security", confidence: 0.6 },
    { keywords: ["security", "auth", "login"], category: "authentication", confidence: 0.5 },
    // programming (generic — lower confidence)
    { keywords: ["code", "coding", "programming", "function", "class"], category: "programming", confidence: 0.4 },
    // typescript
    { keywords: ["typescript", "ts", "type"], category: "typescript", confidence: 0.7 },
    // python
    { keywords: ["python", "py", "django", "flask"], category: "python", confidence: 0.7 },
    // debugging
    { keywords: ["debug", "debugging", "bug", "error"], category: "debugging", confidence: 0.7 },
    // documentation
    { keywords: ["markdown", "md", "docs", "documentation"], category: "documentation", confidence: 0.7 },
    // config
    { keywords: ["config", "configuration", "env", "dotenv"], category: "config", confidence: 0.6 },
    // mobile
    { keywords: ["mobile", "ios", "android", "react-native"], category: "mobile", confidence: 0.6 },
    // performance
    { keywords: ["performance", "optimize", "optimization", "slow"], category: "performance", confidence: 0.6 },
    // regex
    { keywords: ["regex", "regexp", "pattern"], category: "programming", confidence: 0.5 },
];
export const EXTENSION_MAP = [
    { extensions: [".pdf", ".doc", ".docx"], category: "pdf-processing", confidence: 0.9 },
    { extensions: [".txt"], category: "pdf-processing", confidence: 0.5 },
    { extensions: [".xlsx", ".xls", ".csv", ".tsv"], category: "spreadsheet", confidence: 0.9 },
    { extensions: [".js", ".ts", ".tsx", ".jsx", ".py", ".rs", ".go"], category: "programming", confidence: 0.7 },
    { extensions: [".sql", ".db", ".sqlite"], category: "database", confidence: 0.9 },
    { extensions: [".json", ".yaml", ".yml", ".toml"], category: "config", confidence: 0.6 },
    { extensions: [".md", ".rst", ".txt"], category: "documentation", confidence: 0.5 },
    // React-specific
    { extensions: [".tsx", ".jsx"], category: "react", confidence: 0.7 },
    { extensions: [".tsx", ".jsx"], category: "frontend", confidence: 0.7 },
];
export const COMMAND_MAP = [
    { commands: ["npm", "yarn", "pnpm", "bun"], category: "javascript", confidence: 0.7 },
    { commands: ["npm", "yarn", "pnpm"], category: "deployment", confidence: 0.5 },
    { commands: ["pip", "pip3", "uv"], category: "python", confidence: 0.7 },
    { commands: ["cargo", "rustc"], category: "rust", confidence: 0.7 },
    { commands: ["docker", "docker-compose"], category: "docker", confidence: 0.7 },
    { commands: ["docker", "docker-compose"], category: "containerization", confidence: 0.6 },
    { commands: ["psql", "sqlite3", "mysql"], category: "database", confidence: 0.8 },
    { commands: ["git"], category: "git-workflows", confidence: 0.7 },
    { commands: ["git"], category: "version-control", confidence: 0.6 },
    { commands: ["pytest", "jest", "vitest", "mocha"], category: "testing", confidence: 0.7 },
    { commands: ["tsc", "eslint", "biome", "ruff"], category: "programming", confidence: 0.6 },
];
//# sourceMappingURL=categories.js.map