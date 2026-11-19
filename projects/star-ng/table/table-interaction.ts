import {
  afterNextRender,
  ApplicationRef,
  computed,
  Directive,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { starInlineKey, starIsRtl, StarUiText, ɵstarOptionalBoolean } from '@star-ng/ui/core';
import type { StarColumn } from './table';
import { COLUMN_FALLBACK_VIEWPORT } from './table-column-window';
import {
  cellNavigationTarget,
  columnScrollOffset,
  StarScrollAlign,
  StarTableCellRef,
  uncoveredRow,
} from './table-navigation';
import type { StarHeaderWidths, StarPinSide } from './table-pinning';
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
  },
})
export abstract class StarTableInteraction<T> {
  protected readonly interactionInjector = inject(Injector);
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

  // ---------------------------------------------------------------- inputs

  /**
   * Row selection. It adds the selection column: a check box per row and a tri-state header check
   * box (`'multiple'`, PrimeNG `p-tableCheckbox` / `p-tableHeaderCheckbox`), or a radio per row
   * (`'single'`, PrimeNG `p-tableRadioButton`).
   */
  readonly selectionMode = input<'single' | 'multiple' | null>(null);

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

  /** The cells take the focus: `cellNavigation`, or automatic. */
  protected readonly cellMode = computed(
    () => this.cellNavigation() ?? this.columns().some((column) => !!column.editable),
  );

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

  // ---------------------------------------------------------------- events

  protected onCellFocusIn(event: FocusEvent): void {
    if (!this.cellMode()) return;
    const target = this.cellOf(event.target);
    if (target) this.setActive(target.row, target.column);
  }

  protected onCellKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || !this.cellMode() || event.altKey) return;
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
    if (event.shiftKey) return;
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
