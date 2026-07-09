# SkillFinder

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-green.svg)](https://opencode.ai)
[![npm version](https://img.shields.io/npm/v/opencode-skill-finder.svg)](https://www.npmjs.com/package/opencode-skill-finder)

> **OpenCode plugin that watches your task context, searches 7 skill marketplaces, caches locally with FTS5, and auto-recommends relevant skills.**

## Quick Install

Choose the method that fits your setup:

### npm (recommended)

Best for **all users** with Node.js installed. Universal and easy to update.

```bash
npm install -g opencode-skill-finder
```

### One-liner (PowerShell)

Best for **Windows users** who want a quick install without Node.js.

```powershell
iwr -useb https://raw.githubusercontent.com/brain-orch/skill-finder/main/install.ps1 | iex
```

### One-liner (bash)

Best for **Linux/macOS users** who want a quick install without Node.js.

```bash
curl -fsSL https://raw.githubusercontent.com/brain-orch/skill-finder/main/install.sh | sh
```

### bun

Best for **Bun users** who prefer an alternative Node.js runtime.

```bash
bun install -g opencode-skill-finder
```

### pnpm

Best for **pnpm users** who want faster installs with efficient disk usage.

```bash
pnpm add -g opencode-skill-finder
```

### yarn

Best for **Yarn Classic users** already familiar with the Yarn ecosystem.

```bash
yarn global add opencode-skill-finder
```

### Manual Install

Best for **developers / contributors** who want to modify the source code or contribute to the repository.

```bash
git clone https://github.com/brain-orch/skill-finder.git
cd skill-finder
npm install
npm run build
npm run postinstall
```

## Upgrade

How to update SkillFinder to the latest version:

| Install Method | Upgrade Command |
|----------------|----------------|
| npm | `npm update -g opencode-skill-finder` |
| bun | `bun update -g opencode-skill-finder` |
| pnpm | `pnpm update -g opencode-skill-finder` |
| yarn | `yarn global upgrade opencode-skill-finder` |
| PowerShell one-liner | Re-run the install script |
| bash one-liner | Re-run the install script |
| Manual | `git pull && npm install && npm run build` |

## What It Does

SkillFinder enhances your OpenCode experience by:

1. **Intent-Based Search** — Parses natural language queries with category expansion and scanner-aware context
2. **Trust Scoring** — A-F trust grades with deep security analysis and visible badges
3. **Version Management** — Lockfile version pinning, changelog tracking, smart update notifications
4. **Multi-Marketplace Aggregation** — Searches 7 marketplaces with dedup and category grouping
5. **Plan Sharing** — Export/import skill collections as JSON with local plan registry

## Features (v2.0.0)

- **Quality Score** — Each skill scored 0.0 to 1.0 based on stars (35%), install count (35%), description quality (15%), and source reputation (15%). Source reputation tiers: official (1.0), verified (0.8), community (0.5), unknown (0.3).
- **Security Validation** — Skill content is validated before installation for shell injection patterns (curl pipe to shell, backtick execution, command substitution), path traversal, base64-encoded payloads, and eval/exec patterns.
- **Quality Score Display** — Each search result displays a quality score percentage alongside relevance, letting you quickly gauge skill reliability at a glance.
- **Intent-Based Search** — Natural language queries parsed into structured search with automatic category expansion. Search understands "pdf extract text" → searches pdf-processing + document categories with synonyms.
- **Scanner-Aware Search** — Detected project stacks (React, Prisma, etc.) are automatically fed as expanded search queries for contextually relevant results.
- **Cross-Marketplace Aggregator** — Results from all 7 marketplaces are deduplicated and grouped by category, keeping the highest-quality skill per name.
- **Trust Score (A-F Grade)** — Each skill gets a trust grade: A (Trusted), B (Reliable), C (Caution), D/F (Review Required). Formula: security audit 40% + quality score 30% + source reputation 20% + verified badge 10%.
- **Security Auditor** — Deep static analysis with numeric score (0-100) and severity rating. Checks: shell injection, path traversal, base64 payloads, obfuscated URLs.
- **Trust & Security Badges** — Search results display trust grade + security badges at a glance. "✅ Fully Trusted" when grade A + security clean.
- **Version Locking** — Lockfile enhanced with version pinning, semver ranges, and dependency tracking. Backward compatible with existing lockfiles.
- **Changelog Tracker** — Tracks skill version changes with breaking change detection. Stored in `.opencode/skill-finder-changelog.json`.
- **Smart Update System** — `checkAll()` scans locked skills for updates with breaking change warnings. Configurable auto-check via `updateCheck` setting.
- **Dynamic Agent Targets** — Configure custom install directories via `opencode.json`. Supports any agent directory, overrides built-in targets.
- **Agent Detection** — `--detect` flag probes common agent directories (`.opencode/skills`, `.claude/skills`, `.cursor/skills`, `.windsurf/skills`, `.github/agents`).
- **Plan Sharing** — Export/import skill plans as JSON via `export-plan` and `import-plan` tools. Plan registry at `.opencode/skill-finder-plans/` with `list-plans` tool.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        SkillFinder v2.0                          │
├──────────────────────────────────────────────────────────────────┤
│  Intent Parser → Search Aggregator → Trust Scorer → Marketplaces │
│       ↑                    ↕                          ↓          │
│  Scanner───────────→ Changelog Tracker ←────────── Cache/Lock    │
│       ↓                                                          │
│  Plan Registry ───→ Plan Serializer ───→ Share/Export            │
└──────────────────────────────────────────────────────────────────┘
```

## Configuration

### Plugin Options (per-project)

Edit `.opencode/opencode.json`:

```json
{
  "plugins": {
    "skill-finder": {
      "config": {
        "autoRecommend": true,
        "maxRecommendations": 5,
        "searchTimeoutMs": 15000,
        "marketplaces": [
          "lobehub",
          "skillssh",
          "agentskillsh",
          "skillsmp",
          "mcpservers",
          "awesomeskill",
          "clawhub"
        ]
      }
    }
  }
}
```

### Global Options

Edit `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["skill-finder"],
  "skill-finder": {
    "searchTimeoutMs": 10000,
    "retryCount": 3
  }
}
```

### Configuration Table

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoRecommend` | boolean | `true` | Automatically recommend skills based on context |
| `maxRecommendations` | number | `3` | Maximum skills to recommend per detection |
| `searchTimeoutMs` | number | `15000` | Timeout for marketplace searches |
| `marketplaces` | string[] | all 7 | Enabled marketplaces |
| `retryCount` | number | `2` | Retry count for failed searches |
| `retryBackoffMs` | number | `1000` | Exponential backoff base |
| `agentTargets` | object | `{}` | Custom agent install targets (name → path mappings) |
| `updateCheck.enabled` | boolean | `true` | Enable automatic update checking |
| `updateCheck.intervalHours` | number | `24` | Hours between update checks |

## Usage

### Automatic Mode

SkillFinder works automatically in the background. When it detects a task category, it searches marketplaces and presents recommendations.

### Manual Tools

Use these tools anytime:

- **Search for skills:**
  ```
  skill-finder_search query="pdf extract text"
  ```

- **Install a skill:**
  ```
  skill-finder_install identifier="lobehub:pdf-tools" marketplace="lobehub"
  ```

- **List cached skills:**
  ```
  skill-finder_list
  ```

- **Get skill info:**
  ```
  skill-finder_info identifier="lobehub:pdf-tools"
  ```

- **Remove a skill:**
  ```
  skill-finder_remove identifier="lobehub:pdf-tools"
  ```

- **Export a plan:**
  ```
  skill-finder_export-plan key="my-stack"
  ```

- **Import a plan:**
  ```
  skill-finder_import-plan json='{...}'
  ```

- **List saved plans:**
  ```
  skill-finder_list-plans
  ```

## Marketplaces

| Marketplace | URL | Status |
|-------------|-----|--------|
| LobeHub Skills | https://lobehub.com/skills | ✅ Active |
| Skills.sh | https://skills.sh | ✅ Active |
| AgentSkills.sh | https://agentskill.sh | ✅ Active |
| SkillsMP | https://skillsmp.com | ✅ Active |
| ClawHub | https://clawhub.ai | ✅ Active |
| MCP Servers | https://registry.modelcontextprotocol.io | ✅ Active |
| AwesomeSkill | https://awesomeskill.ai | ✅ Active |

## Development

### Prerequisites

- Node.js 18+
- npm or bun

### Setup

```bash
git clone https://github.com/brain-orch/skill-finder.git
cd skill-finder
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Type Check

```bash
npm run typecheck
```

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built for the [OpenCode](https://opencode.ai) ecosystem
- Inspired by the need for better skill discovery in AI-assisted development
