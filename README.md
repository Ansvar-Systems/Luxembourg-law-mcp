# Luxembourg Law MCP

Production-grade Luxembourg legislation MCP server with:

- `stdio` transport for local MCP clients.
- Streamable HTTP transport for Vercel/serverless deployment.
- Golden contract tests and nightly drift detection anchors.
- Automated update checks against Legilux.

## Requirements

- Node.js `>=18`
- npm

## Install

```bash
npm install
```

## Build And Run

```bash
npm run build
npm start
```

Dev mode:

```bash
npm run dev
```

## Database

Build the SQLite database from `data/seed/*.json`:

```bash
npm run build:db
```

Ingest from Legilux:

```bash
# Full discovery + ingestion
npm run ingest

# Only selected laws
npm run ingest -- --ids loi-1799-07-04-n1,loi-2002-08-02-n2

# Overwrite existing seed files
npm run ingest -- --ids loi-1799-07-04-n1 --force
```

Override DB path:

```bash
export LUXEMBOURG_LAW_DB_PATH=/absolute/path/to/database.db
```

## Testing

Run full test suite:

```bash
npm test
```

Run golden contract tests:

```bash
npm run test:contract
```

Nightly-mode contract checks (includes network assertions):

```bash
CONTRACT_MODE=nightly npm run test:contract
```

Coverage:

```bash
npm run test:coverage
```

## Drift Detection

Run upstream drift checks for configured anchors:

```bash
npm run drift:detect
```

Anchors are configured in `fixtures/golden-hashes.json`.

## Update Checks

Compare local data with Legilux:

```bash
npm run check-updates
```

Machine-readable output:

```bash
npm run check-updates -- --json --output update-summary.json
```

## Vercel Deployment

API handlers:

- `api/mcp.ts` for MCP streamable HTTP (`/mcp`)
- `api/health.ts` for health/version (`/health`, `/version`)

`vercel.json` config includes rewrites and packaged DB file.

### GitHub Actions deployment workflow

The workflow `.github/workflows/vercel-deploy.yml` supports:

- PR preview deploys
- Production deploys on `main`

Required repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## GitHub Actions

- `ci.yml`: build, tests, contract tests, coverage, typecheck.
- `check-updates.yml`: daily freshness checks + issue management + optional auto-update.
- `drift-detect.yml`: nightly drift checks with issue creation on mismatch.
- `vercel-deploy.yml`: preview and production deployment to Vercel.

## API Endpoints

- `GET /health`: health payload
- `GET /version`: version/capability payload
- `POST /mcp`: streamable MCP endpoint

## License

Apache-2.0
