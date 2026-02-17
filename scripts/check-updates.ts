#!/usr/bin/env tsx
/**
 * Check for updates between local Luxembourg legislation data and Legilux.
 *
 * Usage:
 *   npm run check-updates
 *   npm run check-updates -- --json
 *   npm run check-updates -- --output .tmp/updates.json
 */

import Database from 'better-sqlite3';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sparqlQuery } from './lib/fetcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = resolve(__dirname, '../data/database.db');

const DOC_TYPES = ['LOI', 'RGD'] as const;
const PAGE_SIZE = 5000;

interface LocalDocument {
  id: string;
  title: string;
  url: string | null;
  issued_date: string | null;
  last_updated: string | null;
}

interface RemoteDocument {
  uri: string;
  date: string;
  title: string;
  typeDocument: string;
}

interface UpdateEntry {
  id: string;
  title: string;
  uri: string;
  local_date: string | null;
  remote_date: string;
}

interface Summary {
  checked_at: string;
  local_count: number;
  remote_count: number;
  updates_count: number;
  new_documents_count: number;
  missing_remote_count: number;
  updates: UpdateEntry[];
  new_documents: RemoteDocument[];
}

interface SummaryOutput extends Summary {
  error?: string;
}

function parseArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function isJsonOutputEnabled(): boolean {
  return process.argv.includes('--json');
}

function formatError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause instanceof Error && cause.message && cause.message !== error.message) {
    return `${error.message} (${cause.message})`;
  }
  if (typeof cause === 'string' && cause.length > 0) {
    return `${error.message} (${cause})`;
  }
  return error.message;
}

function normalizeIsoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  if (!match) {
    return null;
  }

  return match[0];
}

async function discoverRemoteDocuments(): Promise<RemoteDocument[]> {
  const discovered: RemoteDocument[] = [];

  for (const docType of DOC_TYPES) {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const query = `
        PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
        SELECT ?act ?date ?title WHERE {
          ?act a jolux:Act ;
               jolux:publicationDate ?date ;
               jolux:typeDocument <http://data.legilux.public.lu/resource/authority/resource-type/${docType}> ;
               jolux:isRealizedBy ?expr .
          ?expr jolux:title ?title .
        }
        ORDER BY DESC(?date)
        LIMIT ${PAGE_SIZE}
        OFFSET ${offset}
      `;

      const bindings = await sparqlQuery(query);
      for (const binding of bindings) {
        discovered.push({
          uri: binding['act'].value,
          date: binding['date'].value,
          title: binding['title'].value,
          typeDocument: docType,
        });
      }

      if (bindings.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }
  }

  const dedupedMap = new Map<string, RemoteDocument>();
  for (const entry of discovered) {
    const existing = dedupedMap.get(entry.uri);
    if (!existing || entry.date > existing.date) {
      dedupedMap.set(entry.uri, entry);
    }
  }

  return [...dedupedMap.values()];
}

function loadLocalDocuments(dbPath: string): LocalDocument[] {
  const db = new Database(dbPath, { readonly: true });
  const rows = db.prepare(
    `SELECT id, title, url, issued_date, last_updated
     FROM legal_documents
     WHERE type = 'statute'
     ORDER BY id`
  ).all() as LocalDocument[];
  db.close();
  return rows;
}

function buildSummary(localDocs: LocalDocument[], remoteDocs: RemoteDocument[]): Summary {
  const remoteByUri = new Map(remoteDocs.map((entry) => [entry.uri, entry]));
  const localUris = new Set(localDocs.map((doc) => doc.url).filter((url): url is string => !!url));

  const updates: UpdateEntry[] = [];
  let missingRemoteCount = 0;

  for (const doc of localDocs) {
    if (!doc.url) {
      continue;
    }

    const remote = remoteByUri.get(doc.url);
    if (!remote) {
      missingRemoteCount++;
      continue;
    }

    const localDate = normalizeIsoDate(doc.issued_date) ?? normalizeIsoDate(doc.last_updated);
    if (!localDate) {
      continue;
    }

    if (remote.date > localDate) {
      updates.push({
        id: doc.id,
        title: doc.title,
        uri: doc.url,
        local_date: localDate,
        remote_date: remote.date,
      });
    }
  }

  const newDocuments = remoteDocs.filter((entry) => !localUris.has(entry.uri));

  return {
    checked_at: new Date().toISOString(),
    local_count: localDocs.length,
    remote_count: remoteDocs.length,
    updates_count: updates.length,
    new_documents_count: newDocuments.length,
    missing_remote_count: missingRemoteCount,
    updates,
    new_documents: newDocuments,
  };
}

function printHumanSummary(summary: SummaryOutput): void {
  console.log('Luxembourg Law MCP - Data Freshness Check');
  console.log('');
  console.log(`Local statutes:             ${summary.local_count}`);
  console.log(`Remote statutes (Legilux):  ${summary.remote_count}`);
  console.log(`Updates available:          ${summary.updates_count}`);
  console.log(`New documents available:    ${summary.new_documents_count}`);
  console.log(`Missing remote matches:     ${summary.missing_remote_count}`);

  if (summary.updates.length > 0) {
    console.log('');
    for (const update of summary.updates.slice(0, 50)) {
      console.log(
        `UPDATE AVAILABLE: ${update.id} (${update.local_date ?? 'unknown'} -> ${update.remote_date})`,
      );
    }
    if (summary.updates.length > 50) {
      console.log(`...and ${summary.updates.length - 50} more`);
    }
  }

  if (summary.new_documents.length > 0) {
    console.log('');
    for (const doc of summary.new_documents.slice(0, 30)) {
      console.log(`NEW DOCUMENT: ${doc.typeDocument} ${doc.date} ${doc.title}`);
    }
    if (summary.new_documents.length > 30) {
      console.log(`...and ${summary.new_documents.length - 30} more`);
    }
  }

  if (summary.error) {
    console.log('');
    console.log(`ERROR: ${summary.error}`);
  }
}

function writeSummary(summary: SummaryOutput, outputPath?: string): void {
  if (outputPath) {
    writeFileSync(resolve(outputPath), `${JSON.stringify(summary, null, 2)}\n`);
  }
}

function createFailureSummary(localCount: number, error: string): SummaryOutput {
  return {
    checked_at: new Date().toISOString(),
    local_count: localCount,
    remote_count: 0,
    updates_count: 0,
    new_documents_count: 0,
    missing_remote_count: 0,
    updates: [],
    new_documents: [],
    error,
  };
}

async function main(): Promise<void> {
  const outputPath = parseArgValue('--output');
  const jsonOutput = isJsonOutputEnabled();

  if (!existsSync(DB_PATH)) {
    const summary = createFailureSummary(0, `Database not found at ${DB_PATH}`);
    if (jsonOutput) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      printHumanSummary(summary);
    }
    writeSummary(summary, outputPath);
    process.exit(1);
  }

  const localDocs = loadLocalDocuments(DB_PATH);

  try {
    const remoteDocs = await discoverRemoteDocuments();
    const summary = buildSummary(localDocs, remoteDocs);

    if (jsonOutput) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      printHumanSummary(summary);
    }

    writeSummary(summary, outputPath);

    if (summary.updates_count > 0 || summary.new_documents_count > 0) {
      process.exit(1);
    }
  } catch (error) {
    const summary = createFailureSummary(localDocs.length, formatError(error));

    if (jsonOutput) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      printHumanSummary(summary);
    }

    writeSummary(summary, outputPath);
    process.exit(1);
  }
}

main().catch((error) => {
  const message = formatError(error);
  console.error(`check-updates failed: ${message}`);
  process.exit(1);
});
