import * as core from '@star-ng/ui/core';
import {
  STAR_TABLE_MATCH_MODES,
  ɵstarDayKey,
  ɵstarHasBound,
  ɵstarIsRangeFilter,
  ɵstarMatchesRule,
} from '@star-ng/ui/core';
import * as table from '@star-ng/ui/table';
import * as tableFilter from './table-filter';

describe('table filter logic from core', () => {
  it('the table uses and re-exports the same functions and match modes as core', () => {
    expect(table.STAR_TABLE_MATCH_MODES).toBe(STAR_TABLE_MATCH_MODES);
    expect(tableFilter.starMatchesRule).toBe(ɵstarMatchesRule);
    expect(tableFilter.isRange).toBe(ɵstarIsRangeFilter);
    expect(tableFilter.hasBound).toBe(ɵstarHasBound);
    expect(tableFilter.dayKey).toBe(ɵstarDayKey);
  });

  it('keeps the filter helpers out of the public API', () => {
    const helpers = [
      'starMatchesRule',
      'starMatchesFilter',
      'starRuleActive',
      'starIsActiveFilter',
      'starIsFilterConstraint',
      'starIsRangeFilter',
      'starHasBound',
      'starDayKey',
      'isRange',
      'hasBound',
      'dayKey',
    ];
    for (const name of helpers) {
      expect(name in core, `core exports ${name}`).toBe(false);
      expect(name in table, `table exports ${name}`).toBe(false);
    }
    expect('ɵstarMatchesRule' in table).toBe(false);
    expect(core.STAR_TABLE_MATCH_MODES).toBe(table.STAR_TABLE_MATCH_MODES);
  });
});
