# Changelog

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