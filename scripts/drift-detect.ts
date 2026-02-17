#!/usr/bin/env tsx
/**
 * Drift detection for upstream legal source anchors.
 *
 * Compares hashes of upstream resources from fixtures/golden-hashes.json
 * to detect potential source drift.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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

async function main(): Promise<void> {
  const hashesPath = join(__dirname, '..', 'fixtures', 'golden-hashes.json');
  const hashes = JSON.parse(readFileSync(hashesPath, 'utf-8')) as GoldenHashes;

  if (!Array.isArray(hashes.provisions) || hashes.provisions.length === 0) {
    console.log('No drift anchors configured in fixtures/golden-hashes.json');
    return;
  }

  let driftCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  console.log(`Drift detection: checking ${hashes.provisions.length} provisions...\n`);

  for (const entry of hashes.provisions) {
    if (entry.expected_sha256 === 'COMPUTE_ON_FIRST_RUN') {
      console.log(`  SKIP  ${entry.id}: ${entry.description} (hash not yet computed)`);
      skippedCount++;
      await sleep(1000);
      continue;
    }

    try {
      const response = await fetch(entry.upstream_url, {
        headers: { 'User-Agent': 'Ansvar-Luxembourg-DriftDetect/1.0' },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        console.log(`  ERROR ${entry.id}: HTTP ${response.status} for ${entry.upstream_url}`);
        errorCount++;
        await sleep(1000);
        continue;
      }

      const text = await response.text();
      const hash = sha256(text);

      if (hash !== entry.expected_sha256) {
        console.log(`  DRIFT ${entry.id}: ${entry.description}`);
        console.log(`         Expected: ${entry.expected_sha256}`);
        console.log(`         Got:      ${hash}`);
        driftCount++;
      } else {
        console.log(`  OK    ${entry.id}: ${entry.description}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR ${entry.id}: ${message}`);
      errorCount++;
    }

    await sleep(1000);
  }

  console.log(
    `\nResults: ${hashes.provisions.length - driftCount - errorCount - skippedCount} OK, ${driftCount} drift, ${errorCount} errors, ${skippedCount} skipped`,
  );

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
