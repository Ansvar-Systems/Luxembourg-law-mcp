# Luxembourg Law MCP Server

**The Legilux (Journal Officiel) alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fluxembourg-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/luxembourg-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/Luxembourg-law-mcp?style=social)](https://github.com/Ansvar-Systems/Luxembourg-law-mcp)
[![CI](https://github.com/Ansvar-Systems/Luxembourg-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/Luxembourg-law-mcp/actions/workflows/ci.yml)
[![Daily Data Check](https://github.com/Ansvar-Systems/Luxembourg-law-mcp/actions/workflows/check-updates.yml/badge.svg)](https://github.com/Ansvar-Systems/Luxembourg-law-mcp/actions/workflows/check-updates.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](docs/EU_INTEGRATION_GUIDE.md)
[![Provisions](https://img.shields.io/badge/provisions-36%2C014-blue)](docs/EU_INTEGRATION_GUIDE.md)

Query **4,551 Luxembourg statutes** — from the loi du 1er août 2018 (protection des données) and the Code pénal to the Code du travail, la loi sur les sociétés commerciales, and more — directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Luxembourg legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Luxembourg legal research is scattered across Legilux, the Journal Officiel du Grand-Duché de Luxembourg, EUR-Lex, and bilateral treaty collections. Whether you're:
- A **lawyer** validating citations in a brief, contract, or société anonyme filing
- A **compliance officer** checking GDPR obligations or CSSF regulatory requirements
- A **legal tech developer** building tools on Luxembourg law
- A **researcher** tracing legislative history from projet de loi to loi publiée

...you shouldn't need a dozen browser tabs and manual PDF cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Luxembourg law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version — zero dependencies, nothing to install.

**Endpoint:** `https://luxembourg-law-mcp.vercel.app/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add luxembourg-law --transport http https://luxembourg-law-mcp.vercel.app/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "luxembourg-law": {
      "type": "url",
      "url": "https://luxembourg-law-mcp.vercel.app/mcp"
    }
  }
}
```

**GitHub Copilot** — add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "luxembourg-law": {
      "type": "http",
      "url": "https://luxembourg-law-mcp.vercel.app/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/luxembourg-law-mcp
```

**Claude Desktop** — add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "luxembourg-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/luxembourg-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "luxembourg-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/luxembourg-law-mcp"]
    }
  }
}
```

## Example Queries

Once connected, just ask naturally (les requêtes fonctionnent en français ou en anglais):

- *"Que dit l'article 5 de la loi du 1er août 2018 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel ?"*
- *"Rechercher 'protection des données' dans la législation luxembourgeoise"*
- *"La loi du 2 août 2002 relative à la protection des personnes à l'égard du traitement des données à caractère personnel est-elle toujours en vigueur ?"*
- *"Quels articles du Code pénal concernent les infractions informatiques ?"*
- *"Quelles lois luxembourgeoises transposent la directive NIS2 ?"*
- *"Rechercher les dispositions sur le secret professionnel dans le Code du travail"*
- *"Validate the citation 'loi du 1er août 2018, art. 62'"*
- *"Which Luxembourg laws implement the GDPR?"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Statutes** | 4,551 lois | Comprehensive Luxembourg legislation from Legilux |
| **Provisions** | 36,014 articles | Full-text searchable with FTS5 |
| **Premium: Case law** | 260 judgments | Tribunal et Cour d'appel decisions |
| **Premium: Preparatory works** | 7 documents | Projets de loi and exposés des motifs |
| **Premium: Agency guidance** | 4,938 documents | CNPD, CSSF, and ministerial circulars |
| **Database Size** | ~69 MB | Optimized SQLite, portable |
| **Daily Updates** | Automated | Freshness checks against Legilux |

**Verified data only** — every citation is validated against official sources (Legilux / Journal Officiel). Zero LLM-generated content.

---

## Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from Legilux (legilux.public.lu) official sources
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing — the database contains regulation text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by loi date/number + article
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
Legilux API → Parse → SQLite → FTS5 snippet() → MCP response
                ↑                     ↑
         Provision parser       Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search Legilux by date de publication | Search by plain French: *"protection données consentement"* |
| Navigate multi-chapter statutes manually | Get the exact provision with context |
| Manual cross-referencing between lois | `build_legal_stance` aggregates across sources |
| "Cette loi est-elle toujours en vigueur ?" → check manually | `check_currency` tool → answer in seconds |
| Find EU basis → dig through EUR-Lex | `get_eu_basis` → linked EU directives instantly |
| No API, no integration | MCP protocol → AI-native |

**Traditional:** Search Legilux → Download PDF → Ctrl+F → Cross-reference with Journal Officiel → Check EUR-Lex → Repeat

**This MCP:** *"Quel est le fondement européen de l'article 5 de la loi du 1er août 2018 ?"* → Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 36,014 provisions with BM25 ranking. Supports quoted phrases, boolean operators, prefix wildcards |
| `get_provision` | Retrieve specific provision by statute reference + article number |
| `check_currency` | Check if a statute is in force, amended, or repealed |
| `validate_citation` | Validate citation against database — zero-hallucination check |
| `build_legal_stance` | Aggregate citations from multiple statutes for a legal topic |
| `format_citation` | Format citations per Luxembourg conventions (full/short/pinpoint) |
| `list_sources` | List all available statutes with metadata, coverage scope, and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### EU Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get EU directives/regulations underlying a Luxembourg statute |
| `get_luxembourg_implementations` | Find Luxembourg laws implementing a specific EU act |
| `search_eu_implementations` | Search EU documents with Luxembourg implementation counts |
| `get_provision_eu_basis` | Get EU law references for a specific provision |
| `validate_eu_compliance` | Check implementation status of Luxembourg statutes against EU directives |

---

## EU Law Integration

Luxembourg is an **EU member state** and EU founding member. Every major Luxembourg statute in data protection, financial regulation, and telecommunications has a direct EU basis. The EU bridge tools give you full bi-directional lookup.

| Metric | Value |
|--------|-------|
| **EU Member State** | Yes — founding member |
| **EU References** | Cross-references linking Luxembourg statutes to EU law |
| **Directives transposed** | GDPR, NIS2, DORA, AI Act, eIDAS, AML directives, and more |
| **EUR-Lex Integration** | Automated metadata fetching |
| **CSSF supervision** | Financial sector EU regulatory framework fully covered |

### Key Luxembourg EU Implementations

- **Loi du 1er août 2018** — GDPR transposition and national data protection supplement
- **Loi du 22 janvier 2021** — Cybersecurity law (NIS Directive transposition)
- **Loi du 16 mai 2011** — AML/CFT (successive AMLD transpositions)
- **Loi du 5 avril 1993** — Financial sector (MiFID basis, extensively amended)

See [EU_INTEGRATION_GUIDE.md](docs/EU_INTEGRATION_GUIDE.md) for detailed documentation.

---

## Data Sources & Freshness

All content is sourced from authoritative Luxembourg legal databases:

- **[Legilux](https://legilux.public.lu/)** — Journal Officiel du Grand-Duché de Luxembourg (official statute publication)
- **[EUR-Lex](https://eur-lex.europa.eu/)** — Official EU law database (metadata only)

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Service Central de Législation, Grand-Duché de Luxembourg |
| **Retrieval method** | Legilux official database |
| **Languages** | French (primary legislative language); German and Luxembourgish also official |
| **License** | Public domain (données publiques gouvernementales) |
| **Coverage** | 4,551 statutes, 36,014 provisions |
| **Last ingested** | 2026-02-28 |

### Automated Freshness Checks (Daily)

A [daily GitHub Actions workflow](.github/workflows/check-updates.yml) monitors Legilux for changes:

| Check | Method |
|-------|--------|
| **Statute amendments** | Legilux date comparison across 4,551 statutes |
| **New statutes** | Journal Officiel publication monitoring |
| **Repealed statutes** | Status change detection |
| **EU reference staleness** | Git commit timestamps — flagged if >90 days old |

**Verified data only** — every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Docker Security** | Container image scanning + SBOM generation | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **OSSF Scorecard** | OpenSSF best practices scoring | Weekly |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official Legilux publications. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is limited** — do not rely solely on this for case law research
> - **Verify critical citations** against primary sources (Legilux, Journal Officiel) for court filings
> - **EU cross-references** are extracted from statute text and EUR-Lex metadata, not a complete implementation mapping
> - **Multilingual jurisdiction** — Luxembourg law exists in French, German, and Luxembourgish. This database covers French-language legislative texts. Verify against official Legilux publications for other language versions

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [PRIVACY.md](PRIVACY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. See [PRIVACY.md](PRIVACY.md) for guidance consistent with **Barreau de Luxembourg / Ordre des Avocats du Barreau de Luxembourg** professional conduct standards.

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/Luxembourg-law-mcp
cd Luxembourg-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest           # Ingest statutes from Legilux
npm run build:db         # Rebuild SQLite database
npm run drift:detect     # Run drift detection against anchors
npm run check-updates    # Check for amendments
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** ~69 MB (efficient, portable)
- **Reliability:** 100% ingestion success rate across 4,551 statutes

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** — MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** — GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### @ansvar/luxembourg-law-mcp (This Project)
**Query 4,551 Luxembourg statutes directly from Claude** — loi du 1er août 2018, Code pénal, Code du travail, and more. Full provision text with EU cross-references. `npx @ansvar/luxembourg-law-mcp`

### [@ansvar/us-regulations-mcp](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws** — HIPAA, CCPA, SOX, GLBA, FERPA, and more. `npx @ansvar/us-regulations-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** — ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

**70+ national law MCPs** covering Austria, Belgium, Czech Republic, Denmark, Estonia, Finland, France, Germany, Ireland, Italy, Netherlands, Norway, Poland, Portugal, Slovakia, Slovenia, Spain, Sweden, Switzerland, UK, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Court case law expansion (Tribunal administratif, Cour administrative, Cour d'appel)
- CSSF circular and regulation coverage
- German-language text version ingestion
- Historical statute versions and amendment tracking
- EU Regulations MCP integration for full directive text

---

## Roadmap

- [x] Core statute database with FTS5 search (4,551 statutes, 36,014 provisions)
- [x] EU law integration with bi-directional lookup
- [x] Premium dataset (260 case law, 7 preparatory works, 4,938 agency guidance documents)
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [ ] Court case law expansion
- [ ] Full EU text integration (via @ansvar/eu-regulations-mcp)
- [ ] German-language statute coverage
- [ ] Historical statute versions (amendment tracking)
- [ ] CSSF and CNPD guidance documents

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{luxembourg_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Luxembourg Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/Luxembourg-law-mcp},
  note = {4,551 Luxembourg statutes with 36,014 provisions and EU law cross-references}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** Service Central de Législation, Grand-Duché de Luxembourg (public domain)
- **EU Metadata:** EUR-Lex (EU public domain)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the European market. Luxembourg's unique position as an EU financial and legal hub — hosting major banks, investment funds, and EU institutions — makes it a key jurisdiction for our compliance suite.

So we're open-sourcing it. Navigating 4,551 statutes across a trilingual legal system shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
