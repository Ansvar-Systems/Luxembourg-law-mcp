/**
 * list_sources tool — returns provenance metadata for all data sources.
 * Required by the standard Law MCP tool set (Audit §1.5).
 */

import type Database from '@ansvar/mcp-sqlite';
import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';

export interface SourceEntry {
  name: string;
  authority: string;
  official_portal: string;
  retrieval_method: string;
  update_frequency: string;
  last_ingested: string;
  license: {
    type: string;
    url: string;
    summary: string;
  };
  coverage: {
    scope: string;
    limitations: string;
  };
  languages: string[];
}

export interface ListSourcesResult {
  jurisdiction: string;
  schema_version: string;
  sources: SourceEntry[];
  data_freshness: {
    automated_checks: boolean;
    check_frequency: string;
    last_verified: string;
  };
}

export function listSources(
  db: InstanceType<typeof Database>,
): ToolResponse<ListSourcesResult> {
  let builtAt = 'unknown';
  let schemaVersion = '2';

  try {
    const row = db.prepare("SELECT value FROM db_metadata WHERE key = 'built_at'").get() as { value: string } | undefined;
    if (row?.value) builtAt = row.value;

    const sv = db.prepare("SELECT value FROM db_metadata WHERE key = 'schema_version'").get() as { value: string } | undefined;
    if (sv?.value) schemaVersion = sv.value;
  } catch {
    // Ignore metadata read errors
  }

  return {
    results: {
      jurisdiction: 'LU',
      schema_version: schemaVersion,
      sources: [
        {
          name: 'Legilux',
          authority: 'Service central de législation',
          official_portal: 'https://legilux.public.lu',
          retrieval_method: 'SPARQL + Akoma Ntoso XML',
          update_frequency: 'weekly',
          last_ingested: builtAt,
          license: {
            type: 'Open data',
            url: 'https://data.public.lu/en/terms/',
            summary: 'Luxembourg government open data, free to use',
          },
          coverage: {
            scope: 'Luxembourg laws and regulations (4,551 acts, 36K provisions)',
            limitations:
              'In-force status is not currently extracted from upstream metadata — all documents ' +
              'are marked as in_force regardless of actual legislative status. Verify currency ' +
              'against Legilux for repealed or amended legislation. ' +
              'EU cross-references use internal identifiers (directive:YYYY/NNN), not CELEX numbers. ' +
              'Not all Luxembourg statutes are included.',
          },
          languages: ['fr'],
        },
      ],
      data_freshness: {
        automated_checks: true,
        check_frequency: 'weekly',
        last_verified: builtAt,
      },
    },
    _metadata: generateResponseMetadata(db),
  };
}
