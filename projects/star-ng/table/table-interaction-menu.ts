import type { CdkContextMenuTrigger } from '@angular/cdk/menu';
import { OutputEmitterRef, signal, WritableSignal } from '@angular/core';
import { StarUiText, ɵstarIsContextMenuKey, ɵstarOpenContextMenu } from '@star-ng/ui/core';
import type { StarMenuItem } from '@star-ng/ui/menu';
import type { StarColumn, StarSortOrder } from './table';
import {
  defaultMenuItems,
  StarTableContextMenuEvent,
  StarTableMenuDefault,
  StarTableMenuItems,
} from './table-context-menu';
import { OWN_KEYS } from './table-navigation';
import type { StarPinSide } from './table-pinning';
import type { StarRowPinSide } from './table-row-pins';

/** The table parts that the context menu reads and calls. Functions, so the table gives them lazily. */
export interface StarTableMenuHost<T> {
  readonly document: Document;
  readonly trigger: () => CdkContextMenuTrigger | undefined;
  readonly body: () => HTMLElement | undefined;
  readonly text: () => StarUiText;
  readonly hasContextMenu: () => boolean;
  readonly contextMenu: () => StarTableMenuItems<T> | null;
  readonly contextMenuDefaults: () => readonly StarTableMenuDefault[];
  readonly contextMenuSelection: WritableSignal<T | null>;
  readonly contextMenuSelect: OutputEmitterRef<StarTableContextMenuEvent<T>>;
  readonly pageRows: () => readonly T[];
  readonly trackKey: (row: T) => unknown;
  /** The column of the body cell that holds a DOM node (`null` off a data cell). */
  readonly columnAt: (node: EventTarget | null) => StarColumn<T> | null;
  readonly sideOf: (column: StarColumn<T>) => StarPinSide | null;
  readonly canHide: (column: StarColumn<T>) => boolean;
  readonly copy: (headers: boolean, cell: { row: T; column: StarColumn<T> } | null) => void;
  readonly pin: (field: string, side: StarPinSide | null) => void;
  readonly sort: (field: string, order: StarSortOrder) => void;
  readonly hide: (column: StarColumn<T>) => void;
  readonly exportCsv: () => void;
  readonly rowPinOf: (row: T) => StarRowPinSide | null;
  readonly pinRow: (row: T, side: StarRowPinSide | null) => void;
  readonly destroyed: () => boolean;
  /** Where the focus goes after the menu when the element that had it is gone. */
  readonly cellElement: (row: T, field: string) => HTMLElement | null;
  readonly activeCellElement: () => HTMLElement | null;
  readonly focusElement: (element: HTMLElement) => void;
}

/** The cell of the open menu, and the element that had the focus. */
interface MenuTarget<T> {
  readonly row: T;
  /** Index of the row in the page rows, for the focus return after a delete. */
  readonly index: number;
  readonly column: StarColumn<T> | null;
  readonly focus: Element | null;
}

/**
 * Context menu of the body of `star-table` (right click, Shift+F10, the context menu key): the
 * items of a cell, the open state and the focus return. `StarTableInteraction` owns one and
 * delegates to it. Internal.
 */
export class StarTableMenuState<T> {
  constructor(private readonly host: StarTableMenuHost<T>) {}

  /** Items of the menu that opens now. */
  readonly items = signal<readonly StarMenuItem[]>([]);
  /** The context menu is open. */
  private readonly open = signal(false);
  private target: MenuTarget<T> | null = null;

  /** The row of the open context menu (`contextMenuSelection`). */
  isMenuRow(row: T): boolean {
    const selected = this.host.contextMenuSelection();
    if (!this.open() || selected === null) return false;
    return Object.is(this.host.trackKey(selected), this.host.trackKey(row));
  }

  /**
   * A `contextmenu` event on a body row (it comes before the CDK trigger on the body): builds the
   * items for the cell and lets the trigger open. Without items the browser menu shows.
   */
  onRowContextMenu(row: T, event: MouseEvent): void {
    const host = this.host;
    const trigger = host.trigger();
    if (!trigger) return;
    trigger.disabled = true;
    if (!host.hasContextMenu() || (event.target as Element).closest(OWN_KEYS)) return;
    const column = host.columnAt(event.target);
    const items = this.itemsFor(row, column);
    if (!items.length) return;
    if (trigger.isOpen()) trigger.close();
    const active = host.document.activeElement;
    this.target = {
      row,
      index: host.pageRows().indexOf(row),
      column,
      focus: host.body()?.parentElement?.contains(active) ? active : null,
    };
    host.contextMenuSelection.set(row);
    this.items.set(items);
    trigger.menuData = { $implicit: items };
    trigger.disabled = false;
  }

  /** The menu opened: the trigger is disabled again, so other body parts keep the browser menu. */
  onOpened(): void {
    const trigger = this.host.trigger();
    if (trigger) trigger.disabled = true;
    this.open.set(true);
  }

  onItem(item: StarMenuItem): void {
    const target = this.target;
    if (target) this.host.contextMenuSelect.emit({ row: target.row, column: target.column, item });
  }

  /** The menu closed: the focus goes back to the cell when it has nowhere else to be. */
  onClosed(): void {
    const host = this.host;
    const target = this.target;
    this.open.set(false);
    setTimeout(() => {
      // A right click on another row can open a new menu before this runs: keep its target.
      if (this.target === target) this.target = null;
      if (host.destroyed()) return;
      const doc = host.document;
      const active = doc.activeElement;
      if (!target || (active && active !== doc.body && active.isConnected)) return;
      const back =
        target.focus?.isConnected && target.focus instanceof HTMLElement
          ? target.focus
          : ((target.column && host.cellElement(target.row, target.column.field)) ??
            host.activeCellElement() ??
            this.rowControlAt(target.index));
      if (back) host.focusElement(back);
    });
  }

  /**
   * Without cell navigation, after a delete item: the first control of the row that is now at the
   * place of the menu row (else the row before), so the focus does not drop to the page body.
   */
  private rowControlAt(index: number): HTMLElement | null {
    const rows = this.host
      .body()
      ?.querySelectorAll<HTMLElement>(':scope > tr.star-table__row:not([hidden])');
    if (!rows?.length || index < 0) return null;
    const row = rows[Math.min(index, rows.length - 1)];
    return row.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), a[href], [tabindex]',
    );
  }

  /** Shift+F10 or the context menu key in a body row: opens the menu at the cell (or the row). */
  onMenuKey(event: KeyboardEvent): boolean {
    if (!ɵstarIsContextMenuKey(event) || !this.host.hasContextMenu()) return false;
    const target = event.target as Element;
    const grid = this.host.body()?.parentElement;
    const tr = target.closest?.('tr');
    const section = tr?.parentElement;
    if (!grid || !tr || section?.tagName !== 'TBODY' || section.parentElement !== grid)
      return false;
    if (target.closest(OWN_KEYS)) return false;
    event.preventDefault();
    ɵstarOpenContextMenu(target.closest<HTMLElement>('td[data-field]') ?? (tr as HTMLElement));
    return true;
  }

  /** Built-in items first, then the `contextMenu` items (a separator between the two). */
  private itemsFor(row: T, column: StarColumn<T> | null): StarMenuItem[] {
    const host = this.host;
    const builtIn = defaultMenuItems(host.contextMenuDefaults(), {
      text: host.text(),
      column,
      side: column ? host.sideOf(column) : null,
      canHide: !!column && host.canHide(column),
      // Without a selection the copy takes the cell of the menu.
      copy: (headers) => host.copy(headers, column ? { row, column } : null),
      pin: (side) => column && host.pin(column.field, side),
      sort: (order) => column && host.sort(column.field, order),
      hide: () => column && host.hide(column),
      exportCsv: () => host.exportCsv(),
      rowSide: host.rowPinOf(row),
      pinRow: (side) => host.pinRow(row, side),
    });
    const source = host.contextMenu();
    const own = typeof source === 'function' ? source(row, column) : (source ?? []);
    return builtIn.length && own.length
      ? [...builtIn, { separator: true }, ...own]
      : [...builtIn, ...own];
  }
}
