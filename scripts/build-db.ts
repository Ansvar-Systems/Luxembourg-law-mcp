#!/usr/bin/env tsx
/**
 * Database builder for Luxembourg Law MCP server.
 *
 * Builds the SQLite database from seed JSON files in data/seed/.
 * Schema follows the Finnish Law MCP reference implementation.
 *
 * Usage: npm run build:db
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEED_DIR = path.resolve(__dirname, '../data/seed');
const DB_PATH = path.resolve(__dirname, '../data/database.db');

// ─────────────────────────────────────────────────────────────────────────────
// Seed file types
// ─────────────────────────────────────────────────────────────────────────────

interface DocumentSeed {
  id: string;
  type: 'statute' | 'bill' | 'case_law';
  title: string;
  title_en?: string;
  short_name?: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issued_date?: string;
  in_force_date?: string;
  url?: string;
  description?: string;
  provisions?: ProvisionSeed[];
  definitions?: DefinitionSeed[];
}

interface ProvisionSeed {
  provision_ref: string;
  chapter?: string;
  section: string;
  title?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface DefinitionSeed {
  term: string;
  term_en?: string;
  definition: string;
  source_provision?: string;
}

interface ProvisionDedupStats {
  duplicate_refs: number;
  conflicting_duplicates: number;
}

type EUCommunityValue = 'EU' | 'EG' | 'EEG' | 'Euratom' | 'CE' | 'CEE';

interface ExtractedEUReference {
  eu_document_id: string;
  type: 'directive' | 'regulation';
  year: number;
  number: number;
  community: EUCommunityValue;
  full_citation: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Database schema
// ─────────────────────────────────────────────────────────────────────────────

const SCHEMA = `
-- Legal documents (statutes, regulations)
CREATE TABLE legal_documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('statute', 'bill', 'case_law')),
  title TEXT NOT NULL,
  title_en TEXT,
  short_name TEXT,
  status TEXT NOT NULL DEFAULT 'in_force'
    CHECK(status IN ('in_force', 'amended', 'repealed', 'not_yet_in_force')),
  issued_date TEXT,
  in_force_date TEXT,
  url TEXT,
  description TEXT,
  last_updated TEXT DEFAULT (datetime('now'))
);

-- Individual provisions from statutes
CREATE TABLE legal_provisions (
  id INTEGER PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES legal_documents(id),
  provision_ref TEXT NOT NULL,
  chapter TEXT,
  section TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  metadata TEXT,
  UNIQUE(document_id, provision_ref)
);

CREATE INDEX idx_provisions_doc ON legal_provisions(document_id);
CREATE INDEX idx_provisions_chapter ON legal_provisions(document_id, chapter);

-- FTS5 for provision search
CREATE VIRTUAL TABLE provisions_fts USING fts5(
  content, title,
  content='legal_provisions',
  content_rowid='id',
  tokenize='unicode61'
);

CREATE TRIGGER provisions_ai AFTER INSERT ON legal_provisions BEGIN
  INSERT INTO provisions_fts(rowid, content, title)
  VALUES (new.id, new.content, new.title);
END;

CREATE TRIGGER provisions_ad AFTER DELETE ON legal_provisions BEGIN
  INSERT INTO provisions_fts(provisions_fts, rowid, content, title)
  VALUES ('delete', old.id, old.content, old.title);
END;

CREATE TRIGGER provisions_au AFTER UPDATE ON legal_provisions BEGIN
  INSERT INTO provisions_fts(provisions_fts, rowid, content, title)
  VALUES ('delete', old.id, old.content, old.title);
  INSERT INTO provisions_fts(rowid, content, title)
  VALUES (new.id, new.content, new.title);
END;

-- Legal term definitions
CREATE TABLE definitions (
  id INTEGER PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES legal_documents(id),
  term TEXT NOT NULL,
  term_en TEXT,
  definition TEXT NOT NULL,
  source_provision TEXT,
  UNIQUE(document_id, term)
);

-- FTS5 for definition search
CREATE VIRTUAL TABLE definitions_fts USING fts5(
  term, definition,
  content='definitions',
  content_rowid='id',
  tokenize='unicode61'
);

CREATE TRIGGER definitions_ai AFTER INSERT ON definitions BEGIN
  INSERT INTO definitions_fts(rowid, term, definition)
  VALUES (new.id, new.term, new.definition);
END;

CREATE TRIGGER definitions_ad AFTER DELETE ON definitions BEGIN
  INSERT INTO definitions_fts(definitions_fts, rowid, term, definition)
  VALUES ('delete', old.id, old.term, old.definition);
END;

CREATE TRIGGER definitions_au AFTER UPDATE ON definitions BEGIN
  INSERT INTO definitions_fts(definitions_fts, rowid, term, definition)
  VALUES ('delete', old.id, old.term, old.definition);
  INSERT INTO definitions_fts(rowid, term, definition)
  VALUES (new.id, new.term, new.definition);
END;

-- EU Documents (directives and regulations)
CREATE TABLE eu_documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('directive', 'regulation')),
  year INTEGER NOT NULL CHECK (year >= 1957 AND year <= 2100),
  number INTEGER NOT NULL CHECK (number > 0),
  community TEXT CHECK (community IN ('EU', 'EG', 'EEG', 'Euratom', 'CE', 'CEE')),
  celex_number TEXT,
  title TEXT,
  title_fr TEXT,
  short_name TEXT,
  adoption_date TEXT,
  entry_into_force_date TEXT,
  in_force BOOLEAN DEFAULT 1,
  amended_by TEXT,
  repeals TEXT,
  url_eur_lex TEXT,
  description TEXT,
  last_updated TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_eu_documents_type_year ON eu_documents(type, year DESC);
CREATE INDEX idx_eu_documents_celex ON eu_documents(celex_number);

-- EU References (links national provisions to EU documents)
CREATE TABLE eu_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL CHECK (source_type IN ('provision', 'document', 'case_law')),
  source_id TEXT NOT NULL,
  document_id TEXT NOT NULL REFERENCES legal_documents(id),
  provision_id INTEGER REFERENCES legal_provisions(id),
  eu_document_id TEXT NOT NULL REFERENCES eu_documents(id),
  eu_article TEXT,
  reference_type TEXT NOT NULL CHECK (reference_type IN (
    'implements', 'supplements', 'applies', 'references', 'complies_with',
    'derogates_from', 'amended_by', 'repealed_by', 'cites_article'
  )),
  reference_context TEXT,
  full_citation TEXT,
  is_primary_implementation BOOLEAN DEFAULT 0,
  implementation_status TEXT CHECK (implementation_status IN ('complete', 'partial', 'pending', 'unknown')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_verified TEXT,
  UNIQUE(source_id, eu_document_id, eu_article)
);

CREATE INDEX idx_eu_references_document ON eu_references(document_id, eu_document_id);
CREATE INDEX idx_eu_references_eu_document ON eu_references(eu_document_id, document_id);
CREATE INDEX idx_eu_references_provision ON eu_references(provision_id, eu_document_id);

-- Build metadata (tier, schema version, build timestamp)
CREATE TABLE db_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function pickPreferredProvision(existing: ProvisionSeed, incoming: ProvisionSeed): ProvisionSeed {
  const existingContent = normalizeWhitespace(existing.content);
  const incomingContent = normalizeWhitespace(incoming.content);

  if (incomingContent.length > existingContent.length) {
    return {
      ...incoming,
      title: incoming.title ?? existing.title,
    };
  }

  return {
    ...existing,
    title: existing.title ?? incoming.title,
  };
}

function dedupeProvisions(provisions: ProvisionSeed[]): { deduped: ProvisionSeed[]; stats: ProvisionDedupStats } {
  const byRef = new Map<string, ProvisionSeed>();
  const stats: ProvisionDedupStats = {
    duplicate_refs: 0,
    conflicting_duplicates: 0,
  };

  for (const provision of provisions) {
    const ref = provision.provision_ref.trim();
    const existing = byRef.get(ref);

    if (!existing) {
      byRef.set(ref, { ...provision, provision_ref: ref });
      continue;
    }

    stats.duplicate_refs++;

    const existingContent = normalizeWhitespace(existing.content);
    const incomingContent = normalizeWhitespace(provision.content);

    if (existingContent !== incomingContent) {
      stats.conflicting_duplicates++;
    }

    byRef.set(ref, pickPreferredProvision(existing, provision));
  }

  return {
    deduped: Array.from(byRef.values()),
    stats,
  };
}

const DIRECTIVE_PATTERN = /\bdirective\b[^\d]{0,48}(\d{2,4})\/(\d{1,4})\/(UE|EU|CE|CEE|EG|EEG|EURATOM)\b/giu;
const REGULATION_PATTERN = /\br(?:è|e)glement\b[^\d]{0,48}\((UE|EU|CE|CEE|EG|EEG|EURATOM)\)\s*(?:n[°o]\s*)?(\d{1,4})\/(\d{2,4})\b/giu;

const EU_DOC_SHORT_NAMES: Record<string, string> = {
  'regulation:2016/679': 'GDPR',
  'directive:1995/46': 'Data Protection Directive',
  'directive:2002/58': 'ePrivacy Directive',
  'directive:2016/680': 'Law Enforcement Directive',
  'directive:2016/1148': 'NIS Directive',
  'directive:2022/2555': 'NIS2 Directive',
};

function normalizeCommunity(raw: string | undefined): EUCommunityValue {
  switch ((raw ?? '').toUpperCase()) {
    case 'UE':
    case 'EU':
      return 'EU';
    case 'EG':
      return 'EG';
    case 'EEG':
      return 'EEG';
    case 'EURATOM':
      return 'Euratom';
    case 'CEE':
      return 'CEE';
    case 'CE':
    default:
      return 'CE';
  }
}

function parseEuYear(raw: string): number | null {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (raw.length === 2) {
    return parsed >= 57 ? 1900 + parsed : 2000 + parsed;
  }

  if (parsed < 1957 || parsed > 2100) {
    return null;
  }

  return parsed;
}

function inferRegulationYearAndNumber(
  community: EUCommunityValue,
  first: string,
  second: string
): { year: number; number: number } | null {
  const a = Number.parseInt(first, 10);
  const b = Number.parseInt(second, 10);

  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
    return null;
  }

  const yearFromFirst = parseEuYear(first);
  const yearFromSecond = parseEuYear(second);
  const isLegacyCommunity = ['CE', 'CEE', 'EG', 'EEG', 'Euratom'].includes(community);

  if (isLegacyCommunity) {
    if (yearFromSecond) {
      return { year: yearFromSecond, number: a };
    }
    if (yearFromFirst) {
      return { year: yearFromFirst, number: b };
    }
  } else {
    if (yearFromFirst) {
      return { year: yearFromFirst, number: b };
    }
    if (yearFromSecond) {
      return { year: yearFromSecond, number: a };
    }
  }

  return null;
}

function normalizeCitation(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function extractEUReferencesFromText(text: string): ExtractedEUReference[] {
  const extracted: ExtractedEUReference[] = [];

  DIRECTIVE_PATTERN.lastIndex = 0;
  REGULATION_PATTERN.lastIndex = 0;

  for (const match of text.matchAll(DIRECTIVE_PATTERN)) {
    const year = parseEuYear(match[1]);
    const number = Number.parseInt(match[2], 10);
    if (!year || !Number.isFinite(number) || number <= 0) {
      continue;
    }
    const community = normalizeCommunity(match[3]);
    extracted.push({
      eu_document_id: `directive:${year}/${number}`,
      type: 'directive',
      year,
      number,
      community,
      full_citation: normalizeCitation(match[0]),
    });
  }

  for (const match of text.matchAll(REGULATION_PATTERN)) {
    const community = normalizeCommunity(match[1]);
    const normalized = inferRegulationYearAndNumber(community, match[2], match[3]);
    if (!normalized) {
      continue;
    }

    extracted.push({
      eu_document_id: `regulation:${normalized.year}/${normalized.number}`,
      type: 'regulation',
      year: normalized.year,
      number: normalized.number,
      community,
      full_citation: normalizeCitation(match[0]),
    });
  }

  const unique = new Map<string, ExtractedEUReference>();
  for (const ref of extracted) {
    if (!unique.has(ref.eu_document_id)) {
      unique.set(ref.eu_document_id, ref);
    }
  }

  return [...unique.values()];
}

// ─────────────────────────────────────────────────────────────────────────────
// Build
// ─────────────────────────────────────────────────────────────────────────────

function buildDatabase(): void {
  console.log('Building Luxembourg Law MCP database...\n');

  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  db.exec(SCHEMA);

  // Prepared statements
  const insertDoc = db.prepare(`
    INSERT INTO legal_documents (id, type, title, title_en, short_name, status, issued_date, in_force_date, url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertProvision = db.prepare(`
    INSERT INTO legal_provisions (document_id, provision_ref, chapter, section, title, content, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDefinition = db.prepare(`
    INSERT INTO definitions (document_id, term, term_en, definition, source_provision)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertEuDocument = db.prepare(`
    INSERT OR IGNORE INTO eu_documents (
      id, type, year, number, community, title, short_name, description, in_force
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const insertEuReference = db.prepare(`
    INSERT OR IGNORE INTO eu_references (
      source_type, source_id, document_id, provision_id, eu_document_id, eu_article,
      reference_type, reference_context, full_citation, is_primary_implementation,
      implementation_status, last_verified
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Load seed files
  if (!fs.existsSync(SEED_DIR)) {
    console.log('No seed directory -- creating empty database.');
    db.close();
    return;
  }

  const seedFiles = fs.readdirSync(SEED_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('.') && !f.startsWith('_')
      && f !== 'eu-references.json' && f !== 'eurlex-documents.json');

  if (seedFiles.length === 0) {
    console.log('No seed files found. Database created with empty schema.');
    db.close();
    return;
  }

  let totalDocs = 0;
  let totalProvisions = 0;
  let totalDefs = 0;
  let totalEuDocuments = 0;
  let totalEuReferences = 0;
  let totalDuplicateRefs = 0;
  let totalConflictingDuplicates = 0;

  const loadAll = db.transaction(() => {
    for (const file of seedFiles) {
      const filePath = path.join(SEED_DIR, file);

      const content = fs.readFileSync(filePath, 'utf-8');
      const seed = JSON.parse(content) as DocumentSeed;

      insertDoc.run(
        seed.id, seed.type, seed.title, seed.title_en ?? null,
        seed.short_name ?? null, seed.status,
        seed.issued_date ?? null, seed.in_force_date ?? null,
        seed.url ?? null, seed.description ?? null
      );
      totalDocs++;

      const { deduped, stats } = dedupeProvisions(seed.provisions ?? []);
      totalDuplicateRefs += stats.duplicate_refs;
      totalConflictingDuplicates += stats.conflicting_duplicates;
      if (stats.duplicate_refs > 0) {
        console.log(
          `    WARNING: ${stats.duplicate_refs} duplicate refs in ${seed.id} ` +
          `(${stats.conflicting_duplicates} with different text).`
        );
      }

      for (const prov of deduped) {
        insertProvision.run(
          seed.id, prov.provision_ref, prov.chapter ?? null,
          prov.section, prov.title ?? null, prov.content,
          prov.metadata ? JSON.stringify(prov.metadata) : null
        );
        totalProvisions++;
      }

      for (const def of seed.definitions ?? []) {
        insertDefinition.run(
          seed.id, def.term, def.term_en ?? null,
          def.definition, def.source_provision ?? null
        );
        totalDefs++;
      }
    }
  });

  loadAll();

  const inferEuReferenceType = (text: string): { referenceType: string; isPrimary: number } => {
    const normalized = text.toLowerCase();
    const isImplementation = (
      normalized.includes('transposition') ||
      normalized.includes('transpose') ||
      normalized.includes('mise en oeuvre') ||
      normalized.includes('mettant en oeuvre') ||
      normalized.includes('met en oeuvre') ||
      normalized.includes('implements')
    );

    return {
      referenceType: isImplementation ? 'implements' : 'references',
      isPrimary: isImplementation ? 1 : 0,
    };
  };

  const populateEUData = db.transaction(() => {
    const docs = db.prepare(
      `SELECT id, title, description
       FROM legal_documents
       ORDER BY id`
    ).all() as Array<{ id: string; title: string; description: string | null }>;

    for (const doc of docs) {
      const searchText = [doc.title, doc.description ?? ''].join('\n');
      const refs = extractEUReferencesFromText(searchText);
      if (refs.length === 0) {
        continue;
      }

      const refType = inferEuReferenceType(searchText);
      const seenReferences = new Set<string>();

      for (const ref of refs) {
        const shortName = EU_DOC_SHORT_NAMES[ref.eu_document_id] ?? null;
        const genericTitle = (
          ref.type === 'directive'
            ? `Directive ${ref.year}/${ref.number}/${ref.community}`
            : `Regulation ${ref.year}/${ref.number}/${ref.community}`
        );

        const euDocResult = insertEuDocument.run(
          ref.eu_document_id,
          ref.type,
          ref.year,
          ref.number,
          ref.community,
          genericTitle,
          shortName,
          `Auto-extracted from Luxembourg legislation metadata (${doc.id}).`,
        );
        totalEuDocuments += euDocResult.changes;

        const dedupeKey = `${doc.id}|${ref.eu_document_id}`;
        if (seenReferences.has(dedupeKey)) {
          continue;
        }
        seenReferences.add(dedupeKey);

        const euRefResult = insertEuReference.run(
          'document',
          doc.id,
          doc.id,
          null,
          ref.eu_document_id,
          null,
          refType.referenceType,
          doc.title,
          ref.full_citation,
          refType.isPrimary,
          'unknown',
          new Date().toISOString(),
        );
        totalEuReferences += euRefResult.changes;
      }
    }
  });

  populateEUData();

  // Write build metadata
  const insertMeta = db.prepare('INSERT INTO db_metadata (key, value) VALUES (?, ?)');
  const writeMeta = db.transaction(() => {
    insertMeta.run('tier', 'free');
    insertMeta.run('schema_version', '2');
    insertMeta.run('built_at', new Date().toISOString());
    insertMeta.run('builder', 'build-db.ts');
    insertMeta.run('jurisdiction', 'LU');
  });
  writeMeta();

  // Finalize: switch to DELETE journal mode (required for WASM SQLite / readonly)
  db.pragma('journal_mode = DELETE');
  db.exec('ANALYZE');
  db.exec('VACUUM');
  db.close();

  const size = fs.statSync(DB_PATH).size;
  console.log(
    `\nBuild complete: ${totalDocs} documents, ${totalProvisions} provisions, ` +
    `${totalDefs} definitions, ${totalEuDocuments} EU documents, ${totalEuReferences} EU references`
  );
  if (totalDuplicateRefs > 0) {
    console.log(
      `Data quality: ${totalDuplicateRefs} duplicate refs detected ` +
      `(${totalConflictingDuplicates} with conflicting text).`
    );
  }
  console.log(`Output: ${DB_PATH} (${(size / 1024).toFixed(1)} KB)`);
}

buildDatabase();
