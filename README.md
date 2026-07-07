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

1. **Context Detection** — Watches your messages, tool calls, and file extensions to understand what you're working on
2. **Marketplace Search** — Searches 7 skill marketplaces in parallel for relevant tools
3. **Local Caching** — Stores skills locally with FTS5 full-text search indexing
4. **Auto-Recommendation** — Proactively suggests skills when it detects task categories like PDF processing, git workflows, database operations, etc.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SkillFinder Plugin                        │
├─────────────────────────────────────────────────────────────┤
│  Task Detector → Recommender → Marketplace Registry → Cache │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐           ┌────▼────┐           ┌────▼────┐
   │ LobeHub │           │Skills.sh│           │ ... 5   │
   │  Skills │           │         │           │  more   │
   └─────────┘           └─────────┘           └─────────┘
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
| `maxRecommendations` | number | `5` | Maximum skills to recommend per detection |
| `searchTimeoutMs` | number | `15000` | Timeout for marketplace searches |
| `marketplaces` | string[] | all 7 | Enabled marketplaces |
| `retryCount` | number | `2` | Retry count for failed searches |
| `retryBackoffMs` | number | `1000` | Exponential backoff base |

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

## Marketplaces

| Marketplace | URL | Status |
|-------------|-----|--------|
| LobeHub Skills | https://lobehub.com/skills | ✅ Active |
| Skills.sh | https://skills.sh | ✅ Active |
| AgentSkills.sh | https://agentskills.sh | ✅ Active |
| SkillsMP | https://skillsmp.com | ✅ Active |
| MCP Servers | https://mcpservers.ai | ✅ Active |
| AwesomeSkill | https://awesomeskill.io | ✅ Active |
| ClawHub | https://clawhub.dev | ✅ Active |

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
