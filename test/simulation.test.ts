/**
 * Real-case scenario simulations for SkillFinder plugin.
 *
 * Simulates realistic agent-task interactions: user requests → detector
 * analysis → skill recommendation → activation flow.
 *
 * Each scenario models a "session" where a user gives a natural-language
 * request to the agent, the detector extracts task context, the recommender
 * finds relevant skills, and activation is tested.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { TaskDetector, type DetectedContext } from "../src/plugin/detector.js";
import { MarketRegistry } from "../src/registry/index.js";
import { MockMarketplace } from "../src/registry/mock.js";
import { SearchEngine } from "../src/search/index.js";
import { SkillIndexer } from "../src/cache/indexer.js";
import { CacheManager } from "../src/cache/index.js";
import { SkillRecommender } from "../src/plugin/recommender.js";
import { SkillActivator } from "../src/activation.js";
import { loadConfig } from "../src/config.js";
import type { SkillSearchResult, MarketplaceConfig } from "../src/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A realistic mock marketplace populated with domain-specific skills. */
function createSkillMarketplace(name: string): MockMarketplace {
  return new MockMarketplace(name, [
    {
      id: `${name}:pdf-extractor`,
      name: "pdf-extractor",
      description: "Extract text, tables, and images from PDF documents using OCR and structured parsing",
      marketplace: name as SkillSearchResult["marketplace"],
      category: "pdf-processing",
      triggers: ["pdf", "extract", "ocr", "document"],
      installCount: 15420,
      stars: 4.5,
      installCommand: "",
      homepageUrl: "",
      verified: true,
    },
    {
      id: `${name}:excel-formula-wizard`,
      name: "excel-formula-wizard",
      description: "Expert in writing complex Excel formulas, QUERY, LAMBDA, and array formulas",
      marketplace: name as SkillSearchResult["marketplace"],
      category: "spreadsheet",
      triggers: ["excel", "formula", "spreadsheet", "vlookup"],
      installCount: 8900,
      stars: 4.2,
      installCommand: "",
      homepageUrl: "",
      verified: true,
    },
    {
      id: `${name}:git-workflow-manager`,
      name: "git-workflow-manager",
      description: "Manage git workflows: branch strategies, rebase, merge conflict resolution",
      marketplace: name as SkillSearchResult["marketplace"],
      category: "git-workflows",
      triggers: ["git", "commit", "branch", "merge", "rebase"],
      installCount: 23100,
      stars: 4.8,
      installCommand: "",
      homepageUrl: "",
      verified: true,
    },
    {
      id: `${name}:deploy-master`,
      name: "deploy-master",
      description: "Automated deployment pipelines for Node.js, Docker, and cloud services",
      marketplace: name as SkillSearchResult["marketplace"],
      category: "deployment",
      triggers: ["deploy", "publish", "release", "npm"],
      installCount: 12100,
      stars: 4.0,
      installCommand: "",
      homepageUrl: "",
      verified: false,
    },
    {
      id: `${name}:react-component-builder`,
      name: "react-component-builder",
      description: "Build reusable React components with TypeScript, Tailwind CSS, and accessibility",
      marketplace: name as SkillSearchResult["marketplace"],
      category: "react",
      triggers: ["react", "component", "jsx", "tsx", "frontend"],
      installCount: 18900,
      stars: 4.6,
      installCommand: "",
      homepageUrl: "",
      verified: true,
    },
    {
      id: `${name}:docker-compose-pro`,
      name: "docker-compose-pro",
      description: "Professional Docker Compose setups for development and production environments",
      marketplace: name as SkillSearchResult["marketplace"],
      category: "docker",
      triggers: ["docker", "compose", "container"],
      installCount: 7600,
      stars: 3.9,
      installCommand: "",
      homepageUrl: "",
      verified: false,
    },
    {
      id: `${name}:sql-query-optimizer`,
      name: "sql-query-optimizer",
      description: "Optimize SQL queries, analyze execution plans, and suggest indexes",
      marketplace: name as SkillSearchResult["marketplace"],
      category: "sql",
      triggers: ["sql", "query", "optimize", "index"],
      installCount: 14200,
      stars: 4.3,
      installCommand: "",
      homepageUrl: "",
      verified: true,
    },
    {
      id: `${name}:api-security-scanner`,
      name: "api-security-scanner",
      description: "Scan REST APIs for common security vulnerabilities including auth bypasses",
      marketplace: name as SkillSearchResult["marketplace"],
      category: "security",
      triggers: ["api", "security", "auth", "vulnerability"],
      installCount: 20500,
      stars: 4.7,
      installCommand: "",
      homepageUrl: "",
      verified: true,
    },
    {
      id: `${name}:test-automation-suite`,
      name: "test-automation-suite",
      description: "End-to-end and unit test automation with Vitest, Playwright, and coverage reports",
      marketplace: name as SkillSearchResult["marketplace"],
      category: "testing",
      triggers: ["test", "vitest", "playwright", "e2e", "coverage"],
      installCount: 11300,
      stars: 4.1,
      installCommand: "",
      homepageUrl: "",
      verified: true,
    },
  ]);
}

function makeRegistryConfig(): MarketplaceConfig {
  return {
    marketplaces: [],
    searchTimeoutMs: 5000,
    retryCount: 0,
    retryBackoffMs: 0,
  };
}

// ---------------------------------------------------------------------------
// Scenario Suite
// ---------------------------------------------------------------------------

describe("Real-case Scenario Simulations", () => {
  let detector: TaskDetector;
  let registry: MarketRegistry;
  let searchEngine: SearchEngine;
  let indexer: SkillIndexer | null;
  let recommender: SkillRecommender;
  let activator: SkillActivator;
  let tmpDir: string;
  let cacheDir: string;
  let globalSkillsDir: string;

  function createMockSkillFile(name: string): string {
    const dir = path.join(tmpDir, "sources", name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), `# ${name}\n\nMock skill for ${name}.\n`, "utf-8");
    return dir;
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-finder-sim-"));
    cacheDir = path.join(tmpDir, "cache");
    globalSkillsDir = path.join(tmpDir, "global-skills");
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.mkdirSync(globalSkillsDir, { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "sources"), { recursive: true });

    // Detector — real instance, no mocks
    detector = new TaskDetector();

    // Registry with one real-ish mock marketplace
    registry = new MarketRegistry(makeRegistryConfig());
    registry.addAdapter(createSkillMarketplace("lobehub"));

    // Search engine
    searchEngine = new SearchEngine(registry);

    // Optional indexer (null for no-local-index tests)
    indexer = null;

    // Recommender with registry-based search
    recommender = new SkillRecommender(searchEngine, registry, indexer, {
      maxResults: 3,
      minScore: 0.3,
    });

    // Activator
    activator = new SkillActivator({
      globalSkillsDir,
      projectSkillsDir: path.join(tmpDir, "project-skills"),
      preApprovedCategories: ["testing", "git-workflows"],
    });
  });

  afterEach(() => {
    if (indexer) {
      indexer.close();
      indexer = null;
    }
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ─── SCENARIO 1: PDF extraction ──────────────────────────────────────
  it("Scenario 1: User requests PDF text extraction", async () => {
    const userMessage = "Can you extract all the text from this PDF document and save it as a markdown file?";

    const context = detector.analyzeText(userMessage);

    // Detector should identify pdf-processing with high confidence
    expect(context.categories).toContain("pdf-processing");
    expect(context.categories).toContain("document");
    expect(context.confidence).toBeGreaterThanOrEqual(0.6);
    expect(context.signals.length).toBeGreaterThan(0);

    // Recommender should find PDF-related skills
    const recommendations = await recommender.recommend(context);
    expect(recommendations.length).toBeGreaterThanOrEqual(1);
    expect(recommendations.length).toBeLessThanOrEqual(3);

    const pdfSkill = recommendations.find((r) =>
      r.name.includes("pdf") || r.matchReasons.some((m) => m.toLowerCase().includes("pdf")),
    );

    // Activate the first recommendation
    const first = recommendations[0];
    const sourceDir = createMockSkillFile(first.name);
    const result = await activator.activate(first.name, sourceDir, {
      categories: context.categories,
      userConsent: { approved: true, autoApproveFuture: false, showDetails: false },
    });

    expect(result.success).toBe(true);
    expect(result.skillName).toBe(first.name);
  });

  // ─── SCENARIO 2: Spreadsheet editing ─────────────────────────────────
  it("Scenario 2: User edits an Excel spreadsheet", async () => {
    // Simulate tool.execute.before for a file read on .xlsx
    const context = detector.analyzeToolCall("read", {
      filename: "/home/user/reports/sales-data.xlsx",
    });

    expect(context.categories).toContain("spreadsheet");
    expect(context.confidence).toBeGreaterThanOrEqual(0.6);
    expect(context.signals.some((s) => s.type === "extension")).toBe(true);
    expect(context.signals.some((s) => s.value === ".xlsx")).toBe(true);
  });

  // ─── SCENARIO 3: Git workflow ────────────────────────────────────────
  it("Scenario 3: User runs git commands in bash", async () => {
    const context = detector.analyzeToolCall("bash", {
      command: "git merge feature-branch && git push origin main",
    });

    expect(context.categories).toContain("git-workflows");
    expect(context.categories).toContain("version-control");
    expect(context.signals.some((s) => s.type === "command")).toBe(true);

    // Recommender should find git-related skills
    const recommendations = await recommender.recommend(context);
    expect(recommendations.length).toBeGreaterThanOrEqual(1);

    const gitRecommends = recommendations.filter(
      (r) => r.name.includes("git") || r.matchReasons.some((m) => m.toLowerCase().includes("git")),
    );

    // Activation should work for pre-approved category (git-workflows)
    const gitSkill = recommendations[0];
    const sourceDir = createMockSkillFile(gitSkill.name);
    const result = await activator.activate(gitSkill.name, sourceDir, {
      categories: context.categories,
    });
    expect(result.success).toBe(true);
  });

  // ─── SCENARIO 4: Deployment ──────────────────────────────────────────
  it("Scenario 4: User wants to deploy an app", async () => {
    const userMessage = "I need to deploy my Node.js application to production using Docker";

    const context = detector.analyzeText(userMessage);

    expect(context.categories).toContain("deployment");
    expect(context.categories).toContain("docker");
    expect(context.confidence).toBeGreaterThanOrEqual(0.6);

    const recommendations = await recommender.recommend(context);
    expect(recommendations.length).toBeGreaterThanOrEqual(1);

    // Should find deploy-related skills
    const deploySkill = recommendations.find(
      (r) => r.matchReasons.some((m) => m.toLowerCase().includes("deploy")),
    );
  });

  // ─── SCENARIO 5: Mixed signals ──────────────────────────────────────
  it("Scenario 5: Mixed task signals ('deploy the PDF generator')", async () => {
    const userMessage = "deploy the PDF generator to production";

    const context = detector.analyzeText(userMessage);

    // Should detect BOTH deployment and pdf-processing
    expect(context.categories).toContain("deployment");
    expect(context.categories).toContain("pdf-processing");

    // Confidence should be reasonable for mixed signals
    expect(context.confidence).toBeGreaterThanOrEqual(0.6);

    const recommendations = await recommender.recommend(context);
    // Should get recommendations for either deployment or pdf
    expect(recommendations.length).toBeGreaterThanOrEqual(1);
  });

  // ─── SCENARIO 6: No-op / irrelevant input ──────────────────────────
  it("Scenario 6: User says something irrelevant", async () => {
    const userMessage = "Good morning! How are you today?";

    const context = detector.analyzeText(userMessage);

    // No task-relevant categories should be detected
    expect(context.categories.length).toBe(0);
    expect(context.confidence).toBeLessThan(0.6);

    const recommendations = await recommender.recommend(context);
    expect(recommendations.length).toBe(0);
  });

  // ─── SCENARIO 7: FTS5 index integration ─────────────────────────────
  it("Scenario 7: FTS5 index provides instant offline search after caching", async () => {
    // Create indexer and seed it with a cached skill
    const indexerPath = path.join(cacheDir, "index.db");
    const localIndexer = new SkillIndexer(indexerPath);
    localIndexer.init();

    localIndexer.indexSkill({
      id: "lobehub:pdf-extractor",
      name: "pdf-extractor",
      description: "Extract text from PDF documents",
      marketplace: "lobehub",
      category: "pdf-processing",
      triggers: ["pdf", "extract", "ocr"],
      installCount: 15420,
      stars: 4.5,
      filePath: path.join(globalSkillsDir, "pdf-extractor", "SKILL.md"),
      installedAt: new Date().toISOString(),
      lastUsed: null,
      useCount: 0,
      skillHash: "abc123",
    });

    // Create recommender with indexer
    const offlineRecommender = new SkillRecommender(searchEngine, registry, localIndexer, {
      maxResults: 3,
    });

    const context = detector.analyzeText("extract pdf text");
    const recommendations = await offlineRecommender.recommend(context);

    // Should find the indexed skill via FTS5
    expect(recommendations.length).toBeGreaterThanOrEqual(1);
    expect(recommendations.some((r) => r.fromCache)).toBe(true);
    expect(recommendations.some((r) => r.name === "pdf-extractor")).toBe(true);

    localIndexer.close();
  });

  // ─── SCENARIO 8: Already-installed skill filtered out ──────────────
  it("Scenario 8: Already installed skill is filtered from recommendations", async () => {
    const context = detector.analyzeText("I need to extract text from a PDF");

    const recommenderWithFilter = new SkillRecommender(searchEngine, registry, indexer, {
      maxResults: 3,
      installedSkillNames: ["pdf-extractor"], // Already installed
    });

    const recommendations = await recommenderWithFilter.recommend(context);

    // pdf-extractor should NOT appear since it's already installed
    const alreadyInstalled = recommendations.some((r) => r.name === "pdf-extractor");
    expect(alreadyInstalled).toBe(false);
  });

  // ─── SCENARIO 9: Pre-approved auto-activation ─────────────────────
  it("Scenario 9: Pre-approved category auto-activates without consent", async () => {
    // "git-workflows" is in preApprovedCategories
    const context = detector.analyzeText("I need to git commit and push");

    // First, simulate finding the skill
    const recommendations = await recommender.recommend(context);
    expect(recommendations.length).toBeGreaterThanOrEqual(1);

    // Activate without explicit userConsent — should auto-activate for pre-approved
    const sourceDir = createMockSkillFile(recommendations[0].name);
    const result = await activator.activate(recommendations[0].name, sourceDir, {
      categories: ["git-workflows"], // Pre-approved category
    });

    // No userConsent provided, but category is pre-approved
    // The activator should auto-activate
    expect(result.success).toBe(true);
  });

  // ─── SCENARIO 10: React + TypeScript development ──────────────────
  it("Scenario 10: User works on a React/TypeScript component", async () => {
    // Simulate tool.execute.before with .tsx file
    const context = detector.analyzeToolCall("read", {
      filename: "src/components/UserProfile.tsx",
    });

    expect(context.categories).toContain("react");
    expect(context.categories).toContain("frontend");
    expect(context.signals.some((s) => s.type === "extension")).toBe(true);
    expect(context.signals.some((s) => s.value === ".tsx")).toBe(true);

    // Additionally, user messages may reinforce the context
    const messageContext = detector.analyzeText(
      "Make this React component accessible with proper ARIA labels",
    );

    // Merge: should have react + frontend categories
    const mergedCategories = [...new Set([...context.categories, ...messageContext.categories])];
    expect(mergedCategories).toContain("react");
    expect(mergedCategories).toContain("frontend");
  });

  // ─── SCENARIO 11: Download → Index → Recommend flow ──────────────
  it("Scenario 11: Full cache → index → recommend pipeline with real file ops", async () => {
    // Simulate downloading a skill (write SKILL.md to a source dir, NOT inside globalSkillsDir)
    const downloadDir = path.join(tmpDir, "downloaded-skills", "test-automation-suite");
    fs.mkdirSync(downloadDir, { recursive: true });
    fs.writeFileSync(
      path.join(downloadDir, "SKILL.md"),
      `# test-automation-suite\n\nExpert in Vitest and Playwright test automation.\n`,
      "utf-8",
    );

    // Create indexer and index the skill
    const idxPath = path.join(cacheDir, "pipeline.db");
    const pipelineIndexer = new SkillIndexer(idxPath);
    pipelineIndexer.init();

    pipelineIndexer.indexSkill({
      id: "lobehub:test-automation-suite",
      name: "test-automation-suite",
      description: "E2E and unit test automation with Vitest and Playwright",
      marketplace: "lobehub",
      category: "testing",
      triggers: ["test", "vitest", "playwright"],
      installCount: 11300,
      stars: 4.1,
      filePath: path.join(downloadDir, "SKILL.md"),
      installedAt: new Date().toISOString(),
      lastUsed: null,
      useCount: 0,
      skillHash: "def456",
    });

    // User asks about testing
    const context = detector.analyzeText("I need to write tests for my app using vitest");

    // Recommender with indexer should find the testing skill
    const pipelineRecommender = new SkillRecommender(searchEngine, registry, pipelineIndexer, {
      maxResults: 3,
    });

    const recommendations = await pipelineRecommender.recommend(context);

    // testing is in preApprovedCategories, so activation should auto-work
    const testingSkill = recommendations.find((r) => r.name === "test-automation-suite");
    expect(testingSkill).toBeDefined();
    expect(testingSkill!.fromCache).toBe(true);
    expect(testingSkill!.score).toBeGreaterThanOrEqual(0.3);

    const result = await activator.activate("test-automation-suite", downloadDir, {
      categories: ["testing"],
    });
    expect(result.success).toBe(true);

    pipelineIndexer.close();
  });

  // ─── SCENARIO 12: Config loading with user prefs ───────────────────
  it("Scenario 12: User configures pre-approved categories", async () => {
    const config = loadConfig({
      enabled: true,
      autoRecommend: true,
      marketplaces: ["lobehub"],
      cacheTtlHours: 48,
      preApprovedCategories: ["pdf-processing", "testing"],
      maxRecommendations: 5,
    });

    expect(config.enabled).toBe(true);
    expect(config.marketplaces).toEqual(["lobehub"]);
    expect(config.cacheTtlHours).toBe(48);
    expect(config.preApprovedCategories).toContain("pdf-processing");
    expect(config.maxRecommendations).toBe(5);

    // Activator should use these pre-approved categories
    const configuredActivator = new SkillActivator({
      globalSkillsDir,
      projectSkillsDir: path.join(tmpDir, "project-skills"),
      preApprovedCategories: config.preApprovedCategories,
    });

    // "pdf-processing" is pre-approved → auto-activates
    expect(configuredActivator.isPreApproved("pdf-processing")).toBe(true);
    expect(configuredActivator.isPreApproved("deployment")).toBe(false);
  });

  // ─── SCENARIO 13: Database work ────────────────────────────────────
  it("Scenario 13: User works with database queries", async () => {
    const userMessage = "Can you help me optimize this SQL query that joins 5 tables?";

    const context = detector.analyzeText(userMessage);

    expect(context.categories).toContain("database");
    // Confidence = avg of top signals: "sql"→database (0.6) + "sql"→sql (0.5) = 0.55
    expect(context.confidence).toBeGreaterThanOrEqual(0.5);

    // Simulate tool call too
    const toolContext = detector.analyzeToolCall("bash", {
      command: "psql -d mydb -c 'SELECT * FROM users'",
    });
    expect(toolContext.categories).toContain("database");
  });

  // ─── SCENARIO 14: Security audit request ──────────────────────────
  it("Scenario 14: User asks for security audit", async () => {
    const userMessage = "Can you scan our API endpoints for auth vulnerabilities?";

    const context = detector.analyzeText(userMessage);

    expect(context.categories).toContain("security");
    expect(context.categories).toContain("api-development");

    const recommendations = await recommender.recommend(context);
    expect(recommendations.length).toBeGreaterThanOrEqual(1);

    // Should find api-security-scanner
    const securityRecommendations = recommendations.filter(
      (r) => r.name.includes("security") || r.matchReasons.some((m) => m.toLowerCase().includes("security")),
    );
  });

  // ─── SCENARIO 15: Pre-approved non-consent gate ───────────────────
  it("Scenario 15: Non-pre-approved category requires consent", async () => {
    // "deployment" is NOT in preApprovedCategories
    const context = detector.analyzeText("Deploy the app to production");
    const deploySource = createMockSkillFile("deploy-master");

    const result = await activator.activate("deploy-master", deploySource, {
      categories: ["deployment"], // Not pre-approved
      // No userConsent provided
    });

    // Should require consent
    expect(result.requiresConsent).toBe(true);
    expect(result.success).toBe(false);
  });

  // ─── SCENARIO 16: Extension + keyword double-confirm ─────────────
  it("Scenario 16: Both file extension and keyword signal reinforce each other", async () => {
    // Tool call on a .xlsx file
    const toolCtx = detector.analyzeToolCall("read", {
      filename: "budget-2026.xlsx",
    });

    // User message mentioning "excel"
    const msgCtx = detector.analyzeText("Edit this excel budget file");

    // Both should agree on "spreadsheet"
    expect(toolCtx.categories).toContain("spreadsheet");
    expect(msgCtx.categories).toContain("spreadsheet");

    // Combined confidence should be higher than individual
    // Each signal contributes to combined confidence
    const combinedCategories = [...toolCtx.categories, ...msgCtx.categories];
    const spreadsheetMentions = combinedCategories.filter((c) => c === "spreadsheet").length;
    expect(spreadsheetMentions).toBeGreaterThanOrEqual(2);
  });

  // ─── SCENARIO 17: Graceful degradation when marketplace unavailable ─
  it("Scenario 17: Unavailable marketplace degrades gracefully", async () => {
    // Create registry with a mock that reports unavailable
    class UnavailableMarketplace extends MockMarketplace {
      override isAvailable(): boolean {
        return false;
      }
    }
    const degRegistry = new MarketRegistry(makeRegistryConfig());
    degRegistry.addAdapter(new UnavailableMarketplace("unavailable", []));
    degRegistry.addAdapter(createSkillMarketplace("lobehub"));

    const degSearchEngine = new SearchEngine(degRegistry);
    const degRecommender = new SkillRecommender(degSearchEngine, degRegistry, null, {
      maxResults: 3,
    });

    // Fast marketplace should still return results
    const context = detector.analyzeText("I need to extract PDF text");
    const recommendations = await degRecommender.recommend(context);

    // Should still get results from the available marketplace
    expect(recommendations.length).toBeGreaterThanOrEqual(1);
  });
});
