import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Database from '@ansvar/mcp-sqlite';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { validateCitation } from '../../src/citation/validator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', '..', 'data', 'database.db');
const dbAvailable = existsSync(dbPath);

describe.skipIf(!dbAvailable)('citation validator', () => {
  let db: InstanceType<typeof Database>;

  beforeAll(() => {
    db = new Database(dbPath, { readonly: true });
  });

  afterAll(() => {
    db?.close();
  });

  it('validates an existing Luxembourg citation with Roman article numbering', () => {
    const result = validateCitation(db, 'Loi du 11 avril 1799, art. I.er');

    expect(result.citation.valid).toBe(true);
    expect(result.document_exists).toBe(true);
    expect(result.provision_exists).toBe(true);
    expect(result.document_title?.toLowerCase()).toContain('hospices civils');
  });

  it('handles non-existent citations gracefully', () => {
    const result = validateCitation(db, 'Loi du 1 janvier 9999, art. ZZZ');

    expect(result.document_exists).toBe(false);
    expect(result.provision_exists).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
