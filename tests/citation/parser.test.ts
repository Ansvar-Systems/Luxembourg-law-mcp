import { describe, expect, it } from 'vitest';
import { parseCitation } from '../../src/citation/parser.js';
import { formatCitation } from '../../src/citation/formatter.js';

describe('citation parser', () => {
  it('parses Luxembourg article citations', () => {
    const parsed = parseCitation('Loi du 11 avril 1799, art. I.er');

    expect(parsed.valid).toBe(true);
    expect(parsed.title).toBe('Loi du 11 avril 1799');
    expect(parsed.year).toBe(1799);
    expect(parsed.section).toBe('I.er');
  });

  it('parses section-style citations', () => {
    const parsed = parseCitation('Section 3, Data Protection Act 2018');

    expect(parsed.valid).toBe(true);
    expect(parsed.section).toBe('3');
    expect(parsed.year).toBe(2018);
  });

  it('formats Luxembourg citations in full and pinpoint styles', () => {
    const parsed = parseCitation('Loi du 11 avril 1799, art. I.er');
    expect(parsed.valid).toBe(true);

    expect(formatCitation(parsed, 'full')).toBe('Loi du 11 avril 1799, art. I.er');
    expect(formatCitation(parsed, 'pinpoint')).toBe('art. I.er');
  });

  it('returns invalid for unknown citations', () => {
    const parsed = parseCitation('this-is-not-a-citation');
    expect(parsed.valid).toBe(false);
    expect(parsed.error).toContain('Could not parse legal citation');
  });
});
