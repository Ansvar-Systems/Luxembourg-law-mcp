/**
 * Legal citation validator.
 *
 * Validates that a citation maps to an existing document and provision
 * in the local Luxembourg legislation database.
 */

import type { Database } from '@ansvar/mcp-sqlite';
import type { ValidationResult } from '../types/index.js';
import { parseCitation } from './parser.js';

function romanToNumber(value: string): number | null {
  const normalized = value.toUpperCase();
  if (!/^[IVXLCDM]+$/.test(normalized)) {
    return null;
  }

  const map: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };

  let total = 0;
  for (let i = 0; i < normalized.length; i++) {
    const current = map[normalized[i]];
    const next = map[normalized[i + 1]];
    total += next && current < next ? -current : current;
  }
  return total;
}

function provisionCandidates(section: string | undefined): string[] {
  if (!section) {
    return [];
  }

  const cleaned = section
    .trim()
    .toLowerCase()
    .replace(/^art(?:icle)?\.?\s*/i, '')
    .replace(/\s+/g, '');

  if (!cleaned) {
    return [];
  }

  const normalized = cleaned.replace(/[.,;:!?]+$/g, '');
  const candidates = new Set<string>();
  candidates.add(normalized);
  candidates.add(`art${normalized}`);

  // Handle "I.er" and "II" style references.
  const romanLike = normalized.replace(/\./g, '').replace(/er$/i, '');
  const romanNumber = romanToNumber(romanLike);
  if (romanNumber !== null) {
    candidates.add(String(romanNumber));
    candidates.add(`art${romanNumber}`);
  }

  // Handle numeric section references like "3(1)(a)".
  const numeric = normalized.match(/^(\d+)/);
  if (numeric?.[1]) {
    candidates.add(numeric[1]);
    candidates.add(`art${numeric[1]}`);
  }

  return [...candidates];
}

export function validateCitation(db: Database, citation: string): ValidationResult {
  const parsed = parseCitation(citation);
  const warnings: string[] = [];

  if (!parsed.valid) {
    return {
      citation: parsed,
      document_exists: false,
      provision_exists: false,
      warnings: [parsed.error ?? 'Invalid citation format'],
    };
  }

  type DocumentRow = { id: string; title: string; status: string };

  let doc: DocumentRow | undefined;

  if (parsed.title) {
    doc = db.prepare(
      `SELECT id, title, status
       FROM legal_documents
       WHERE lower(title) LIKE lower(?)
       ORDER BY CASE WHEN lower(title) = lower(?) THEN 0 ELSE 1 END, length(title)
       LIMIT 1`
    ).get(`%${parsed.title}%`, parsed.title) as DocumentRow | undefined;
  }

  if (!doc && parsed.year) {
    doc = db.prepare(
      `SELECT id, title, status
       FROM legal_documents
       WHERE issued_date LIKE ? OR title LIKE ?
       ORDER BY length(title)
       LIMIT 1`
    ).get(`${parsed.year}%`, `%${parsed.year}%`) as DocumentRow | undefined;
  }

  if (!doc && parsed.section && parsed.year) {
    for (const candidate of provisionCandidates(parsed.section)) {
      doc = db.prepare(
        `SELECT ld.id, ld.title, ld.status
         FROM legal_documents ld
         JOIN legal_provisions lp ON lp.document_id = ld.id
         WHERE (ld.issued_date LIKE ? OR ld.title LIKE ?)
           AND (lower(lp.provision_ref) = ? OR lower(lp.section) = ?)
         LIMIT 1`
      ).get(
        `${parsed.year}%`,
        `%${parsed.year}%`,
        candidate.toLowerCase(),
        candidate.toLowerCase(),
      ) as DocumentRow | undefined;
      if (doc) {
        break;
      }
    }
  }

  if (!doc) {
    return {
      citation: parsed,
      document_exists: false,
      provision_exists: false,
      warnings: [`Document "${parsed.title ?? 'unknown'} ${parsed.year ?? ''}" not found in database`.trim()],
    };
  }

  if (doc.status === 'repealed') {
    warnings.push('This statute has been repealed');
  }

  // Check provision existence
  let provisionExists = false;
  if (parsed.section) {
    const candidates = provisionCandidates(parsed.section);
    for (const candidate of candidates) {
      const prov = db.prepare(
        `SELECT 1
         FROM legal_provisions
         WHERE document_id = ?
           AND (lower(provision_ref) = ? OR lower(section) = ?)
         LIMIT 1`
      ).get(doc.id, candidate.toLowerCase(), candidate.toLowerCase());
      if (prov) {
        provisionExists = true;
        break;
      }
    }

    if (!provisionExists) {
      warnings.push(`Article/section ${parsed.section} not found in ${doc.title}`);
    }
  }

  return {
    citation: parsed,
    document_exists: true,
    provision_exists: provisionExists,
    document_title: doc.title,
    status: doc.status,
    warnings,
  };
}
