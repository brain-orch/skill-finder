#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// AGENTS.md block to inject
const AGENTS_MD_BLOCK = `
<!-- skill-finder -->
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
<!-- /skill-finder -->
`.trim();

// Detect opencode config directory
function getConfigDir() {
  if (process.platform === 'win32') {
    return join(process.env.USERPROFILE || homedir(), '.config', 'opencode');
  }
  return join(homedir(), '.config', 'opencode');
}

// Main installation logic
async function main() {
  const configDir = getConfigDir();
  const packageDir = __dirname.replace(/[\\/]+scripts$/, '');

  console.log('SkillFinder: Starting installation...');
  console.log(`  Config dir: ${configDir}`);
  console.log(`  Package dir: ${packageDir}`);

  // Check if config directory exists
  if (!existsSync(configDir)) {
    console.log('SkillFinder: Config directory not found, creating...');
    mkdirSync(configDir, { recursive: true });
  }

  // Check and update opencode.json
  const configPath = join(configDir, 'opencode.json');
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      
      // Ensure plugin array exists (global config uses array format)
      if (!Array.isArray(config.plugin)) {
        config.plugin = [];
      }

      // Check if skill-finder is already registered
      const alreadyRegistered = config.plugin.some(p => 
        p === 'skill-finder' || p === 'opencode-skill-finder'
      );

      if (!alreadyRegistered) {
        config.plugin.push('skill-finder');
        writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('SkillFinder: Added to opencode.json plugin array');
      } else {
        console.log('SkillFinder: Already registered in opencode.json');
      }
    } catch (e) {
      console.error('SkillFinder: Error reading opencode.json:', e);
    }
  } else {
    console.log('SkillFinder: No opencode.json found, creating...');
    const config = { plugin: ['skill-finder'] };
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('SkillFinder: Created opencode.json with skill-finder');
  }

  // Check and update AGENTS.md
  const agentsPath = join(configDir, 'AGENTS.md');
  if (existsSync(agentsPath)) {
    try {
      const content = readFileSync(agentsPath, 'utf-8');
      if (!content.includes('<!-- skill-finder -->')) {
        const newContent = content + '\n\n' + AGENTS_MD_BLOCK + '\n';
        writeFileSync(agentsPath, newContent);
        console.log('SkillFinder: Injected instructions into AGENTS.md');
      } else {
        console.log('SkillFinder: Already present in AGENTS.md');
      }
    } catch (e) {
      console.error('SkillFinder: Error reading AGENTS.md:', e);
    }
  } else {
    console.log('SkillFinder: No AGENTS.md found, creating...');
    writeFileSync(agentsPath, AGENTS_MD_BLOCK + '\n');
    console.log('SkillFinder: Created AGENTS.md with skill-finder');
  }

  // Copy plugin to plugins directory
  const pluginsDir = join(configDir, 'plugins', 'skill-finder');
  if (!existsSync(pluginsDir)) {
    mkdirSync(pluginsDir, { recursive: true });
  }

  const distDir = join(packageDir, 'dist');
  if (existsSync(distDir)) {
    try {
      cpSync(distDir, join(pluginsDir, 'dist'), { recursive: true });
      console.log('SkillFinder: Copied dist/ to plugins directory');
    } catch (e) {
      console.error('SkillFinder: Error copying dist:', e);
    }
  }

  console.log('SkillFinder: Installation complete!');
}

// Run installation
main().catch(err => {
  console.error('SkillFinder: Installation failed:', err);
  process.exit(1);
});
