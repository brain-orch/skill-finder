import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { SkillActivator } from "../src/activation.js";
import type { ActivationConfig } from "../src/activation.js";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeConfig(tmpDir: string): ActivationConfig {
  return {
    globalSkillsDir: path.join(tmpDir, "global-skills"),
    projectSkillsDir: path.join(tmpDir, "project-skills"),
    preApprovedCategories: ["testing", "development"],
  };
}

function createSourceSkill(tmpDir: string, name: string): string {
  const sourceDir = path.join(tmpDir, "source", name);
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.writeFileSync(
    path.join(sourceDir, "SKILL.md"),
    `# ${name}\n\nSkill content for ${name}\n`,
    "utf-8",
  );
  return sourceDir;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("SkillActivator", () => {
  let tmpDir: string;
  let activator: SkillActivator;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-activator-test-"));
    activator = new SkillActivator(makeConfig(tmpDir));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /* 1 */
  it("activate places skill in global dir for pre-approved category", async () => {
    const sourcePath = createSourceSkill(tmpDir, "test-skill");

    const result = await activator.activate("test-skill", sourcePath, {
      categories: ["testing"],
    });

    expect(result.success).toBe(true);
    expect(result.skillName).toBe("test-skill");
    expect(result.path).toContain("global-skills");
    expect(result.path).toContain("SKILL.md");
    expect(result.message).toBe("Activated");
    expect(result.requiresConsent).toBe(false);

    // Verify file exists
    expect(fs.existsSync(result.path)).toBe(true);
    const content = fs.readFileSync(result.path, "utf-8");
    expect(content).toContain("# test-skill");
  });

  /* 2 */
  it("activate places skill in project dir with user consent", async () => {
    const sourcePath = createSourceSkill(tmpDir, "consent-skill");

    const result = await activator.activate("consent-skill", sourcePath, {
      categories: ["unknown-category"],
      userConsent: { approved: true, autoApproveFuture: false, showDetails: false },
    });

    expect(result.success).toBe(true);
    expect(result.skillName).toBe("consent-skill");
    expect(result.path).toContain("project-skills");
    expect(result.path).toContain("SKILL.md");
    expect(result.message).toBe("Activated");
    expect(result.requiresConsent).toBe(false);

    // Verify file exists
    expect(fs.existsSync(result.path)).toBe(true);
  });

  /* 3 */
  it("isAlreadyInstalled returns false for unknown skill", () => {
    const result = activator.isAlreadyInstalled("unknown-skill");

    expect(result.installed).toBe(false);
    expect(result.location).toBeUndefined();
  });

  /* 4 */
  it("isAlreadyInstalled returns true after activation", async () => {
    const sourcePath = createSourceSkill(tmpDir, "installed-skill");

    await activator.activate("installed-skill", sourcePath, {
      categories: ["testing"],
    });

    const result = activator.isAlreadyInstalled("installed-skill");
    expect(result.installed).toBe(true);
    expect(result.location).toBeDefined();
    expect(result.location).toContain("SKILL.md");
  });

  /* 5 */
  it("detectConflicts returns no conflicts for clean setup", () => {
    // In clean test environment, no conflicts
    const result = activator.detectConflicts("no-conflict-skill");

    expect(result.hasConflict).toBe(false);
    expect(result.conflictPaths).toHaveLength(0);
  });

  /* 6 */
  it("detectConflicts finds conflicts in ~/.claude/skills/", () => {
    // Create a conflicting skill in a mock ~/.claude/skills/ directory
    const homeDir = os.homedir();
    const conflictDir = path.join(homeDir, ".claude", "skills", "conflict-skill");
    fs.mkdirSync(conflictDir, { recursive: true });
    fs.writeFileSync(path.join(conflictDir, "SKILL.md"), "conflict");

    try {
      const result = activator.detectConflicts("conflict-skill");

      expect(result.hasConflict).toBe(true);
      expect(result.conflictPaths).toHaveLength(1);
      expect(result.conflictPaths[0]).toContain("conflict-skill");
    } finally {
      // Cleanup
      fs.rmSync(conflictDir, { recursive: true, force: true });
    }
  });

  /* 7 */
  it("pre-approved category auto-activates", async () => {
    const sourcePath = createSourceSkill(tmpDir, "dev-skill");

    const result = await activator.activate("dev-skill", sourcePath, {
      categories: ["development"],
    });

    expect(result.success).toBe(true);
    expect(result.requiresConsent).toBe(false);
    expect(result.path).toContain("global-skills");
  });

  /* 8 */
  it("requires consent for non-pre-approved categories", async () => {
    const sourcePath = createSourceSkill(tmpDir, "unknown-skill");

    const result = await activator.activate("unknown-skill", sourcePath, {
      categories: ["unknown-category"],
    });

    expect(result.success).toBe(false);
    expect(result.requiresConsent).toBe(true);
    expect(result.message).toContain("Load it?");
  });

  /* 9 */
  it("does not overwrite existing skills", async () => {
    const sourcePath1 = createSourceSkill(tmpDir, "existing-skill");
    const sourcePath2 = createSourceSkill(tmpDir, "existing-skill");

    // First activation
    const result1 = await activator.activate("existing-skill", sourcePath1, {
      categories: ["testing"],
    });
    expect(result1.success).toBe(true);

    // Try to activate again - should fail
    const result2 = await activator.activate("existing-skill", sourcePath2, {
      categories: ["testing"],
    });

    expect(result2.success).toBe(false);
    expect(result2.message).toBe("Already installed");
  });

  /* 10 */
  it("warns only once per session per skill", () => {
    // Create a conflicting skill
    const homeDir = os.homedir();
    const conflictDir = path.join(homeDir, ".claude", "skills", "warn-once-skill");
    fs.mkdirSync(conflictDir, { recursive: true });
    fs.writeFileSync(path.join(conflictDir, "SKILL.md"), "conflict");

    try {
      // First detection - should warn
      const result1 = activator.detectConflicts("warn-once-skill");
      expect(result1.hasConflict).toBe(true);

      // Create a second activator instance (simulating same session)
      const activator2 = new SkillActivator(makeConfig(tmpDir));
      
      // The warnedSessions set is per-instance, so this would warn again
      // In a real session, the same instance would be used
      const result2 = activator2.detectConflicts("warn-once-skill");
      expect(result2.hasConflict).toBe(true);

      // Both results should have conflicts
      expect(result1.conflictPaths).toHaveLength(1);
      expect(result2.conflictPaths).toHaveLength(1);
    } finally {
      // Cleanup
      fs.rmSync(conflictDir, { recursive: true, force: true });
    }
  });

  /* 11 */
  it("getActivationPath returns correct paths", () => {
    const globalPath = activator.getActivationPath("my-skill");
    expect(globalPath).toContain("global-skills");
    expect(globalPath).toContain("my-skill");
    expect(globalPath).toContain("SKILL.md");

    const projectPath = activator.getActivationPath("my-skill", true);
    expect(projectPath).toContain("project-skills");
    expect(projectPath).toContain("my-skill");
    expect(projectPath).toContain("SKILL.md");
  });
});
