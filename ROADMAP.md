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

## v2.2.0 (Planned)

- CLI implementation (currently throws "Not implemented")
- Auto-recommendation improvements
- Marketplace coverage expansion
- Better error handling and retries
- API for 3rd-party integrations
