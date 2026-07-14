# Roadmap

SkillFinder development milestones and future plans.

## v1.0.0 (Released)

- Initial plugin release
- 7 marketplace registry (LobeHub, Skills.sh, AgentSkills.sh, SkillsMP, MCP Servers, AwesomeSkill, ClawHub)
- 5 tool stubs (search, install, list, remove, info)
- FTS5 local cache
- Auto-recommendation engine
- Plugin hooks for OpenCode

## v1.1.0 (Released)

- Real marketplace adapters:
  - LobeHub adapter (wraps @lobehub/market-cli)
  - Skills.sh adapter (REST API)
  - AgentSkills.sh adapter (graceful fallback — API not yet public)
- 5 real tool implementations returning markdown:
  - search: aggregates across all marketplaces
  - install: delegates to adapter
  - list: scans local filesystem
  - remove: deletes from local filesystem
  - info: fetches skill details
- ROADMAP.md documentation

## v2.0.0 (Released)

- Intent-Based Search with automatic category expansion
- Trust Scoring (A-F grade) with deep security analysis
- Version Locking with semver ranges and changelog tracking
- Dynamic Agent Targets for custom install directories
- Plan Sharing — export/import skill collections as JSON
- Multi-marketplace aggregator with dedup and quality scoring
- Cross-platform installers (npm, PowerShell, bash, bun, pnpm, yarn)

## v2.1.0 (Released)

- **Security Hardening**: All 5 marketplace adapters migrated from `execSync` to `spawnSync` + arg arrays
- **Input Validation**: New `safe-slug.ts` module with allowlist regex for slug, owner, and source
- **Platform Selection**: Interactive platform detection for OpenCode/Claude Code/Cursor installers
- Zero `execSync` remaining in adapter layer

## v2.1.1 (Released)

- **Major Dependency Updates**: TypeScript 5.9→7.0, Vitest 3.2→4.1, better-sqlite3 11→12, @types/node 22→26
- **Explicit zod dependency**: Pinned zod@4.1.8 as direct dependency for plugin type compatibility
- **GitHub Releases**: Created missing GitHub Releases for v2.0.0 and v2.1.0
- **Test fixes**: Vitest v4 mock isolation compatibility in hooks test

## v2.2.0 (Released)

- **CLI**: Full command-line interface with 8 commands (search, install, list, info, remove, check-updates, plan, mcp) — custom arg parser, `--help` per command
- **Auto-Recommendation Improvements**: Trust grade filtering, cross-source dedup, in-memory feedback (accept/dismiss), adaptive throttle
- **New Marketplace**: Hugging Face models adapter (discovery-only)
- **Error Handling**: SkillFinderError class with typed error codes, exponential backoff with jitter for retries, logging in all catch blocks
- **Programmatic API**: SkillFinderAPI class with 7 methods, exported as `opencode-skill-finder/api`
- **Tests**: 789 total tests passing, 0 failures

## v2.3.0 (Released)

- **Skill Usage Indicator**: Chat displays skill name, marketplace, and trust grade when agent reads a skill file via `tool.execute.after` hook
- **Trust Grade Persistence**: Trust grades computed at install time and stored in lockfile (`trustGrade` optional field in `LockMetadata` + `LockedSkill`)
- **SkillUsageTracker**: New class for detecting installed skill file reads with cached path mapping and session-scoped deduplication
