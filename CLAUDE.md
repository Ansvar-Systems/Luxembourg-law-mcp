# CLAUDE.md — Luxembourg Law MCP

## Project overview

Luxembourg legislation MCP server serving 4,551 acts and ~36K provisions from Legilux open data. Dual transport: stdio (npm) + Streamable HTTP (Vercel serverless). French language.

## Architecture

- **Entry points**: `src/index.ts` (stdio), `api/mcp.ts` (Vercel HTTP), `api/health.ts` (health/version)
- **Tool registry**: `src/tools/registry.ts` — single shared registry for both transports
- **Each tool**: separate file in `src/tools/` exporting handler function + input type
- **Response envelope**: `ToolResponse<T>` with `results` + `_metadata` (see `src/utils/metadata.ts`)
- **Database**: SQLite via `@ansvar/mcp-sqlite` (WASM-based, works in Vercel serverless)
- **Build pipeline**: `scripts/ingest.ts` (SPARQL from Legilux) → `data/seed/*.json` → `scripts/build-db.ts` → `data/database.db`

## Key conventions

- TypeScript ESM (`"type": "module"` in package.json)
- All imports use `.js` extension (TypeScript ESM convention)
- DB queries use parameterized statements — never string interpolation
- FTS5 uses `MATCH` operator, never `LIKE`
- Journal mode must be `DELETE` (not WAL) for serverless compatibility
- DB is copied to `/tmp/database.db` on Vercel cold start
- Tool names: `snake_case`, matching `^[a-zA-Z0-9_-]{1,64}$`

## Testing

- `npm test` — unit tests (vitest)
- `npm run test:contract` — golden contract tests against real DB
- `npm run validate` — both suites
- `npm run test:coverage` — with v8 coverage
- Golden tests: `fixtures/golden-tests.json` (19 tests)
- Drift anchors: `fixtures/golden-hashes.json` (5 anchors, use `--seed` to compute)

## Data pipeline

- `npm run ingest` — fetch from Legilux SPARQL endpoint
- `npm run build:db` — build SQLite from seed JSON
- `npm run check-updates` — check for upstream changes
- `npm run drift:detect` — compare upstream hashes
- `npm run drift:detect -- --seed` — compute initial hashes

## Deployment

- **Strategy A** (Vercel): DB bundled in function via `includeFiles` in `vercel.json`
- npm package: `@ansvar/luxembourg-law-mcp`
- Endpoint: `luxembourg-law-mcp.vercel.app`

## Don't

- Don't use `better-sqlite3` in production code (only in devDeps for scripts)
- Don't use WAL journal mode
- Don't hardcode data — always derive from DB or `db_metadata` table
- Don't add tools without updating `registry.ts` switch statement AND `TOOLS`/`buildTools`

## Git Workflow

- **Never commit directly to `main`.** Always create a feature branch and open a Pull Request.
- Branch protection requires: verified signatures, PR review, and status checks to pass.
- Use conventional commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`, etc.
