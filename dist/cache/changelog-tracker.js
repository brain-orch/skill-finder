import * as fs from "node:fs";
import * as path from "node:path";
export class ChangelogTracker {
    changelogPath;
    constructor(baseDir) {
        const base = baseDir ?? process.cwd();
        this.changelogPath = path.join(base, ".opencode", "skill-finder-changelog.json");
    }
    recordChange(identifier, fromVersion, toVersion, breaking) {
        const data = this.readChangelog();
        const entry = {
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
    getChangelog(identifier) {
        const data = this.readChangelog();
        return data.changes[identifier] ?? [];
    }
    hasBreakingChanges(identifier) {
        const entries = this.getChangelog(identifier);
        return entries.some((entry) => entry.breaking);
    }
    readChangelog() {
        try {
            const raw = fs.readFileSync(this.changelogPath, "utf-8");
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && parsed.changes) {
                return parsed;
            }
        }
        catch (err) {
            console.warn("[skill-finder] changelog read failed, treating as empty:", err instanceof Error ? err.message : String(err));
        }
        return { version: 1, changes: {} };
    }
    writeChangelog(data) {
        const dir = path.dirname(this.changelogPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.changelogPath, JSON.stringify(data, null, 2), "utf-8");
    }
}
//# sourceMappingURL=changelog-tracker.js.map