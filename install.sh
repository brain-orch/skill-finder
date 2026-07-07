#!/usr/bin/env bash
#
# install.sh — One-click installer for SkillFinder OpenCode Plugin
#
# Installs the SkillFinder plugin globally in OpenCode's config directory.
# Registers the plugin in opencode.json and injects instructions into AGENTS.md.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/brainorch/skill-finder/main/install.sh | sh
#
# Requirements:
#   - curl or wget (for remote install)
#   - git or unzip (for downloading source)
#   - Node.js >= 18
#   - npm
#
# License: MIT
#

set -euo pipefail

# ─── Constants ───────────────────────────────────────────────────────────────

REPO_URL="https://github.com/brainorch/skill-finder"
ZIP_URL="https://github.com/brainorch/skill-finder/archive/refs/heads/main.zip"
RAW_BASE="https://raw.githubusercontent.com/brainorch/skill-finder/main"

AGENTS_BLOCK='<!-- skill-finder -->
# SkillFinder Plugin

SkillFinder watches your task context (messages, tool calls, file extensions) and automatically recommends relevant skills from 7 marketplaces.

## Available Tools
- `skill-finder_search` — Search for skills with query, category, and limit
- `skill-finder_install` — Install a skill from a marketplace
- `skill-finder_list` — List locally cached skills
- `skill-finder_remove` — Remove a cached skill
- `skill-finder_info` — Show detailed skill information

## How to Use
The plugin works automatically in the background. When it detects a task category (pdf-processing, git-workflows, database, etc.), it searches marketplaces and presents recommendations.

You can also use the tools manually at any time:
- `skill-finder_search query="pdf extract text"` to find skills
- `skill-finder_install identifier="lobehub:pdf-tools" marketplace="lobehub"` to install

## Configuration
Plugin options live in `~/.config/opencode/opencode.json` under the `"plugin"` array and in `.opencode/opencode.json` per-project. See README for details.
<!-- /skill-finder -->'

# ─── Utility Functions ───────────────────────────────────────────────────────

info()  { printf "\033[36m%s\033[0m\n" "• $1"; }
ok()    { printf "\033[32m✓\033[0m %s\n" "$1"; }
warn()  { printf "\033[33m⚠\033[0m %s\n" "$1" >&2; }
error() { printf "\033[31m✗\033[0m %s\n" "$1" >&2; exit 1; }

# ─── Step 1: Check Prerequisites ─────────────────────────────────────────────

info "Checking prerequisites..."

if ! command -v node &>/dev/null; then
  error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org"
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  error "Node.js 18+ required. Found: $(node -v)"
fi
ok "Node.js $(node -v)"

if ! command -v npm &>/dev/null; then
  error "npm is not installed. Please install npm."
fi
ok "npm $(npm -v)"

# ─── Step 2: Determine Paths ──────────────────────────────────────────────────

CONFIG_DIR="${HOME}/.config/opencode"
PLUGIN_DIR="${CONFIG_DIR}/plugins/skill-finder"
TEMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'skill-finder-install')
trap 'rm -rf "$TEMP_DIR"' EXIT

info "Config directory: ${CONFIG_DIR}"

# ─── Step 3: Detect Installation Method ──────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_MODE=false

# Check if we're running from a local checkout (script exists alongside package.json)
if [ -f "${SCRIPT_DIR}/package.json" ]; then
  LOCAL_MODE=true
  SOURCE_DIR="${SCRIPT_DIR}"
  info "Detected local checkout"
fi

# ─── Step 4: Get Plugin Files ────────────────────────────────────────────────

info "Setting up SkillFinder..."

mkdir -p "${CONFIG_DIR}/plugins"

# Remove old installation if present
rm -rf "${PLUGIN_DIR}"

if [ "$LOCAL_MODE" = true ]; then
  # Copy from local checkout
  cp -r "$SOURCE_DIR" "$PLUGIN_DIR"
  ok "Copied from local checkout"
else
  # Download from GitHub
  DOWNLOAD_METHOD=""

  if command -v git &>/dev/null; then
    DOWNLOAD_METHOD="git"
    info "Cloning repository..."
    git clone --depth 1 "$REPO_URL" "$PLUGIN_DIR" 2>/dev/null || true
  fi

  if [ ! -d "${PLUGIN_DIR}/package.json" ] && [ ! -f "${PLUGIN_DIR}/package.json" ]; then
    if command -v curl &>/dev/null; then
      DOWNLOAD_METHOD="curl"
      info "Downloading archive..."
      curl -fsSL "$ZIP_URL" -o "${TEMP_DIR}/archive.zip"
    elif command -v wget &>/dev/null; then
      DOWNLOAD_METHOD="wget"
      info "Downloading archive..."
      wget -q "$ZIP_URL" -O "${TEMP_DIR}/archive.zip"
    else
      error "Neither git, curl, nor wget found. Please install one of them."
    fi

    if command -v unzip &>/dev/null; then
      info "Extracting archive..."
      unzip -q "${TEMP_DIR}/archive.zip" -d "${TEMP_DIR}/extracted"
      EXTRACTED_DIR=$(find "${TEMP_DIR}/extracted" -maxdepth 1 -type d | tail -1)
      mv "$EXTRACTED_DIR" "$PLUGIN_DIR"
    else
      error "unzip not found. Please install unzip."
    fi
  fi

  ok "Downloaded via ${DOWNLOAD_METHOD}"
fi

# ─── Step 5: Install Dependencies & Build ─────────────────────────────────────

info "Installing dependencies..."
cd "$PLUGIN_DIR"
npm install --production 2>/dev/null || npm install 2>/dev/null || warn "npm install had warnings"
ok "Dependencies installed"

info "Building plugin..."
npm run build 2>/dev/null || warn "Build skipped (dist may already exist)"
ok "Build complete"

# ─── Step 6: Register in opencode.json ───────────────────────────────────────

info "Registering in opencode.json..."

mkdir -p "$CONFIG_DIR"
CONFIG_FILE="${CONFIG_DIR}/opencode.json"

if [ -f "$CONFIG_FILE" ]; then
  # Check if already registered
  if grep -q '"skill-finder"' "$CONFIG_FILE" 2>/dev/null; then
    ok "Already registered in opencode.json"
  else
    # Use temporary Node.js one-liner to modify JSON
    node -e "
      const fs = require('fs');
      const path = '$CONFIG_FILE';
      let cfg = JSON.parse(fs.readFileSync(path, 'utf-8'));
      if (!Array.isArray(cfg.plugin)) cfg.plugin = [];
      if (!cfg.plugin.includes('skill-finder')) cfg.plugin.push('skill-finder');
      fs.writeFileSync(path, JSON.stringify(cfg, null, 2));
    "
    ok "Registered in opencode.json"
  fi
else
  echo '{ "plugin": ["skill-finder"] }' > "$CONFIG_FILE"
  ok "Created opencode.json with skill-finder"
fi

# ─── Step 7: Inject into AGENTS.md ───────────────────────────────────────────

info "Updating AGENTS.md..."

AGENTS_FILE="${CONFIG_DIR}/AGENTS.md"

if [ -f "$AGENTS_FILE" ]; then
  if grep -q '<!-- skill-finder -->' "$AGENTS_FILE" 2>/dev/null; then
    ok "Already present in AGENTS.md"
  else
    printf "\n\n%s\n" "$AGENTS_BLOCK" >> "$AGENTS_FILE"
    ok "Injected instructions into AGENTS.md"
  fi
else
  printf "%s\n" "$AGENTS_BLOCK" > "$AGENTS_FILE"
  ok "Created AGENTS.md with skill-finder"
fi

# ─── Step 8: Post-Install Summary ─────────────────────────────────────────────

printf "\n"
printf "╔══════════════════════════════════════════════════════╗\n"
printf "║          SkillFinder — Installation Complete        ║\n"
printf "╠══════════════════════════════════════════════════════╣\n"
printf "║  Location:  %-38s║\n" "$PLUGIN_DIR"
printf "║  Config:    %-38s║\n" "$CONFIG_FILE"
printf "║  AGENTS.md: %-38s║\n" "$AGENTS_FILE"
printf "╠══════════════════════════════════════════════════════╣\n"
printf "║  Next step: Restart OpenCode to activate plugin     ║\n"
printf "╚══════════════════════════════════════════════════════╝\n"
