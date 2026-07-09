import * as fs from "node:fs";
import * as path from "node:path";

export interface ChangeEntry {
  identifier: string;
  fromVersion: string;
  toVersion: string;
  breaking: boolean;
  timestamp: string;
}

interface ChangelogData {
  version: number;
  changes: Record<string, ChangeEntry[]>;
}

export class ChangelogTracker {
  private changelogPath: string;

  constructor(baseDir?: string) {
    const base = baseDir ?? process.cwd();
    this.changelogPath = path.join(base, ".opencode", "skill-finder-changelog.json");
  }

  recordChange(identifier: string, fromVersion: string, toVersion: string, breaking: boolean): void {
    const data = this.readChangelog();
    const entry: ChangeEntry = {
      identifier,
      fromVersion,
      toVersion,
      breaking,
      timestamp: new Date().toISOString(),
    };

    if (!data.changes[identifier]) {
      data.changes[identifier] = [];
    }
    data.changes[identifier].push(entry);
    this.writeChangelog(data);
  }

  getChangelog(identifier: string): ChangeEntry[] {
    const data = this.readChangelog();
    return data.changes[identifier] ?? [];
  }

  hasBreakingChanges(identifier: string): boolean {
    const entries = this.getChangelog(identifier);
    return entries.some((entry) => entry.breaking);
  }

  private readChangelog(): ChangelogData {
    try {
      const raw = fs.readFileSync(this.changelogPath, "utf-8");
      const parsed = JSON.parse(raw) as ChangelogData;
      if (parsed && typeof parsed === "object" && parsed.changes) {
        return parsed;
      }
    } catch {
      // Missing or corrupt — treat as empty
    }
    return { version: 1, changes: {} };
  }

  private writeChangelog(data: ChangelogData): void {
    const dir = path.dirname(this.changelogPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.changelogPath, JSON.stringify(data, null, 2), "utf-8");
  }
}