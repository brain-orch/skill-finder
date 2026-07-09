import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { SkillLockManager } from "../../src/cache/skill-lock.js";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "skill-lock-test-"));
}

function createSkillFile(tmpDir: string, marketplace: string, name: string, content: string): string {
  const skillDir = path.join(tmpDir, ".opencode", "skills", marketplace, name);
  fs.mkdirSync(skillDir, { recursive: true });
  const skillFile = path.join(skillDir, "SKILL.md");
  fs.writeFileSync(skillFile, content, "utf-8");
  return skillFile;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("SkillLockManager", () => {
  let tmpDir: string;
  let manager: SkillLockManager;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    manager = new SkillLockManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("lockSkill creates lockfile with correct structure", () => {
    const content = "name: 'test-skill'\ndescription: 'A test skill'";
    manager.lockSkill("lobehub:test-skill", content, {
      installedAt: "2026-07-08T10:00:00Z",
      version: "1.0.0",
      marketplace: "lobehub",
    });

    const lockfilePath = path.join(tmpDir, ".opencode", "skill-finder-lock.json");
    expect(fs.existsSync(lockfilePath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(lockfilePath, "utf-8"));
    expect(data.version).toBe(1);
    expect(data.skills["lobehub:test-skill"]).toBeDefined();
    expect(data.skills["lobehub:test-skill"].identifier).toBe("lobehub:test-skill");
    expect(data.skills["lobehub:test-skill"].installedAt).toBe("2026-07-08T10:00:00Z");
    expect(data.skills["lobehub:test-skill"].version).toBe("1.0.0");
    expect(data.skills["lobehub:test-skill"].marketplace).toBe("lobehub");
    expect(data.skills["lobehub:test-skill"].contentHash).toMatch(/^sha256-[a-f0-9]{64}$/);
  });

  it("computeHash produces correct SHA-256", () => {
    const content = "hello world";
    const expected = `sha256-${crypto.createHash("sha256").update(content, "utf-8").digest("hex")}`;
    expect(SkillLockManager.computeHash(content)).toBe(expected);
  });

  it("checkForUpdates returns hasUpdate false when content unchanged", async () => {
    const content = "name: 'test-skill'\ndescription: 'A test skill'";
    manager.lockSkill("lobehub:test-skill", content, {
      installedAt: "2026-07-08T10:00:00Z",
      marketplace: "lobehub",
    });

    const result = await manager.checkForUpdates("lobehub:test-skill", content);

    expect(result.hasUpdate).toBe(false);
    expect(result.identifier).toBe("lobehub:test-skill");
    expect(result.newHash).toBeUndefined();
    expect(result.currentHash).toMatch(/^sha256-[a-f0-9]{64}$/);
  });

  it("checkForUpdates returns hasUpdate true when content differs", async () => {
    const original = "name: 'test-skill'\ndescription: 'Version 1'";
    manager.lockSkill("lobehub:test-skill", original, {
      installedAt: "2026-07-08T10:00:00Z",
      marketplace: "lobehub",
    });

    const updated = "name: 'test-skill'\ndescription: 'Version 2'";
    const result = await manager.checkForUpdates("lobehub:test-skill", updated);

    expect(result.hasUpdate).toBe(true);
    expect(result.newHash).toBeDefined();
    expect(result.newHash).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(result.newHash).not.toBe(result.currentHash);
  });

  it("unlockSkill removes skill from lockfile", () => {
    manager.lockSkill("lobehub:test-skill", "content", {
      installedAt: "2026-07-08T10:00:00Z",
      marketplace: "lobehub",
    });
    expect(manager.getLockedSkills()).toHaveLength(1);

    manager.unlockSkill("lobehub:test-skill");
    expect(manager.getLockedSkills()).toHaveLength(0);
  });

  it("handles corrupted lockfile gracefully", () => {
    const lockfilePath = path.join(tmpDir, ".opencode", "skill-finder-lock.json");
    fs.mkdirSync(path.dirname(lockfilePath), { recursive: true });
    fs.writeFileSync(lockfilePath, "NOT VALID JSON {{{", "utf-8");

    const skills = manager.getLockedSkills();
    expect(skills).toHaveLength(0);
  });

  it("handles missing lockfile gracefully", () => {
    const skills = manager.getLockedSkills();
    expect(skills).toHaveLength(0);
  });

  it("getStaleSkills returns skills older than threshold", async () => {
    manager.lockSkill("lobehub:fresh", "content-a", {
      installedAt: "2026-07-08T10:00:00Z",
      marketplace: "lobehub",
    });
    manager.lockSkill("lobehub:stale", "content-b", {
      installedAt: "2026-06-01T10:00:00Z",
      marketplace: "lobehub",
    });

    // Simulate stale by manually backdating lastChecked in lockfile
    const lockfilePath = path.join(tmpDir, ".opencode", "skill-finder-lock.json");
    const data = JSON.parse(fs.readFileSync(lockfilePath, "utf-8"));
    data.skills["lobehub:stale"].lastChecked = "2026-06-01T10:00:00Z";
    fs.writeFileSync(lockfilePath, JSON.stringify(data, null, 2), "utf-8");

    const stale = manager.getStaleSkills(7);
    expect(stale).toHaveLength(1);
    expect(stale[0].identifier).toBe("lobehub:stale");
  });

  it("getStaleSkills returns empty when all skills are fresh", async () => {
    manager.lockSkill("lobehub:fresh", "content", {
      installedAt: "2026-07-08T10:00:00Z",
      marketplace: "lobehub",
    });

    const stale = manager.getStaleSkills(7);
    expect(stale).toHaveLength(0);
  });

  it("rebuild creates lockfile from filesystem", () => {
    createSkillFile(tmpDir, "lobehub", "pdf-tools", "name: 'pdf-tools'\ndescription: 'PDF tools'");
    createSkillFile(tmpDir, "skillssh", "json-fmt", "name: 'json-fmt'\ndescription: 'JSON formatter'");

    manager.rebuild();

    const skills = manager.getLockedSkills();
    expect(skills).toHaveLength(2);

    const identifiers = skills.map((s) => s.identifier).sort();
    expect(identifiers).toEqual(["lobehub:pdf-tools", "skillssh:json-fmt"]);

    for (const skill of skills) {
      expect(skill.contentHash).toMatch(/^sha256-[a-f0-9]{64}$/);
      expect(skill.marketplace).toBeTruthy();
      expect(skill.lastChecked).toBeTruthy();
    }
  });

  it("rebuild produces empty lockfile when skills dir is empty", () => {
    manager.rebuild();

    const skills = manager.getLockedSkills();
    expect(skills).toHaveLength(0);
  });

  it("lockSkill updates existing entry", () => {
    manager.lockSkill("lobehub:test", "v1", {
      installedAt: "2026-07-08T10:00:00Z",
      marketplace: "lobehub",
      version: "1.0.0",
    });

    manager.lockSkill("lobehub:test", "v2", {
      installedAt: "2026-07-08T12:00:00Z",
      marketplace: "lobehub",
      version: "2.0.0",
    });

    const skills = manager.getLockedSkills();
    expect(skills).toHaveLength(1);
    expect(skills[0].version).toBe("2.0.0");
    expect(skills[0].installedAt).toBe("2026-07-08T12:00:00Z");
  });

  it("checkForUpdates on unknown skill returns hasUpdate false", async () => {
    const result = await manager.checkForUpdates("unknown:missing", "content");
    expect(result.hasUpdate).toBe(false);
    expect(result.currentHash).toBe("");
  });

  it("lockSkill stores version and versionRange", () => {
    manager.lockSkill("lobehub:test-skill", "content", {
      installedAt: "2026-07-08T10:00:00Z",
      version: "1.2.3",
      versionRange: "^1.0.0",
      changelog: "https://example.com/changelog",
      breaking: false,
      dependencies: ["lobehub:dep-skill"],
      marketplace: "lobehub",
    });

    const skills = manager.getLockedSkills();
    expect(skills).toHaveLength(1);
    expect(skills[0].version).toBe("1.2.3");
    expect(skills[0].versionRange).toBe("^1.0.0");
    expect(skills[0].changelog).toBe("https://example.com/changelog");
    expect(skills[0].breaking).toBe(false);
    expect(skills[0].dependencies).toEqual(["lobehub:dep-skill"]);
  });

  it("readLockfile reads old format without new fields gracefully", () => {
    const lockfilePath = path.join(tmpDir, ".opencode", "skill-finder-lock.json");
    fs.mkdirSync(path.dirname(lockfilePath), { recursive: true });
    
    const oldData = {
      version: 1,
      skills: {
        "lobehub:old-skill": {
          identifier: "lobehub:old-skill",
          installedAt: "2026-07-08T10:00:00Z",
          contentHash: "sha256-abc123",
          version: "1.0.0",
          marketplace: "lobehub",
          lastChecked: "2026-07-08T10:00:00Z",
          targets: [".opencode/skills"],
        },
      },
    };
    fs.writeFileSync(lockfilePath, JSON.stringify(oldData, null, 2), "utf-8");

    const skills = manager.getLockedSkills();
    expect(skills).toHaveLength(1);
    expect(skills[0].identifier).toBe("lobehub:old-skill");
    expect(skills[0].versionRange).toBeUndefined();
    expect(skills[0].changelog).toBeUndefined();
    expect(skills[0].breaking).toBeUndefined();
    expect(skills[0].dependencies).toBeUndefined();
  });

  it("getDependencies returns empty array for unknown skill", () => {
    const deps = manager.getDependencies("unknown:missing");
    expect(deps).toEqual([]);
  });

  it("getDependencies returns dependencies for known skill", () => {
    manager.lockSkill("lobehub:test-skill", "content", {
      installedAt: "2026-07-08T10:00:00Z",
      dependencies: ["lobehub:dep1", "skillssh:dep2"],
      marketplace: "lobehub",
    });

    const deps = manager.getDependencies("lobehub:test-skill");
    expect(deps).toEqual(["lobehub:dep1", "skillssh:dep2"]);
  });

  it("getSkillVersion returns null for unknown skill", () => {
    const version = manager.getSkillVersion("unknown:missing");
    expect(version).toBeNull();
  });

  it("getSkillVersion returns version for known skill", () => {
    manager.lockSkill("lobehub:test-skill", "content", {
      installedAt: "2026-07-08T10:00:00Z",
      version: "2.0.0",
      marketplace: "lobehub",
    });

    const version = manager.getSkillVersion("lobehub:test-skill");
    expect(version).toBe("2.0.0");
  });

  it("lockSkill defaults version to 0.0.0 when not provided", () => {
    manager.lockSkill("lobehub:test-skill", "content", {
      installedAt: "2026-07-08T10:00:00Z",
      marketplace: "lobehub",
    });

    const skills = manager.getLockedSkills();
    expect(skills[0].version).toBe("0.0.0");
  });

  it("lockSkill updates existing skill with new version fields", () => {
    manager.lockSkill("lobehub:test-skill", "v1", {
      installedAt: "2026-07-08T10:00:00Z",
      marketplace: "lobehub",
    });

    manager.lockSkill("lobehub:test-skill", "v2", {
      installedAt: "2026-07-08T12:00:00Z",
      version: "2.0.0",
      versionRange: ">=2.0.0",
      breaking: true,
      dependencies: ["lobehub:new-dep"],
      marketplace: "lobehub",
    });

    const skills = manager.getLockedSkills();
    expect(skills).toHaveLength(1);
    expect(skills[0].version).toBe("2.0.0");
    expect(skills[0].versionRange).toBe(">=2.0.0");
    expect(skills[0].breaking).toBe(true);
    expect(skills[0].dependencies).toEqual(["lobehub:new-dep"]);
  });

  it("removeSkill via unlockSkill clears version fields", () => {
    manager.lockSkill("lobehub:test-skill", "content", {
      installedAt: "2026-07-08T10:00:00Z",
      version: "1.0.0",
      versionRange: "^1.0.0",
      dependencies: ["lobehub:dep"],
      marketplace: "lobehub",
    });

    expect(manager.getLockedSkills()).toHaveLength(1);

    manager.unlockSkill("lobehub:test-skill");
    expect(manager.getLockedSkills()).toHaveLength(0);
    expect(manager.getSkillVersion("lobehub:test-skill")).toBeNull();
    expect(manager.getDependencies("lobehub:test-skill")).toEqual([]);
  });
});
