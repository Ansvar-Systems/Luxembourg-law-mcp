/**
 * SPARQL client and HTTP fetcher for Legilux (Luxembourg legislation).
 *
 * - SPARQL endpoint: https://data.legilux.public.lu/sparqlendpoint (Virtuoso, GET only)
 * - Filestore XML: https://data.legilux.public.lu/filestore/...
 * - Rate-limited to avoid overloading the public endpoint (500ms delay).
 */

const SPARQL_ENDPOINT = 'https://data.legilux.public.lu/sparqlendpoint';
const USER_AGENT = 'AnsvarLuxembourgLawMCP/1.0 (https://ansvar.eu; hello@ansvar.ai)';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SparqlBinding {
  [key: string]: { type: string; value: string; datatype?: string };
}

export interface SparqlResults {
  head: { vars: string[] };
  results: { bindings: SparqlBinding[] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────────────────────────────────────

let lastRequestTime = 0;
const MIN_DELAY_MS = 500;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

// ─────────────────────────────────────────────────────────────────────────────
// SPARQL client
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute a SPARQL SELECT query against the Legilux Virtuoso endpoint.
 * Uses GET with query parameter (Virtuoso does not accept POST for SPARQL).
 */
export async function sparqlQuery(query: string): Promise<SparqlBinding[]> {
  await rateLimit();

  const url = new URL(SPARQL_ENDPOINT);
  url.searchParams.set('query', query);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SPARQL query failed (${response.status}): ${text.slice(0, 500)}`);
  }

  const data = (await response.json()) as SparqlResults;
  return data.results.bindings;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP fetcher
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch XML content from a URL with rate limiting.
 * Returns the raw XML string or null if the request fails (404, etc.).
 */
export async function fetchXml(url: string): Promise<string | null> {
  await rateLimit();

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/xml',
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      return null;
    }

    const text = await response.text();

    // Legilux sometimes returns HTML error pages instead of XML
    if (text.startsWith('<!DOCTYPE html') || text.startsWith('<html')) {
      return null;
    }

    return text;
  } catch {
    return null;
  }
}

/**
 * Construct the filestore XML URL from an ELI URI.
 *
 * ELI URI:  http://data.legilux.public.lu/eli/etat/leg/loi/2026/02/05/a33/jo
 * XML URL:  https://data.legilux.public.lu/filestore/eli/etat/leg/loi/2026/02/05/a33/jo/fr/xml/eli-etat-leg-loi-2026-02-05-a33-jo-fr-xml.xml
 */
export function buildXmlUrl(eliUri: string): string {
  // Extract path after the domain
  const path = eliUri.replace(/^https?:\/\/data\.legilux\.public\.lu\//, '');
  // The French expression path + xml manifestation
  const frXmlPath = `${path}/fr/xml`;
  // Filename: replace slashes with hyphens
  const filename = frXmlPath.replace(/\//g, '-');
  return `https://data.legilux.public.lu/filestore/${frXmlPath}/${filename}.xml`;
}
