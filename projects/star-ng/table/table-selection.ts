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
  /** In a grid: the selection cell of a row, which takes the focus instead of its control. */
  readonly gridCell?: (tr: HTMLElement) => HTMLElement | null;
  /**
   * The filter result in display order: the scope of the header check box with
   * `selectionPageOnly` off, and the rows of a range.
   */
  readonly rows: Signal<readonly T[]>;
  /** Rows of the current page. */
  readonly pageRows: Signal<readonly T[]>;
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

/** `change` removes every selected key. */
const ALL = 'all' as const;
/** `change` removes no key. */
const NONE: ReadonlySet<unknown> = new Set();

export class StarTableSelection<T> {
  /** Key of the row where a range starts (the last row clicked or toggled). */
  private anchor: { readonly key: unknown } | null = null;

  constructor(private readonly host: StarTableSelectionHost<T>) {}

  /** Selected keys in order: `selectionKeys` when the owner binds it, else from `selection`. */
  private readonly keyList = computed<readonly unknown[]>(
    () => this.host.selectionKeys() ?? this.host.selection().map((row) => this.host.keyOf(row)),
  );

  /** The selected keys as a set, for fast look-ups. */
  readonly keys = computed(() => new Set(this.keyList()));

  /**
   * Row objects by key: the rows of `selection`, replaced by the rows of `value` in key mode, so
   * a reload or an edit gives the fresh objects.
   */
  private readonly objects = computed(() => {
    const byKey = new Map<unknown, T>();
    for (const row of this.host.selection()) byKey.set(this.host.keyOf(row), row);
    if (this.host.selectionKeys()) {
      const keys = this.keys();
      for (const row of this.host.knownRows()) {
        const key = this.host.keyOf(row);
        if (keys.has(key)) byKey.set(key, row);
      }
    }
    return byKey;
  });

  /**
   * The selected rows as objects. In key mode: the rows of the keys that resolve (a key of a row
   * that the table never had, for example on another lazy page, has no object).
   */
  readonly rowsOfKeys = computed<readonly T[]>(() => {
    if (!this.host.selectionKeys()) return this.host.selection();
    const objects = this.objects();
    return this.keyList().flatMap((key) => (objects.has(key) ? [objects.get(key) as T] : []));
  });

  /** Rows that the header check box covers: the filter result, or the page. */
  private readonly scope = computed(() =>
    (this.host.pageOnly() ? this.host.pageRows() : this.host.rows()).filter((row) =>
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

  /** Check box of a row, or Space on a row: adds or removes the row (single: the only row). */
  toggle(row: T, event: Event | null): boolean {
    if (!this.selectable(row)) return false;
    const key = this.host.keyOf(row);
    this.anchor = { key };
    const selected = this.isSelected(row);
    if (this.host.mode() === 'single') {
      return selected ? this.change([], ALL, event) : this.change([row], ALL, event);
    }
    return selected ? this.change([], new Set([key]), event) : this.change([row], NONE, event);
  }

  /** Radio of a row, or a click in single mode: the row becomes the selection. */
  selectOnly(row: T, event: Event | null): boolean {
    if (!this.selectable(row)) return false;
    this.anchor = { key: this.host.keyOf(row) };
    return this.change([row], ALL, event);
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
      this.change(this.range(row), meta ? NONE : ALL, event);
      return;
    }
    if (meta) this.toggle(row, event);
    else this.selectOnly(row, event);
  }

  /**
   * Shift + Space or Shift + Arrow: adds the rows from the anchor to `row` (multiple only). The
   * range only grows: a move back toward the anchor does not clear rows.
   */
  extendTo(row: T, event: Event | null): boolean {
    if (this.host.mode() !== 'multiple') return this.selectOnly(row, event);
    if (!this.anchor) this.anchor = { key: this.host.keyOf(row) };
    return this.change(this.range(row), NONE, event);
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
    const done = checked
      ? this.change(rows, NONE, event, false)
      : this.change([], new Set(rows.map((row) => this.host.keyOf(row))), event, false);
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
      this.toggle(row, event);
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
    const control =
      this.host.gridCell?.(next) ?? next.querySelector<HTMLElement>('td.star-table__select input');
    (onRow ? next : (control ?? next)).focus();
    return row;
  }

  /** Rows from the anchor to `row` that can be selected. */
  private range(row: T): T[] {
    const anchor = this.anchor?.key ?? this.host.keyOf(row);
    return starSelectionRange(
      this.host.rows(),
      this.host.keyOf,
      anchor,
      this.host.keyOf(row),
    ).filter((item) => this.selectable(item));
  }

  /**
   * Changes the selection by keys: removes `remove` (or all keys), then adds the keys of `add`.
   * Keys without a row object stay as they are, so a selection on other lazy pages survives.
   * `selectionChanging` gets the row objects before and after; `perRow` emits `rowUnselect`,
   * then `rowSelect`, for each changed row. Returns `false` when nothing changed or a handler
   * cancelled.
   */
  private change(
    add: readonly T[],
    remove: ReadonlySet<unknown> | typeof ALL,
    event: Event | null,
    perRow = true,
  ): boolean {
    const keyOf = this.host.keyOf;
    const before = this.keyList();
    const kept = remove === ALL ? [] : before.filter((key) => !remove.has(key));
    const keptSet = new Set(kept);
    const added = add.filter((row) => {
      const key = keyOf(row);
      if (keptSet.has(key)) return false;
      keptSet.add(key);
      return true;
    });
    const after = [...kept, ...added.map((row) => keyOf(row))];
    const beforeSet = this.keys();
    if (after.length === beforeSet.size && after.every((key) => beforeSet.has(key))) return false;
    const objects = new Map(this.objects());
    for (const row of added) objects.set(keyOf(row), row);
    const previous = this.rowsOfKeys();
    const next = after.flatMap((key) => (objects.has(key) ? [objects.get(key) as T] : []));
    if (!starSelectionChanging(this.host.changing, previous, next)) return false;
    this.host.selection.set(next);
    if (this.host.selectionKeys()) this.host.selectionKeys.set(after);
    if (perRow) {
      const afterSet = new Set(after);
      for (const row of previous) {
        if (!afterSet.has(keyOf(row))) this.host.rowUnselect.emit({ row, originalEvent: event });
      }
      for (const row of added) {
        if (!beforeSet.has(keyOf(row))) this.host.rowSelect.emit({ row, originalEvent: event });
      }
    }
    return true;
  }
}
