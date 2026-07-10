#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import { MCPServer } from "../mcp/server.js";
import { marketplaceRegistry } from "../registry/instance.js";
import { SkillLockManager } from "../cache/skill-lock.js";
import { ChangelogTracker } from "../cache/changelog-tracker.js";
import { SkillPlanComposer, discoverPlans } from "../composer/skill-plan.js";
import { QualityScorer } from "../scoring/quality.js";
import { parseArgs } from "./args.js";
import { detectActiveAgents, AGENT_TARGETS } from "../installer/agent-targets.js";
import type { SkillSearchResult } from "../types.js";

const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const SEP = "\u2500".repeat(60);

const HELP_TEXT = `\
Usage: skill-finder <command> [options]

Commands:
  search <query>      Search for skills across all marketplaces
  install <id> <mp>   Install a skill from a marketplace
  list                List installed (cached) skills
  info <id>           Show detailed info about a skill
  remove <id>         Remove a cached skill
  check-updates       Check for available updates to installed skills
  plan                List available skill plans
  mcp                 Start MCP server (for agentic integration)

Options:
  -h, --help          Show this help message
`;

const qualityScorer = new QualityScorer();

interface SkillEntry {
  name: string;
  description: string;
}

function readSkillsFromDir(baseDir: string, marketplace?: string): SkillEntry[] {
  if (!fs.existsSync(baseDir)) return [];

  const marketplaces = marketplace
    ? [marketplace]
    : fs.readdirSync(baseDir).filter((d) => {
        const full = path.join(baseDir, d);
        return fs.statSync(full).isDirectory();
      });

  const skills: SkillEntry[] = [];

  for (const mp of marketplaces) {
    const mpDir = path.join(baseDir, mp);
    if (!fs.existsSync(mpDir) || !fs.statSync(mpDir).isDirectory()) continue;

    const skillDirs = fs.readdirSync(mpDir).filter((d) => {
      const full = path.join(mpDir, d);
      return fs.statSync(full).isDirectory();
    });

    for (const skill of skillDirs) {
      const skillDir = path.join(mpDir, skill);
      const skillMdPath = path.join(skillDir, "SKILL.md");
      let description = "";
      if (fs.existsSync(skillMdPath)) {
        const content = fs.readFileSync(skillMdPath, "utf-8");
        const firstLine = content.split("\n").find((l) => l.trim().length > 0);
        if (firstLine) {
          description = firstLine.replace(/^#+\s*/, "").trim();
        }
      }
      skills.push({ name: `${mp}:${skill}`, description });
    }
  }

  return skills;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "\u2026";
}

export class SkillFinderCLI {
  async run(args: string[]): Promise<void> {
    const parsed = parseArgs(args);

    // Handle --help / -h (from flags or as command)
    if (parsed.flags["h"] === true || parsed.flags["help"] === true || parsed.command === "help") {
      process.stdout.write(HELP_TEXT);
      return;
    }

    if (!parsed.command) {
      process.stdout.write(HELP_TEXT);
      return;
    }

    switch (parsed.command) {
      case "search":
        await this.handleSearch(parsed.positional);
        break;
      case "install":
        await this.handleInstall(parsed.positional, parsed.flags);
        break;
      case "list":
        await this.handleList(parsed.positional);
        break;
      case "info":
        await this.handleInfo(parsed.positional);
        break;
      case "remove":
        await this.handleRemove(parsed.positional);
        break;
      case "check-updates":
        await this.handleCheckUpdates();
        break;
      case "plan":
        await this.handlePlan();
        break;
      case "mcp": {
        const server = new MCPServer();
        await server.start();
        break;
      }
      default:
        process.stderr.write(`Unknown command: ${parsed.command}\n\n`);
        process.stdout.write(HELP_TEXT);
        process.exit(1);
    }
  }

  private async handleSearch(positional: string[]): Promise<void> {
    const query = positional.join(" ").trim();
    if (!query) {
      process.stderr.write("Error: search requires a query.\n\n");
      process.stdout.write(HELP_TEXT);
      process.exit(1);
    }

    try {
      const results = await marketplaceRegistry.searchAll(query, { limit: 20 });

      if (results.length === 0) {
        process.stdout.write("No matching skills found.\n");
        return;
      }

      process.stdout.write(`${BOLD}Search Results for "${query}"${RESET}\n`);
      process.stdout.write(`${SEP}\n\n`);

      for (const item of results) {
        const desc = truncate(item.description, 120);
        const qScore = qualityScorer.score(item);
        const stars = item.stars ? `⭐${item.stars}` : "⭐0";
        const installs = item.installCount ? `${item.installCount} installs` : "0 installs";
        const verified = item.verified ? " ✅" : "";

        process.stdout.write(`${BOLD}${item.name}${RESET}${verified}\n`);
        process.stdout.write(`  ${desc}\n`);
        process.stdout.write(`  Quality: ${Math.round(qScore * 100)}% | ${stars} | ${installs} | ${item.marketplace}\n`);
        process.stdout.write(`  ID: ${item.id}\n`);
        process.stdout.write(`${SEP}\n\n`);
      }

      process.stdout.write(`${BOLD}Total: ${results.length} skills found${RESET}\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Search failed: ${message}\n`);
      process.exit(1);
    }
  }

  private async handleInstall(positional: string[], flags: Record<string, string | boolean>): Promise<void> {
    const identifier = positional[0]?.trim();
    const marketplace = positional[1]?.trim();

    if (!identifier || !marketplace) {
      process.stderr.write("Error: install requires <identifier> <marketplace>.\n\n");
      process.stdout.write(HELP_TEXT);
      process.exit(1);
    }

    const adapter = marketplaceRegistry.getMarketplace(marketplace);
    if (!adapter) {
      process.stderr.write(`Unknown marketplace '${marketplace}'. Available: ${marketplaceRegistry.listAvailable().join(", ")}\n`);
      process.exit(1);
    }

    const targetDir = typeof flags["target"] === "string" ? flags["target"] : process.cwd();

    try {
      const result = await adapter.install(identifier, targetDir);
      process.stdout.write(`${BOLD}✅ Installed ${identifier}${RESET}\n`);
      process.stdout.write(`  Path: ${result.path}\n`);
      process.stdout.write(`  Files: ${result.files.join(", ")}\n`);
      process.stdout.write(`  Marketplace: ${marketplace}\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Installation failed: ${message}\n`);
      process.exit(1);
    }
  }

  private async handleList(positional: string[]): Promise<void> {
    const marketplace = positional[0]?.trim() || undefined;
    const projectRoot = process.cwd();

    const activeAgents = detectActiveAgents(projectRoot);
    if (activeAgents.length === 0) {
      activeAgents.push("opencode");
    }

    let total = 0;
    const lines: string[] = [];

    for (const agent of activeAgents) {
      const agentInfo = AGENT_TARGETS[agent];
      const agentDir = path.join(projectRoot, agentInfo.dir);

      if (!fs.existsSync(agentDir)) continue;

      const skills = readSkillsFromDir(agentDir, marketplace);
      if (skills.length === 0) continue;

      lines.push(`${BOLD}${agent} (${agentInfo.dir}) \u2014 ${skills.length} installed${RESET}`);
      for (const skill of skills) {
        const desc = skill.description ? ` \u2014 ${skill.description}` : "";
        lines.push(`  ${skill.name}${desc}`);
        total++;
      }
      lines.push("");
    }

    if (total === 0) {
      process.stdout.write("No skills installed. Use 'skill-finder install' to add one.\n");
      return;
    }

    lines.push(`${BOLD}Total: ${total} skills installed${RESET}`);
    process.stdout.write(lines.join("\n") + "\n");
  }

  private async handleInfo(positional: string[]): Promise<void> {
    const identifier = positional.join(" ").trim();
    if (!identifier) {
      process.stderr.write("Error: info requires an identifier.\n\n");
      process.stdout.write(HELP_TEXT);
      process.exit(1);
    }

    let skill: SkillSearchResult | null = null;

    // Try to find adapter by marketplace prefix
    if (identifier.includes(":")) {
      const [marketplace, skillId] = identifier.split(":", 2);
      const adapter = marketplaceRegistry.getMarketplace(marketplace);
      if (adapter) {
        skill = await adapter.getSkillInfo(skillId);
      }
    }

    // Fallback: search all marketplaces
    if (!skill) {
      const results = await marketplaceRegistry.searchAll(identifier, { limit: 5 });
      skill = results.find((r) => r.id === identifier) ?? results[0] ?? null;
    }

    if (!skill) {
      process.stderr.write(`Skill '${identifier}' was not found in any marketplace.\n`);
      process.exit(1);
    }

    process.stdout.write(`${BOLD}${skill.name}${RESET}\n`);
    process.stdout.write(`${SEP}\n`);
    process.stdout.write(`  ID:          ${skill.id}\n`);
    process.stdout.write(`  Marketplace: ${skill.marketplace}\n`);
    process.stdout.write(`  Category:    ${skill.category ?? "\u2014"}\n`);
    process.stdout.write(`  Stars:       ⭐ ${skill.stars}\n`);
    process.stdout.write(`  Installs:    ${skill.installCount}\n`);
    process.stdout.write(`  Description: ${skill.description}\n`);
    process.stdout.write(`  Triggers:    ${skill.triggers.join(", ") || "\u2014"}\n`);
    process.stdout.write(`  Install:     ${skill.installCommand}\n`);
    process.stdout.write(`  Homepage:    ${skill.homepageUrl}\n`);
    if (skill.verified) {
      process.stdout.write(`  Verified:    ✅\n`);
    }
  }

  private async handleRemove(positional: string[]): Promise<void> {
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

    process.stdout.write(`${BOLD}✅ Removed ${identifier}${RESET}\n`);
    process.stdout.write(`  Removed from:\n`);
    for (const p of removedPaths) {
      process.stdout.write(`    ${p}\n`);
    }
  }

  private async handleCheckUpdates(): Promise<void> {
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
          process.stdout.write(`  ${skill.identifier}: update available (${currentVersion})${breaking ? " ⚠️ BREAKING" : ""}\n`);
        } else {
          process.stdout.write(`  ${skill.identifier}: ✅ up to date\n`);
        }
      } catch (err) {
        console.warn(
          "[skill-finder] update check failed for",
          skill.identifier,
          err instanceof Error ? err.message : String(err),
        );
        process.stdout.write(`  ${skill.identifier}: ⚠️ failed to check\n`);
      }
    }

    process.stdout.write(`\n`);
    if (hasAnyUpdates) {
      process.stdout.write("Action needed: run 'skill-finder install' to update skills.\n");
    } else {
      process.stdout.write("All tracked skills are up to date.\n");
    }
  }

  private async handlePlan(): Promise<void> {
    const composer = new SkillPlanComposer();
    const plans = composer.getAvailablePlans();

    if (plans.length === 0) {
      process.stdout.write("No skill plans available.\n");
      return;
    }

    process.stdout.write(`${BOLD}Available Skill Plans${RESET}\n`);
    process.stdout.write(`${SEP}\n\n`);

    for (const plan of plans) {
      process.stdout.write(`${BOLD}${plan.key}${RESET} \u2014 ${plan.name}\n`);
      process.stdout.write(`  ${plan.description}\n`);
      process.stdout.write(`  Categories: ${plan.matchCategories.join(", ")}\n`);
      process.stdout.write(`\n`);
    }

    process.stdout.write(`${BOLD}Total: ${plans.length} plan(s)${RESET}\n`);
  }
}

// Run CLI if this file is executed directly
import { fileURLToPath, pathToFileURL } from "node:url";
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const cli = new SkillFinderCLI();
  cli.run(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
}
