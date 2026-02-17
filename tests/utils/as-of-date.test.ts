import { describe, expect, it } from 'vitest';
import { normalizeAsOfDate } from '../../src/utils/as-of-date.js';

describe('normalizeAsOfDate', () => {
  it('accepts valid ISO dates', () => {
    expect(normalizeAsOfDate('2025-12-31')).toBe('2025-12-31');
  });

  it('returns undefined for empty input', () => {
    expect(normalizeAsOfDate('   ')).toBeUndefined();
    expect(normalizeAsOfDate(undefined)).toBeUndefined();
  });

  it('rejects invalid dates', () => {
    expect(() => normalizeAsOfDate('2025-02-30')).toThrow(
      'as_of_date must be an ISO date in YYYY-MM-DD format',
    );
    expect(() => normalizeAsOfDate('31-12-2025')).toThrow(
      'as_of_date must be an ISO date in YYYY-MM-DD format',
    );
  });
});
