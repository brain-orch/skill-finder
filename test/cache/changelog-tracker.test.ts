import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { ChangelogTracker } from "../../src/cache/changelog-tracker.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "changelog-tracker-test-"));
}

describe("ChangelogTracker", () => {
  let tmpDir: string;
  let tracker: ChangelogTracker;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    tracker = new ChangelogTracker(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("recordChange creates changelog file with entry", () => {
    tracker.recordChange("lobehub:test-skill", "1.0.0", "1.1.0", false);

    const changelogPath = path.join(tmpDir, ".opencode", "skill-finder-changelog.json");
    expect(fs.existsSync(changelogPath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(changelogPath, "utf-8"));
    expect(data.version).toBe(1);
    expect(data.changes["lobehub:test-skill"]).toHaveLength(1);
    expect(data.changes["lobehub:test-skill"][0].fromVersion).toBe("1.0.0");
    expect(data.changes["lobehub:test-skill"][0].toVersion).toBe("1.1.0");
    expect(data.changes["lobehub:test-skill"][0].breaking).toBe(false);
    expect(data.changes["lobehub:test-skill"][0].timestamp).toBeTruthy();
  });

  it("getChangelog returns empty array for unknown skill", () => {
    const changelog = tracker.getChangelog("unknown:missing");
    expect(changelog).toEqual([]);
  });

  it("getChangelog returns all changes for known skill", () => {
    tracker.recordChange("lobehub:test-skill", "1.0.0", "1.1.0", false);
    tracker.recordChange("lobehub:test-skill", "1.1.0", "2.0.0", true);

    const changelog = tracker.getChangelog("lobehub:test-skill");
    expect(changelog).toHaveLength(2);
    expect(changelog[0].fromVersion).toBe("1.0.0");
    expect(changelog[1].fromVersion).toBe("1.1.0");
    expect(changelog[1].breaking).toBe(true);
  });

  it("hasBreakingChanges returns true when breaking change exists", () => {
    tracker.recordChange("lobehub:test-skill", "1.0.0", "2.0.0", true);
    expect(tracker.hasBreakingChanges("lobehub:test-skill")).toBe(true);
  });

  it("hasBreakingChanges returns false when no breaking changes", () => {
    tracker.recordChange("lobehub:test-skill", "1.0.0", "1.1.0", false);
    expect(tracker.hasBreakingChanges("lobehub:test-skill")).toBe(false);
  });

  it("hasBreakingChanges returns false for unknown skill", () => {
    expect(tracker.hasBreakingChanges("unknown:missing")).toBe(false);
  });

  it("handles corrupted changelog file gracefully", () => {
    const changelogPath = path.join(tmpDir, ".opencode", "skill-finder-changelog.json");
    fs.mkdirSync(path.dirname(changelogPath), { recursive: true });
    fs.writeFileSync(changelogPath, "NOT VALID JSON {{{", "utf-8");

    const changelog = tracker.getChangelog("unknown:missing");
    expect(changelog).toEqual([]);
  });

  it("handles missing changelog file gracefully", () => {
    const changelog = tracker.getChangelog("unknown:missing");
    expect(changelog).toEqual([]);
  });

  it("recordChange appends multiple entries for same skill", () => {
    tracker.recordChange("lobehub:test-skill", "1.0.0", "1.1.0", false);
    tracker.recordChange("lobehub:test-skill", "1.1.0", "1.2.0", false);
    tracker.recordChange("lobehub:test-skill", "1.2.0", "1.3.0", false);

    const changelog = tracker.getChangelog("lobehub:test-skill");
    expect(changelog).toHaveLength(3);
    expect(changelog[0].toVersion).toBe("1.1.0");
    expect(changelog[1].toVersion).toBe("1.2.0");
    expect(changelog[2].toVersion).toBe("1.3.0");
  });
});