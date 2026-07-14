# Changelog

## [2.3.0] - 2026-07-14

### Features
- **feat(plugin)**: Skill usage indicator — displays skill name, marketplace, and trust grade in chat when agent reads a skill file (e.g., "📖 Using skill: pdf-tools (lobehub · Trust Grade A)")
- **feat(cache)**: Added optional `trustGrade` field to `LockMetadata` and `LockedSkill` interfaces for storing trust grade in lockfile
- **feat(install)**: Trust grade now computed and stored during skill installation via `TrustScorer.score()` with graceful fallback on failure
- **feat(plugin)**: New `SkillUsageTracker` class — loads lockfile, builds cached path map, detects skill file reads, formats display string
- **feat(plugin)**: New `onToolExecuteAfter` hook — detects `read` tool calls to skill files, sets output title with skill info, deduplicates per session

## [2.2.1] - 2026-07-10

### Chore
- **chore(readme)**: Add Patreon donation badge and Support section

## [2.2.0] - 2026-07-10

### Features
- **feat(cli)**: Full CLI with 8 commands (search, install, list, info, remove, check-updates, plan, mcp) — custom arg parser, zero new dependencies
- **feat(cli)**: Windows-compatible entry point using `pathToFileURL` from `node:url`
- **feat(recommender)**: Trust grade filtering (min grade "C" default) — filters out low-trust skills from recommendations
- **feat(recommender)**: Cross-source deduplication — same skill from multiple marketplaces appears only once
- **feat(recommender)**: In-memory feedback tracking — acceptSkill()/dismissSkill() with session-scoped Sets
- **feat(recommender)**: Adaptive throttle — faster recommendations when user accepts, slower when dismissing
- **feat(marketplace)**: Hugging Face models adapter (discovery-only — models are not installable skills)
- **feat(error)**: SkillFinderError class with typed error codes (NETWORK, API, VALIDATION, TIMEOUT, NOT_FOUND, INSTALL_FAILED)
- **feat(error)**: Exponential backoff with ±20% jitter for marketplace search retries
- **feat(api)**: SkillFinderAPI programmatic class with 7 methods (search, install, list, info, remove, checkUpdates, plan)
- **feat(api)**: Exported as `opencode-skill-finder/api` via package.json exports

### Fixes
- **fix(error)**: Add logging to all empty catch blocks across 7 marketplace adapters and tools
- **fix(api)**: Use `os.tmpdir()` + `path.join()` instead of hardcoded `/tmp/` for cross-platform compatibility

### Tests
- **test(cli)**: 47 CLI command tests covering all 8 commands with happy + failure paths
- **test(recommender)**: 42 tests for adaptive throttle, trust filtering, dedup, and feedback
- **test(marketplace)**: 22 Hugging Face adapter tests
- **test(error)**: 7 SkillFinderError + retry wiring tests
- **test(api)**: 29 SkillFinderAPI class tests

### Chore
- **chore(deps)**: Zero new npm dependencies — all v2.2.0 features built on existing internals
- **chore(api)**: Package exports updated with `"./api"` entry and types

## [2.1.1] - 2026-07-10

### Chore
- **chore(deps)**: Update all major dependencies — TypeScript v7.0.2, Vitest v4.1.10, better-sqlite3 v12.11.1, @types/node v26.1.1, @opencode-ai/plugin v1.17.18
- **chore(deps)**: Add `zod@4.1.8` as explicit direct dependency (pinned to match plugin version)
- **chore(release)**: Create GitHub Releases for v2.0.0 and v2.1.0 (git tags existed but releases were missing)

### Fixes
- **fix(test)**: Add `vi.clearAllMocks()` to hooks test beforeEach for Vitest v4 mock isolation compatibility

## [2.1.0] - 2025-07-10

### Security
- **security(adapters)**: Replace execSync with spawnSync + arg arrays in all 5 marketplace adapters — eliminates shell interpreter, prevents command injection
- **security(safe-slug)**: Add shared input sanitizer module (`src/safe-slug.ts`) with allowlist regex validation for slug, owner, and source parameters — prevents path traversal and shell injection from untrusted input
- **security(harden)**: Validate slug before `path.join` in LobeHub, SkillsMP, AgentSkillSh, SkillsSh, ClawHub adapters — three-layer defense (regex → spawnSync → path validation)

### Features
- **feat(install)**: Add interactive platform selection to postinstall.mjs, install.ps1, and shared platform-profiles module
- **feat(install)**: Auto-detect OpenCode/Claude Code/Cursor with numbered menu fallback

### Tests
- **test(safe-slug)**: 24 tests for validateSlug + validateOwner covering edge cases, boundary values, unicode, and known-bad patterns
- **test(adapters)**: Add install-path tests for all 5 hardened adapters

### Chore
- **chore**: Zero `execSync` remaining in `src/registry/adapters/` — all 7 adapters now use safe execution

## [2.0.0] - 2025-07-09

### Features
- **feat**: 5-wave upgrade — Intent Search, Trust Score, Version Locking, Dynamic Targets, Plan Sharing
- **feat(core)**: Wire plugin registration for scanner, check-updates, and plan tools
- **feat(composer)**: Add skill plan composer with 5 known stack plans
- **feat(install)**: Add multi-agent install with auto-detect and lockfile integration
- **feat(scanner)**: Add proactive project scanner with 36-stack detection
- **feat(cache)**: Add skill lockfile with SHA-256 hashing
- **feat(mcp)**: Implement stdio MCP server with 4 tools
- **feat(search)**: Add BM25 semantic search with field-weighted FTS5 ranking
- **feat(ranker)**: Cross-marketplace dedup with quality score tiebreak

### Documentation
- **docs**: Update README with quality score, security validation, and search display
- **docs**: Document interactive platform selection install flow

## [1.1.0] - 2025-07-08

### Features
- **feat(tools)**: Replace stubs with real implementations for info, install, list, remove
- **feat(scoring)**: Add quality score engine with normalized signal aggregation
- **feat(validation)**: Add SKILL.md content security validator with hooks
- **feat(detector)**: Add weighted keyword expansion with 8 new category entries
- **feat(ranker)**: Integrate quality score into search relevance ranking
- **feat(recommender,search)**: Integrate quality score into recommendations and search UI

### Fixes
- **fix**: Reject unsafe skill names
- **fix(agentskillsh)**: Replace stub with real API — domain is agentskill.sh not agentskills.sh

### Documentation
- **docs**: Add user profile guidance for each install method
- **docs**: Use English for install method descriptions (global audience)
- **docs**: Add Upgrade section with commands per install method

### Chore
- **chore**: Add .codegraph/.omo to gitignore, update README with published npm
- **chore**: Update .gitignore for production and fix README stale defaults
- **chore**: Add project scaffolding with all 7 marketplace adapters

### Tests
- **test**: Update integration/simulation tests for validator and marketplace compatibility

### Initial
- **Initial commit**: SkillFinder - OpenCode plugin for skill discovery and recommendation

## [1.0.0] - 2025-06-01

### Initial
- **Initial commit**: SkillFinder - OpenCode plugin for skill discovery and recommendation