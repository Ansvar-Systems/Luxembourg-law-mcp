import type { VercelRequest, VercelResponse } from '@vercel/node';
import Database from '@ansvar/mcp-sqlite';
import { join } from 'path';
import { existsSync, copyFileSync, rmSync } from 'fs';

const SERVER_NAME = 'luxembourg-legal-citations';
const SERVER_VERSION = '1.0.0';
const REPO_URL = 'https://github.com/Ansvar-Systems/Luxembourg-law-mcp';
const STALENESS_THRESHOLD_DAYS = 30;

const SOURCE_DB = process.env.LUXEMBOURG_LAW_DB_PATH
  || join(process.cwd(), 'data', 'database.db');
const TMP_DB = '/tmp/database.db';
const TMP_DB_LOCK = '/tmp/database.db.lock';

interface DbProbe {
  status: 'ok' | 'stale' | 'degraded' | 'error';
  schema_version: string;
  tier: string;
  built_at: string;
  days_old: number;
  counts: {
    legal_documents: number;
    legal_provisions: number;
    eu_documents: number;
    eu_references: number;
  };
}

function probeDatabase(): DbProbe {
  const errorResult: DbProbe = {
    status: 'error',
    schema_version: 'unknown',
    tier: 'unknown',
    built_at: 'unknown',
    days_old: -1,
    counts: { legal_documents: 0, legal_provisions: 0, eu_documents: 0, eu_references: 0 },
  };

  if (!existsSync(SOURCE_DB)) {
    return errorResult;
  }

  let db: InstanceType<typeof Database> | null = null;
  try {
    if (existsSync(TMP_DB_LOCK)) {
      rmSync(TMP_DB_LOCK, { recursive: true, force: true });
    }
    if (!existsSync(TMP_DB)) {
      copyFileSync(SOURCE_DB, TMP_DB);
    }
    db = new Database(TMP_DB, { readonly: true });

    const getMeta = (key: string): string => {
      try {
        const row = db!.prepare('SELECT value FROM db_metadata WHERE key = ?').get(key) as { value: string } | undefined;
        return row?.value ?? 'unknown';
      } catch { return 'unknown'; }
    };

    const safeCount = (table: string): number => {
      try {
        const row = db!.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
        return Number(row.count);
      } catch { return 0; }
    };

    const builtAt = getMeta('built_at');
    const schemaVersion = getMeta('schema_version');
    const tier = getMeta('tier');

    let daysOld = -1;
    let status: DbProbe['status'] = 'ok';

    if (builtAt !== 'unknown') {
      daysOld = Math.floor((Date.now() - new Date(builtAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysOld > STALENESS_THRESHOLD_DAYS) {
        status = 'stale';
      }
    } else {
      status = 'degraded';
    }

    const counts = {
      legal_documents: safeCount('legal_documents'),
      legal_provisions: safeCount('legal_provisions'),
      eu_documents: safeCount('eu_documents'),
      eu_references: safeCount('eu_references'),
    };

    if (counts.legal_documents === 0 || counts.legal_provisions === 0) {
      status = 'degraded';
    }

    return { status, schema_version: schemaVersion, tier, built_at: builtAt, days_old: daysOld, counts };
  } catch {
    return errorResult;
  }
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url ?? '/', `https://${req.headers.host}`);

  if (url.pathname === '/version' || url.searchParams.has('version')) {
    const probe = probeDatabase();
    res.status(200).json({
      name: SERVER_NAME,
      version: SERVER_VERSION,
      node_version: process.version,
      transport: ['stdio', 'streamable-http'],
      capabilities: ['statutes', 'eu_cross_references'],
      tier: probe.tier,
      source_schema_version: probe.schema_version,
      repo_url: REPO_URL,
      report_issue_url: `${REPO_URL}/issues/new?template=data-error.md`,
    });
    return;
  }

  const probe = probeDatabase();

  res.status(200).json({
    status: probe.status,
    server: SERVER_NAME,
    version: SERVER_VERSION,
    uptime_seconds: Math.floor(process.uptime()),
    data: {
      schema_version: probe.schema_version,
      tier: probe.tier,
      built_at: probe.built_at,
      days_old: probe.days_old,
      counts: probe.counts,
    },
    data_freshness: {
      max_age_days: STALENESS_THRESHOLD_DAYS,
      is_stale: probe.status === 'stale',
    },
    capabilities: ['statutes', 'eu_cross_references'],
  });
}
