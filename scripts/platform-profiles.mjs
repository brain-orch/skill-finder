import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

// ---------------------------------------------------------------------------
// AGENTS.md block to inject (mirrors scripts/postinstall.mjs lines 12-35)
// ---------------------------------------------------------------------------
const AGENTS_MD_BLOCK = `<!-- skill-finder -->
# SkillFinder Plugin

SkillFinder watches your task context (messages, tool calls, file extensions) and automatically recommends relevant skills from 7 marketplaces.

## Available Tools
- \`skill-finder_search\` — Search for skills with query, category, and limit
- \`skill-finder_install\` — Install a skill from a marketplace
- \`skill-finder_list\` — List locally cached skills
- \`skill-finder_remove\` — Remove a cached skill
- \`skill-finder_info\` — Show detailed skill information

## How to Use
The plugin works automatically in the background. When it detects a task category (pdf-processing, git-workflows, database, etc.), it searches marketplaces and presents recommendations.

You can also use the tools manually at any time:
- \`skill-finder_search query="pdf extract text"\` to find skills
- \`skill-finder_install identifier="lobehub:pdf-tools" marketplace="lobehub"\` to install

## Configuration
Plugin options live in \`~/.config/opencode/opencode.json\` under the \`"plugin"\` array and in \`.opencode/opencode.json\` per-project. See README for details.
<!-- /skill-finder -->`.trim();

// ---------------------------------------------------------------------------
// Platform Profiles
// ---------------------------------------------------------------------------

const home = homedir();

const PLATFORM_PROFILES = {
  opencode: {
    id: 'opencode',
    name: 'OpenCode',
    configDir: join(home, '.config', 'opencode'),
    configFile: 'opencode.json',
    configFormat: { plugin: ['skill-finder'] },
    pluginDir: join(home, '.config', 'opencode', 'plugins', 'skill-finder'),
    agentsFile: 'AGENTS.md',
    probePaths: ['.opencode/skills', '.opencode'],
    detectPriority: 1,
  },
  claude: {
    id: 'claude',
    name: 'Claude Code',
    configDir: join(home, '.claude'),
    configFile: 'claude.json',
    configFormat: { plugins: ['skill-finder'] },
    pluginDir: join(home, '.claude', 'plugins', 'skill-finder'),
    agentsFile: 'AGENTS.md',
    probePaths: ['.claude/skills', '.claude'],
    detectPriority: 2,
  },
  cursor: {
    id: 'cursor',
    name: 'Cursor',
    configDir: join(home, '.cursor'),
    configFile: 'opencode.json',
    configFormat: { plugin: ['skill-finder'] },
    pluginDir: join(home, '.cursor', 'extensions', 'skill-finder'),
    agentsFile: 'AGENTS.md',
    probePaths: ['.cursor/skills', '.cursor'],
    detectPriority: 3,
  },
};

// ---------------------------------------------------------------------------
// Detection Utilities
// ---------------------------------------------------------------------------

/**
 * Probe all platforms and return array of detected platform IDs.
 * Returns empty array if none detected.
 */
function detectAllPlatforms() {
  const detected = [];

  for (const [id, profile] of Object.entries(PLATFORM_PROFILES)) {
    for (const probePath of profile.probePaths) {
      if (existsSync(join(home, probePath))) {
        detected.push(id);
        break;
      }
    }
  }

  return detected;
}

/**
 * Convenience wrapper: returns { primary, all }.
 * primary is the profile with lowest detectPriority (highest priority).
 * Returns null primary if none detected.
 */
function detectPlatform() {
  const all = detectAllPlatforms();

  if (all.length === 0) {
    return { primary: null, all };
  }

  let bestId = all[0];
  let bestPriority = PLATFORM_PROFILES[bestId].detectPriority;

  for (const id of all) {
    const p = PLATFORM_PROFILES[id].detectPriority;
    if (p < bestPriority) {
      bestPriority = p;
      bestId = id;
    }
  }

  return { primary: PLATFORM_PROFILES[bestId], all };
}

/**
 * Case-insensitive lookup by platform id or name.
 * Returns the profile object or null if no match.
 */
function getPlatformByName(name) {
  const lower = name.toLowerCase();

  for (const profile of Object.values(PLATFORM_PROFILES)) {
    if (profile.id.toLowerCase() === lower || profile.name.toLowerCase() === lower) {
      return profile;
    }
  }

  return null;
}

/**
 * Returns a display string like "1) OpenCode  2) Claude Code  3) Cursor".
 */
function formatPlatformList() {
  return Object.values(PLATFORM_PROFILES)
    .map((p, i) => `${i + 1}) ${p.name}`)
    .join('  ');
}

/**
 * Boolean check: is the given name a supported platform?
 */
function isSupportedPlatform(name) {
  return getPlatformByName(name) !== null;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  PLATFORM_PROFILES,
  AGENTS_MD_BLOCK,
  detectAllPlatforms,
  detectPlatform,
  getPlatformByName,
  formatPlatformList,
  isSupportedPlatform,
};
