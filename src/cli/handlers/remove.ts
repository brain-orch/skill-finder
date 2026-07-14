import * as fs from "node:fs";
import * as path from "node:path";
import { detectActiveAgents, AGENT_TARGETS } from "../../installer/agent-targets.js";
import { SkillLockManager } from "../../cache/skill-lock.js";
import { BOLD, RESET, HELP_TEXT } from "../format.js";

export async function handleRemove(positional: string[]): Promise<void> {
  const identifier = positional.join(" ").trim();
  if (!identifier) {
    process.stderr.write("Error: remove requires an identifier.\n\n");
    process.stdout.write(HELP_TEXT);
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const activeAgents = detectActiveAgents(projectRoot);
  if (activeAgents.length === 0) {
    activeAgents.push("opencode");
  }

  let marketplace: string;
  let skillName: string;

  if (identifier.includes(":")) {
    [marketplace, skillName] = identifier.split(":", 2);
  } else {
    marketplace = "";
    skillName = identifier;
  }

  const removedPaths: string[] = [];

  for (const agent of activeAgents) {
    const agentInfo = AGENT_TARGETS[agent];
    const agentDir = path.join(projectRoot, agentInfo.dir);

    if (!fs.existsSync(agentDir)) continue;

    if (marketplace) {
      const skillPath = path.join(agentDir, marketplace, skillName);
      if (fs.existsSync(skillPath) && fs.statSync(skillPath).isDirectory()) {
        fs.rmSync(skillPath, { recursive: true, force: true });
        removedPaths.push(path.relative(projectRoot, skillPath));
      }
    } else {
      const marketplaceDirs = fs.readdirSync(agentDir).filter((d) => {
        const full = path.join(agentDir, d);
        return fs.statSync(full).isDirectory();
      });

      for (const mp of marketplaceDirs) {
        const candidate = path.join(agentDir, mp, skillName);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
          fs.rmSync(candidate, { recursive: true, force: true });
          removedPaths.push(path.relative(projectRoot, candidate));
        }
      }
    }
  }

  if (removedPaths.length === 0) {
    process.stderr.write(`Skill '${identifier}' is not installed.\n`);
    process.exit(1);
  }

  // Unlock from lockfile
  try {
    const lockManager = new SkillLockManager(projectRoot);
    lockManager.unlockSkill(identifier);
  } catch (err) {
    console.warn(
      "[skill-finder] lockfile write failed during removal:",
      err instanceof Error ? err.message : String(err),
    );
  }

  process.stdout.write(`${BOLD}\u2705 Removed ${identifier}${RESET}\n`);
  process.stdout.write(`  Removed from:\n`);
  for (const p of removedPaths) {
    process.stdout.write(`    ${p}\n`);
  }
}
