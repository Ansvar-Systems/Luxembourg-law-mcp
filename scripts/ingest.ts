#!/usr/bin/env tsx
/**
 * Luxembourg Law ingestion pipeline.
 *
 * Two-phase ingestion:
 *   Phase 1 (Discovery): SPARQL query to discover all legislation on Legilux
 *   Phase 2 (Content):   Fetch AKN XML, parse, write seed JSON
 *
 * Usage:
 *   npm run ingest                     # Full ingestion
 *   npm run ingest -- --limit 20       # Ingest only 20 laws
 *   npm run ingest -- --skip-discovery # Skip Phase 1, reuse existing index
 *   npm run ingest -- --ids id1,id2    # Process specific seed IDs only
 *   npm run ingest -- --force          # Overwrite existing seed files
 *
 * SPARQL endpoint: https://data.legilux.public.lu/sparqlendpoint (Virtuoso, GET)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { sparqlQuery, fetchXml, buildXmlUrl } from './lib/fetcher.js';
import { parseAknXml } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');
const INDEX_PATH = path.join(SOURCE_DIR, 'law-index.json');

// ─────────────────────────────────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const limitArg = args.indexOf('--limit');
const LIMIT = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : 0;
const SKIP_DISCOVERY = args.includes('--skip-discovery');
const FORCE = args.includes('--force');
const idsArg = args.indexOf('--ids');
const IDS_RAW = idsArg !== -1 ? args[idsArg + 1] : undefined;
const REQUESTED_IDS = IDS_RAW
  ? new Set(
      IDS_RAW
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    )
  : null;

// Document types to ingest (most important Luxembourg legislative acts)
const DOC_TYPES = [
  'LOI',  // Lois (statutes)
  'RGD',  // Rglements grand-ducaux (grand-ducal regulations)
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LawIndexEntry {
  uri: string;
  date: string;
  title: string;
  typeDocument: string;
  xmlUrl: string;
}

interface SeedProvision {
  provision_ref: string;
  section: string;
  title: string;
  content: string;
}

interface SeedDocument {
  id: string;
  type: string;
  title: string;
  status: string;
  issued_date: string;
  url: string;
  provisions: SeedProvision[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: Discovery via SPARQL
// ─────────────────────────────────────────────────────────────────────────────

async function discoverLaws(): Promise<LawIndexEntry[]> {
  console.log('Phase 1: Discovering legislation via SPARQL...\n');

  const allEntries: LawIndexEntry[] = [];

  for (const docType of DOC_TYPES) {
    console.log(`  Querying ${docType} documents...`);

    // Use SPARQL to get all acts with their XML download URLs
    // Paginate with OFFSET/LIMIT since Virtuoso may have result limits
    const PAGE_SIZE = 5000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const query = `
        PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
        SELECT ?act ?date ?title ?xmlUrl WHERE {
          ?act a jolux:Act ;
               jolux:publicationDate ?date ;
               jolux:typeDocument <http://data.legilux.public.lu/resource/authority/resource-type/${docType}> ;
               jolux:isRealizedBy ?expr .
          ?expr jolux:title ?title ;
                jolux:isEmbodiedBy ?manifest .
          ?manifest jolux:isExemplifiedBy ?xmlUrl ;
                    jolux:userFormat <http://data.legilux.public.lu/resource/authority/user-format/xml> .
        }
        ORDER BY DESC(?date)
        LIMIT ${PAGE_SIZE}
        OFFSET ${offset}
      `;

      const bindings = await sparqlQuery(query);

      for (const b of bindings) {
        allEntries.push({
          uri: b['act'].value,
          date: b['date'].value,
          title: b['title'].value,
          typeDocument: docType,
          xmlUrl: b['xmlUrl'].value,
        });
      }

      console.log(`    Fetched ${bindings.length} ${docType} records (offset ${offset})`);

      if (bindings.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }
  }

  // Deduplicate by URI (SPARQL may return duplicates)
  const seen = new Set<string>();
  const deduped = allEntries.filter((entry) => {
    if (seen.has(entry.uri)) return false;
    seen.add(entry.uri);
    return true;
  });

  console.log(`\n  Total: ${deduped.length} unique acts discovered (${allEntries.length - deduped.length} duplicates removed)\n`);

  // Save index
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(deduped, null, 2));
  console.log(`  Saved index to ${INDEX_PATH}\n`);

  return deduped;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Content fetching and parsing
// ─────────────────────────────────────────────────────────────────────────────

function generateSeedId(entry: LawIndexEntry): string {
  // Extract path components from the ELI URI
  // e.g. http://data.legilux.public.lu/eli/etat/leg/loi/2026/02/05/a33/jo
  const match = entry.uri.match(/\/eli\/etat\/(?:leg\/)?(\w+)\/(\d{4})\/(\d{2})\/(\d{2})\/(\w+)\//);
  if (match) {
    const [, type, year, month, day, ref] = match;
    return `${type}-${year}-${month}-${day}-${ref}`;
  }

  // Fallback: use the last meaningful path segments
  const parts = entry.uri.split('/').filter(Boolean);
  return parts.slice(-5, -1).join('-');
}

function mapDocType(typeDocument: string): string {
  switch (typeDocument) {
    case 'LOI': return 'statute';
    case 'RGD': return 'statute';
    default: return 'statute';
  }
}

async function fetchAndParseLaws(entries: LawIndexEntry[]): Promise<void> {
  console.log('Phase 2: Fetching and parsing legislation...\n');

  fs.mkdirSync(SEED_DIR, { recursive: true });

  const selectedEntries = REQUESTED_IDS
    ? entries.filter((entry) => REQUESTED_IDS.has(generateSeedId(entry)))
    : entries;

  if (REQUESTED_IDS) {
    const foundIds = new Set(selectedEntries.map((entry) => generateSeedId(entry)));
    const missingIds = [...REQUESTED_IDS].filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      console.log(`  WARN: ${missingIds.length} requested ID(s) not found in discovery index.`);
      for (const id of missingIds.slice(0, 20)) {
        console.log(`    - ${id}`);
      }
      if (missingIds.length > 20) {
        console.log(`    ...and ${missingIds.length - 20} more`);
      }
      console.log('');
    }
  }

  const toProcess = LIMIT > 0 ? selectedEntries.slice(0, LIMIT) : selectedEntries;
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let noArticles = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const entry = toProcess[i];
    const seedId = generateSeedId(entry);
    const seedPath = path.join(SEED_DIR, `${seedId}.json`);

    // Skip if seed already exists unless force mode is active.
    if (fs.existsSync(seedPath) && !FORCE) {
      skipped++;
      continue;
    }

    // Progress logging
    if ((i + 1) % 10 === 0 || i === 0) {
      console.log(`  [${i + 1}/${toProcess.length}] Processing ${seedId}...`);
    }

    // Fetch XML -- try the SPARQL-provided URL first, fall back to constructed URL
    let xml = await fetchXml(entry.xmlUrl);
    if (!xml) {
      // Try alternative: construct URL from ELI URI
      const altUrl = buildXmlUrl(entry.uri);
      if (altUrl !== entry.xmlUrl) {
        xml = await fetchXml(altUrl);
      }
    }

    if (!xml) {
      failed++;
      if (failed <= 5) {
        console.log(`    WARN: Failed to fetch XML for ${seedId} (${entry.xmlUrl})`);
      }
      continue;
    }

    // Parse AKN XML
    const parsed = parseAknXml(xml);
    if (!parsed) {
      failed++;
      if (failed <= 5) {
        console.log(`    WARN: Failed to parse XML for ${seedId}`);
      }
      continue;
    }

    if (parsed.provisions.length === 0) {
      noArticles++;
      // Still save it - some acts legitimately have no articles (e.g. approvals)
    }

    // Build seed document
    const seed: SeedDocument = {
      id: seedId,
      type: mapDocType(entry.typeDocument),
      title: parsed.title || entry.title,
      status: 'in_force',
      issued_date: parsed.dateDocument || entry.date,
      url: entry.uri,
      provisions: parsed.provisions,
    };

    fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2));
    processed++;
  }

  console.log(`\nPhase 2 complete:`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Skipped (existing): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  No articles: ${noArticles}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Luxembourg Law MCP — Ingestion Pipeline');
  console.log('========================================\n');

  if (LIMIT > 0) {
    console.log(`Limit: ${LIMIT} laws\n`);
  }
  if (REQUESTED_IDS) {
    console.log(`Requested IDs: ${[...REQUESTED_IDS].length}\n`);
  }
  if (FORCE) {
    console.log('Force mode: existing seeds will be overwritten.\n');
  }

  // Phase 1: Discovery
  let index: LawIndexEntry[];

  if (SKIP_DISCOVERY && fs.existsSync(INDEX_PATH)) {
    console.log('Skipping discovery, using existing index...\n');
    index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
    console.log(`  Loaded ${index.length} entries from index\n`);
  } else {
    index = await discoverLaws();
  }

  // Phase 2: Fetch and parse
  await fetchAndParseLaws(index);

  console.log('\nDone.');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
