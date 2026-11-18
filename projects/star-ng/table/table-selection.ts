import { computed, ModelSignal, OutputEmitterRef, Signal } from '@angular/core';
import { starSelectionChanging, StarSelectionChangingEvent } from '@star-ng/ui/select';

/**
 * Row selection of `star-table`: check box and radio column, header check box, meta-key and
 * range selection, keyboard, selectable rows, key-based selection and the cancelable
 * `selectionChanging` event. The table owns the inputs; this file holds the logic, so `table.ts`
 * stays small.
 */

/** `rowSelect` / `rowUnselect`: one row joined or left the selection (PrimeNG `onRowSelect`). */
export interface StarRowSelectEvent<T> {
  readonly row: T;
  /** The click or key event that changed the selection, or `null`. */
  readonly originalEvent: Event | null;
}

/** `headerCheckboxToggle`: the header check box was toggled (PrimeNG `onHeaderCheckboxToggle`). */
export interface StarHeaderCheckboxToggleEvent {
  readonly checked: boolean;
  readonly originalEvent: Event | null;
}

/** `selectionChanging` of the table: the selected rows now and after the change. */
export type StarTableSelectionChangingEvent<T> = StarSelectionChangingEvent<readonly T[]>;

/** What the selection logic reads from and writes to the table. */
export interface StarTableSelectionHost<T> {
  readonly mode: Signal<'single' | 'multiple' | null>;
  readonly selection: ModelSignal<readonly T[]>;
  readonly selectionKeys: ModelSignal<readonly unknown[] | null>;
  readonly selectAll: ModelSignal<boolean | null>;
  readonly metaKeySelection: Signal<boolean>;
  readonly pageOnly: Signal<boolean>;
  readonly rowSelectable: Signal<((row: T) => boolean) | null>;
  /** Row key (`dataKey`, else the row object). */
  readonly keyOf: (row: T) => unknown;
  /** Rows that "select all" covers when `selectionPageOnly` is off: the filter result. */
  readonly allRows: Signal<readonly T[]>;
  /** Rows of the current page. */
  readonly pageRows: Signal<readonly T[]>;
  /** Rows in display order, for ranges. */
  readonly orderedRows: Signal<readonly T[]>;
  /** Rows that resolve a key to a fresh row object (`value`). */
  readonly knownRows: Signal<readonly T[]>;
  readonly changing: OutputEmitterRef<StarTableSelectionChangingEvent<T>>;
  readonly rowSelect: OutputEmitterRef<StarRowSelectEvent<T>>;
  readonly rowUnselect: OutputEmitterRef<StarRowSelectEvent<T>>;
  readonly headerToggle: OutputEmitterRef<StarHeaderCheckboxToggleEvent>;
}

/** What a key press on a row asks for. */
export type StarSelectionKeyAction = 'toggle' | 'range' | 'extend-up' | 'extend-down' | null;

/**
 * Selection keys: Space toggles the focused row (on the row itself; a check box toggles on its
 * own), Shift + Space selects the range from the anchor row, Shift + Arrow Up / Down moves to the
 * next row and extends the range.
 */
export function starSelectionKey(event: KeyboardEvent, onRow: boolean): StarSelectionKeyAction {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  if (event.key === ' ' || event.key === 'Spacebar') {
    if (event.shiftKey) return 'range';
    return onRow ? 'toggle' : null;
  }
  if (!event.shiftKey) return null;
  if (event.key === 'ArrowUp') return 'extend-up';
  if (event.key === 'ArrowDown') return 'extend-down';
  return null;
}

/** Rows from `fromKey` to `toKey` (both included) in the order of `rows`. */
export function starSelectionRange<T>(
  rows: readonly T[],
  keyOf: (row: T) => unknown,
  fromKey: unknown,
  toKey: unknown,
): T[] {
  const from = rows.findIndex((row) => Object.is(keyOf(row), fromKey));
  const to = rows.findIndex((row) => Object.is(keyOf(row), toKey));
  if (to < 0) return [];
  if (from < 0) return [rows[to]];
  return rows.slice(Math.min(from, to), Math.max(from, to) + 1);
}

export class StarTableSelection<T> {
  /** Key of the row where a range starts (the last row clicked or toggled). */
  private anchor: { readonly key: unknown } | null = null;

  constructor(private readonly host: StarTableSelectionHost<T>) {}

  /** Keys of the selected rows: `selectionKeys` when the owner binds it, else from `selection`. */
  readonly keys = computed(() => {
    const keys = this.host.selectionKeys();
    if (keys) return new Set(keys);
    return new Set(this.host.selection().map((row) => this.host.keyOf(row)));
  });

  /** Rows that the header check box covers: the filter result, or the page. */
  private readonly scope = computed(() =>
    (this.host.pageOnly() ? this.host.pageRows() : this.host.allRows()).filter((row) =>
      this.selectable(row),
    ),
  );

  /** State of the header check box. */
  readonly headerState = computed<boolean | 'mixed'>(() => {
    const rows = this.scope();
    const keys = this.keys();
    const count = rows.filter((row) => keys.has(this.host.keyOf(row))).length;
    const all = this.host.selectAll();
    if (all !== null) return all ? true : count ? 'mixed' : false;
    if (!rows.length || count === 0) return false;
    return count === rows.length ? true : 'mixed';
  });

  /** The header check box has rows to select. */
  readonly headerEnabled = computed(() => this.host.selectAll() !== null || !!this.scope().length);

  isSelected(row: T): boolean {
    return this.keys().has(this.host.keyOf(row));
  }

  selectable(row: T): boolean {
    const test = this.host.rowSelectable();
    return !test || test(row);
  }

  /** Check box of a row (multiple) or a Space on the row: adds or removes the row. */
  toggle(row: T, event: Event | null): boolean {
    if (!this.selectable(row)) return false;
    this.anchor = { key: this.host.keyOf(row) };
    if (this.host.mode() === 'single') {
      return this.commit(this.isSelected(row) ? [] : [row], event);
    }
    const key = this.host.keyOf(row);
    const current = this.current();
    return this.commit(
      this.isSelected(row)
        ? current.filter((selected) => !Object.is(this.host.keyOf(selected), key))
        : [...current, row],
      event,
    );
  }

  /** Radio of a row, or a click in single mode: the row becomes the selection. */
  selectOnly(row: T, event: Event | null): boolean {
    if (!this.selectable(row)) return false;
    this.anchor = { key: this.host.keyOf(row) };
    if (this.isSelected(row) && this.keys().size === 1) return false;
    return this.commit([row], event);
  }

  /**
   * A click on a row. Without `metaKeySelection` only single mode selects (the row becomes the
   * selection). With it: a plain click selects only that row, Ctrl / Cmd + click toggles it, and
   * Shift + click (multiple) selects the range from the anchor row.
   */
  click(row: T, event: MouseEvent): void {
    const mode = this.host.mode();
    if (!mode || !this.selectable(row)) return;
    if (!this.host.metaKeySelection()) {
      if (mode === 'single') this.selectOnly(row, event);
      return;
    }
    const meta = event.ctrlKey || event.metaKey;
    if (event.shiftKey && mode === 'multiple' && this.anchor) {
      const range = this.range(row);
      this.commit(meta ? this.union(this.current(), range) : range, event);
      return;
    }
    if (meta) this.toggle(row, event);
    else {
      this.anchor = { key: this.host.keyOf(row) };
      if (!(this.isSelected(row) && this.keys().size === 1)) this.commit([row], event);
    }
  }

  /** Shift + Space or Shift + Arrow: adds the rows from the anchor to `row` (multiple only). */
  extendTo(row: T, event: Event | null): boolean {
    if (this.host.mode() !== 'multiple') return this.selectOnly(row, event);
    if (!this.anchor) this.anchor = { key: this.host.keyOf(row) };
    return this.commit(this.union(this.current(), this.range(row)), event);
  }

  /** The header check box: selects or clears every selectable row in its scope. */
  toggleAll(checked: boolean, event: Event | null): boolean {
    if (this.host.selectAll() !== null) {
      // Lazy data: the owner decides what "all" means and sets the selection.
      this.host.selectAll.set(checked);
      this.host.headerToggle.emit({ checked, originalEvent: event });
      return true;
    }
    const rows = this.scope();
    const keys = new Set(rows.map((row) => this.host.keyOf(row)));
    const others = this.current().filter((row) => !keys.has(this.host.keyOf(row)));
    const done = this.commit(checked ? [...others, ...rows] : others, event, false);
    if (done) this.host.headerToggle.emit({ checked, originalEvent: event });
    return done;
  }

  /**
   * Selection keys on a row (`tr`, focusable with `metaKeySelection`) or on its check box or
   * radio. `rowOf` finds the row of another `tr` (and makes it the tab stop).
   */
  keydown(row: T, event: KeyboardEvent, rowOf: (tr: HTMLElement) => T | undefined): void {
    const mode = this.host.mode();
    if (!mode || event.defaultPrevented) return;
    const tr = event.currentTarget as HTMLElement;
    const target = event.target as HTMLElement;
    const onRow = target === tr;
    if (!onRow && !target.closest('td.star-table__select')) return;
    const action = starSelectionKey(event, onRow && this.host.metaKeySelection());
    if (!action) {
      const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
      const plain = !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;
      if (onRow && step && plain && this.moveFocus(tr, step, onRow, rowOf) !== undefined) {
        event.preventDefault();
      }
      return;
    }
    event.preventDefault();
    if (action === 'toggle') {
      if (mode === 'single') this.click(row, new MouseEvent('click'));
      else this.toggle(row, event);
    } else if (action === 'range') {
      this.extendTo(row, event);
    } else {
      const next = this.moveFocus(tr, action === 'extend-up' ? -1 : 1, onRow, rowOf);
      if (next !== undefined) this.extendTo(next, event);
    }
  }

  /** Focuses the next or previous row (or its selection control) and returns that row. */
  private moveFocus(
    tr: HTMLElement,
    step: 1 | -1,
    onRow: boolean,
    rowOf: (tr: HTMLElement) => T | undefined,
  ): T | undefined {
    const sibling = (el: Element) =>
      step === 1 ? el.nextElementSibling : el.previousElementSibling;
    let next = sibling(tr) as HTMLElement | null;
    while (next && !(next.matches('tr.star-table__row') && !next.hidden)) {
      next = sibling(next) as HTMLElement | null;
    }
    const row = next ? rowOf(next) : undefined;
    if (!next || row === undefined) return undefined;
    const control = next.querySelector<HTMLElement>('td.star-table__select input');
    (onRow ? next : (control ?? next)).focus();
    return row;
  }

  /** Rows from the anchor to `row` that can be selected. */
  private range(row: T): T[] {
    const anchor = this.anchor?.key ?? this.host.keyOf(row);
    return starSelectionRange(
      this.host.orderedRows(),
      this.host.keyOf,
      anchor,
      this.host.keyOf(row),
    ).filter((item) => this.selectable(item));
  }

  private union(current: readonly T[], add: readonly T[]): T[] {
    const keys = new Set(current.map((row) => this.host.keyOf(row)));
    return [...current, ...add.filter((row) => !keys.has(this.host.keyOf(row)))];
  }

  /**
   * The selected rows as objects. With `selectionKeys`, each key resolves to the row of `value`
   * (fresh objects after a reload or an edit); a key that is not in `value` keeps its old object.
   */
  private current(): readonly T[] {
    const keys = this.host.selectionKeys();
    if (!keys) return this.host.selection();
    const byKey = new Map<unknown, T>();
    for (const row of this.host.selection()) byKey.set(this.host.keyOf(row), row);
    for (const row of this.host.knownRows()) {
      const key = this.host.keyOf(row);
      if (byKey.has(key) || keys.includes(key)) byKey.set(key, row);
    }
    return keys.flatMap((key) => (byKey.has(key) ? [byKey.get(key) as T] : []));
  }

  /**
   * Sets the selection after `selectionChanging`. Returns `false` when nothing changed or a
   * handler cancelled. `perRow` emits `rowSelect` / `rowUnselect` for each changed row.
   */
  private commit(next: readonly T[], event: Event | null, perRow = true): boolean {
    const previous = this.current();
    const before = new Set(previous.map((row) => this.host.keyOf(row)));
    const after = new Set(next.map((row) => this.host.keyOf(row)));
    if (before.size === after.size && [...after].every((key) => before.has(key))) return false;
    if (!starSelectionChanging(this.host.changing, previous, next)) return false;
    this.host.selection.set(next);
    if (this.host.selectionKeys()) this.host.selectionKeys.set([...after]);
    if (perRow) {
      for (const row of next) {
        if (!before.has(this.host.keyOf(row))) {
          this.host.rowSelect.emit({ row, originalEvent: event });
        }
      }
      for (const row of previous) {
        if (!after.has(this.host.keyOf(row))) {
          this.host.rowUnselect.emit({ row, originalEvent: event });
        }
      }
    }
    return true;
  }
}
