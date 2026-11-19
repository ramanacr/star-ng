/**
 * Row spans of `star-table` with `rowGroupMode="rowspan"`: a cell merges with the cells below it
 * that have the same text, so a group value shows once over its rows. PrimeNG
 * `rowGroupMode="rowspan"` with `groupRowsBy`. Pure helper, no DOM.
 */

export interface StarRowSpanOptions<T> {
  /** Display text of a cell: equal texts merge. */
  readonly textOf: (row: T, field: string) => string;
  /** Group of a row (`groupBy`): a run never crosses into another group. */
  readonly groupOf?: ((row: T) => string) | null;
  /** A run ends after this row (a row with its detail row open). */
  readonly endsRun?: (row: T) => boolean;
}

/**
 * Row spans of the merged columns, by field: one number per row. `n > 1`: the first row of a run
 * of `n` rows with the same text (the cell gets `rowspan="n"`); `0`: a later row of a run (no
 * cell); `1`: a cell of its own. An empty text never merges.
 */
export function rowSpans<T>(
  rows: readonly T[],
  fields: readonly string[],
  options: StarRowSpanOptions<T>,
): ReadonlyMap<string, readonly number[]> {
  const spans = new Map<string, readonly number[]>();
  for (const field of fields) {
    const result = new Array<number>(rows.length).fill(1);
    let start = 0;
    for (let index = 1; index <= rows.length; index++) {
      const previous = rows[index - 1];
      const row = rows[index];
      const text = options.textOf(previous, field);
      const same =
        index < rows.length &&
        text !== '' &&
        options.textOf(row, field) === text &&
        !options.endsRun?.(previous) &&
        (!options.groupOf || options.groupOf(row) === options.groupOf(previous));
      if (same) continue;
      const length = index - start;
      if (length > 1) {
        result[start] = length;
        for (let i = start + 1; i < index; i++) result[i] = 0;
      }
      start = index;
    }
    spans.set(field, result);
  }
  return spans;
}
