import {
  STAR_TABLE_MATCH_MODES,
  starDayKey,
  starHasBound,
  starIsRangeFilter,
  starMatchesRule,
} from '@star-ng/ui/core';
import * as table from '@star-ng/ui/table';
import * as tableFilter from './table-filter';

describe('table filter logic from core', () => {
  it('the table uses and re-exports the same functions and match modes as core', () => {
    expect(table.STAR_TABLE_MATCH_MODES).toBe(STAR_TABLE_MATCH_MODES);
    expect(tableFilter.starMatchesRule).toBe(starMatchesRule);
    expect(tableFilter.isRange).toBe(starIsRangeFilter);
    expect(tableFilter.hasBound).toBe(starHasBound);
    expect(tableFilter.dayKey).toBe(starDayKey);
  });
});
