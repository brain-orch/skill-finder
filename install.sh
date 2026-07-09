#!/usr/bin/env bash
#
# install.sh — One-click installer for SkillFinder Plugin
# (supports OpenCode, Claude Code, and Cursor platforms)
#
# Installs the SkillFinder plugin in the selected platform's config directory.
# Registers the plugin and injects instructions into AGENTS.md.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/brainorch/skill-finder/main/install.sh | sh
#   curl -fsSL ... | sh -s -- --install-target claude
#   ./install.sh -t opencode
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

# ─── Parse Arguments ─────────────────────────────────────────────────────────

INSTALL_TARGET=""
while [ $# -gt 0 ]; do
  case "$1" in
    --install-target)
      INSTALL_TARGET="$2"
      shift 2
      ;;
    --install-target=*)
      INSTALL_TARGET="${1#*=}"
      shift
      ;;
    -t)
      INSTALL_TARGET="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# ─── Platform Profiles ──────────────────────────────────────────────────────

declare -A PLATFORM_PROFILES_NAMES
declare -A PLATFORM_PROFILES_DIRS
declare -A PLATFORM_PROFILES_FILES
declare -A PLATFORM_PROFILES_PLUGIN_DIRS
declare -A PLATFORM_PROFILES_PRIORITIES

register_platform() {
  local id="$1" name="$2" dir="$3" file="$4" plugin_dir="$5" priority="$6"
  PLATFORM_PROFILES_NAMES[$id]="$name"
  PLATFORM_PROFILES_DIRS[$id]="$dir"
  PLATFORM_PROFILES_FILES[$id]="$file"
  PLATFORM_PROFILES_PLUGIN_DIRS[$id]="$plugin_dir"
  PLATFORM_PROFILES_PRIORITIES[$id]=$priority
}

register_platform "opencode" "OpenCode"    "${HOME}/.config/opencode" "opencode.json" "${HOME}/.config/opencode/plugins/skill-finder" 1
register_platform "claude"   "Claude Code" "${HOME}/.claude"          "claude.json"   "${HOME}/.claude/plugins/skill-finder"         2
register_platform "cursor"   "Cursor"      "${HOME}/.cursor"          "opencode.json" "${HOME}/.cursor/extensions/skill-finder"      3

PLATFORM_IDS=("opencode" "claude" "cursor")

# ─── Utility Functions ───────────────────────────────────────────────────────

info()  { printf "\033[36m%s\033[0m\n" "• $1"; }
ok()    { printf "\033[32m✓\033[0m %s\n" "$1"; }
warn()  { printf "\033[33m⚠\033[0m %s\n" "$1" >&2; }
error() { printf "\033[31m✗\033[0m %s\n" "$1" >&2; exit 1; }

# ─── Platform Detection Functions ────────────────────────────────────────────

# Probe common directories for each platform; returns space-separated IDs
detect_platforms() {
  local detected=()
  if [ -d "${HOME}/.opencode/skills" ] || [ -d "${HOME}/.opencode" ]; then
    detected+=("opencode")
  fi
  if [ -d "${HOME}/.claude/skills" ] || [ -d "${HOME}/.claude" ]; then
    detected+=("claude")
  fi
  if [ -d "${HOME}/.cursor/skills" ] || [ -d "${HOME}/.cursor" ]; then
    detected+=("cursor")
  fi
  echo "${detected[@]}"
}

# Set SELECTED_* globals from a platform ID
select_platform_by_id() {
  local id="$1"
  SELECTED_PLATFORM="$id"
  SELECTED_PROFILE_NAME="${PLATFORM_PROFILES_NAMES[$id]}"
  SELECTED_CONFIG_DIR="${PLATFORM_PROFILES_DIRS[$id]}"
  SELECTED_CONFIG_FILE="${PLATFORM_PROFILES_FILES[$id]}"
  SELECTED_PLUGIN_DIR="${PLATFORM_PROFILES_PLUGIN_DIRS[$id]}"
}

# Interactive menu — display on stderr, echo platform ID to stdout
select_platform() {
  local prompt="$1"
  local i=1
  for id in "${PLATFORM_IDS[@]}"; do
    printf "    %d) %s\n" "$i" "${PLATFORM_PROFILES_NAMES[$id]}" >&2
    i=$((i + 1))
  done
  local choice
  read -t 30 -p "  $prompt " choice
  if [ -z "$choice" ]; then
    echo ""
    return 1
  fi
  echo "${PLATFORM_IDS[$((choice - 1))]}"
}

# Main platform resolution — sets SELECTED_* globals
resolve_platform() {
  SELECTED_PLATFORM=""
  SELECTED_PROFILE_NAME=""
  SELECTED_CONFIG_DIR=""
  SELECTED_CONFIG_FILE=""
  SELECTED_PLUGIN_DIR=""

  if [ -n "$INSTALL_TARGET" ]; then
    # Validate explicit --install-target / -t value
    local found=0
    for id in "${PLATFORM_IDS[@]}"; do
      if [ "$id" = "$INSTALL_TARGET" ]; then
        found=1
        select_platform_by_id "$id"
        break
      fi
    done
    if [ $found -eq 0 ]; then
      error "Unsupported platform: $INSTALL_TARGET. Supported: ${PLATFORM_IDS[*]}"
    fi
    ok "Platform: $SELECTED_PROFILE_NAME"

  elif [ ! -t 0 ]; then
    # Non-interactive (pipe context): auto-detect, fallback to OpenCode
    local detected
    detected=($(detect_platforms))
    if [ ${#detected[@]} -gt 0 ]; then
      select_platform_by_id "${detected[0]}"
      ok "Auto-detected: $SELECTED_PROFILE_NAME (non-interactive mode)"
    else
      select_platform_by_id "opencode"
      ok "Defaulting to OpenCode (non-interactive mode, no platform detected)"
    fi

  else
    # Interactive mode
    local detected
    detected=($(detect_platforms))
    if [ ${#detected[@]} -eq 0 ]; then
      echo ""
      info "No platform detected. Select a target platform:"
      local choice
      choice=$(select_platform "Enter number (1-3):")
      if [ -z "$choice" ]; then
        error "No platform selected. Installation cancelled."
      fi
      select_platform_by_id "$choice"

    elif [ ${#detected[@]} -eq 1 ]; then
      local id="${detected[0]}"
      echo ""
      read -t 30 -p "  Detected ${PLATFORM_PROFILES_NAMES[$id]}. Install SkillFinder for ${PLATFORM_PROFILES_NAMES[$id]}? [Y/n/s]: " confirm
      case "$confirm" in
        [nN]*) error "Installation cancelled." ;;
        [sS]*)
          local choice
          choice=$(select_platform "Enter number (1-3):")
          [ -z "$choice" ] && error "No platform selected."
          select_platform_by_id "$choice"
          ;;
        *) select_platform_by_id "$id" ;;
      esac

    else
      echo ""
      info "Multiple platforms detected:"
      local choice
      choice=$(select_platform "Choose a platform (1-3):")
      [ -z "$choice" ] && error "No platform selected."
      select_platform_by_id "$choice"
    fi
    ok "Selected platform: $SELECTED_PROFILE_NAME"
  fi
}

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

# ─── Step 1.5: Platform Detection ────────────────────────────────────────────

info "Detecting platform..."
resolve_platform

# ─── Step 2: Determine Paths ──────────────────────────────────────────────────

CONFIG_DIR="$SELECTED_CONFIG_DIR"
PLUGIN_DIR="$SELECTED_PLUGIN_DIR"
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

# ─── Step 6: Register in config file ─────────────────────────────────────────

info "Registering in ${SELECTED_CONFIG_FILE}..."

mkdir -p "$CONFIG_DIR"
CONFIG_FILE="${CONFIG_DIR}/${SELECTED_CONFIG_FILE}"

if [ -f "$CONFIG_FILE" ]; then
  # Check if already registered
  if grep -q '"skill-finder"' "$CONFIG_FILE" 2>/dev/null; then
    ok "Already registered in ${SELECTED_CONFIG_FILE}"
  else
    # Use temporary Node.js one-liner to modify JSON
    if [ "$SELECTED_PLATFORM" = "claude" ]; then
      node -e "
        const fs = require('fs');
        const path = '$CONFIG_FILE';
        let cfg = JSON.parse(fs.readFileSync(path, 'utf-8'));
        if (!Array.isArray(cfg.plugins)) cfg.plugins = [];
        if (!cfg.plugins.includes('skill-finder')) cfg.plugins.push('skill-finder');
        fs.writeFileSync(path, JSON.stringify(cfg, null, 2));
      "
    else
      node -e "
        const fs = require('fs');
        const path = '$CONFIG_FILE';
        let cfg = JSON.parse(fs.readFileSync(path, 'utf-8'));
        if (!Array.isArray(cfg.plugin)) cfg.plugin = [];
        if (!cfg.plugin.includes('skill-finder')) cfg.plugin.push('skill-finder');
        fs.writeFileSync(path, JSON.stringify(cfg, null, 2));
      "
    fi
    ok "Registered in ${SELECTED_CONFIG_FILE}"
  fi
else
  if [ "$SELECTED_PLATFORM" = "claude" ]; then
    echo '{ "plugins": ["skill-finder"] }' > "$CONFIG_FILE"
  else
    echo '{ "plugin": ["skill-finder"] }' > "$CONFIG_FILE"
  fi
  ok "Created ${SELECTED_CONFIG_FILE} with skill-finder"
fi

# ─── Step 7: Inject into AGENTS.md ───────────────────────────────────────────

info "Updating AGENTS.md..."

AGENTS_FILE="${SELECTED_CONFIG_DIR}/AGENTS.md"

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
printf "║  Platform:  %-38s║\n" "$SELECTED_PROFILE_NAME"
printf "║  Location:  %-38s║\n" "$PLUGIN_DIR"
printf "║  Config:    %-38s║\n" "$CONFIG_FILE"
printf "║  AGENTS.md: %-38s║\n" "$AGENTS_FILE"
printf "╠══════════════════════════════════════════════════════╣\n"
printf "║  Next step: Restart your agent to activate plugin   ║\n"
printf "╚══════════════════════════════════════════════════════╝\n"
