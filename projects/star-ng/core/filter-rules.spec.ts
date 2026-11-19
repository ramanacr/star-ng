import {
  ɵstarDayKey,
  ɵstarHasBound,
  ɵstarIsRangeFilter,
  ɵstarMatchesRule,
  ɵstarRuleActive,
} from '@star-ng/ui/core';

describe('filter rules in core', () => {
  it('matches one rule by type, without a table', () => {
    const cell = { raw: 120, text: '120' };
    expect(ɵstarMatchesRule(cell, 'number', { matchMode: 'gt', value: 100 })).toBe(true);
    expect(
      ɵstarMatchesRule(cell, 'number', { matchMode: 'between', value: { min: 1, max: 99 } }),
    ).toBe(false);
    expect(ɵstarRuleActive({ matchMode: 'contains', value: '' })).toBe(false);
    expect(ɵstarDayKey('2026-03-04T10:00:00')).toBe('2026-03-04');
    expect(ɵstarIsRangeFilter({ min: 1 })).toBe(true);
    expect(ɵstarHasBound('')).toBe(false);
  });
});
