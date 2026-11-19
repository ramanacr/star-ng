import { CdkContextMenuTrigger } from '@angular/cdk/menu';
import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ApplicationRef,
  booleanAttribute,
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  model,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import {
  StarClipboard,
  starInlineKey,
  starIsRtl,
  starPrefersReducedMotion,
  StarUiText,
  ɵstarIsContextMenuKey,
  ɵstarOpenContextMenu,
  ɵstarOptionalBoolean,
} from '@star-ng/ui/core';
import type { StarMenuItem } from '@star-ng/ui/menu';
import type {
  StarCellEditEvent,
  StarColumn,
  StarCsvOptions,
  StarSortOrder,
  StarSortState,
} from './table';
import {
  parseTsv,
  StarTableCopyOptions,
  StarTablePasteCell,
  StarTablePasteEvent,
  toTsv,
} from './table-clipboard';
import { COLUMN_FALLBACK_VIEWPORT } from './table-column-window';
import {
  defaultMenuItems,
  StarTableContextMenuEvent,
  StarTableMenuDefault,
  StarTableMenuItems,
} from './table-context-menu';
import {
  parseEditorText,
  sameEditValue,
  StarCellChange,
  starCellError,
  StarEditBatch,
  StarRowEditSaveEvent,
} from './table-editing';
import {
  cellNavigationTarget,
  columnScrollOffset,
  revealDelta,
  StarScrollAlign,
  StarScrollOptions,
  StarTableCellRef,
  uncoveredRow,
} from './table-navigation';
import type { StarHeaderWidths, StarPinSide } from './table-pinning';
import {
  countMatches,
  highlightParts,
  StarSearchCell,
  StarTableSearchMatches,
  StarTableTextPart,
} from './table-search';
import type { VirtualLayout } from './virtual-heights';

/** Rows of a PageUp / PageDown step when the view has no measured height yet. */
const FALLBACK_PAGE_ROWS = 10;
/** Controls inside a cell that keep their own keys (editors, fields, lists). */
const OWN_KEYS =
  '.star-table__editor, input, select, textarea, [contenteditable]:not([contenteditable="false"]), [role="listbox"], [role="combobox"]';

/** A body cell found from a DOM event: its row, its column and its element. */
interface CellTarget<T> {
  readonly row: T;
  readonly column: StarColumn<T>;
  readonly cell: HTMLElement;
}

/**
 * Cell interaction of `star-table` (Wave C4): cell navigation, the active cell and the keyboard
 * and scroll API. `StarTable` extends it; the members marked `abstract` are the table parts that
 * it reads. Not used on its own.
 */
@Directive({
  host: {
    '(focusin)': 'onCellFocusIn($event)',
    '(keydown)': 'onCellKeydown($event)',
    '(mousedown)': 'onCellMouseDown($event)',
    '(click)': 'onCellClick($event)',
    '(paste)': 'onCellPaste($event)',
  },
})
export abstract class StarTableInteraction<T> {
  protected readonly interactionInjector = inject(Injector);
  private readonly interactionDocument = inject(DOCUMENT);
  private readonly clipboard = inject(StarClipboard);
  private readonly interactionApp = inject(ApplicationRef);

  // ---------------------------------------------------------------- table parts

  abstract readonly columns: Signal<readonly StarColumn<T>[]>;
  abstract readonly virtualScroll: Signal<boolean>;
  abstract readonly virtualRowHeight: Signal<number>;
  protected abstract readonly text: StarUiText;
  protected abstract readonly visibleColumns: Signal<readonly StarColumn<T>[]>;
  protected abstract readonly renderedColumns: Signal<readonly StarColumn<T>[]>;
  protected abstract readonly pageRows: Signal<readonly T[]>;
  /** Rows in the DOM now (the virtual window with the focused row). */
  protected abstract readonly renderedRows: Signal<readonly T[]>;
  protected abstract readonly layout: Signal<VirtualLayout<T> | null>;
  protected abstract readonly scroller: Signal<ElementRef<HTMLElement> | undefined>;
  protected abstract readonly body: Signal<ElementRef<HTMLElement> | undefined>;
  protected abstract readonly rowEditMode: Signal<boolean>;
  protected abstract readonly editing: WritableSignal<string | null>;
  protected abstract trackKey(row: T): unknown;
  protected abstract rowKeyText(row: T): string;
  protected abstract cellText(row: T, column: StarColumn<T>): string;
  protected abstract isEditable(row: T, column: StarColumn<T>): boolean;
  protected abstract isEditing(row: T, column: StarColumn<T>): boolean;
  protected abstract isRowInEdit(row: T): boolean;
  protected abstract isRowCollapsed(row: T): boolean;
  protected abstract rowSpan(index: number, column: StarColumn<T>): number;
  protected abstract startEdit(row: T, column: StarColumn<T>): void;
  abstract initRowEdit(row: T): void;
  protected abstract revealItem(index: number): void;
  abstract readonly virtualColumns: Signal<boolean>;
  protected abstract readonly headerWidths: Signal<StarHeaderWidths>;
  protected abstract readonly scrollLeft: WritableSignal<number>;
  protected abstract readonly viewportWidth: WritableSignal<number>;
  protected abstract sideOf(column: StarColumn<T>): StarPinSide | null;
  protected abstract columnPixels(column: StarColumn<T>): number;
  abstract readonly selection: Signal<readonly T[]>;
  abstract readonly batchEdit: Signal<boolean>;
  abstract readonly cellEdit: OutputEmitterRef<StarCellEditEvent<T>>;
  abstract readonly rowEditSave: OutputEmitterRef<StarRowEditSaveEvent<T>>;
  protected abstract readonly batch: StarEditBatch<T>;
  /** Rows of all pages in display order (sorted, filtered, with new rows). */
  protected abstract readonly withAdded: Signal<readonly T[]>;
  protected abstract isSelected(row: T): boolean;
  protected abstract rawValue(row: T, column: StarColumn<T>): unknown;
  protected abstract announce(message: string): void;
  abstract readonly multiSort: Signal<boolean>;
  abstract readonly sortField: WritableSignal<string | null>;
  abstract readonly sortOrder: WritableSignal<StarSortOrder>;
  abstract readonly sortMeta: WritableSignal<readonly StarSortState[]>;
  abstract readonly first: WritableSignal<number>;
  abstract readonly rows: Signal<number>;
  abstract readonly paginator: Signal<boolean>;
  abstract readonly lazy: Signal<boolean>;
  abstract readonly filterLocale: Signal<string | null>;
  abstract pinColumn(field: string, side: StarPinSide | null): void;
  abstract exportCsv(options?: StarCsvOptions<T>): void;
  protected abstract emitLazy(): void;
  protected abstract canHide(column: StarColumn<T>): boolean;
  protected abstract setColumnVisible(column: StarColumn<T>, visible: boolean): void;

  // ---------------------------------------------------------------- inputs

  /**
   * Row selection. It adds the selection column: a check box per row and a tri-state header check
   * box (`'multiple'`, PrimeNG `p-tableCheckbox` / `p-tableHeaderCheckbox`), or a radio per row
   * (`'single'`, PrimeNG `p-tableRadioButton`).
   *
   * Cell selection (`cellSelection`, no selection column): `'cell'` selects one cell (a click or
   * Space; Ctrl / Cmd + click clears it); `'range'` selects a rectangle: a click or Space starts
   * it, Shift + click and Shift + Arrow (Home, End, PageUp, PageDown) stretch it from the anchor,
   * Ctrl / Cmd + click adds or removes one cell. The cell modes turn on cell navigation. AG Grid
   * `cellSelection`, Ignite UI `cellSelection`.
   */
  readonly selectionMode = input<'single' | 'multiple' | 'cell' | 'range' | null>(null);

  /**
   * Selected cells with `selectionMode` `'cell'` or `'range'`: a list of `{ rowKey, field }` (the
   * cells of a range, row by row in display order). Two-way. A key is the `dataKey` value, else
   * the row object.
   */
  readonly cellSelection = model<readonly StarTableCellRef[]>([]);

  /**
   * Cell navigation (WAI-ARIA grid): the table becomes one tab stop and the cells take the focus.
   * Arrow keys move one cell (Left and Right swap in right-to-left), Home / End go to the first /
   * last cell of the row, Ctrl+Home / Ctrl+End to the first / last cell of the table, PageUp /
   * PageDown move by the rows in view. Enter or F2 edits an editable cell (in row edit mode, the
   * row); Escape in the editor goes back to the cell. The keys reach the pinned columns, scroll a
   * column of `virtualColumns` and a row of `virtualScroll` into view first, and skip the rows that
   * a merged cell covers. `undefined` (default) is automatic: on when a column is `editable`, else
   * the rows keep today's keys. Ignite UI grid keyboard navigation, AG Grid cell navigation.
   */
  readonly cellNavigation = input<boolean | undefined, boolean | string | undefined>(undefined, {
    transform: ɵstarOptionalBoolean,
  });

  /**
   * Ctrl+C (Cmd+C) and the Copy items of the context menu add a first line with the column
   * headers. AG Grid `copyHeadersToClipboard`, Ignite UI `clipboardOptions.copyHeaders`.
   */
  readonly copyHeaders = input(false, { transform: booleanAttribute });

  /**
   * Ctrl+V (Cmd+V) on a cell pastes tab-separated text (from a spreadsheet or `copyToClipboard`)
   * into the editable cells from that cell to the right and down. Each value goes through the
   * editor parse and the column rules (`required`, `min`, `max`, `pattern`, `validators`; a
   * `'select'` editor needs one of its `editOptions`): a value that is not valid is left out.
   * Then the table emits `cellEdit` per changed cell (`editMode="row"`: `rowEditSave` per row),
   * or with `batchEdit` adds all cells to the pending changes as one undo step. Cells that are not
   * editable, rows in edit and text past the last row or column are left out. `beforePaste` can
   * cancel. AG Grid clipboard paste, Ignite UI paste handling.
   */
  readonly pasteEditable = input(false, { transform: booleanAttribute });

  /** Before Ctrl+V writes cells: the cells and the text. `cancel()` stops the paste. */
  readonly beforePaste = output<StarTablePasteEvent<T>>();

  /**
   * Context menu of the body (right click, Shift+F10 or the context menu key on a cell or a row):
   * a list of `StarMenuItem`, or a function of the row and the column (`null` off a data cell)
   * that returns the items. The built-in items of `contextMenuDefaults` come first. Without items
   * the browser menu shows. After a choice the focus returns to the cell. PrimeNG `contextMenu`,
   * AG Grid `getContextMenuItems`, Ignite UI `contextMenu` output.
   */
  readonly contextMenu = input<StarTableMenuItems<T> | null>(null);

  /**
   * Built-in context menu items, in this order: `'copy'` and `'copyWithHeaders'`
   * (`copyToClipboard`), `'pinStart'`, `'pinEnd'`, `'unpin'` (`pinColumn`), `'sortAsc'`,
   * `'sortDesc'` (sortable columns), `'hideColumn'` and `'export'` (`exportCsv`). Column items
   * show on a data cell only. AG Grid default menu items.
   */
  readonly contextMenuDefaults = input<readonly StarTableMenuDefault[]>([]);

  /** The row of the open (or last) context menu. Two-way. PrimeNG `contextMenuSelection`. */
  readonly contextMenuSelection = model<T | null>(null);

  /**
   * The user chose a context menu item (also a built-in one, after its action): the row, the
   * column (`null` off a data cell) and the item. PrimeNG `onContextMenuSelect`.
   */
  readonly contextMenuSelect = output<StarTableContextMenuEvent<T>>();

  /**
   * Search highlight, apart from `globalFilter` (rows stay): the matches of this text in the cells
   * show in `<mark>` (case- and accent-insensitive, with `filterLocale`), and `searchMatches`
   * counts them over the rows of all pages. `findNext()` / `findPrevious()` step through them
   * (with wrap) and scroll the active match into view (page, virtual row and column);
   * `clearSearch()` empties the text. A cell template shows marks only when it opts in with the
   * `highlight(text)` function of its context. Two-way. Ignite UI `findNext` / `findPrev` /
   * `clearSearch`.
   */
  readonly searchText = model('');

  /** The focused cell changed (keyboard, click or `focusCell`). Ignite UI `activeNodeChange`. */
  readonly activeCellChange = output<StarTableCellRef | null>();

  // ---------------------------------------------------------------- state

  private readonly active = signal<StarTableCellRef | null>(null);
  /**
   * The active cell: the cell that has the focus, or had it last (`{ rowKey, field }`), else
   * `null`. Signal. Ignite UI `navigation.activeNode`, AG Grid `getFocusedCell()`.
   */
  readonly activeCell: Signal<StarTableCellRef | null> = this.active.asReadonly();

  /** Row selection mode (`single`, `multiple`) without the cell modes. */
  protected readonly rowSelectionMode = computed(() => {
    const mode = this.selectionMode();
    return mode === 'single' || mode === 'multiple' ? mode : null;
  });

  /** Cell selection mode (`cell`, `range`), or `null`. */
  protected readonly cellSelectionMode = computed(() => {
    const mode = this.selectionMode();
    return mode === 'cell' || mode === 'range' ? mode : null;
  });

  /** The cells take the focus: `cellNavigation`, or automatic. */
  protected readonly cellMode = computed(
    () =>
      this.cellNavigation() ??
      (!!this.cellSelectionMode() || this.columns().some((column) => !!column.editable)),
  );

  /** Selected fields by row key. */
  private readonly selectedCells = computed(() => {
    const cells = new Map<unknown, Set<string>>();
    for (const cell of this.cellSelection()) {
      const fields = cells.get(cell.rowKey);
      if (fields) fields.add(cell.field);
      else cells.set(cell.rowKey, new Set([cell.field]));
    }
    return cells;
  });

  /** The fixed corner of a range: the cell of the last click, Space or plain move. */
  private cellAnchor: StarTableCellRef | null = null;

  /** The CDK context menu trigger on the body. It stays disabled until a row prepares a menu. */
  private readonly menuTrigger = viewChild('body', { read: CdkContextMenuTrigger });
  /** Items of the menu that opens now. */
  protected readonly menuItems = signal<readonly StarMenuItem[]>([]);
  /** The context menu is open. */
  private readonly menuOpen = signal(false);
  /** The cell of the open menu, and the element that had the focus. */
  private menuTarget: {
    readonly row: T;
    readonly column: StarColumn<T> | null;
    readonly focus: Element | null;
  } | null = null;
  /** The table has context menu items. */
  protected readonly hasContextMenu = computed(
    () => !!this.contextMenu() || this.contextMenuDefaults().length > 0,
  );

  constructor() {
    effect(() => {
      const trigger = this.menuTrigger();
      if (trigger) trigger.disabled = true;
    });
  }

  /** Rows that the keys move between: the page rows that are not in a closed group. */
  private readonly navRows = computed(() =>
    this.pageRows().filter((row) => !this.isRowCollapsed(row)),
  );

  /** Row by its key text (`data-row`), for the rows of the page. */
  private readonly rowsByText = computed(
    () => new Map(this.pageRows().map((row) => [this.rowKeyText(row), row])),
  );

  /** Index in the page rows by row key (for `rowSpan`). */
  private readonly pageIndex = computed(
    () => new Map(this.pageRows().map((row, index) => [this.trackKey(row), index])),
  );

  /** The cell with `tabindex="0"`: the active cell when it is rendered, else the first cell. */
  private readonly stopCell = computed<{ readonly key: string; readonly field: string } | null>(
    () => {
      if (!this.cellMode()) return null;
      const rows = this.renderedRows().filter((row) => !this.isRowCollapsed(row));
      const columns = this.renderedColumns();
      const active = this.active();
      if (active && columns.some((column) => column.field === active.field)) {
        const row = rows.find((item) => Object.is(this.trackKey(item), active.rowKey));
        if (row !== undefined) return { key: this.rowKeyText(row), field: active.field };
      }
      return rows.length && columns.length
        ? { key: this.rowKeyText(rows[0]), field: columns[0].field }
        : null;
    },
  );

  // ---------------------------------------------------------------- template helpers

  /** The cell shows an edit button, which takes the focus of the cell. */
  protected hasEditButton(row: T, column: StarColumn<T>): boolean {
    return (
      !this.rowEditMode() &&
      !this.isRowInEdit(row) &&
      !this.isEditing(row, column) &&
      this.isEditable(row, column)
    );
  }

  private isStop(row: T, column: StarColumn<T>): boolean {
    const stop = this.stopCell();
    return !!stop && stop.field === column.field && stop.key === this.rowKeyText(row);
  }

  /** `tabindex` of a body cell: the roving tab stop of cell navigation, else none. */
  protected cellTabIndex(row: T, column: StarColumn<T>): number | null {
    if (!this.cellMode() || this.hasEditButton(row, column)) return null;
    if (this.isEditing(row, column) || (this.isRowInEdit(row) && this.isEditable(row, column))) {
      return null;
    }
    return this.isStop(row, column) ? 0 : -1;
  }

  /** `tabindex` of the edit button of a cell with cell navigation (the button is the cell). */
  protected editTabIndex(row: T, column: StarColumn<T>): number | null {
    if (!this.cellMode()) return null;
    return this.isStop(row, column) ? 0 : -1;
  }

  /** The cell is in `cellSelection`. */
  protected isCellSelected(row: T, column: StarColumn<T>): boolean {
    if (!this.cellSelectionMode()) return false;
    return !!this.selectedCells().get(this.trackKey(row))?.has(column.field);
  }

  // ---------------------------------------------------------------- events

  /** Shift + click stretches a range: the browser must not select text. */
  protected onCellMouseDown(event: MouseEvent): void {
    if (event.shiftKey && this.cellSelectionMode() === 'range' && this.cellOf(event.target)) {
      event.preventDefault();
    }
  }

  protected onCellClick(event: MouseEvent): void {
    if (!this.cellSelectionMode() || !this.cellMode() || event.button !== 0) return;
    const target = this.cellOf(event.target);
    if (!target || (event.target as Element).closest(OWN_KEYS)) return;
    const how = event.shiftKey ? 'extend' : event.ctrlKey || event.metaKey ? 'toggle' : 'only';
    this.selectCell(target.row, target.column, how);
    if (event.shiftKey) {
      const element = this.cellElement(target.row, target.column);
      if (element) this.focusElement(element);
    }
  }

  protected onCellFocusIn(event: FocusEvent): void {
    if (!this.cellMode()) return;
    const target = this.cellOf(event.target);
    if (target) this.setActive(target.row, target.column);
  }

  protected onCellKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || this.onCopyKey(event) || this.onMenuKey(event)) return;
    if (!this.cellMode() || event.altKey) return;
    const target = this.cellOf(event.target);
    if (!target || (event.target as Element).closest(OWN_KEYS)) return;
    const { row, column, cell } = target;
    if (event.key === 'Enter' || event.key === 'F2') {
      if (event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (!this.isEditable(row, column) || this.isRowInEdit(row)) return;
      event.preventDefault();
      if (this.rowEditMode()) this.initRowEdit(row);
      else this.startEdit(row, column);
      return;
    }
    if (event.key === ' ' && this.cellSelectionMode() && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      this.selectCell(row, column, event.shiftKey ? 'extend' : 'only');
      return;
    }
    const extend = event.shiftKey && this.cellSelectionMode() === 'range';
    if (event.shiftKey && !extend) return;
    const rows = this.navRows();
    const columns = this.visibleColumns();
    const from = {
      row: rows.findIndex((item) => Object.is(this.trackKey(item), this.trackKey(row))),
      col: columns.indexOf(column),
    };
    if (from.row < 0 || from.col < 0) return;
    const key = { key: starInlineKey(event, cell), ctrlKey: event.ctrlKey, metaKey: event.metaKey };
    const next = cellNavigationTarget(key, from, rows.length, columns.length, this.pageSize());
    if (!next) return;
    event.preventDefault();
    const nextColumn = columns[next.col];
    const step = Math.sign(next.row - from.row);
    const index = uncoveredRow(next.row, step || 1, rows.length, (r) =>
      this.rowSpan(this.pageIndex().get(this.trackKey(rows[r])) ?? r, nextColumn),
    );
    this.moveFocus(rows[index], nextColumn, true);
    if (extend) this.selectCell(rows[index], nextColumn, 'extend');
    else this.cellAnchor = { rowKey: this.trackKey(rows[index]), field: nextColumn.field };
  }

  // ---------------------------------------------------------------- search

  /** Index of the active match: none (-1) after each new search text. */
  private readonly searchIndex = linkedSignal({ source: this.searchText, computation: () => -1 });

  /** The cells with matches, in display order (rows of all pages, visible columns). */
  private readonly searchCells = computed(() => {
    const query = this.searchText();
    const cells: StarSearchCell[] = [];
    const byCell = new Map<string, StarSearchCell>();
    let count = 0;
    if (!query.trim()) return { cells, byCell, count };
    const locale = this.filterLocale();
    const columns = this.visibleColumns();
    for (const row of this.withAdded()) {
      if (this.isRowCollapsed(row)) continue;
      for (const column of columns) {
        const found = countMatches(this.cellText(row, column), query, locale);
        if (!found) continue;
        const cell = {
          rowKey: this.trackKey(row),
          field: column.field,
          start: count,
          count: found,
        };
        cells.push(cell);
        byCell.set(`${this.rowKeyText(row)}\u0000${column.field}`, cell);
        count += found;
      }
    }
    return { cells, byCell, count };
  });

  /**
   * The matches of `searchText`: `count`, and `active`, the index of the active match (-1: none
   * yet). Signal. Ignite UI `findNext` result.
   */
  readonly searchMatches: Signal<StarTableSearchMatches> = computed(() => {
    const count = this.searchCells().count;
    const active = this.searchIndex();
    return { count, active: active < count ? active : -1 };
  });

  /** Makes the next match active (after the last: the first), scrolls to it, returns the count. */
  findNext(): number {
    return this.stepSearch(1);
  }

  /** Makes the previous match active (before the first: the last), scrolls to it, returns the count. */
  findPrevious(): number {
    return this.stepSearch(-1);
  }

  /** Empties `searchText`: no marks. Ignite UI `clearSearch`. */
  clearSearch(): void {
    this.searchText.set('');
  }

  private stepSearch(step: 1 | -1): number {
    const { count, cells } = this.searchCells();
    if (!count) {
      this.searchIndex.set(-1);
      return 0;
    }
    const current = this.searchMatches().active;
    const next = current < 0 ? (step > 0 ? 0 : count - 1) : (current + step + count) % count;
    this.searchIndex.set(next);
    const cell = cells.find((item) => next >= item.start && next < item.start + item.count);
    if (cell) {
      this.scrollToRow(cell.rowKey);
      this.scrollToColumn(cell.field);
    }
    this.announce(this.text.ofTotal(next + 1, count));
    return count;
  }

  /** The parts of the display text of a cell, with the search marks. */
  protected searchParts(row: T, column: StarColumn<T>): readonly StarTableTextPart[] {
    return this.markedParts(this.cellText(row, column), row, column);
  }

  private markedParts(text: string, row: T, column: StarColumn<T>): StarTableTextPart[] {
    const cell = this.searchCells().byCell.get(`${this.rowKeyText(row)}\u0000${column.field}`);
    const active = this.searchMatches().active;
    const local = cell && active >= cell.start && active < cell.start + cell.count;
    return highlightParts(
      text,
      this.searchText(),
      this.filterLocale(),
      local ? active - cell.start : -1,
    );
  }

  /** `highlight` functions of the cell template contexts, one per cell (a stable reference). */
  private readonly highlighters = new Map<string, (text: unknown) => StarTableTextPart[]>();

  /** The `highlight(text)` function of a cell template context. */
  protected highlighter(row: T, column: StarColumn<T>): (text: unknown) => StarTableTextPart[] {
    const key = `${this.rowKeyText(row)}\u0000${column.field}`;
    let highlight = this.highlighters.get(key);
    if (!highlight) {
      if (this.highlighters.size > 5000) this.highlighters.clear();
      highlight = (text) =>
        this.markedParts(text === null || text === undefined ? '' : String(text), row, column);
      this.highlighters.set(key, highlight);
    }
    return highlight;
  }

  // ---------------------------------------------------------------- keyboard and scroll API

  /**
   * Moves the focus to a cell (cell navigation must be on): the row by its key (`dataKey` value,
   * else the row object) and the column by its field. A row on another page of a client paginator
   * opens that page; a row of `virtualScroll` and a column of `virtualColumns` scroll into the
   * window first. Returns `false` when the cell is not in the table (filtered out, in a closed
   * group, a hidden column). Ignite UI `navigateTo`, AG Grid `setFocusedCell`.
   */
  focusCell(rowKey: unknown, field: string): boolean {
    const row = this.withAdded().find((item) => Object.is(this.trackKey(item), rowKey));
    const column = this.visibleColumns().find((item) => item.field === field);
    if (!this.cellMode() || row === undefined || !column || this.isRowCollapsed(row)) return false;
    this.showPageOf(row);
    this.moveFocus(row, column);
    return true;
  }

  /**
   * Focuses the cell of the row at `rowIndex` in the rows of all pages (sorted and filtered, as
   * they show) and the column `field` (default: the column of the active cell, else the first
   * column). Ignite UI `navigateTo(rowIndex, visibleColumnIndex)`.
   */
  navigateTo(rowIndex: number, field?: string): boolean {
    const row = this.withAdded()[rowIndex];
    const target = field ?? this.active()?.field ?? this.visibleColumns()[0]?.field;
    return row !== undefined && target !== undefined && this.focusCell(this.trackKey(row), target);
  }

  /**
   * Scrolls a row into view: by its key (`dataKey` value, else the row object), or by its index in
   * the rows of all pages when no row has that key. A row on another page of a client paginator
   * opens that page; with `virtualScroll` the row renders first. `align`: `'nearest'` (default,
   * the least scroll), `'start'`, `'center'` or `'end'`; the sticky header does not cover it. The
   * scroll is smooth unless the user asks for reduced motion. Ignite UI `navigateTo`, AG Grid
   * `ensureIndexVisible` / `ensureNodeVisible`.
   */
  scrollToRow(rowKeyOrIndex: unknown, options: StarScrollOptions = {}): boolean {
    const rows = this.withAdded();
    let row = rows.find((item) => Object.is(this.trackKey(item), rowKeyOrIndex));
    if (row === undefined && typeof rowKeyOrIndex === 'number') row = rows[rowKeyOrIndex];
    if (row === undefined || this.isRowCollapsed(row)) return false;
    const found = row;
    const moved = this.showPageOf(found);
    const align = options.align ?? 'nearest';
    if (!moved && this.rowElement(found)) {
      this.alignRow(found, align);
    } else {
      this.scrollRowIntoWindow(found);
      afterNextRender(() => this.alignRow(found, align), { injector: this.interactionInjector });
    }
    return true;
  }

  /**
   * Scrolls a column into view by its field, beside the pinned columns (a pinned column is always
   * in view). With `virtualColumns` the column renders first. `align` as in `scrollToRow`. Ignite UI
   * `navigateTo`, AG Grid `ensureColumnVisible`.
   */
  scrollToColumn(field: string, options: StarScrollOptions = {}): boolean {
    const column = this.visibleColumns().find((item) => item.field === field);
    const scroller = this.scroller()?.nativeElement;
    if (!column || !scroller) return false;
    if (this.sideOf(column)) return true;
    const align = options.align ?? 'nearest';
    if (this.virtualColumns() && !this.renderedColumns().includes(column)) {
      this.scrollColumnIntoWindow(column, align === 'nearest' ? 'nearest' : align);
      return true;
    }
    const header = scroller.querySelector<HTMLElement>(
      `:scope > table > thead > tr > th[data-field="${CSS.escape(field)}"]`,
    );
    if (!header) return false;
    const view = this.viewRect(scroller, header);
    const rect = header.getBoundingClientRect();
    const rtl = starIsRtl(scroller);
    const start = rtl ? view.right - rect.right : rect.left - view.left;
    const delta = revealDelta(start, rect.width, view.right - view.left, align);
    if (delta) this.scrollTo(scroller, { left: scroller.scrollLeft + (rtl ? -delta : delta) });
    return true;
  }

  /** Opens the page of a client paginator that holds a row. Returns true when the page changed. */
  private showPageOf(row: T): boolean {
    if (!this.paginator() || this.lazy()) return false;
    const size = Math.max(1, this.rows());
    const index = this.withAdded().indexOf(row);
    const page = Math.floor(index / size) * size;
    if (index < 0 || page === this.first()) return false;
    this.first.set(page);
    return true;
  }

  private rowElement(row: T): HTMLElement | null {
    return (
      this.body()?.nativeElement.querySelector<HTMLElement>(
        `:scope > tr[data-row="${CSS.escape(this.rowKeyText(row))}"], :scope > tr[data-select-key="${CSS.escape(this.rowKeyText(row))}"]`,
      ) ?? this.rowByIndex(row)
    );
  }

  /** The `tr` of a row on the page by its position (tables without row attributes). */
  private rowByIndex(row: T): HTMLElement | null {
    const body = this.body()?.nativeElement;
    if (!body || this.virtualScroll() || this.cellMode() || this.rowSelectionMode()) return null;
    const index = this.pageRows().indexOf(row);
    const rows = body.querySelectorAll<HTMLElement>(':scope > tr.star-table__row');
    return index < 0 ? null : (rows[index] ?? null);
  }

  /** Scrolls a rendered row to its place in the view (below a sticky header). */
  private alignRow(row: T, align: StarScrollAlign): void {
    const scroller = this.scroller()?.nativeElement;
    const element = this.rowElement(row);
    if (!scroller || !element) return;
    const first = element.querySelector<HTMLElement>(':scope > td, :scope > th') ?? element;
    const view = this.viewRect(scroller, first);
    const rect = element.getBoundingClientRect();
    const delta = revealDelta(rect.top - view.top, rect.height, view.bottom - view.top, align);
    if (delta) this.scrollTo(scroller, { top: scroller.scrollTop + delta });
  }

  /** Scrolls the scroll area, smoothly unless the user asks for reduced motion. */
  private scrollTo(scroller: HTMLElement, position: { top?: number; left?: number }): void {
    const behavior = starPrefersReducedMotion(this.interactionDocument) ? 'auto' : 'smooth';
    if (typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ ...position, behavior });
    } else {
      if (position.top !== undefined) scroller.scrollTop = position.top;
      if (position.left !== undefined) scroller.scrollLeft = position.left;
    }
  }

  // ---------------------------------------------------------------- context menu

  /** The row of the open context menu (`contextMenuSelection`). */
  protected isMenuRow(row: T): boolean {
    const selected = this.contextMenuSelection();
    if (!this.menuOpen() || selected === null) return false;
    return Object.is(this.trackKey(selected), this.trackKey(row));
  }

  /**
   * A `contextmenu` event on a body row (it comes before the CDK trigger on the body): builds the
   * items for the cell and lets the trigger open. Without items the browser menu shows.
   */
  protected onRowContextMenu(row: T, event: MouseEvent): void {
    const trigger = this.menuTrigger();
    if (!trigger) return;
    trigger.disabled = true;
    if (!this.hasContextMenu() || (event.target as Element).closest(OWN_KEYS)) return;
    const column = this.cellOf(event.target)?.column ?? null;
    const items = this.menuItemsFor(row, column);
    if (!items.length) return;
    if (trigger.isOpen()) trigger.close();
    const active = this.interactionDocument.activeElement;
    this.menuTarget = {
      row,
      column,
      focus: this.body()?.nativeElement.contains(active) ? active : null,
    };
    this.contextMenuSelection.set(row);
    this.menuItems.set(items);
    trigger.menuData = { $implicit: items };
    trigger.disabled = false;
  }

  /** The menu opened: the trigger is disabled again, so other body parts keep the browser menu. */
  protected onMenuOpened(): void {
    const trigger = this.menuTrigger();
    if (trigger) trigger.disabled = true;
    this.menuOpen.set(true);
  }

  protected onMenuItem(item: StarMenuItem): void {
    const target = this.menuTarget;
    if (target) this.contextMenuSelect.emit({ row: target.row, column: target.column, item });
  }

  /** The menu closed: the focus goes back to the cell when it has nowhere else to be. */
  protected onMenuClosed(): void {
    const target = this.menuTarget;
    this.menuOpen.set(false);
    setTimeout(() => {
      const doc = this.interactionDocument;
      const active = doc.activeElement;
      if (!target || (active && active !== doc.body && active.isConnected)) return;
      const back =
        target.focus?.isConnected && target.focus instanceof HTMLElement
          ? target.focus
          : target.column && this.cellElement(target.row, target.column);
      if (back) this.focusElement(back);
    });
  }

  /** Shift+F10 or the context menu key in a body row: opens the menu at the cell (or the row). */
  private onMenuKey(event: KeyboardEvent): boolean {
    if (!ɵstarIsContextMenuKey(event) || !this.hasContextMenu()) return false;
    const target = event.target as Element;
    const body = this.body()?.nativeElement;
    const tr = target.closest?.('tr');
    if (!body || !tr || tr.parentElement !== body || target.closest(OWN_KEYS)) return false;
    event.preventDefault();
    ɵstarOpenContextMenu(target.closest<HTMLElement>('td[data-field]') ?? (tr as HTMLElement));
    return true;
  }

  /** Built-in items first, then the `contextMenu` items (a separator between the two). */
  private menuItemsFor(row: T, column: StarColumn<T> | null): StarMenuItem[] {
    const builtIn = defaultMenuItems(this.contextMenuDefaults(), {
      text: this.text,
      column,
      side: column ? this.sideOf(column) : null,
      canHide: !!column && this.canHide(column),
      copy: (headers) => {
        // Without a selection the copy takes the cell of the menu.
        if (column) this.setActive(row, column);
        void this.copyToClipboard({ headers });
      },
      pin: (side) => column && this.pinColumn(column.field, side),
      sort: (order) => column && this.sortColumn(column.field, order),
      hide: () => column && this.setColumnVisible(column, false),
      exportCsv: () => this.exportCsv(),
    });
    const source = this.contextMenu();
    const own = typeof source === 'function' ? source(row, column) : (source ?? []);
    return builtIn.length && own.length
      ? [...builtIn, { separator: true }, ...own]
      : [...builtIn, ...own];
  }

  /** Sorts by one column in one order (the context menu sort items). */
  private sortColumn(field: string, order: StarSortOrder): void {
    this.sortMeta.set(this.multiSort() ? [{ field, order }] : []);
    this.sortField.set(field);
    this.sortOrder.set(order);
    this.first.set(0);
    this.emitLazy();
  }

  // ---------------------------------------------------------------- clipboard

  /**
   * Copies cells to the clipboard as tab-separated text (TSV) and announces "Copied N cells". The
   * cells are, in this order: the cell selection (`selectionMode` `'cell'` / `'range'`: the
   * rectangle around the selected cells of the page, other cells in it stay empty), else the
   * selected rows (all pages, all visible columns), else the active cell. A cell copies its
   * `exportValue`, else its display text. Ctrl+C (Cmd+C) in the table body does the same, unless
   * text is selected on the page or the focus is in a field. Resolves with the number of copied
   * cells (0: nothing to copy, or the browser refused). AG Grid `copySelectedRangeToClipboard`,
   * Ignite UI `clipboardOptions`.
   */
  async copyToClipboard(options: StarTableCopyOptions = {}): Promise<number> {
    const block = this.copyBlock();
    if (!block) return 0;
    const lines = block.rows.map((row) =>
      block.columns.map((column) => (block.has(row, column) ? this.copyText(row, column) : '')),
    );
    if (options.headers ?? this.copyHeaders()) {
      lines.unshift(block.columns.map((column) => column.header));
    }
    const done = await this.clipboard.copy(toTsv(lines));
    this.announce(done ? this.text.copiedCells(block.count) : this.text.copyFailed);
    return done ? block.count : 0;
  }

  /** The rows, columns and cells that a copy takes (see `copyToClipboard`), or `null`. */
  private copyBlock(): {
    readonly rows: readonly T[];
    readonly columns: readonly StarColumn<T>[];
    readonly has: (row: T, column: StarColumn<T>) => boolean;
    readonly count: number;
  } | null {
    const columns = this.visibleColumns();
    if (this.cellSelectionMode() && this.cellSelection().length) {
      const rows = this.navRows();
      const picked = this.selectedCells();
      const rowIndexes = rows.flatMap((row, i) => (picked.has(this.trackKey(row)) ? [i] : []));
      const fields = new Set(this.cellSelection().map((cell) => cell.field));
      const colIndexes = columns.flatMap((column, i) => (fields.has(column.field) ? [i] : []));
      if (rowIndexes.length && colIndexes.length) {
        const blockRows = rows.slice(rowIndexes[0], rowIndexes[rowIndexes.length - 1] + 1);
        const blockColumns = columns.slice(colIndexes[0], colIndexes[colIndexes.length - 1] + 1);
        const has = (row: T, column: StarColumn<T>) => this.isCellSelected(row, column);
        let count = 0;
        for (const row of blockRows)
          for (const column of blockColumns) if (has(row, column)) count++;
        return { rows: blockRows, columns: blockColumns, has, count };
      }
    }
    if (this.rowSelectionMode() && this.selection().length) {
      const rows = this.withAdded().filter((row) => this.isSelected(row));
      if (rows.length && columns.length) {
        return { rows, columns, has: () => true, count: rows.length * columns.length };
      }
    }
    const active = this.active();
    const row =
      active && this.navRows().find((item) => Object.is(this.trackKey(item), active.rowKey));
    const column = active && columns.find((item) => item.field === active.field);
    if (row === null || row === undefined || !column) return null;
    return { rows: [row], columns: [column], has: () => true, count: 1 };
  }

  /** Clipboard text of a cell: `exportValue`, else the display text. */
  private copyText(row: T, column: StarColumn<T>): string {
    return column.exportValue ? String(column.exportValue(row) ?? '') : this.cellText(row, column);
  }

  /** Ctrl+C (Cmd+C) in the body: copies (see `copyToClipboard`). Returns true when handled. */
  private onCopyKey(event: KeyboardEvent): boolean {
    const ctrl = event.ctrlKey || event.metaKey;
    if (!ctrl || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'c') return false;
    const target = event.target as Element;
    const body = this.body()?.nativeElement;
    if (!body?.contains(target) || target.closest(OWN_KEYS)) return false;
    // Text that the user selected on the page: the browser copies it.
    const selected = this.interactionDocument.getSelection?.();
    if (selected && !selected.isCollapsed && selected.toString()) return false;
    if (!this.copyBlock()) return false;
    event.preventDefault();
    void this.copyToClipboard();
    return true;
  }

  /** Ctrl+V (Cmd+V) on a cell with `pasteEditable`. */
  protected onCellPaste(event: ClipboardEvent): void {
    if (!this.pasteEditable() || event.defaultPrevented) return;
    const target = this.cellOf(event.target);
    if (!target || (event.target as Element).closest(OWN_KEYS)) return;
    const text = event.clipboardData?.getData('text/plain') ?? '';
    const lines = parseTsv(text);
    if (!lines.length) return;
    event.preventDefault();
    this.pasteLines(target.row, target.column, text, lines);
  }

  /** Writes pasted lines into the editable cells from a cell to the right and down. */
  private pasteLines(row: T, column: StarColumn<T>, text: string, lines: string[][]): void {
    const rows = this.navRows();
    const columns = this.visibleColumns();
    const top = rows.findIndex((item) => Object.is(this.trackKey(item), this.trackKey(row)));
    const left = columns.indexOf(column);
    if (top < 0 || left < 0) return;
    const cells: (StarTablePasteCell<T> & { readonly column: StarColumn<T> })[] = [];
    lines.forEach((line, i) => {
      const target = rows[top + i];
      if (target === undefined || this.isRowInEdit(target)) return;
      line.forEach((value, j) => {
        const col = columns[left + j];
        if (!col || !this.isEditable(target, col)) return;
        const parsed = parseEditorText(col.editor, value);
        const previous = this.rawValue(target, col);
        cells.push({ row: target, field: col.field, column: col, value: parsed, previous });
      });
    });
    if (!cells.length) return;
    let canceled = false;
    this.beforePaste.emit({
      cells: cells.map(({ row: item, field, value, previous }) => ({
        row: item,
        field,
        value,
        previous,
      })),
      text,
      cancel: () => (canceled = true),
    });
    if (canceled) return;
    // Validate each cell with the pasted values of its row, so a rule can compare fields.
    const byRow = new Map<unknown, { row: T; cells: typeof cells }>();
    for (const cell of cells) {
      const key = this.trackKey(cell.row);
      const group = byRow.get(key) ?? { row: cell.row, cells: [] };
      group.cells.push(cell);
      byRow.set(key, group);
    }
    let skipped = 0;
    const groups = [...byRow.values()].map((group) => {
      const values = Object.fromEntries(group.cells.map((cell) => [cell.field, cell.value]));
      const draft = { ...group.row, ...values } as T;
      const valid = group.cells.filter((cell) => {
        const options = cell.column.editor === 'select' ? cell.column.editOptions : undefined;
        const error =
          (options && !options.includes(String(cell.value ?? ''))) ||
          starCellError(cell.column, cell.value, draft, this.text);
        if (error) skipped++;
        return !error;
      });
      return { row: group.row, valid };
    });
    const pasted = this.applyPaste(groups);
    const message = this.text.pastedCells(pasted);
    this.announce(skipped ? `${message}. ${this.text.skippedCells(skipped)}` : message);
  }

  /** Emits the edit events of a paste (or records a batch step). Returns the written cells. */
  private applyPaste(
    groups: readonly { readonly row: T; readonly valid: readonly StarTablePasteCell<T>[] }[],
  ): number {
    let count = 0;
    if (this.batchEdit()) {
      const rows = groups.map(({ row, valid }) => ({
        row,
        cells: valid.map((cell): StarCellChange => ({
          field: cell.field,
          value: cell.value,
          original: cell.previous,
        })),
      }));
      this.batch.changeRows(rows);
      return groups.reduce((sum, group) => sum + group.valid.length, 0);
    }
    for (const { row, valid } of groups) {
      const changed = valid.filter((cell) => !sameEditValue(cell.value, cell.previous));
      count += changed.length;
      if (!changed.length) continue;
      if (this.rowEditMode()) {
        this.rowEditSave.emit({
          row,
          changes: Object.fromEntries(changed.map((cell) => [cell.field, cell.value])),
          previous: Object.fromEntries(changed.map((cell) => [cell.field, cell.previous])),
        });
        continue;
      }
      for (const cell of changed) {
        this.cellEdit.emit({ row, field: cell.field, value: cell.value, previous: cell.previous });
      }
    }
    return count;
  }

  // ---------------------------------------------------------------- cell selection

  /**
   * Selects a cell: `only` makes it the selection (and the anchor), `toggle` adds or removes it
   * (`cell` mode: it is the only cell or none), `extend` selects the rectangle from the anchor.
   */
  private selectCell(row: T, column: StarColumn<T>, how: 'only' | 'toggle' | 'extend'): void {
    const mode = this.cellSelectionMode();
    if (!mode) return;
    const cell = { rowKey: this.trackKey(row), field: column.field };
    if (how === 'extend' && mode === 'range') {
      this.cellSelection.set(this.rectangle(this.cellAnchor ?? cell, cell));
      return;
    }
    this.cellAnchor = cell;
    if (how !== 'toggle') {
      this.cellSelection.set([cell]);
    } else if (this.isCellSelected(row, column)) {
      this.cellSelection.update((cells) =>
        cells.filter((item) => !Object.is(item.rowKey, cell.rowKey) || item.field !== cell.field),
      );
    } else {
      this.cellSelection.update((cells) => (mode === 'cell' ? [cell] : [...cells, cell]));
    }
  }

  /** The cells of the rectangle between two cells, row by row in display order. */
  private rectangle(from: StarTableCellRef, to: StarTableCellRef): StarTableCellRef[] {
    const rows = this.navRows();
    const columns = this.visibleColumns();
    const rowOf = (cell: StarTableCellRef) =>
      rows.findIndex((row) => Object.is(this.trackKey(row), cell.rowKey));
    const colOf = (cell: StarTableCellRef) =>
      columns.findIndex((column) => column.field === cell.field);
    const end = { row: rowOf(to), col: colOf(to) };
    let start = { row: rowOf(from), col: colOf(from) };
    if (start.row < 0 || start.col < 0) start = end;
    const cells: StarTableCellRef[] = [];
    for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
      for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) {
        cells.push({ rowKey: this.trackKey(rows[r]), field: columns[c].field });
      }
    }
    return cells;
  }

  // ---------------------------------------------------------------- focus

  /** The body cell (row, column, element) that holds a DOM node, or `null`. */
  protected cellOf(node: EventTarget | null): CellTarget<T> | null {
    const body = this.body()?.nativeElement;
    if (!(node instanceof Element) || !body) return null;
    const cell = node.closest<HTMLElement>('td[data-field]');
    const tr = cell?.parentElement;
    if (!cell || !tr || tr.parentElement !== body) return null;
    const row = this.rowsByText().get(tr.dataset['row'] ?? '');
    const column = this.visibleColumns().find((item) => item.field === cell.dataset['field']);
    return row === undefined || !column ? null : { row, column, cell };
  }

  /** The focus target of a cell: its edit button, else the cell itself. */
  protected cellElement(row: T, column: StarColumn<T>): HTMLElement | null {
    const body = this.body()?.nativeElement;
    const cell = body?.querySelector<HTMLElement>(
      `:scope > tr[data-row="${CSS.escape(this.rowKeyText(row))}"] > td[data-field="${CSS.escape(column.field)}"]`,
    );
    if (!cell) return null;
    return cell.querySelector<HTMLElement>(':scope > .star-table__edit') ?? cell;
  }

  private setActive(row: T, column: StarColumn<T>): void {
    const current = this.active();
    const rowKey = this.trackKey(row);
    if (current && Object.is(current.rowKey, rowKey) && current.field === column.field) return;
    const next = { rowKey, field: column.field };
    this.active.set(next);
    this.activeCellChange.emit(next);
  }

  /**
   * Moves the focus to a cell. A column of `virtualColumns` and a row of `virtualScroll` that are
   * not rendered scroll into the window first; the focus follows after the render. `now` renders
   * at once (a key press: the next key must start from the new cell).
   */
  protected moveFocus(row: T, column: StarColumn<T>, now = false): void {
    this.setActive(row, column);
    this.scrollColumnIntoWindow(column);
    const element = this.cellElement(row, column);
    if (element) {
      this.focusElement(element);
      return;
    }
    this.scrollRowIntoWindow(row);
    let tries = 0;
    const apply = () => {
      const target = this.cellElement(row, column);
      if (target) this.focusElement(target);
      // Rows of different heights can need a second render (the first one measures).
      else if (++tries < 2) afterNextRender(apply, { injector: this.interactionInjector });
    };
    afterNextRender(apply, { injector: this.interactionInjector });
    if (now) this.interactionApp.tick();
  }

  /** Scrolls a row of the virtual list into the rendered window (virtual scroll only). */
  protected scrollRowIntoWindow(row: T): void {
    if (!this.virtualScroll()) return;
    const key = this.trackKey(row);
    const layout = this.layout();
    const index = layout ? layout.indexOfKey.get(key) : this.pageIndex().get(key);
    if (index !== undefined) this.revealItem(index);
  }

  /**
   * With `virtualColumns`: scrolls sideways so that an unpinned column is in the rendered window
   * (`nearest`: only when it is not rendered; the cell then scrolls fully into view after it
   * renders).
   */
  protected scrollColumnIntoWindow(
    column: StarColumn<T>,
    align: StarScrollAlign = 'nearest',
  ): void {
    const scroller = this.scroller()?.nativeElement;
    if (!scroller || !this.virtualColumns() || this.sideOf(column)) return;
    if (align === 'nearest' && this.renderedColumns().includes(column)) return;
    const columns = this.visibleColumns();
    const middle = columns.filter((item) => !this.sideOf(item));
    const pinned = columns
      .filter((item) => this.sideOf(item))
      .reduce((sum, item) => sum + this.columnPixels(item), 0);
    const widths = this.headerWidths();
    const viewport = this.viewportWidth() || scroller.clientWidth || COLUMN_FALLBACK_VIEWPORT;
    const offset = columnScrollOffset(
      middle.map((item) => this.columnPixels(item)),
      middle.indexOf(column),
      this.scrollLeft(),
      viewport - pinned - widths.start - widths.end,
      align,
    );
    scroller.scrollLeft = starIsRtl(scroller) ? -offset : offset;
    this.scrollLeft.set(offset);
  }

  /** Focuses a cell element without the browser scroll, then scrolls it fully into view. */
  protected focusElement(element: HTMLElement): void {
    element.focus({ preventScroll: true });
    this.revealElement(element);
  }

  /**
   * Scrolls the scroll area the least amount that shows a cell fully: below a sticky header and
   * beside the pinned (sticky) cells of its row.
   */
  protected revealElement(element: HTMLElement): void {
    const scroller = this.scroller()?.nativeElement;
    const cell = element.closest<HTMLElement>('td') ?? element;
    if (!scroller || !scroller.clientHeight) return;
    const view = this.viewRect(scroller, cell);
    const rect = cell.getBoundingClientRect();
    if (rect.top < view.top) scroller.scrollTop -= view.top - rect.top;
    else if (rect.bottom > view.bottom) {
      scroller.scrollTop += Math.min(rect.bottom - view.bottom, rect.top - view.top);
    }
    if (getComputedStyle(cell).position === 'sticky') return;
    if (rect.left < view.left) scroller.scrollLeft -= view.left - rect.left;
    else if (rect.right > view.right) {
      scroller.scrollLeft += Math.min(rect.right - view.right, rect.left - view.left);
    }
  }

  /** The part of the scroll area that sticky cells (header, pinned columns) do not cover. */
  private viewRect(scroller: HTMLElement, cell: HTMLElement) {
    const area = scroller.getBoundingClientRect();
    const top = area.top + scroller.clientTop;
    const left = area.left + scroller.clientLeft;
    const view = {
      top,
      left,
      bottom: top + scroller.clientHeight,
      right: left + scroller.clientWidth,
    };
    const head = scroller.querySelector<HTMLElement>(':scope > table > thead');
    if (head && getComputedStyle(head).position === 'sticky') {
      view.top = Math.max(view.top, head.getBoundingClientRect().bottom);
    }
    // Sticky cells before the cell (in the DOM) cover the inline start: the left in LTR.
    const cells = Array.from(cell.parentElement?.children ?? []);
    const index = cells.indexOf(cell);
    const rtl = starIsRtl(cell);
    cells.forEach((other, i) => {
      if (i === index || getComputedStyle(other).position !== 'sticky') return;
      const rect = other.getBoundingClientRect();
      if (i < index !== rtl) view.left = Math.max(view.left, rect.right);
      else view.right = Math.min(view.right, rect.left);
    });
    return view;
  }

  /** Rows of a PageUp / PageDown step: the rows that fit in the view. */
  private pageSize(): number {
    const scroller = this.scroller()?.nativeElement;
    const row = this.body()?.nativeElement.querySelector<HTMLElement>(':scope > tr[data-row]');
    const height = row?.getBoundingClientRect().height || this.virtualRowHeight();
    if (!scroller?.clientHeight || !height) return FALLBACK_PAGE_ROWS;
    return Math.max(1, Math.floor(scroller.clientHeight / height) - 1);
  }
}
