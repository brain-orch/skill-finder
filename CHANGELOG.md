# Changelog

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