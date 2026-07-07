#!/usr/bin/env pwsh
<#
.SYNOPSIS
    One-click installer for SkillFinder OpenCode Plugin
.DESCRIPTION
    Installs the SkillFinder plugin globally in OpenCode's config directory.
    Registers the plugin in opencode.json and injects instructions into AGENTS.md.
.LINK
    https://github.com/brainorch/skill-finder
.EXAMPLE
    iwr -useb https://raw.githubusercontent.com/brainorch/skill-finder/main/install.ps1 | iex
#>

#Requires -Version 7.0

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# ============================================================================
# Constants
# ============================================================================
$REPO_URL = "https://github.com/brainorch/skill-finder"
$ZIP_URL  = "https://github.com/brainorch/skill-finder/archive/refs/heads/main.zip"
$GITHUB_RAW = "https://raw.githubusercontent.com/brainorch/skill-finder/main"

$AGENTS_BLOCK = @'
<!-- skill-finder -->
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
<!-- /skill-finder -->
'@

# ============================================================================
# Helper Functions
# ============================================================================
function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "    [OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "    [WARN] $Message" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host "    [ERROR] $Message" -ForegroundColor Red
}

# ============================================================================
# Step 1: Check Prerequisites
# ============================================================================
Write-Step "Checking prerequisites..."

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Fail "Node.js is not installed or not in PATH."
    Write-Host ""
    Write-Host "  Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "  (LTS version recommended)" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

$nodeVersion = & node --version 2>$null
Write-Success "Node.js found: $nodeVersion"

$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    Write-Fail "npm is not installed or not in PATH."
    Write-Host "  npm usually ships with Node.js. Please reinstall Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
Write-Success "npm found"

# ============================================================================
# Step 2: Determine Install Paths
# ============================================================================
Write-Step "Determining install paths..."

$configDir = Join-Path $env:USERPROFILE ".config\opencode"
$pluginDir = Join-Path $configDir "plugins\skill-finder"
$distDir   = Join-Path $pluginDir "dist"

Write-Success "Config dir:  $configDir"
Write-Success "Plugin dir:  $pluginDir"
Write-Success "Dist dir:    $distDir"

# ============================================================================
# Step 3: Detect Installation Method
# ============================================================================
Write-Step "Detecting installation method..."

# When invoked via `iwr | iex`, the script content is evaluated directly.
# $PSScriptRoot will be empty in that case.
$isLocal = $false
$scriptDir = $PSScriptRoot

if ($scriptDir -and $scriptDir.Length -gt 0) {
    # Script is being run from a file on disk — check if we're in a checkout
    $possiblePkg = Join-Path (Split-Path $scriptDir -Parent) "package.json"
    if (Test-Path $possiblePkg) {
        $isLocal = $true
        Write-Success "Detected local checkout at: $scriptDir"
    }
}

if (-not $isLocal) {
    Write-Success "Detected remote install (piped via iwr | iex) — will download from GitHub"
}

# ============================================================================
# Step 4: Get Plugin Files
# ============================================================================
Write-Step "Obtaining plugin files..."

# Clean previous installation if present
if (Test-Path $pluginDir) {
    Write-Warn "Existing plugin directory found — removing..."
    Remove-Item -Path $pluginDir -Recurse -Force
}

if ($isLocal) {
    # -------------------------------------------------------------------
    # Local install: copy from checkout
    # -------------------------------------------------------------------
    $sourceRoot = Split-Path $scriptDir -Parent

    Write-Success "Copying from local checkout: $sourceRoot"

    # Create plugin directory
    New-Item -ItemType Directory -Path $pluginDir -Force | Out-Null

    # Copy essential files and directories
    $itemsToCopy = @(
        "package.json",
        "tsconfig.json",
        "README.md",
        "src",
        "dist"
    )

    foreach ($item in $itemsToCopy) {
        $srcItem = Join-Path $sourceRoot $item
        $dstItem = Join-Path $pluginDir $item
        if (Test-Path $srcItem) {
            if ((Get-Item $srcItem).PSIsContainer) {
                Copy-Item -Path $srcItem -Destination $dstItem -Recurse -Force
            } else {
                Copy-Item -Path $srcItem -Destination $dstItem -Force
            }
            Write-Success "Copied: $item"
        }
    }
} else {
    # -------------------------------------------------------------------
    # Remote install: download from GitHub
    # -------------------------------------------------------------------
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "skill-finder-install-$(Get-Random)"

    try {
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
        Write-Success "Downloading ZIP from GitHub..."

        $zipPath = Join-Path $tempDir "skill-finder.zip"
        Invoke-WebRequest -Uri $ZIP_URL -OutFile $zipPath -UseBasicParsing

        Write-Success "Extracting ZIP..."
        Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force

        # The ZIP extracts to skill-finder-main/
        $extractedDir = Join-Path $tempDir "skill-finder-main"
        if (-not (Test-Path $extractedDir)) {
            # Fallback: look for any directory that contains package.json
            $extractedDir = Get-ChildItem -Path $tempDir -Directory |
                Where-Object { Test-Path (Join-Path $_.FullName "package.json") } |
                Select-Object -First 1 -ExpandProperty FullName
        }

        if (-not $extractedDir -or -not (Test-Path $extractedDir)) {
            Write-Fail "Failed to extract plugin files from ZIP."
            exit 1
        }

        Write-Success "Copying files to plugin directory..."
        New-Item -ItemType Directory -Path $pluginDir -Force | Out-Null

        # Copy all items from extracted directory
        Copy-Item -Path (Join-Path $extractedDir "*") -Destination $pluginDir -Recurse -Force

        Write-Success "Plugin files installed to: $pluginDir"
    } catch {
        Write-Fail "Failed to download or extract plugin: $_"
        exit 1
    } finally {
        # Cleanup temp directory
        if (Test-Path $tempDir) {
            Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

# ============================================================================
# Step 5: Install Dependencies
# ============================================================================
Write-Step "Installing npm dependencies..."

Push-Location $pluginDir
try {
    Write-Success "Running: npm install --production"
    npm install --production 2>&1 | ForEach-Object { Write-Host "    $_" }
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm install failed with exit code $LASTEXITCODE"
        exit 1
    }
    Write-Success "Dependencies installed"

    if (Test-Path (Join-Path $pluginDir "src")) {
        Write-Success "Running: npm run build"
        npm run build 2>&1 | ForEach-Object { Write-Host "    $_" }
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "npm run build failed with exit code $LASTEXITCODE"
            exit 1
        }
        Write-Success "Build completed"
    } else {
        Write-Success "No src directory — skipping build (pre-built dist expected)"
    }
} catch {
    Write-Fail "Failed to install dependencies: $_"
    exit 1
} finally {
    Pop-Location
}

# ============================================================================
# Step 6: Register in opencode.json
# ============================================================================
Write-Step "Registering plugin in opencode.json..."

$opencodeJsonPath = Join-Path $configDir "opencode.json"
$configObj = $null

if (Test-Path $opencodeJsonPath) {
    try {
        $rawJson = Get-Content -Path $opencodeJsonPath -Raw
        $configObj = $rawJson | ConvertFrom-Json
        Write-Success "Read existing opencode.json"
    } catch {
        Write-Warn "Could not parse opencode.json — will create a new one"
        $configObj = [PSCustomObject]@{}
    }
} else {
    $configObj = [PSCustomObject]@{}
    Write-Warn "opencode.json not found — will create a new one"
}

# Ensure plugin array exists
if (-not ($configObj.PSObject.Properties.Name -contains "plugin")) {
    $configObj | Add-Member -NotePropertyName "plugin" -NotePropertyValue @()
    Write-Success "Created 'plugin' array"
}

# Check if skill-finder is already registered
$pluginArray = @($configObj.plugin)
$isRegistered = $false
foreach ($p in $pluginArray) {
    if ($p -eq "skill-finder") {
        $isRegistered = $true
        break
    }
}

if (-not $isRegistered) {
    $pluginArray += "skill-finder"
    $configObj.plugin = $pluginArray
    Write-Success "Added 'skill-finder' to plugin array"
} else {
    Write-Success "'skill-finder' already registered"
}

# Write back — ensure config directory exists
New-Item -ItemType Directory -Path $configDir -Force | Out-Null
$configObj | ConvertTo-Json -Depth 10 | Set-Content -Path $opencodeJsonPath -Encoding UTF8
Write-Success "Saved opencode.json"

# ============================================================================
# Step 7: Inject into AGENTS.md
# ============================================================================
Write-Step "Updating AGENTS.md..."

$agentsMdPath = Join-Path $configDir "AGENTS.md"
$marker = "<!-- skill-finder -->"

if (Test-Path $agentsMdPath) {
    $agentsContent = Get-Content -Path $agentsMdPath -Raw

    if ($agentsContent -match [regex]::Escape($marker)) {
        Write-Success "AGENTS.md already contains skill-finder block — skipping"
    } else {
        # Append the block
        $newContent = $agentsContent.TrimEnd() + "`n`n" + $AGENTS_BLOCK + "`n"
        Set-Content -Path $agentsMdPath -Value $newContent -Encoding UTF8
        Write-Success "Appended skill-finder block to existing AGENTS.md"
    }
} else {
    # Create new file with just the block
    Set-Content -Path $agentsMdPath -Value ($AGENTS_BLOCK + "`n") -Encoding UTF8
    Write-Success "Created new AGENTS.md with skill-finder block"
}

# ============================================================================
# Step 8: Post-Install Summary
# ============================================================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  SkillFinder Plugin — Installation Complete!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Installed to:    $pluginDir"
Write-Host "  Config file:     $opencodeJsonPath"
Write-Host "  AGENTS.md:       $agentsMdPath"
Write-Host ""
Write-Host "  What was done:" -ForegroundColor Cyan
Write-Host "    [1] Plugin files downloaded and installed"
Write-Host "    [2] npm dependencies installed"
Write-Host "    [3] Plugin registered in opencode.json"
Write-Host "    [4] Instructions injected into AGENTS.md"
Write-Host ""
Write-Host "  Next step: Restart OpenCode to activate the plugin." -ForegroundColor Yellow
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
