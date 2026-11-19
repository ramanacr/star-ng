/**
 * Column filter model and matching of `star-table`. The pure logic lives in `@star-ng/ui/core`
 * (`filter-rules.ts`), so `star-query-builder` uses the same match modes; this file keeps the
 * names that the table files import. The `ɵ` functions are not public API.
 */
export {
  STAR_TABLE_MATCH_MODES,
  ɵstarDayKey as dayKey,
  ɵstarHasBound as hasBound,
  ɵstarIsRangeFilter as isRange,
  ɵstarIsActiveFilter as starIsActiveFilter,
  ɵstarIsFilterConstraint as starIsFilterConstraint,
  ɵstarMatchesFilter as starMatchesFilter,
  ɵstarMatchesRule as starMatchesRule,
  ɵstarRuleActive as starRuleActive,
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
