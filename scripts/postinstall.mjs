#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import * as readline from 'node:readline';
import { PLATFORM_PROFILES, AGENTS_MD_BLOCK, detectPlatform, getPlatformByName, isSupportedPlatform } from './platform-profiles.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Main installation logic
async function main() {
  // Parse --install-target flag and SKILLFINDER_PLATFORM env var
  const args = process.argv.slice(2);
  const installTarget = args.find(a => a.startsWith('--install-target='))?.split('=')[1]
    || args.find(a => a === '--install-target' && args[args.indexOf(a) + 1] && args[args.indexOf(a) + 1])
    || process.env.SKILLFINDER_PLATFORM
    || null;

  let selectedProfile = null;

  if (installTarget) {
    // Explicit target via --install-target flag or SKILLFINDER_PLATFORM env var
    const profile = getPlatformByName(installTarget);
    if (!profile) {
      console.error(`SkillFinder: Unsupported platform: "${installTarget}". Supported: opencode, claude, cursor`);
      process.exit(1);
    }
    selectedProfile = profile;
    console.log(`SkillFinder: Platform: ${profile.name}`);
  } else if (process.stdout.isTTY) {
    // Interactive mode — auto-detect + confirm/menu
    const { primary, all } = detectPlatform();

    if (all.length === 0) {
      // Nothing detected — show menu
      console.log('SkillFinder: No platform detected. Select a target:');
      for (const [id, profile] of Object.entries(PLATFORM_PROFILES)) {
        const i = Object.keys(PLATFORM_PROFILES).indexOf(id) + 1;
        console.log(`  ${i}) ${profile.name}`);
      }
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise(resolve => rl.question('  Enter number (1-3): ', resolve));
      rl.close();
      const index = parseInt(answer, 10) - 1;
      const ids = Object.keys(PLATFORM_PROFILES);
      if (index >= 0 && index < ids.length) {
        selectedProfile = PLATFORM_PROFILES[ids[index]];
      } else {
        console.error('SkillFinder: Invalid selection.');
        process.exit(1);
      }
    } else if (all.length === 1) {
      // Single platform detected — confirm
      const profile = PLATFORM_PROFILES[all[0]];
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise(resolve => rl.question(`  Detected ${profile.name}. Install for ${profile.name}? [Y/n/s]: `, resolve));
      rl.close();
      const upper = answer.trim().toUpperCase();
      if (upper === 'N' || upper === 'NO') {
        console.log('SkillFinder: Installation cancelled.');
        process.exit(0);
      } else if (upper === 'S' || upper === 'SELECT') {
        // Show menu
        console.log('SkillFinder: Select a platform:');
        for (const [id, p] of Object.entries(PLATFORM_PROFILES)) {
          const i = Object.keys(PLATFORM_PROFILES).indexOf(id) + 1;
          console.log(`  ${i}) ${p.name}`);
        }
        const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer2 = await new Promise(resolve => rl2.question('  Enter number (1-3): ', resolve));
        rl2.close();
        const index = parseInt(answer2, 10) - 1;
        const ids = Object.keys(PLATFORM_PROFILES);
        selectedProfile = (index >= 0 && index < ids.length) ? PLATFORM_PROFILES[ids[index]] : profile;
      } else {
        selectedProfile = profile;
      }
    } else {
      // Multiple platforms detected — show menu
      console.log('SkillFinder: Multiple platforms detected. Choose one:');
      for (const id of all) {
        const i = all.indexOf(id) + 1;
        console.log(`  ${i}) ${PLATFORM_PROFILES[id].name}`);
      }
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise(resolve => rl.question('  Enter number (1-3): ', resolve));
      rl.close();
      const index = parseInt(answer, 10) - 1;
      if (index >= 0 && index < all.length) {
        selectedProfile = PLATFORM_PROFILES[all[index]];
      } else {
        selectedProfile = PLATFORM_PROFILES[all[0]]; // fallback to first
      }
    }
    console.log(`SkillFinder: Selected platform: ${selectedProfile.name}`);
  } else {
    // Non-interactive (npm lifecycle, CI, pipe) — auto-detect with OpenCode fallback
    const { primary } = detectPlatform();
    selectedProfile = primary || getPlatformByName('opencode');
    console.log(`SkillFinder: Platform: ${selectedProfile.name} (${primary ? 'auto-detected' : 'default - OpenCode'})`);
  }

  const packageDir = __dirname.replace(/[\\/]+scripts$/, '');

  console.log('SkillFinder: Starting installation...');
  console.log(`  Config dir: ${selectedProfile.configDir}`);
  console.log(`  Package dir: ${packageDir}`);

  // Check if config directory exists
  if (!existsSync(selectedProfile.configDir)) {
    console.log('SkillFinder: Config directory not found, creating...');
    mkdirSync(selectedProfile.configDir, { recursive: true });
  }

  // Check and update config file
  const configPath = join(selectedProfile.configDir, selectedProfile.configFile);
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));

      // Ensure plugin/plugins array exists (platform-specific key name)
      const configPropName = Array.isArray(selectedProfile.configFormat.plugin) ? 'plugin' : 'plugins';
      if (!Array.isArray(config[configPropName])) {
        config[configPropName] = [];
      }

      // Check if skill-finder is already registered
      const alreadyRegistered = config[configPropName].some(p =>
        p === 'skill-finder' || p === 'opencode-skill-finder'
      );

      if (!alreadyRegistered) {
        config[configPropName].push('skill-finder');
        writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`SkillFinder: Added to ${selectedProfile.configFile} ${configPropName} array`);
      } else {
        console.log(`SkillFinder: Already registered in ${selectedProfile.configFile}`);
      }
    } catch (e) {
      console.error(`SkillFinder: Error reading ${selectedProfile.configFile}:`, e);
    }
  } else {
    console.log(`SkillFinder: No ${selectedProfile.configFile} found, creating...`);
    const configPropName = Array.isArray(selectedProfile.configFormat.plugin) ? 'plugin' : 'plugins';
    const config = { [configPropName]: ['skill-finder'] };
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`SkillFinder: Created ${selectedProfile.configFile} with skill-finder`);
  }

  // Check and update AGENTS.md
  const agentsPath = join(selectedProfile.configDir, selectedProfile.agentsFile);
  if (existsSync(agentsPath)) {
    try {
      const content = readFileSync(agentsPath, 'utf-8');
      if (!content.includes('<!-- skill-finder -->')) {
        const newContent = content + '\n\n' + AGENTS_MD_BLOCK + '\n';
        writeFileSync(agentsPath, newContent);
        console.log(`SkillFinder: Injected instructions into ${selectedProfile.agentsFile}`);
      } else {
        console.log(`SkillFinder: Already present in ${selectedProfile.agentsFile}`);
      }
    } catch (e) {
      console.error(`SkillFinder: Error reading ${selectedProfile.agentsFile}:`, e);
    }
  } else {
    console.log(`SkillFinder: No ${selectedProfile.agentsFile} found, creating...`);
    writeFileSync(agentsPath, AGENTS_MD_BLOCK + '\n');
    console.log(`SkillFinder: Created ${selectedProfile.agentsFile} with skill-finder`);
  }

  // Copy plugin to plugins directory
  const pluginsDir = selectedProfile.pluginDir;
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

  console.log(`SkillFinder: Installation complete for ${selectedProfile.name}!`);
}

// Run installation
main().catch(err => {
  console.error('SkillFinder: Installation failed:', err);
  process.exit(1);
});
