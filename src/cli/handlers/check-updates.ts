import { marketplaceRegistry } from "../../registry/instance.js";
import { SkillLockManager } from "../../cache/skill-lock.js";
import { ChangelogTracker } from "../../cache/changelog-tracker.js";
import { BOLD, RESET, SEP } from "../format.js";

export async function handleCheckUpdates(): Promise<void> {
  const lockManager = new SkillLockManager();
  const changelogTracker = new ChangelogTracker();
  const lockedSkills = lockManager.getLockedSkills();

  if (lockedSkills.length === 0) {
    process.stdout.write("No skills are currently tracked in the lockfile.\n");
    return;
  }

  process.stdout.write(`${BOLD}Update Check Results${RESET}\n`);
  process.stdout.write(`${SEP}\n\n`);

  let hasAnyUpdates = false;

  for (const skill of lockedSkills) {
    const adapter = marketplaceRegistry.getMarketplace(skill.marketplace);
    if (!adapter) {
      process.stdout.write(`  ${skill.identifier}: marketplace '${skill.marketplace}' unavailable\n`);
      continue;
    }

    try {
      const info = await adapter.getSkillInfo(skill.identifier);
      if (!info) {
        process.stdout.write(`  ${skill.identifier}: not found on marketplace\n`);
        continue;
      }

      const result = await lockManager.checkForUpdates(skill.identifier, info.description);

      if (result.hasUpdate) {
        hasAnyUpdates = true;
        const currentVersion = skill.version ?? "unknown";
        const breaking = result.breaking ?? skill.breaking ?? false;
        process.stdout.write(`  ${skill.identifier}: update available (${currentVersion})${breaking ? " \u26a0\ufe0f BREAKING" : ""}\n`);
      } else {
        process.stdout.write(`  ${skill.identifier}: \u2705 up to date\n`);
      }
    } catch (err) {
      console.warn(
        "[skill-finder] update check failed for",
        skill.identifier,
        err instanceof Error ? err.message : String(err),
      );
      process.stdout.write(`  ${skill.identifier}: \u26a0\ufe0f failed to check\n`);
    }
  }

  process.stdout.write(`\n`);
  if (hasAnyUpdates) {
    process.stdout.write("Action needed: run 'skill-finder install' to update skills.\n");
  } else {
    process.stdout.write("All tracked skills are up to date.\n");
  }
}
