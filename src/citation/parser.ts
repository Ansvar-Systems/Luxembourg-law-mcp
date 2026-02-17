/**
 * Legal citation parser for Luxembourg and legacy section-style references.
 *
 * Supports citations like:
 *   "Loi du 11 avril 1799, art. I.er"
 *   "Loi du 2 août 2002, article 3"
 *   "Section 3, Data Protection Act 2018"
 */

import type { ParsedCitation } from '../types/index.js';

// Luxembourg-style citation: "Loi du 11 avril 1799, art. I.er"
const LUXEMBOURG_ARTICLE =
  /^(?<title>.+?)(?:,\s*|\s+)(?:article|art\.?)\s*(?<article>[a-z0-9().\-]+)$/i;

// Full citation: "Section 3, Data Protection Act 2018"
const FULL_CITATION = /^(?:Section|s\.?)\s+(\d+(?:\(\d+\))*(?:\([a-z]\))*)\s*,?\s+(.+?)\s+(\d{4})$/i;

// Short citation: "s. 3 DPA 2018"
const SHORT_CITATION = /^s\.?\s+(\d+(?:\(\d+\))*(?:\([a-z]\))*)\s+([A-Z][A-Z0-9&\s]*?)\s+(\d{4})$/;

// Section with subsection: "s. 3(1)(a)"
const SECTION_REF = /^(\d+)(?:\((\d+)\))?(?:\(([a-z])\))?$/;

export function parseCitation(citation: string): ParsedCitation {
  const trimmed = citation.trim();

  const luxMatch = trimmed.match(LUXEMBOURG_ARTICLE);
  if (luxMatch?.groups) {
    const title = luxMatch.groups['title']?.trim();
    const article = luxMatch.groups['article']?.trim();
    const yearMatch = title?.match(/\b(\d{4})\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

    if (title && article) {
      return parseArticle(article, title, year, 'statute');
    }
  }

  let match = trimmed.match(FULL_CITATION);
  if (match) {
    return parseArticle(match[1], match[2], parseInt(match[3], 10), 'statute');
  }

  match = trimmed.match(SHORT_CITATION);
  if (match) {
    return parseArticle(match[1], match[2], parseInt(match[3], 10), 'statute');
  }

  return {
    valid: false,
    type: 'unknown',
    error: `Could not parse legal citation: "${trimmed}"`,
  };
}

function parseArticle(
  sectionStr: string,
  title: string,
  year: number | undefined,
  type: 'statute' | 'statutory_instrument'
): ParsedCitation {
  const normalizedSection = sectionStr
    .replace(/^art(?:icle)?\.?\s*/i, '')
    .trim();

  const sectionMatch = normalizedSection.match(SECTION_REF);
  if (!sectionMatch) {
    return {
      valid: true,
      type,
      title: title.trim(),
      year,
      section: normalizedSection,
    };
  }

  return {
    valid: true,
    type,
    title: title.trim(),
    year,
    section: sectionMatch[1],
    subsection: sectionMatch[2] || undefined,
    paragraph: sectionMatch[3] || undefined,
  };
}
