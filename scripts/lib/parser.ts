/**
 * Akoma Ntoso XML parser for Legilux Luxembourg legislation.
 *
 * Parses the AKN XML format used by Legilux to extract articles
 * and their content from Luxembourg laws.
 */

import { XMLParser } from 'fast-xml-parser';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedProvision {
  provision_ref: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedLaw {
  title: string;
  dateDocument: string | null;
  typeDocument: string | null;
  provisions: ParsedProvision[];
}

// ─────────────────────────────────────────────────────────────────────────────
// XML parser config
// ─────────────────────────────────────────────────────────────────────────────

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
  isArray: (name: string) => {
    // These elements can appear multiple times
    return [
      'article', 'chapter', 'section', 'part',
      'alinea', 'paragraph', 'p', 'li', 'ol', 'ul',
      'content', 'num', 'heading', 'container',
      'scl:jolux',
    ].includes(name);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Text extraction helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inline elements that should be concatenated directly (no space) into text.
 */
const INLINE_ELEMENTS = new Set(['sup', 'sub', 'b', 'i', 'em', 'strong', 'span']);

/**
 * Recursively extract all text from a parsed XML node.
 * Handles mixed content where inline elements like <sup> should be
 * concatenated without spaces into the surrounding text.
 */
function extractText(node: unknown, noSpace = false): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (typeof node === 'boolean') return '';

  if (Array.isArray(node)) {
    return node.map(n => extractText(n, noSpace)).filter(Boolean).join(noSpace ? '' : ' ');
  }

  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    const parts: string[] = [];

    // Handle #text first to maintain order, then other elements
    if ('#text' in obj) {
      parts.push(extractText(obj['#text'], noSpace));
    }

    for (const [key, value] of Object.entries(obj)) {
      if (key === '#text') continue;
      if (key.startsWith('@_')) continue;

      if (INLINE_ELEMENTS.has(key)) {
        // Inline elements: concatenate directly into previous text
        const inlineText = extractText(value, true);
        if (inlineText && parts.length > 0) {
          parts[parts.length - 1] = parts[parts.length - 1] + inlineText;
        } else if (inlineText) {
          parts.push(inlineText);
        }
      } else {
        parts.push(extractText(value, noSpace));
      }
    }

    return parts.filter(Boolean).join(noSpace ? '' : ' ');
  }

  return '';
}

/**
 * Clean extracted text: normalize whitespace, fix punctuation spacing.
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

/**
 * Extract the article number from a <num> element.
 * Handles: "Art. 1er.", "Art. 2.", "Art. 10bis.", etc.
 *
 * The XML has <num>Art. 1<sup>er</sup>. </num> which fast-xml-parser renders
 * as #text="Art. 1." + sup="er", giving us "Art. 1.er" after inline concat.
 * We clean this to extract the pure number: "1er".
 */
function extractArticleNum(numNode: unknown): string {
  const rawText = extractText(numNode);
  // Remove "Art." prefix first
  let cleaned = rawText.replace(/^Art\.\s*/i, '').trim();
  // Remove trailing period
  cleaned = cleaned.replace(/\.\s*$/, '');
  // Fix artifact from parser: "1.er" -> "1er" (period before sup content)
  cleaned = cleaned.replace(/(\d+)\.(\w+)$/, '$1$2');
  // Remove any remaining spaces
  cleaned = cleaned.replace(/\s+/g, '');
  return cleaned;
}

/**
 * Normalize article ref to a consistent format.
 * "1er" -> "art1", "2" -> "art2", "10bis" -> "art10bis"
 */
function normalizeArticleRef(num: string): string {
  const cleaned = num
    .replace(/\s+/g, '')
    .replace(/^art\.?\s*/i, '')
    .replace(/\.$/g, '')
    .toLowerCase();

  // Handle "1er" -> "1"
  const normalized = cleaned.replace(/^(\d+)er$/, '$1');

  return `art${normalized}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Article extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractArticles(body: Record<string, unknown>): ParsedProvision[] {
  const provisions: ParsedProvision[] = [];

  function processArticle(article: Record<string, unknown>, chapterRef?: string): void {
    const numNode = article['num'];
    const articleNum = numNode ? extractArticleNum(numNode) : '';

    if (!articleNum) return;

    const ref = normalizeArticleRef(articleNum);
    // For display: "1er" -> "Article 1er", "2" -> "Article 2"
    const displayNum = articleNum.match(/^\d+er$/i) ? articleNum : articleNum;
    const title = `Article ${displayNum}`;

    // Extract content from alinea/content/p elements
    const contentParts: string[] = [];

    // Handle alinea elements (most common structure)
    const alineas = article['alinea'];
    if (alineas) {
      const alineaArr = Array.isArray(alineas) ? alineas : [alineas];
      for (const alinea of alineaArr) {
        const text = cleanText(extractText(alinea));
        if (text) contentParts.push(text);
      }
    }

    // Handle paragraph elements
    const paragraphs = article['paragraph'];
    if (paragraphs) {
      const paraArr = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
      for (const para of paraArr) {
        const text = cleanText(extractText(para));
        if (text) contentParts.push(text);
      }
    }

    // Handle direct content elements
    const contentNodes = article['content'];
    if (contentNodes && !alineas && !paragraphs) {
      const contentArr = Array.isArray(contentNodes) ? contentNodes : [contentNodes];
      for (const content of contentArr) {
        const text = cleanText(extractText(content));
        if (text) contentParts.push(text);
      }
    }

    // Handle direct p elements
    const pNodes = article['p'];
    if (pNodes && !alineas && !paragraphs && !contentNodes) {
      const pArr = Array.isArray(pNodes) ? pNodes : [pNodes];
      for (const p of pArr) {
        const text = cleanText(extractText(p));
        if (text) contentParts.push(text);
      }
    }

    const fullContent = contentParts.join('\n\n');

    if (fullContent) {
      provisions.push({
        provision_ref: ref,
        section: chapterRef ?? '1',
        title,
        content: fullContent,
      });
    }
  }

  function processContainer(container: Record<string, unknown>, chapterRef?: string): void {
    // Process articles directly in this container
    const articles = container['article'];
    if (articles) {
      const articleArr = Array.isArray(articles) ? articles : [articles];
      for (const article of articleArr) {
        if (typeof article === 'object' && article !== null) {
          processArticle(article as Record<string, unknown>, chapterRef);
        }
      }
    }

    // Process chapters
    const chapters = container['chapter'];
    if (chapters) {
      const chapterArr = Array.isArray(chapters) ? chapters : [chapters];
      for (let i = 0; i < chapterArr.length; i++) {
        const chapter = chapterArr[i] as Record<string, unknown>;
        const chapterNum = chapter['num'] ? cleanText(extractText(chapter['num'])) : String(i + 1);
        processContainer(chapter, chapterNum);
      }
    }

    // Process sections
    const sections = container['section'];
    if (sections) {
      const sectionArr = Array.isArray(sections) ? sections : [sections];
      for (let i = 0; i < sectionArr.length; i++) {
        const section = sectionArr[i] as Record<string, unknown>;
        const sectionNum = section['num']
          ? cleanText(extractText(section['num']))
          : (chapterRef ? `${chapterRef}.${i + 1}` : String(i + 1));
        processContainer(section, sectionNum);
      }
    }

    // Process parts
    const parts = container['part'];
    if (parts) {
      const partArr = Array.isArray(parts) ? parts : [parts];
      for (let i = 0; i < partArr.length; i++) {
        const part = partArr[i] as Record<string, unknown>;
        const partNum = part['num']
          ? cleanText(extractText(part['num']))
          : String(i + 1);
        processContainer(part, partNum);
      }
    }
  }

  processContainer(body);
  return provisions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata extraction from SCL extensions
// ─────────────────────────────────────────────────────────────────────────────

function extractMetadata(meta: Record<string, unknown>): { dateDocument: string | null; typeDocument: string | null } {
  let dateDocument: string | null = null;
  let typeDocument: string | null = null;

  try {
    const identification = meta['identification'] as Record<string, unknown> | undefined;
    if (!identification) return { dateDocument, typeDocument };

    const joluxWork = identification['scl:JOLUXWork'] as Record<string, unknown> | undefined;
    if (!joluxWork) return { dateDocument, typeDocument };

    const legalResource = joluxWork['scl:JOLUXLegalResource'] as Record<string, unknown> | undefined;
    if (!legalResource) return { dateDocument, typeDocument };

    const joluxEntries = legalResource['scl:jolux'];
    if (!joluxEntries) return { dateDocument, typeDocument };

    const entries = Array.isArray(joluxEntries) ? joluxEntries : [joluxEntries];

    for (const entry of entries) {
      if (typeof entry !== 'object' || entry === null) continue;
      const obj = entry as Record<string, unknown>;
      const name = obj['@_scl:name'] as string | undefined;
      const value = (obj['#text'] ?? '') as string;

      if (name === 'dateDocument' && value) {
        dateDocument = value;
      }
      if (name === 'typeDocument' && value) {
        // Extract short type from URI
        const match = value.match(/resource-type\/(\w+)$/);
        typeDocument = match ? match[1] : value;
      }
    }
  } catch {
    // Metadata extraction is best-effort
  }

  return { dateDocument, typeDocument };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse Akoma Ntoso XML from Legilux into structured provisions.
 */
export function parseAknXml(xml: string): ParsedLaw | null {
  try {
    const doc = parser.parse(xml);

    // Navigate to the act element
    const akomaNtoso = doc['akomaNtoso'];
    if (!akomaNtoso) return null;

    const act = akomaNtoso['act'];
    if (!act) return null;

    // Extract title from preface/longTitle
    let title = '';
    const preface = act['preface'] as Record<string, unknown> | undefined;
    if (preface) {
      const longTitle = preface['longTitle'] as Record<string, unknown> | undefined;
      if (longTitle) {
        title = cleanText(extractText(longTitle));
      }
    }

    // Fall back to meta title
    if (!title) {
      const meta = act['meta'] as Record<string, unknown> | undefined;
      if (meta) {
        const identification = meta['identification'] as Record<string, unknown> | undefined;
        if (identification) {
          const joluxExpr = identification['scl:JOLUXExpression'] as Record<string, unknown> | undefined;
          if (joluxExpr) {
            const entries = joluxExpr['scl:jolux'];
            const entryArr = Array.isArray(entries) ? entries : entries ? [entries] : [];
            for (const entry of entryArr) {
              if (typeof entry === 'object' && entry !== null) {
                const obj = entry as Record<string, unknown>;
                if (obj['@_scl:name'] === 'title') {
                  title = cleanText(String(obj['#text'] ?? ''));
                  break;
                }
              }
            }
          }
        }
      }
    }

    // Extract metadata
    const meta = act['meta'] as Record<string, unknown> | undefined;
    const { dateDocument, typeDocument } = meta ? extractMetadata(meta) : { dateDocument: null, typeDocument: null };

    // Extract articles from body
    const body = act['body'] as Record<string, unknown> | undefined;
    if (!body) {
      return { title, dateDocument, typeDocument, provisions: [] };
    }

    const provisions = extractArticles(body);

    return {
      title,
      dateDocument,
      typeDocument,
      provisions,
    };
  } catch (error) {
    console.error('Failed to parse AKN XML:', error);
    return null;
  }
}
