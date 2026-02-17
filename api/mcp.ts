import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import Database from '@ansvar/mcp-sqlite';
import { join } from 'path';
import { existsSync, copyFileSync, readFileSync, rmSync } from 'fs';
import { createHash } from 'crypto';

import { registerTools } from '../dist/tools/registry.js';

const SOURCE_DB = process.env.LUXEMBOURG_LAW_DB_PATH
  || join(process.cwd(), 'data', 'database.db');
const TMP_DB = '/tmp/database.db';
const TMP_DB_LOCK = '/tmp/database.db.lock';

let db: InstanceType<typeof Database> | null = null;

function getDatabase(): InstanceType<typeof Database> {
  if (!db) {
    if (existsSync(TMP_DB_LOCK)) {
      rmSync(TMP_DB_LOCK, { recursive: true, force: true });
    }
    if (!existsSync(TMP_DB)) {
      copyFileSync(SOURCE_DB, TMP_DB);
    }
    db = new Database(TMP_DB, { readonly: true });
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function computeAboutContext(database: InstanceType<typeof Database>) {
  let fingerprint = 'unknown';
  let dbBuilt = 'unknown';

  try {
    const buf = readFileSync(SOURCE_DB);
    fingerprint = createHash('sha256').update(buf).digest('hex').slice(0, 12);
  } catch {
    // Keep unknown fallback.
  }

  try {
    const row = database
      .prepare("SELECT value FROM db_metadata WHERE key = 'built_at'")
      .get() as { value: string } | undefined;
    if (row?.value) {
      dbBuilt = row.value;
    }
  } catch {
    // Keep unknown fallback.
  }

  return { version: '1.0.0', fingerprint, dbBuilt };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({
      name: 'luxembourg-legal-citations',
      version: '1.0.0',
      protocol: 'mcp-streamable-http',
    });
    return;
  }

  try {
    if (!existsSync(SOURCE_DB)) {
      res.status(500).json({ error: `Database not found at ${SOURCE_DB}` });
      return;
    }

    const database = getDatabase();

    const server = new Server(
      { name: 'luxembourg-legal-citations', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    registerTools(server, database, computeAboutContext(database));

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('MCP handler error:', message);
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  }
}
