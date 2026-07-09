import { z } from "zod";
import { tool } from "@opencode-ai/plugin";
import { SkillLockManager } from "../cache/skill-lock.js";
import { ChangelogTracker } from "../cache/changelog-tracker.js";
import { marketplaceRegistry } from "../registry/instance.js";
const checkUpdatesArgsSchema = z.object({});
export const checkUpdatesTool = tool({
    description: "Check installed skills for updates",
    args: checkUpdatesArgsSchema.shape,
    async execute(_args, ctx) {
        const lockManager = new SkillLockManager(ctx.directory || process.cwd());
        const changelogTracker = new ChangelogTracker(ctx.directory || process.cwd());
        const lockedSkills = lockManager.getLockedSkills();
        if (lockedSkills.length === 0) {
            return "## 📋 No Installed Skills\nNo skills are currently tracked in the lockfile.";
        }
        const lines = ["## 🔍 Update Check Results", ""];
        let hasAnyUpdates = false;
        let hasBreakingChanges = false;
        for (const skill of lockedSkills) {
            const adapter = marketplaceRegistry.getMarketplace(skill.marketplace);
            if (!adapter) {
                lines.push(`- **${skill.identifier}**: ⚠️ marketplace '${skill.marketplace}' unavailable`);
                continue;
            }
            try {
                const info = await adapter.getSkillInfo(skill.identifier);
                if (!info) {
                    lines.push(`- **${skill.identifier}**: ⚠️ not found on marketplace`);
                    continue;
                }
                const result = await lockManager.checkForUpdates(skill.identifier, info.description);
                if (result.hasUpdate) {
                    hasAnyUpdates = true;
                    const currentVersion = skill.version ?? "unknown";
                    const newVersion = skill.version ?? "unknown";
                    const breaking = result.breaking ?? skill.breaking ?? false;
                    if (breaking) {
                        hasBreakingChanges = true;
                    }
                    lines.push(`- **${info.name}**: ${currentVersion} → ${newVersion}${breaking ? " ⚠️ BREAKING" : ""}`);
                }
                else {
                    lines.push(`- **${skill.identifier}**: ✅ up to date`);
                }
            }
            catch {
                lines.push(`- **${skill.identifier}**: ⚠️ failed to check`);
            }
        }
        lines.push("");
        if (hasAnyUpdates) {
            if (hasBreakingChanges) {
                lines.push("**⚠️ Breaking changes detected:** Review updates carefully before installing.");
            }
            lines.push("**Action needed:** Run `skill-finder_install` to update skills.");
        }
        else {
            lines.push("All tracked skills are up to date.");
        }
        return lines.join("\n");
    },
});
//# sourceMappingURL=check-updates.js.map