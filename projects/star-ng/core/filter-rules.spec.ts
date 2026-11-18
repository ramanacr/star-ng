import {
  starDayKey,
  starHasBound,
  starIsRangeFilter,
  starMatchesRule,
  starRuleActive,
} from '@star-ng/ui/core';

describe('filter rules in core', () => {
  it('matches one rule by type, without a table', () => {
    const cell = { raw: 120, text: '120' };
    expect(starMatchesRule(cell, 'number', { matchMode: 'gt', value: 100 })).toBe(true);
    expect(
      starMatchesRule(cell, 'number', { matchMode: 'between', value: { min: 1, max: 99 } }),
    ).toBe(false);
    expect(starRuleActive({ matchMode: 'contains', value: '' })).toBe(false);
    expect(starDayKey('2026-03-04T10:00:00')).toBe('2026-03-04');
    expect(starIsRangeFilter({ min: 1 })).toBe(true);
    expect(starHasBound('')).toBe(false);
  });
});
