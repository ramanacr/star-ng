// The query model of the query builder: the rule types and the functions that test, complete
// and describe a query. It is its own entry point so that a control can filter with a query
// (the advanced filter of `star-table`) without loading the query builder component.
// `@star-ng/ui/query-builder` re-exports the same public names.
export {
  starQueryComplete,
  starQueryToPredicate,
  starQueryToText,
  starIsQueryGroup as ɵstarIsQueryGroup,
  starQueryEmptyValue as ɵstarQueryEmptyValue,
  starQueryIncompleteCount as ɵstarQueryIncompleteCount,
  starQueryModeLabel as ɵstarQueryModeLabel,
  starQueryModesOf as ɵstarQueryModesOf,
  starQueryNewRule as ɵstarQueryNewRule,
  starQueryOptions as ɵstarQueryOptions,
  starQueryRuleComplete as ɵstarQueryRuleComplete,
} from './query-model';
export type {
  StarQueryCompleteOptions,
  StarQueryField,
  StarQueryFieldType,
  StarQueryGroup,
  StarQueryModeSource,
  StarQueryOption,
  StarQueryRule,
  StarQueryRuleValue,
} from './query-model';
