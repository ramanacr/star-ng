import type { StarUiText } from '@star-ng/ui/core';
import type { StarMenuItem } from '@star-ng/ui/menu';
import type { StarColumn, StarSortOrder } from './table';
import type { StarPinSide } from './table-pinning';
import type { StarRowPinSide } from './table-row-pins';

/**
 * Context menu of `star-table`: the built-in items. PrimeNG `contextMenu`, AG Grid
 * `getContextMenuItems` with its default items (`copy`, `copyWithHeaders`, `export`).
 */

/** A built-in item of the table context menu (`contextMenuDefaults`). */
export type StarTableMenuDefault =
  | 'copy'
  | 'copyWithHeaders'
  | 'pinStart'
  | 'pinEnd'
  | 'unpin'
  | 'sortAsc'
  | 'sortDesc'
  | 'hideColumn'
  | 'export'
  | 'pinRowTop'
  | 'pinRowBottom'
  | 'unpinRow';

/** Items of `contextMenu`: a list, or a function of the row and the column (`null` off a cell). */
export type StarTableMenuItems<T> =
  readonly StarMenuItem[] | ((row: T, column: StarColumn<T> | null) => readonly StarMenuItem[]);

/** `contextMenuSelect` output: the row, the column (`null` off a cell) and the chosen item. */
export interface StarTableContextMenuEvent<T> {
  readonly row: T;
  readonly column: StarColumn<T> | null;
  readonly item: StarMenuItem;
}

/** What the built-in items do: the table actions for the cell of the menu. */
export interface StarTableMenuActions<T> {
  readonly text: StarUiText;
  readonly column: StarColumn<T> | null;
  readonly side: StarPinSide | null;
  readonly canHide: boolean;
  /** Edge where the row of the menu is pinned, or `null`. */
  readonly rowSide?: StarRowPinSide | null;
  copy(headers: boolean): void;
  pin(side: StarPinSide | null): void;
  sort(order: StarSortOrder): void;
  hide(): void;
  exportCsv(): void;
  pinRow?(side: StarRowPinSide | null): void;
}

/**
 * The built-in items in the order of `keys`. Column items (pin, sort, hide) need a column: off a
 * cell they are left out, and sort items need a `sortable` column. An item that would change
 * nothing (pin to the side the column is on, unpin a column that is not pinned, hide the last
 * column) is disabled. Row items (`pinRowTop`, `pinRowBottom`, `unpinRow`) work on any row cell; the
 * item for the edge the row is on, and `unpinRow` for a row that is not pinned, are disabled.
 */
export function defaultMenuItems<T>(
  keys: readonly StarTableMenuDefault[],
  actions: StarTableMenuActions<T>,
): StarMenuItem[] {
  const { text, column, side } = actions;
  const items: StarMenuItem[] = [];
  for (const key of keys) {
    if (key === 'copy' || key === 'copyWithHeaders') {
      const headers = key === 'copyWithHeaders';
      items.push({
        label: headers ? text.copyWithHeaders : text.copy,
        icon: 'ph-bold ph-copy',
        command: () => actions.copy(headers),
      });
    } else if (key === 'export') {
      items.push({
        label: text.exportCsv,
        icon: 'ph-bold ph-download-simple',
        command: () => actions.exportCsv(),
      });
    } else if (key === 'pinRowTop' || key === 'pinRowBottom') {
      const target: StarRowPinSide = key === 'pinRowTop' ? 'top' : 'bottom';
      items.push({
        label: target === 'top' ? text.pinRowTop : text.pinRowBottom,
        icon: 'ph-bold ph-push-pin',
        disabled: actions.rowSide === target,
        command: () => actions.pinRow?.(target),
      });
    } else if (key === 'unpinRow') {
      items.push({
        label: text.unpinRow,
        icon: 'ph-bold ph-push-pin-slash',
        disabled: !actions.rowSide,
        command: () => actions.pinRow?.(null),
      });
    } else if (!column) {
      continue;
    } else if (key === 'pinStart' || key === 'pinEnd') {
      const target: StarPinSide = key === 'pinStart' ? 'start' : 'end';
      items.push({
        label: (target === 'start' ? text.pinColumnStart : text.pinColumnEnd)(column.header),
        icon: `ph-bold ph-arrow-line-${target === 'start' ? 'left' : 'right'} star-icon-mirror`,
        disabled: side === target,
        command: () => actions.pin(target),
      });
    } else if (key === 'unpin') {
      items.push({
        label: text.unpinColumn(column.header),
        icon: 'ph-bold ph-push-pin-slash',
        disabled: !side,
        command: () => actions.pin(null),
      });
    } else if (key === 'sortAsc' || key === 'sortDesc') {
      if (!column.sortable) continue;
      const order: StarSortOrder = key === 'sortAsc' ? 1 : -1;
      items.push({
        label: order === 1 ? text.sortAscending : text.sortDescending,
        icon: `ph-bold ph-sort-${order === 1 ? 'ascending' : 'descending'}`,
        command: () => actions.sort(order),
      });
    } else if (key === 'hideColumn') {
      items.push({
        label: text.hideColumn(column.header),
        icon: 'ph-bold ph-eye-slash',
        disabled: !actions.canHide,
        command: () => actions.hide(),
      });
    }
  }
  return items;
}
