/**
 * Column filter model and matching of `star-table`. The pure logic lives in `@star-ng/ui/core`
 * (`filter-rules.ts`), so `star-query-builder` uses the same match modes; this file keeps the
 * names that the table files import.
 */
export {
  STAR_TABLE_MATCH_MODES,
  starDayKey as dayKey,
  starHasBound as hasBound,
  starIsRangeFilter as isRange,
  starIsActiveFilter,
  starIsFilterConstraint,
  starMatchesFilter,
  starMatchesRule,
  starRuleActive,
  type StarColumnFilterType,
  type StarColumnFilters,
  type StarFilterCell,
  type StarFilterConstraint,
  type StarFilterLookup,
  type StarFilterRule,
  type StarFilterRuleValue,
  type StarFilterValue,
  type StarRangeFilter,
  type StarTableMatchMode,
} from '@star-ng/ui/core';
