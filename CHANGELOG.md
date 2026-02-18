# Changelog

All notable changes to the Luxembourg Law MCP are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-16

### Added
- Initial release with 4,551 acts and ~36K provisions from Legilux
- 13 tools: `search_legislation`, `get_provision`, `validate_citation`, `build_legal_stance`, `format_citation`, `check_currency`, `get_eu_basis`, `get_luxembourg_implementations`, `search_eu_implementations`, `get_provision_eu_basis`, `validate_eu_compliance`, `list_sources`, `about`
- Dual transport: stdio (npm) + Streamable HTTP (Vercel)
- EU cross-reference index: 268 EU documents, 372 references
- FTS5 full-text search with BM25 ranking
- 19 golden contract tests
- 5 drift detection anchors
- 6-layer security scanning (CodeQL, Semgrep, Trivy, Gitleaks, Socket, OSSF)
- Daily data freshness checks against Legilux
- Nightly upstream drift detection
- MCP registry manifest (`server.json`)

### Data sources
- **Legilux** (https://legilux.public.lu) — SPARQL + Akoma Ntoso XML
- Schema version: 2
- Database: SQLite + FTS5 (~69 MB)
