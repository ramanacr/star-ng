import { CdkContextMenuTrigger } from '@angular/cdk/menu';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  ApplicationRef,
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  OutputEmitterRef,
  PLATFORM_ID,
  Signal,
  signal,
  untracked,
  viewChild,
  WritableSignal,
} from '@angular/core';
import {
  StarClipboard,
  starInlineKey,
  starIsRtl,
  starPrefersReducedMotion,
  StarUiText,
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
import type { StarTableCopyOptions, StarTablePasteEvent } from './table-clipboard';
import { COLUMN_FALLBACK_VIEWPORT } from './table-column-window';
import type {
  StarTableContextMenuEvent,
  StarTableMenuDefault,
  StarTableMenuItems,
} from './table-context-menu';
import type { StarEditBatch, StarRowEditSaveEvent } from './table-editing';
import { StarTableClipboardActions } from './table-interaction-clipboard';
import { StarTableMenuState } from './table-interaction-menu';
import { StarTableSearchState } from './table-interaction-search';
import {
  cellNavigationTarget,
  columnScrollOffset,
  OWN_KEYS,
  revealDelta,
  StarScrollAlign,
  StarScrollOptions,
  StarTableCellRef,
  uncoveredRow,
} from './table-navigation';
import type { StarHeaderWidths, StarPinSide } from './table-pinning';
import type { StarRowPinSide } from './table-row-pins';
import type { StarTableSearchMatches, StarTableTextPart } from './table-search';
import type { VirtualLayout } from './virtual-heights';

/** Rows of a PageUp / PageDown step when the view has no measured height yet. */
const FALLBACK_PAGE_ROWS = 10;

/** Focusable controls inside a lead or trail cell (selection, expander, reorder, row actions). */
const CELL_CONTROLS = 'button, input, select, textarea, a[href], [tabindex]';
/** The controls of a lead or trail cell that Enter or F2 can go into. */
const ENABLED_CONTROLS =
  ':is(button, input, select, textarea, a[href], [tabindex]):not([disabled]):not([aria-disabled="true"])';
/** Marks a control that cell navigation took out of the tab order. */
const GRID_TAB_MARK = 'data-star-grid-tab';

/**
 * A body cell found from a DOM event: its row, its field and its element. `column` is `null` for a
 * lead or trail cell (field `$reorder`, `$expander`, `$select` or `$actions`).
 */
interface CellTarget<T> {
  readonly row: T;
  readonly field: string;
  readonly column: StarColumn<T> | null;
  readonly cell: HTMLElement;
}

/** The field of a lead or trail cell starts with `$`. */
function isLeadField(field: string): boolean {
  return field.startsWith('$');
}

/**
 * Cell interaction of `star-table` (Wave C4): cell navigation, the active cell and the keyboard
 * and scroll API. `StarTable` extends it; the members marked `abstract` are the table parts that
 * it reads. Not used on its own.
 */
@Directive({
  host: {
    '(focusin)': 'onCellFocusIn($event)',
    '(focusout)': 'onCellFocusOut($event)',
    '(keydown)': 'onCellKeydown($event)',
    '(mousedown)': 'onCellMouseDown($event)',
    '(click)': 'onCellClick($event)',
    '(paste)': 'onCellPaste($event)',
  },
})
export abstract class StarTableInteraction<T> {
  protected readonly interactionInjector = inject(Injector);
  private readonly interactionDocument = inject(DOCUMENT);
  private readonly interactionHost = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly interactionApp = inject(ApplicationRef);
  /** The focus and scroll API needs a browser (`CSS.escape`, layout); on the server it does nothing. */
  private readonly interactionBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  /** The table is destroyed: a pending timeout does nothing. */
  private interactionDestroyed = false;

  // ---------------------------------------------------------------- table parts

  abstract readonly columns: Signal<readonly StarColumn<T>[]>;
  abstract readonly virtualScroll: Signal<boolean>;
  abstract readonly virtualRowHeight: Signal<number>;
  protected abstract readonly text: StarUiText;
  protected abstract readonly visibleColumns: Signal<readonly StarColumn<T>[]>;
  protected abstract readonly renderedColumns: Signal<readonly StarColumn<T>[]>;
  protected abstract readonly pageRows: Signal<readonly T[]>;
  /** Pinned top rows, the page rows and the pinned bottom rows, in display order. */
  protected abstract readonly shownRows: Signal<readonly T[]>;
  protected abstract rowPinOf(row: T): StarRowPinSide | null;
  abstract pinRow(row: T, side: StarRowPinSide): void;
  abstract unpinRow(row: T): void;
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
  abstract readonly reorderableRows: Signal<boolean>;
  abstract readonly editingRowKeys: Signal<readonly unknown[]>;
  protected abstract readonly expandable: Signal<boolean>;

  // ---------------------------------------------------------------- inputs

  /**
   * Row selection adds the selection column: a check box per row and a tri-state header check box
   * (`'multiple'`, PrimeNG `p-tableCheckbox` / `p-tableHeaderCheckbox`), or a radio per row
   * (`'single'`, PrimeNG `p-tableRadioButton`). Cell selection (`cellSelection`, no selection
   * column, cell navigation on): `'cell'` selects one cell (a click or Space; Ctrl / Cmd + click
   * clears it); `'range'` selects a rectangle: a click or Space starts it, Shift + click and Shift
   * + Arrow (Home, End, PageUp, PageDown) stretch it from the anchor, Ctrl / Cmd + click adds or
   * removes one cell. AG Grid `cellSelection`, Ignite UI `cellSelection`. `'column'` selects
   * whole columns (`columnSelection`): each header gets a select button; a click selects that
   * column, Ctrl / Cmd + click adds or removes it, Shift + click selects the columns from the last
   * clicked one. Ignite UI `columnSelection`.
   */
  readonly selectionMode = input<'single' | 'multiple' | 'cell' | 'range' | 'column' | null>(null);

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
   * a merged cell covers. The selection, expander, reorder and row action cells are grid cells:
   * their controls leave the tab order, Space toggles the row check box, Enter or F2 goes into the
   * controls and Escape or F2 back. The table takes those controls out of the tab order after a
   * change of the rendered rows, the lead and trail cells or the rows in edit; a control that a
   * custom row action or lead template adds at another time keeps its tab stop until then, so
   * give it `tabindex="-1"`. `undefined` (default) is automatic: on when a column is `editable`
   * or `selectionMode` is `'cell'` or `'range'`, else the rows keep today's keys. Ignite UI grid
   * keyboard navigation, AG Grid cell navigation.
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
  /** Position (row, column index) of the active cell, to find the nearest cell when it goes. */
  private activePos: { row: number; col: number } | null = null;
  /** A cell of the grid had the focus last (the focus has not moved out of the table since). */
  private gridFocused = false;
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

  /** The fixed corner of a range: the cell that last got the focus without Shift, or a click. */
  private cellAnchor: StarTableCellRef | null = null;
  /** The cell that a Shift move or Shift + click focuses: its focus keeps the anchor. */
  private extendTarget: StarTableCellRef | null = null;

  /** The CDK context menu trigger on the body. It stays disabled until a row prepares a menu. */
  private readonly menuTrigger = viewChild('grid', { read: CdkContextMenuTrigger });
  /** The `<table>` element: the body and the pinned row parts are its `<tbody>` children. */
  protected readonly grid = viewChild<ElementRef<HTMLElement>>('grid');
  /** The table has context menu items. */
  protected readonly hasContextMenu = computed(
    () => !!this.contextMenu() || this.contextMenuDefaults().length > 0,
  );
  /** Context menu state (`table-interaction-menu.ts`). */
  private readonly menu = new StarTableMenuState<T>({
    document: this.interactionDocument,
    trigger: () => this.menuTrigger(),
    body: () => this.body()?.nativeElement,
    text: () => this.text,
    hasContextMenu: () => this.hasContextMenu(),
    contextMenu: () => this.contextMenu(),
    contextMenuDefaults: () => this.contextMenuDefaults(),
    contextMenuSelection: this.contextMenuSelection,
    contextMenuSelect: this.contextMenuSelect,
    pageRows: () => this.shownRows(),
    trackKey: (row) => this.trackKey(row),
    columnAt: (node) => this.cellOf(node)?.column ?? null,
    sideOf: (column) => this.sideOf(column),
    canHide: (column) => this.canHide(column),
    copy: (headers, cell) => void this.clipboardActions.copy(headers, cell),
    pin: (field, side) => this.pinColumn(field, side),
    sort: (field, order) => this.sortColumn(field, order),
    hide: (column) => this.setColumnVisible(column, false),
    exportCsv: () => this.exportCsv(),
    rowPinOf: (row) => this.rowPinOf(row),
    pinRow: (row, side) => (side ? this.pinRow(row, side) : this.unpinRow(row)),
    destroyed: () => this.interactionDestroyed,
    cellElement: (row, field) => this.cellElement(row, field),
    activeCellElement: () => this.activeElementCell(),
    focusElement: (element) => this.focusElement(element),
  });
  /** Items of the menu that opens now. */
  protected readonly menuItems = this.menu.items;

  /**
   * Body rows and cells carry `data-row` / `data-field`: with cell navigation, a context menu (to
   * know the column) or paste.
   */
  protected readonly cellKeys = computed(
    () => this.cellMode() || this.hasContextMenu() || this.pasteEditable(),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.interactionDestroyed = true));
    // The active cell left the grid (a hidden column, a deleted or filtered row, a page change):
    // the nearest cell becomes active, and takes the focus when the grid had it.
    effect(() => {
      const rows = this.navRows();
      const fields = this.navFields();
      const on = this.cellMode();
      untracked(() => this.recoverActive(rows, fields, on));
    });
    effect(() => {
      const trigger = this.menuTrigger();
      if (trigger) trigger.disabled = true;
    });
    // Grid: the controls of the lead and trail cells (check boxes, radios, buttons, custom row
    // actions) leave the tab order; their cell is the key stop.
    // It runs after a render that changed the rendered rows, the lead or trail cells, the grid
    // mode or the rows in edit (custom row actions), not on every application tick.
    afterRenderEffect({
      write: () => {
        this.cellMode();
        this.renderedRows();
        this.leadFields();
        this.trailFields();
        this.editingRowKeys();
        untracked(() => this.syncLeadControls());
      },
    });
  }

  private syncLeadControls(): void {
    const body = this.grid()?.nativeElement;
    if (!body) return;
    const on = this.cellMode();
    if (on) {
      const cells = body.querySelectorAll<HTMLElement>(':scope > tbody > tr > td[data-field^="$"]');
      for (const cell of Array.from(cells)) {
        for (const control of Array.from(cell.querySelectorAll<HTMLElement>(CELL_CONTROLS))) {
          if (control.getAttribute('tabindex') === '-1') continue;
          control.setAttribute('tabindex', '-1');
          control.setAttribute(GRID_TAB_MARK, '');
        }
      }
      return;
    }
    for (const control of Array.from(body.querySelectorAll<HTMLElement>(`[${GRID_TAB_MARK}]`))) {
      control.removeAttribute('tabindex');
      control.removeAttribute(GRID_TAB_MARK);
    }
  }

  /** Lead cells (before the data columns) that the keys reach, in display order. */
  private readonly leadFields = computed(() => [
    ...(this.reorderableRows() ? ['$reorder'] : []),
    ...(this.expandable() ? ['$expander'] : []),
    ...(this.rowSelectionMode() ? ['$select'] : []),
  ]);

  /** Trail cells (after the data columns): the row actions of row edit mode. */
  private readonly trailFields = computed(() => (this.rowEditMode() ? ['$actions'] : []));

  /** The fields that the keys move between: lead cells, visible columns, trail cells. */
  private readonly navFields = computed(() => [
    ...this.leadFields(),
    ...this.visibleColumns().map((column) => column.field),
    ...this.trailFields(),
  ]);

  /** A visible column by field (`undefined` for a lead or trail cell). */
  private columnOf(field: string): StarColumn<T> | undefined {
    return this.visibleColumns().find((column) => column.field === field);
  }

  /** Rows that the keys move between: the page rows that are not in a closed group. */
  private readonly navRows = computed(() =>
    this.shownRows().filter((row) => !this.isRowCollapsed(row)),
  );

  /** Row by its key text (`data-row`), for the rows of the page. */
  private readonly rowsByText = computed(
    () => new Map(this.shownRows().map((row) => [this.rowKeyText(row), row])),
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
      const fields = [
        ...this.leadFields(),
        ...this.renderedColumns().map((column) => column.field),
        ...this.trailFields(),
      ];
      const active = this.active();
      if (active && fields.includes(active.field)) {
        const row = rows.find((item) => Object.is(this.trackKey(item), active.rowKey));
        if (row !== undefined) return { key: this.rowKeyText(row), field: active.field };
      }
      // The first data cell, else the first cell.
      const first = this.renderedColumns()[0]?.field ?? fields[0];
      return rows.length && first !== undefined
        ? { key: this.rowKeyText(rows[0]), field: first }
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

  private isStop(row: T, field: string): boolean {
    const stop = this.stopCell();
    return !!stop && stop.field === field && stop.key === this.rowKeyText(row);
  }

  /** `tabindex` of a body cell: the roving tab stop of cell navigation, else none. */
  protected cellTabIndex(row: T, column: StarColumn<T>): number | null {
    if (!this.cellMode() || this.hasEditButton(row, column)) return null;
    if (this.isEditing(row, column) || (this.isRowInEdit(row) && this.isEditable(row, column))) {
      return null;
    }
    return this.isStop(row, column.field) ? 0 : -1;
  }

  /** `tabindex` of the edit button of a cell with cell navigation (the button is the cell). */
  protected editTabIndex(row: T, column: StarColumn<T>): number | null {
    if (!this.cellMode()) return null;
    return this.isStop(row, column.field) ? 0 : -1;
  }

  /**
   * `tabindex` of a lead or trail cell (`$reorder`, `$expander`, `$select`, `$actions`) with
   * cell navigation: the cell is the key stop; its controls leave the tab order.
   */
  protected leadTabIndex(row: T, field: string): number | null {
    if (!this.cellMode()) return null;
    return this.isStop(row, field) ? 0 : -1;
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
    if (!target?.column || (event.target as Element).closest(OWN_KEYS)) return;
    const how = event.shiftKey ? 'extend' : event.ctrlKey || event.metaKey ? 'toggle' : 'only';
    this.selectCell(target.row, target.column, how);
    if (event.shiftKey) {
      const element = this.cellElement(target.row, target.field);
      this.extendTarget = { rowKey: this.trackKey(target.row), field: target.field };
      if (element) this.focusElement(element);
      this.extendTarget = null;
    }
  }

  protected onCellFocusIn(event: FocusEvent): void {
    if (!this.cellMode()) return;
    const target = this.cellOf(event.target);
    if (!target) return;
    this.gridFocused = true;
    this.setActive(target.row, target.field);
    // Any focus of a cell (Tab in, a click, focusCell, navigateTo) sets the range anchor, unless
    // a Shift move or Shift + click stretches the range to this cell.
    // A lead or trail cell is never the corner of a range. The Shift move target is used up by
    // this focus in either case, so it never stays stale.
    const extend = this.extendTarget;
    this.extendTarget = null;
    if (!target.column) return;
    const cell = { rowKey: this.trackKey(target.row), field: target.field };
    if (!extend || !Object.is(extend.rowKey, cell.rowKey) || extend.field !== cell.field) {
      this.cellAnchor = cell;
    }
  }

  protected onCellKeydown(event: KeyboardEvent): void {
    if (
      event.defaultPrevented ||
      this.clipboardActions.onCopyKey(event) ||
      this.menu.onMenuKey(event)
    )
      return;
    if (!this.cellMode() || event.altKey) return;
    const target = this.cellOf(event.target);
    if (!target) return;
    const { row, column, cell, field } = target;
    const plain = !event.ctrlKey && !event.metaKey && !event.shiftKey;
    if (!column) {
      // A lead or trail cell: Enter or F2 goes into its controls, Escape or F2 comes back.
      if (event.target !== cell) {
        if (plain && (event.key === 'Escape' || event.key === 'F2')) {
          event.preventDefault();
          this.focusElement(cell);
        }
        return;
      }
      if (plain && (event.key === 'Enter' || event.key === 'F2')) {
        // The first enabled control; without one the key keeps its default.
        const control = cell.querySelector<HTMLElement>(ENABLED_CONTROLS);
        if (control) {
          event.preventDefault();
          control.focus();
        }
        return;
      }
      if (plain && event.key === ' ' && field === '$select') {
        event.preventDefault();
        cell.querySelector<HTMLElement>('input:not([disabled])')?.click();
        return;
      }
    } else {
      if ((event.target as Element).closest(OWN_KEYS)) return;
      if (event.key === 'Enter' || event.key === 'F2') {
        if (!plain || !this.isEditable(row, column) || this.isRowInEdit(row)) return;
        event.preventDefault();
        if (this.rowEditMode()) this.initRowEdit(row);
        else this.startEdit(row, column);
        return;
      }
      // Space on a button or link of a custom cell template activates it.
      const control = (event.target as Element).closest('button:not(.star-table__edit), a[href]');
      if (event.key === ' ' && this.cellSelectionMode() && !event.ctrlKey && !event.metaKey) {
        if (control && cell.contains(control)) return;
        event.preventDefault();
        this.selectCell(row, column, event.shiftKey ? 'extend' : 'only');
        return;
      }
    }
    const extend = event.shiftKey && this.cellSelectionMode() === 'range';
    if (event.shiftKey && !extend) return;
    const rows = this.navRows();
    const fields = this.navFields();
    const from = {
      row: rows.findIndex((item) => Object.is(this.trackKey(item), this.trackKey(row))),
      col: fields.indexOf(field),
    };
    if (from.row < 0 || from.col < 0) return;
    const key = { key: starInlineKey(event, cell), ctrlKey: event.ctrlKey, metaKey: event.metaKey };
    const next = cellNavigationTarget(key, from, rows.length, fields.length, this.pageSize());
    if (!next) return;
    event.preventDefault();
    const nextField = fields[next.col];
    const nextColumn = this.columnOf(nextField);
    // A move to the side (no vertical step) into a covered cell lands on the merged cell above.
    const step = Math.sign(next.row - from.row);
    const index = nextColumn
      ? uncoveredRow(next.row, step, rows.length, (r) =>
          this.rowSpan(this.pageIndex().get(this.trackKey(rows[r])) ?? -1, nextColumn),
        )
      : next.row;
    const goal = { rowKey: this.trackKey(rows[index]), field: nextField };
    if (extend) this.extendTarget = goal;
    this.moveFocus(rows[index], nextField, true);
    if (extend && nextColumn) {
      // From a lead cell the range starts at the first data cell that the move reaches.
      if (!column || !this.cellAnchor || isLeadField(this.cellAnchor.field)) this.cellAnchor = goal;
      this.selectCell(rows[index], nextColumn, 'extend');
    } else if (!extend && nextColumn) {
      this.cellAnchor = goal;
    }
  }

  // ---------------------------------------------------------------- search

  /** Search state (`table-interaction-search.ts`). */
  private readonly search = new StarTableSearchState<T>({
    searchText: this.searchText,
    filterLocale: () => this.filterLocale(),
    columns: () => this.visibleColumns(),
    rows: () => this.withAdded(),
    isRowCollapsed: (row) => this.isRowCollapsed(row),
    trackKey: (row) => this.trackKey(row),
    rowKeyText: (row) => this.rowKeyText(row),
    cellText: (row, column) => this.cellText(row, column),
  });

  /**
   * The matches of `searchText`: `count`, and `active`, the index of the active match (-1: none
   * yet). Signal. Ignite UI `findNext` result.
   */
  readonly searchMatches: Signal<StarTableSearchMatches> = this.search.matches;

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
    const { count, active, cell } = this.search.step(step);
    if (!count) return 0;
    if (cell && this.interactionBrowser) {
      this.scrollToRow(cell.rowKey);
      this.scrollToColumn(cell.field);
    }
    this.announce(this.text.ofTotal(active + 1, count));
    return count;
  }

  /** The parts of the display text of a cell, with the search marks. */
  protected searchParts(row: T, column: StarColumn<T>): readonly StarTableTextPart[] {
    return this.search.parts(row, column);
  }

  /** The `highlight(text)` function of a cell template context. */
  protected highlighter(row: T, column: StarColumn<T>): (text: unknown) => StarTableTextPart[] {
    return this.search.highlighter(row, column);
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
    const known = this.navFields().includes(field);
    if (!this.interactionBrowser) return false;
    if (!this.cellMode() || row === undefined || !known || this.isRowCollapsed(row)) return false;
    this.showPageOf(row);
    this.moveFocus(row, field);
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
    if (!this.interactionBrowser) return false;
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
    if (!column || !scroller || !this.interactionBrowser) return false;
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
      this.grid()?.nativeElement.querySelector<HTMLElement>(
        `:scope > tbody > tr[data-row="${CSS.escape(this.rowKeyText(row))}"], :scope > tbody > tr[data-select-key="${CSS.escape(this.rowKeyText(row))}"]`,
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
    return this.menu.isMenuRow(row);
  }

  /**
   * A `contextmenu` event on a body row (it comes before the CDK trigger on the body): builds the
   * items for the cell and lets the trigger open. Without items the browser menu shows.
   */
  protected onRowContextMenu(row: T, event: MouseEvent): void {
    this.menu.onRowContextMenu(row, event);
  }

  /** The menu opened: the trigger is disabled again, so other body parts keep the browser menu. */
  protected onMenuOpened(): void {
    this.menu.onOpened();
  }

  protected onMenuItem(item: StarMenuItem): void {
    this.menu.onItem(item);
  }

  /** The menu closed: the focus goes back to the cell when it has nowhere else to be. */
  protected onMenuClosed(): void {
    this.menu.onClosed();
  }

  /** The element of the active cell (after a recovery), or `null`. */
  private activeElementCell(): HTMLElement | null {
    const active = this.active();
    const row =
      active && this.shownRows().find((item) => Object.is(this.trackKey(item), active.rowKey));
    return row !== null && row !== undefined && active ? this.cellElement(row, active.field) : null;
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

  /** Copy and paste (`table-interaction-clipboard.ts`). */
  private readonly clipboardActions = new StarTableClipboardActions<T>({
    clipboard: inject(StarClipboard),
    document: this.interactionDocument,
    text: () => this.text,
    copyHeaders: () => this.copyHeaders(),
    beforePaste: this.beforePaste,
    cellEdit: () => this.cellEdit,
    rowEditSave: () => this.rowEditSave,
    body: () => this.body()?.nativeElement,
    cellSelectionMode: () => this.cellSelectionMode(),
    cellSelection: () => this.cellSelection(),
    rowSelectionMode: () => this.rowSelectionMode(),
    selection: () => this.selection(),
    active: () => this.active(),
    navRows: () => this.navRows(),
    withAdded: () => this.withAdded(),
    visibleColumns: () => this.visibleColumns(),
    hasSelectedCells: (row) => this.selectedCells().has(this.trackKey(row)),
    isCellSelected: (row, column) => this.isCellSelected(row, column),
    isSelected: (row) => this.isSelected(row),
    trackKey: (row) => this.trackKey(row),
    cellText: (row, column) => this.cellText(row, column),
    isRowInEdit: (row) => this.isRowInEdit(row),
    isEditable: (row, column) => this.isEditable(row, column),
    isEditing: (row, column) => this.isEditing(row, column),
    rawValue: (row, column) => this.rawValue(row, column),
    batchEdit: () => this.batchEdit(),
    batch: () => this.batch,
    rowEditMode: () => this.rowEditMode(),
    announce: (message) => this.announce(message),
  });

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
  copyToClipboard(options: StarTableCopyOptions = {}): Promise<number> {
    return this.clipboardActions.copy(options.headers, null);
  }

  /** Ctrl+V (Cmd+V) on a cell with `pasteEditable`. */
  protected onCellPaste(event: ClipboardEvent): void {
    if (!this.pasteEditable() || event.defaultPrevented) return;
    const target = this.cellOf(event.target);
    if (!target?.column || (event.target as Element).closest(OWN_KEYS)) return;
    this.clipboardActions.onPaste(event, target.row, target.column);
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
    const grid = this.grid()?.nativeElement;
    if (!(node instanceof Element) || !grid) return null;
    const cell = node.closest<HTMLElement>('td[data-field]');
    const tr = cell?.parentElement;
    const section = tr?.parentElement;
    if (!cell || !tr || section?.tagName !== 'TBODY' || section.parentElement !== grid) return null;
    const row = this.rowsByText().get(tr.dataset['row'] ?? '');
    const field = cell.dataset['field'] ?? '';
    const column = this.columnOf(field) ?? null;
    if (row === undefined || (!column && !isLeadField(field))) return null;
    return { row, field, column, cell };
  }

  /** The focus target of a cell (by field): its edit button, else the cell itself. */
  protected cellElement(row: T, field: string): HTMLElement | null {
    const grid = this.grid()?.nativeElement;
    const cell = grid?.querySelector<HTMLElement>(
      `:scope > tbody > tr[data-row="${CSS.escape(this.rowKeyText(row))}"] > td[data-field="${CSS.escape(field)}"]`,
    );
    if (!cell) return null;
    return cell.querySelector<HTMLElement>(':scope > .star-table__edit') ?? cell;
  }

  private setActive(row: T, field: string): void {
    const rowKey = this.trackKey(row);
    this.activePos = {
      row: this.navRows().findIndex((item) => Object.is(this.trackKey(item), rowKey)),
      col: this.navFields().indexOf(field),
    };
    const current = this.active();
    if (current && Object.is(current.rowKey, rowKey) && current.field === field) return;
    const next = { rowKey, field };
    this.active.set(next);
    this.activeCellChange.emit(next);
  }

  private clearActive(): void {
    this.activePos = null;
    if (this.active() === null) return;
    this.active.set(null);
    this.activeCellChange.emit(null);
  }

  /**
   * When the active cell is no longer in the grid: the cell of the same row in the next visible
   * column (else the previous), or the cell of the same column in the next row (else the previous
   * row) becomes active; `null` when the grid is empty or cell navigation is off.
   */
  private recoverActive(rows: readonly T[], fields: readonly string[], on: boolean): void {
    const active = this.active();
    if (!active) return;
    if (!on) return this.clearActive();
    const row = rows.findIndex((item) => Object.is(this.trackKey(item), active.rowKey));
    const col = fields.indexOf(active.field);
    if (row >= 0 && col >= 0) {
      this.activePos = { row, col };
      return;
    }
    if (!rows.length || !fields.length) return this.clearActive();
    const pos = this.activePos ?? { row: 0, col: 0 };
    const nextRow = rows[row >= 0 ? row : Math.min(Math.max(pos.row, 0), rows.length - 1)];
    const nextField = fields[col >= 0 ? col : Math.min(Math.max(pos.col, 0), fields.length - 1)];
    this.setActive(nextRow, nextField);
    // Take the focus back only when the grid owns it now (the old cell is still in the DOM here).
    const owned = this.interactionHost.contains(this.interactionDocument.activeElement);
    if (!this.gridFocused || !owned) return;
    afterNextRender(
      () => {
        const doc = this.interactionDocument;
        const focused = doc.activeElement;
        if (focused && focused !== doc.body && focused.isConnected) return;
        const element = this.cellElement(nextRow, nextField);
        if (element) this.focusElement(element);
      },
      { injector: this.interactionInjector },
    );
  }

  /** The focus left the table: a later change of the grid does not take the focus back. */
  protected onCellFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    const host = this.interactionHost;
    if (next) {
      if (!host.contains(next)) this.gridFocused = false;
      return;
    }
    // No new target (a click on a part of the page that takes no focus): check after the move.
    setTimeout(() => {
      if (!host.contains(this.interactionDocument.activeElement)) this.gridFocused = false;
    });
  }

  /**
   * Moves the focus to a cell. A column of `virtualColumns` and a row of `virtualScroll` that are
   * not rendered scroll into the window first; the focus follows after the render. `now` renders
   * at once (a key press: the next key must start from the new cell).
   */
  protected moveFocus(row: T, field: string, now = false): void {
    this.setActive(row, field);
    const column = this.columnOf(field);
    if (column) this.scrollColumnIntoWindow(column);
    const element = this.cellElement(row, field);
    if (element) {
      this.focusElement(element);
      return;
    }
    this.scrollRowIntoWindow(row);
    let tries = 0;
    const apply = () => {
      const target = this.cellElement(row, field);
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
