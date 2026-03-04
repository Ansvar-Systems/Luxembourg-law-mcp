#!/usr/bin/env tsx
/**
 * Drift detection for upstream legal source anchors.
 *
 * Compares hashes of upstream resources from fixtures/golden-hashes.json
 * to detect potential source drift.
 *
 * Run with --seed to compute initial hashes for COMPUTE_ON_FIRST_RUN entries.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface GoldenHashEntry {
  id: string;
  description: string;
  upstream_url: string;
  selector_hint: string;
  expected_sha256: string;
  expected_snippet: string;
}

interface GoldenHashes {
  $schema: string;
  version: string;
  mcp_name: string;
  jurisdiction: string;
  description: string;
  provisions: GoldenHashEntry[];
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function sha256(text: string): string {
  return createHash('sha256').update(normalizeText(text)).digest('hex');
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHash(url: string): Promise<{ hash: string; text: string } | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Ansvar-Luxembourg-DriftDetect/1.0' },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return null;
    }

    const text = await response.text();
    return { hash: sha256(text), text };
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const hashesPath = join(__dirname, '..', 'fixtures', 'golden-hashes.json');
  const hashes = JSON.parse(readFileSync(hashesPath, 'utf-8')) as GoldenHashes;
  const seedMode = process.argv.includes('--seed');

  if (!Array.isArray(hashes.provisions) || hashes.provisions.length === 0) {
    console.log('No drift anchors configured in fixtures/golden-hashes.json');
    return;
  }

  let driftCount = 0;
  let errorCount = 0;
  let seededCount = 0;

  const mode = seedMode ? 'Seed mode' : 'Drift detection';
  console.log(`${mode}: checking ${hashes.provisions.length} provisions...\n`);

  for (const entry of hashes.provisions) {
    const needsSeed = entry.expected_sha256 === 'COMPUTE_ON_FIRST_RUN';

    if (needsSeed && !seedMode) {
      console.log(`  SKIP  ${entry.id}: ${entry.description} (run with --seed to compute)`);
      await sleep(1000);
      continue;
    }

    const result = await fetchHash(entry.upstream_url);

    if (!result) {
      console.log(`  ERROR ${entry.id}: Failed to fetch ${entry.upstream_url}`);
      errorCount++;
      await sleep(1000);
      continue;
    }

    if (needsSeed) {
      // Verify snippet is present before seeding
      if (!normalizeText(result.text).includes(normalizeText(entry.expected_snippet))) {
        console.log(`  WARN  ${entry.id}: Snippet "${entry.expected_snippet}" not found in response — seeding anyway`);
      }
      entry.expected_sha256 = result.hash;
      console.log(`  SEED  ${entry.id}: ${result.hash.slice(0, 16)}... (${entry.description})`);
      seededCount++;
    } else if (result.hash !== entry.expected_sha256) {
      console.log(`  DRIFT ${entry.id}: ${entry.description}`);
      console.log(`         Expected: ${entry.expected_sha256}`);
      console.log(`         Got:      ${result.hash}`);
      driftCount++;
    } else {
      console.log(`  OK    ${entry.id}: ${entry.description}`);
    }

    await sleep(1000);
  }

  if (seededCount > 0) {
    writeFileSync(hashesPath, JSON.stringify(hashes, null, 2) + '\n', 'utf-8');
    console.log(`\nSeeded ${seededCount} hashes → fixtures/golden-hashes.json updated.`);
  }

  const checked = hashes.provisions.length - errorCount - seededCount;
  const ok = checked - driftCount;
  console.log(`\nResults: ${ok} OK, ${driftCount} drift, ${errorCount} errors, ${seededCount} seeded`);

  if (driftCount > 0) {
    process.exit(2);
  }
  if (errorCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`drift-detect failed: ${message}`);
  process.exit(1);
});
