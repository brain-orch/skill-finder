# Roadmap

SkillFinder development milestones and future plans.

## v1.0.0 (Released)

- Initial plugin release
- 7 marketplace registry (LobeHub, Skills.sh, AgentSkills.sh, SkillsMP, MCP Servers, AwesomeSkill, ClawHub)
- 5 tool stubs (search, install, list, remove, info)
- FTS5 local cache
- Auto-recommendation engine
- Plugin hooks for OpenCode

## v1.1.0 (In Development)

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

## v1.2.0 (Planned)

- CLI implementation (currently throws "Not implemented")
- Auto-recommendation improvements
- Marketplace coverage expansion (SkillsMP, MCP Servers, AwesomeSkill, ClawHub)
- Better error handling and retries

## v2.0.0 (Future)

- API for 3rd-party integrations
- Advanced caching with invalidation
- Web UI dashboard for skill management
- Multi-agent skill sharing
