import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { SkillLockManager } from "../../src/cache/skill-lock.js";
import { ChangelogTracker } from "../../src/cache/changelog-tracker.js";
import { loadConfig } from "../../src/config.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "smart-update-test-"));
}

describe("Smart Update System", () => {
  let tmpDir: string;
  let lockManager: SkillLockManager;
  let changelogTracker: ChangelogTracker;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    lockManager = new SkillLockManager(tmpDir);
    changelogTracker = new ChangelogTracker(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("checkAll returns empty array when no skills locked", async () => {
    const results = await lockManager.checkAll();
    expect(results).toEqual([]);
  });

  it("checkAll returns results for locked skills", async () => {
    lockManager.lockSkill("lobehub:test-skill", "content-v1", {
      installedAt: "2026-07-08T10:00:00Z",
      version: "1.0.0",
      marketplace: "lobehub",
    });

    const results = await lockManager.checkAll();
    expect(results).toHaveLength(1);
    expect(results[0].identifier).toBe("lobehub:test-skill");
    expect(results[0].hasUpdate).toBe(false);
  });

  it("checkAll flags breaking changes correctly", async () => {
    lockManager.lockSkill("lobehub:test-skill", "content-v1", {
      installedAt: "2026-07-08T10:00:00Z",
      version: "1.0.0",
      breaking: true,
      marketplace: "lobehub",
    });

    const results = await lockManager.checkAll();
    expect(results).toHaveLength(1);
    expect(results[0].breaking).toBe(true);
  });

  it("loadConfig handles updateCheck configuration", () => {
    const config = loadConfig({
      updateCheck: {
        enabled: false,
        intervalHours: 48,
      },
    });

    expect(config.updateCheck).toEqual({
      enabled: false,
      intervalHours: 48,
    });
  });

  it("loadConfig uses default updateCheck when not provided", () => {
    const config = loadConfig({});
    expect(config.updateCheck).toEqual({
      enabled: true,
      intervalHours: 24,
    });
  });

  it("ChangelogTracker records breaking changes for checkAll integration", () => {
    lockManager.lockSkill("lobehub:test-skill", "content-v1", {
      installedAt: "2026-07-08T10:00:00Z",
      version: "1.0.0",
      marketplace: "lobehub",
    });

    changelogTracker.recordChange("lobehub:test-skill", "1.0.0", "2.0.0", true);

    expect(changelogTracker.hasBreakingChanges("lobehub:test-skill")).toBe(true);
    const changelog = changelogTracker.getChangelog("lobehub:test-skill");
    expect(changelog).toHaveLength(1);
    expect(changelog[0].breaking).toBe(true);
  });
});