/**
 * Legal citation formatter with Luxembourg-friendly defaults.
 *
 * Formats:
 *   full:     "Loi du 11 avril 1799, art. I.er"
 *   short:    "art. I.er Loi du 11 avril 1799"
 *   pinpoint: "art. I.er"
 */

import type { ParsedCitation, CitationFormat } from '../types/index.js';

export function formatCitation(
  parsed: ParsedCitation,
  format: CitationFormat = 'full'
): string {
  if (!parsed.valid || !parsed.section) {
    return '';
  }

  const pinpoint = buildPinpoint(parsed);
  const title = parsed.title?.trim();
  const year = parsed.year ? String(parsed.year) : '';
  const luxembourgStyle = !!title && /^(loi|règlement|reglement|arr[eê]t[eé])/i.test(title);

  switch (format) {
    case 'full':
      if (luxembourgStyle) {
        return `${title}, art. ${pinpoint}`.trim();
      }
      return `Section ${pinpoint}, ${title ?? ''} ${year}`.trim();

    case 'short':
      return `art. ${pinpoint} ${title ?? ''} ${year}`.trim();

    case 'pinpoint':
      return `art. ${pinpoint}`;

    default:
      if (luxembourgStyle) {
        return `${title}, art. ${pinpoint}`.trim();
      }
      return `Section ${pinpoint}, ${title ?? ''} ${year}`.trim();
  }
}

function buildPinpoint(parsed: ParsedCitation): string {
  let ref = parsed.section ?? '';
  if (parsed.subsection) {
    ref += `(${parsed.subsection})`;
  }
  if (parsed.paragraph) {
    ref += `(${parsed.paragraph})`;
  }
  return ref;
}
