#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_OWNER = 'brain-orch';
const REPO_NAME = 'skill-finder';

/**
 * Execute a git command and return trimmed stdout.
 * @param {string} cmd
 * @param {number} [maxBuffer=1024*1024]
 * @returns {string}
 */
function git(cmd, maxBuffer = 1024 * 1024) {
  return execSync(`git ${cmd}`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer,
    windowsHide: true,
  }).trim();
}

/**
 * Check that git is available.
 */
function assertGitAvailable() {
  try {
    git('--version');
  } catch {
    throw new Error('Git is not available. Please install git and try again.');
  }
}

/**
 * Check that a tag exists.
 * @param {string} tag
 */
function assertTagExists(tag) {
  try {
    const output = git(`rev-parse --verify "refs/tags/${tag}"`);
    if (!output) {
      throw new Error();
    }
  } catch {
    throw new Error(`Tag ${tag} not found`);
  }
}

/**
 * Find the previous tag before the given tag.
 * Retries up to 3 times on transient errors.
 * @param {string} tag
 * @returns {string|null} previous tag name, or null if this is the first release
 */
function findPreviousTag(tag) {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const prev = git(`describe --tags --abbrev=0 "${tag}^"`);
      return prev;
    } catch {
      // If this is the last attempt, assume first release (no previous tag)
      if (attempt === maxRetries) {
        return null;
      }
    }
  }
  return null;
}

/**
 * Get commits between two refs.
 * If prevRef is null, gets all commits up to currentRef.
 * @param {string|null} prevRef
 * @param {string} currentRef
 * @returns {string[]} array of formatted commit lines
 */
function getCommits(prevRef, currentRef) {
  const range = prevRef ? `${prevRef}..${currentRef}` : currentRef;
  const logOutput = git(`log ${range} --no-decorate --format="%h: %s (%an)"`);

  if (!logOutput) {
    return [];
  }

  return logOutput.split('\n').filter(line => line.length > 0);
}

/**
 * Categorize commits by conventional commit type.
 * @param {string[]} commits - array of formatted commit lines ("hash: message (author)")
 * @returns {{ feat: string[], fix: string[], other: string[] }}
 */
function categorizeCommits(commits) {
  const categories = { feat: [], fix: [], other: [] };

  for (const commit of commits) {
    // Match pattern: "hash: prefix(optional-scope): message (author)"
    const match = commit.match(/^([a-f0-9]+):\s*(feat|fix|chore|docs|refactor)(?:\([^)]*\))?\s*:\s*(.+)\s*\((.+)\)$/i);

    if (!match) {
      categories.other.push(commit);
      continue;
    }

    const [, hash, prefix, message, author] = match;
    const cleanCommit = `${hash}: ${message.trim()} (${author})`;

    switch (prefix.toLowerCase()) {
      case 'feat':
        categories.feat.push(cleanCommit);
        break;
      case 'fix':
        categories.fix.push(cleanCommit);
        break;
      default:
        // chore, docs, refactor → Other Changes
        categories.other.push(cleanCommit);
        break;
    }
  }

  return categories;
}

/**
 * Extract version from a tag (remove leading 'v').
 * @param {string} tag
 * @returns {string}
 */
function extractVersion(tag) {
  return tag.startsWith('v') ? tag.slice(1) : tag;
}

/**
 * Get today's date in YYYY-MM-DD format.
 * @returns {string}
 */
function getDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate the Patreon post markdown.
 * @param {string} tag
 * @param {string|null} prevTag
 * @param {string} date
 * @param {string[]} commits
 * @returns {string}
 */
function generatePost(tag, prevTag, date, commits) {
  const version = extractVersion(tag);
  const categories = categorizeCommits(commits);

  // Build changelog URL
  const changelogUrl = prevTag
    ? `https://github.com/${REPO_OWNER}/${REPO_NAME}/compare/${prevTag}...${tag}`
    : `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/${tag}`;

  // Build sections (skip empty)
  const sections = [];

  if (categories.feat.length > 0) {
    sections.push(`## ✨ New Features\n${categories.feat.map(c => `- ${c}`).join('\n')}`);
  }

  if (categories.fix.length > 0) {
    sections.push(`## 🐛 Bug Fixes\n${categories.fix.map(c => `- ${c}`).join('\n')}`);
  }

  if (categories.other.length > 0) {
    sections.push(`## 📦 Other Changes\n${categories.other.map(c => `- ${c}`).join('\n')}`);
  }

  if (sections.length === 0) {
    sections.push('## 📦 Other Changes\n- No changes since previous release');
  }

  // Patron-only footer
  const visibility = process.env.PATREON_POST_VISIBILITY || 'patron-only';
  const footer = visibility !== 'public' ? '\n_(Patron-only post)_' : '';

  return `# SkillFinder v${version} — Release Update

**🗓️ Tanggal:** ${date}

${sections.join('\n\n')}

## 📋 Full Changelog
${changelogUrl}${footer}
`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const tag = process.argv[2];
  const explicitFromTag = process.argv[3]; // optional: override auto-detected previous tag

  if (!tag) {
    console.error('Usage: node generate-patreon-post.mjs <tag> [from-tag]');
    console.error('Example: node generate-patreon-post.mjs v2.2.0');
    console.error('Example: node generate-patreon-post.mjs v2.2.0 v1.1.0  # cumulative post from v1.1.0 to v2.2.0');
    process.exit(1);
  }

  assertGitAvailable();
  assertTagExists(tag);

  if (explicitFromTag) {
    assertTagExists(explicitFromTag);
  }

  const prevTag = explicitFromTag || findPreviousTag(tag);
  const commits = getCommits(prevTag, tag);
  const date = getDateString();

  const post = generatePost(tag, prevTag, date, commits);

  // Write to file
  const outputPath = resolve('patreon-post.md');
  writeFileSync(outputPath, post, 'utf-8');
  console.log(`Generated ${outputPath}`);

  // Also output to stdout
  console.log('\n--- Patreon Post ---\n');
  console.log(post);
}

main();
