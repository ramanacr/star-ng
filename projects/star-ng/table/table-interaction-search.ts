import { computed, linkedSignal, Signal } from '@angular/core';
import type { StarColumn } from './table';
import {
  countMatches,
  highlightParts,
  StarSearchCell,
  StarTableSearchMatches,
  StarTableTextPart,
} from './table-search';

/** The table parts that the search reads. Functions, so the table can give them lazily. */
export interface StarTableSearchHost<T> {
  readonly searchText: Signal<string>;
  readonly filterLocale: () => string | null;
  readonly columns: () => readonly StarColumn<T>[];
  /** Rows of all pages in display order. */
  readonly rows: () => readonly T[];
  readonly isRowCollapsed: (row: T) => boolean;
  readonly trackKey: (row: T) => unknown;
  readonly rowKeyText: (row: T) => string;
  readonly cellText: (row: T, column: StarColumn<T>) => string;
}

/**
 * Search highlight state of `star-table` (`searchText`): the cells with matches, the active
 * match and the marked parts of a cell text. `StarTableInteraction` owns one and delegates to it;
 * the scroll to a match and the announcement stay in the table. Internal.
 */
export class StarTableSearchState<T> {
  constructor(private readonly host: StarTableSearchHost<T>) {}

  /** The cells with matches, in display order (rows of all pages, visible columns). */
  private readonly cells = computed(() => {
    const host = this.host;
    const query = host.searchText();
    const cells: StarSearchCell[] = [];
    const byCell = new Map<string, StarSearchCell>();
    let count = 0;
    if (!query.trim()) return { cells, byCell, count };
    const locale = host.filterLocale();
    const columns = host.columns();
    for (const row of host.rows()) {
      if (host.isRowCollapsed(row)) continue;
      for (const column of columns) {
        const found = countMatches(host.cellText(row, column), query, locale);
        if (!found) continue;
        const cell = {
          rowKey: host.trackKey(row),
          field: column.field,
          start: count,
          count: found,
        };
        cells.push(cell);
        byCell.set(`${host.rowKeyText(row)}\u0000${column.field}`, cell);
        count += found;
      }
    }
    return { cells, byCell, count };
  });

  /**
   * Index of the active match: none (-1) after each new search text and each change of the
   * matches (new data, other columns), so the index never points to another match.
   */
  private readonly index = linkedSignal({ source: () => this.cells(), computation: () => -1 });

  /** `searchMatches` of the table: the count and the active match (-1: none yet). */
  readonly matches: Signal<StarTableSearchMatches> = computed(() => {
    const count = this.cells().count;
    const active = this.index();
    return { count, active: active < count ? active : -1 };
  });

  /**
   * Makes the next (`1`) or previous (`-1`) match active, with wrap. Returns the count, the new
   * active index and the cell of that match (none without matches).
   */
  step(step: 1 | -1): { readonly count: number; readonly active: number; cell?: StarSearchCell } {
    const { count, cells } = this.cells();
    if (!count) {
      this.index.set(-1);
      return { count: 0, active: -1 };
    }
    const current = this.matches().active;
    const next = current < 0 ? (step > 0 ? 0 : count - 1) : (current + step + count) % count;
    this.index.set(next);
    const cell = cells.find((item) => next >= item.start && next < item.start + item.count);
    return { count, active: next, cell };
  }

  /** The parts of the display text of a cell, with the search marks. */
  parts(row: T, column: StarColumn<T>): StarTableTextPart[] {
    const host = this.host;
    return this.markedText(
      host.cellText(row, column),
      `${host.rowKeyText(row)}\u0000${column.field}`,
    );
  }

  /** The marked parts of a text in the cell with the key `<row key text>\u0000<field>`. */
  private markedText(text: string, key: string): StarTableTextPart[] {
    const cell = this.cells().byCell.get(key);
    const active = this.matches().active;
    const local = cell && active >= cell.start && active < cell.start + cell.count;
    return highlightParts(
      text,
      this.host.searchText(),
      this.host.filterLocale(),
      local ? active - cell.start : -1,
    );
  }

  /** `highlight` functions of the cell template contexts, one per cell (a stable reference). */
  private readonly highlighters = new Map<string, (text: unknown) => StarTableTextPart[]>();

  /** The `highlight(text)` function of a cell template context. */
  highlighter(row: T, column: StarColumn<T>): (text: unknown) => StarTableTextPart[] {
    const key = `${this.host.rowKeyText(row)}\u0000${column.field}`;
    let highlight = this.highlighters.get(key);
    if (!highlight) {
      if (this.highlighters.size > 5000) this.highlighters.clear();
      // The function keeps the key text only, not the row object.
      highlight = (text) =>
        this.markedText(text === null || text === undefined ? '' : String(text), key);
      this.highlighters.set(key, highlight);
    }
    return highlight;
  }
}
