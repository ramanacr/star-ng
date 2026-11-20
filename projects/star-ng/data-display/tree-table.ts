import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  effect,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  isDevMode,
  linkedSignal,
  model,
  numberAttribute,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarEmptyContext,
  starInlineKey,
  StarPart,
  StarSlot,
  starSlot,
  StarStyled,
  ɵSTAR_MIN_COLUMN_WIDTH,
  ɵSTAR_PART_HOST,
  ɵstarAriaSort,
  ɵstarClampColumnWidth,
  ɵstarEditText,
  ɵstarIsContextMenuKey,
  ɵstarNextSort,
  ɵstarOpenContextMenu,
  ɵstarOptionalBoolean,
  ɵstarResizeByKey,
  ɵstarResizeMax,
  ɵstarSameWidths,
  ɵstarSortIcon,
  ɵstarSortRank,
  ɵstarSortRules,
  ɵstarStartColumnResize,
  ɵstarStickyOffsets,
  ɵstarUnchangedEdit,
} from '@star-ng/ui/core';
import { StarContextMenu, StarMenu, StarMenuItem } from '@star-ng/ui/menu';
import { StarPaginator } from '@star-ng/ui/paginator';
import type { StarSortOrder, StarSortState } from '@star-ng/ui/table';
import {
  flattenVisible,
  navigationTarget,
  parentsOf,
  rowIndexOf,
  StarNodeContext,
  StarTreeNode,
  stillFocusable,
  TreeRow,
} from '@star-ng/ui/tree';
import {
  cellText,
  checkStates,
  filterTree,
  moveColumnOrder,
  nodeMatches,
  orderColumns,
  pageRoots,
  sortTree,
  toggleChecked,
  TreeFilterMode,
  TreeFilterResult,
} from './tree-table-data';
import {
  ariaRowCount,
  ariaRowIndex,
  revealRowOffset,
  RowWindow,
  rowWindow,
} from './tree-table-model';

// ---------------------------------------------------------------- Tree table

/**
 * A node of `star-tree-table`: a tree node (`StarTreeNode` from `@star-ng/ui/tree`) whose `data`
 * holds the column values. PrimeNG `TreeNode`, Ignite tree grid record.
 */
export interface StarTreeTableNode extends StarTreeNode<Record<string, unknown>> {
  readonly children?: readonly StarTreeTableNode[];
  /**
   * With `lazy`: `false` marks a node whose children are not loaded yet. It shows an expander,
   * and opening it emits `nodeExpand` so that the owner loads the children.
   */
  readonly leaf?: boolean;
  /** The children of this node are loading: an open node shows a loading row under it. */
  readonly loading?: boolean;
}

export interface StarTreeTableColumn {
  readonly field: string;
  readonly header: string;
  readonly width?: string;
  readonly align?: 'start' | 'center' | 'end';
  /** The header sorts the rows by this column (siblings sort within their parent). */
  readonly sortable?: boolean;
  /** A text filter for this column, in a second header row. */
  readonly filter?: boolean;
  /**
   * Keeps the column in view when the table scrolls sideways (sticky). Frozen columns come first,
   * and the first column holds the tree toggle.
   */
  readonly frozen?: boolean;
  /**
   * The user can change the cell in place (Enter or F2). The table does not change `nodes`: it
   * emits `cellEdit`, and the owner stores the new value.
   */
  readonly editable?: boolean | ((node: StarTreeTableNode) => boolean);
  /** Editor of an editable cell (default `'text'`). `'number'` emits a number or `null`. */
  readonly editor?: 'text' | 'number';
}

/** Payload of `nodeSelect`, `nodeUnselect`, `nodeExpand` and `nodeCollapse`. */
export interface StarTreeTableNodeEvent {
  /** The node, as it is in `nodes`. */
  readonly node: StarTreeTableNode;
}

/** The user changed an editable cell. PrimeNG `onEditComplete`. */
export interface StarTreeTableCellEditEvent {
  readonly node: StarTreeTableNode;
  readonly field: string;
  /** New value: text, or a number / `null` for the `'number'` editor. */
  readonly value: string | number | null;
  readonly previous: unknown;
}

/** The user chose an item of the context menu of a row. */
export interface StarTreeTableContextMenuEvent {
  readonly node: StarTreeTableNode;
  readonly item: StarMenuItem;
}

type TreeTableNode = StarTreeTableNode;
type TreeTableRow = TreeRow<TreeTableNode>;

/**
 * One rendered body row: a node row, or the loading row under an open node whose children load.
 * `aria` is the `aria-rowindex` (null in the default rendering).
 */
interface TreeTableEntry {
  readonly key: string;
  readonly row: TreeTableRow;
  readonly loading: boolean;
  readonly aria: number | null;
}

/** Natural height of a tree table row in pixels. */
const TREE_TABLE_ROW_HEIGHT = 53;
/** Rows that render before and after the visible ones in windowed rendering. */
const BUFFER_ROWS = 8;
/** Height of the scroll area before it is measured (the first window of windowed rendering). */
const FALLBACK_VIEWPORT = 600;
/** Key suffix of the loading row of a node. */
const LOADING_KEY = '\u0000loading';

/**
 * Tree table (PrimeNG `p-treeTable`, Ignite `igx-tree-grid`): hierarchical rows with expand /
 * collapse in a table, `role="treegrid"`. Node `data` holds the column values; the first column
 * shows the tree toggle.
 *
 * Features: sorting (`sortable` columns, `sortField` / `sortOrder`, `multiSort` with `sortMeta`;
 * siblings sort within their parent), filtering (`globalFilter`, the `filter` search field, column
 * `filter`s, `filterMode` lenient or strict), paging over the top-level rows (`paginator`, `rows`,
 * `first`), selection (`selectionMode` single, multiple or checkbox with propagation up and down,
 * `selection` keys), lazy children (`lazy`, `leaf: false`, `nodeExpand`, `loading`), windowed
 * rendering (`virtualScroll`), column resize / reorder / freeze (`columnWidths`, `columnOrder`),
 * cell edit (`editable` columns, `cellEdit`) and a row context menu (`contextMenu`,
 * `contextMenuSelect`). The table never changes `nodes`.
 *
 * Keys (WAI-ARIA treegrid): Up / Down, Home / End move between rows. Right opens a closed branch;
 * on an open branch or a leaf it moves into the row with `cellNavigation` (automatic when a
 * column is editable). Left closes an open branch or moves to the parent. In a cell, Left /
 * Right move between cells, Left on the first cell goes back to the row, Enter or F2 edits. Space selects. Shift+F10 or the
 * context menu key opens the context menu. Left and Right swap in right-to-left.
 *
 * Large tables: `virtualScroll` with `scrollHeight` and `virtualItemSize` renders only the rows in
 * and near the viewport. It is still one `<table>`: a spacer row above and one below the rendered
 * rows stand for the others, the header is sticky, and every row has the fixed height
 * `virtualItemSize`. Keys, `aria-rowcount`, `aria-rowindex`, `aria-level`, `aria-setsize` and
 * `aria-posinset` work over all open rows, also the ones that are not in the DOM.
 *
 * Slots (content children): `starNode` (from `@star-ng/ui/tree`; replaces the label in the first
 * column, and the toggle stays; the context has `$implicit` (the node), `level`, `expanded` and
 * `selected`), `starEmpty` (a row with one cell over all columns when there are no rows;
 * `$implicit` is the `globalFilter` text; without the slot nothing shows, or the "no results"
 * text while a filter is on), `starHeader` and `starFooter` (content above and below the table).
 * Do not put focusable elements (buttons, links, inputs) in these templates: the table owns the
 * keyboard model and the ARIA attributes of its rows.
 *
 * `<star-tree-table [nodes]="budget" [columns]="cols" [(expanded)]="open" ariaLabel="Budget" />`
 */
@Component({
  selector: 'star-tree-table',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, NgTemplateOutlet, StarContextMenu, StarMenu, StarPaginator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarTreeTable) }],
  host: {
    class: 'star-table star-tree-table',
    '[class.star-table--sticky]': '!!scrollHeight()',
    '[class.star-table--virtual]': 'windowed()',
    '[style.--star-table-row-height.px]': 'windowed() ? virtualItemSize() : null',
  },
  template: `
    @if (headerSlot(); as header) {
      <ng-container *ngTemplateOutlet="header" />
    }
    @if (filter()) {
      <div data-star-part="filter" class="star-panel__filter star-tree-table__search">
        <i data-star-part="filterIcon" class="ph-bold ph-magnifying-glass" aria-hidden="true"></i>
        <input
          data-star-part="input"
          type="search"
          class="star-input star-input--sm"
          autocomplete="off"
          [attr.aria-label]="text.filterPlaceholder"
          [placeholder]="text.filterPlaceholder"
          [value]="globalFilter()"
          (input)="setGlobalFilter($any($event.target).value)"
        />
      </div>
    }
    <div
      data-star-part="scroll"
      #scroller
      class="star-table__scroll"
      [attr.role]="windowed() ? 'group' : null"
      [attr.aria-label]="windowed() ? ariaLabel() : null"
      [attr.tabindex]="windowed() ? (activeRendered() ? -1 : 0) : null"
      [style.max-height]="scrollHeight()"
      (scroll)="syncScroll()"
      (focus)="onScrollerFocus()"
      (blur)="parked = false"
      (keydown)="onScrollerKeydown($event)"
    >
      <table
        data-star-part="scrollTable"
        role="treegrid"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-multiselectable]="multiselectable()"
        [attr.aria-rowcount]="windowed() ? ariaRowCountValue() : null"
      >
        <thead data-star-part="scrollThead" #header>
          <tr data-star-part="scrollRow" [attr.aria-rowindex]="windowed() ? 1 : null">
            @for (column of visibleColumns(); track column.field) {
              <th
                data-star-part="scrollHeaderCell"
                scope="col"
                [style.width]="widthOf(column)"
                [style.min-width]="resizedWidth(column)"
                [style.max-width]="resizedWidth(column)"
                [style.inset-inline-start]="frozenOffset(column)"
                [attr.data-field]="column.field"
                [class]="'star-table__th star-table__cell--' + (column.align ?? 'start')"
                [class.star-table__cell--frozen]="column.frozen"
                [class.star-table__th--drop]="dropField() === column.field"
                [attr.aria-sort]="ariaSort(column)"
                [attr.draggable]="canMove(column) ? 'true' : null"
                (dragstart)="onDragStart(column, $event)"
                (dragover)="onDragOver(column, $event)"
                (drop)="onDrop(column, $event)"
                (dragend)="endDrag()"
              >
                @if (column.sortable) {
                  <button
                    data-star-part="sort"
                    type="button"
                    class="star-table__sort"
                    [attr.title]="multiSort() ? text.sortMultiHint : null"
                    (click)="sortBy(column, $event)"
                  >
                    {{ column.header }}
                    <i data-star-part="sortIcon" [class]="sortIcon(column)" aria-hidden="true"></i>
                    @if (sortRank(column); as rank) {
                      <span data-star-part="sortRank" class="star-table__sort-rank">{{
                        rank
                      }}</span>
                    }
                  </button>
                } @else {
                  {{ column.header }}
                }
                @if (canMove(column)) {
                  <span data-star-part="move" class="star-tree-table__move">
                    <button
                      data-star-part="toggle"
                      type="button"
                      class="star-table__toggle"
                      [disabled]="!canMoveBy(column, -1)"
                      [attr.aria-label]="text.moveColumnEarlier(column.header)"
                      (click)="moveColumnBy(column, -1)"
                    >
                      <i
                        data-star-part="caretLeftIcon"
                        class="ph-bold ph-caret-left"
                        aria-hidden="true"
                      ></i>
                    </button>
                    <button
                      data-star-part="toggle"
                      type="button"
                      class="star-table__toggle"
                      [disabled]="!canMoveBy(column, 1)"
                      [attr.aria-label]="text.moveColumnLater(column.header)"
                      (click)="moveColumnBy(column, 1)"
                    >
                      <i
                        data-star-part="caretRightIcon"
                        class="star-table__caret-right-icon ph-bold ph-caret-right"
                        aria-hidden="true"
                      ></i>
                    </button>
                  </span>
                }
                @if (resizableColumns()) {
                  <span
                    data-star-part="resizer"
                    class="star-table__resizer"
                    role="separator"
                    aria-orientation="vertical"
                    tabindex="0"
                    [attr.aria-label]="text.resizeColumn(column.header)"
                    [attr.aria-valuenow]="resizeNow(column)"
                    [attr.aria-valuemin]="minColumnWidth"
                    [attr.aria-valuemax]="resizeMax(column)"
                    (pointerdown)="startResize(column, $event)"
                    (keydown)="onResizeKey(column, $event)"
                  ></span>
                }
              </th>
            }
          </tr>
          @if (hasColumnFilters()) {
            <tr
              data-star-part="filters"
              class="star-table__filters"
              [attr.aria-rowindex]="windowed() ? 2 : null"
            >
              @for (column of visibleColumns(); track column.field) {
                <td
                  data-star-part="filtersCell"
                  [class.star-table__cell--frozen]="column.frozen"
                  [style.inset-inline-start]="frozenOffset(column)"
                >
                  @if (column.filter) {
                    <input
                      data-star-part="filter"
                      type="search"
                      class="star-input star-input--sm star-table__filter"
                      autocomplete="off"
                      [attr.aria-label]="text.filterBy(column.header)"
                      [value]="filters()[column.field] ?? ''"
                      (input)="setFilter(column.field, $any($event.target).value)"
                    />
                  }
                </td>
              }
            </tr>
          }
        </thead>
        @if (contextMenu().length) {
          <tbody
            data-star-part="scrollTbody"
            [starContextMenu]="rowMenu"
            (menuClosed)="onMenuClosed()"
          >
            <ng-container *ngTemplateOutlet="body" />
          </tbody>
        } @else {
          <tbody data-star-part="scrollTbody">
            <ng-container *ngTemplateOutlet="body" />
          </tbody>
        }
      </table>
    </div>
    @if (paginator()) {
      <star-paginator
        [ariaLabel]="ariaLabel() ? text.pagination + ': ' + ariaLabel() : null"
        [totalRecords]="sortedNodes().length"
        [(first)]="first"
        [(rows)]="rows"
        [rowsPerPageOptions]="rowsPerPageOptions()"
      />
    }
    <star-menu
      #rowMenu
      [items]="contextMenu()"
      [ariaLabel]="text.actions"
      (itemClick)="onMenuItem($event)"
    />
    @if (footerSlot(); as footer) {
      <ng-container *ngTemplateOutlet="footer" />
    }

    <ng-template #body>
      @if (window().before > 0) {
        <tr starPart="spacer" class="star-table__spacer" aria-hidden="true">
          <td
            data-star-part="spacerCell"
            class="star-table__spacer-cell"
            [attr.colspan]="visibleColumns().length"
            [style.height.px]="window().before"
          ></td>
        </tr>
      }
      @if (showEmpty()) {
        <tr starPart="emptyRow" [attr.aria-rowindex]="windowed() ? headerRows() + 1 : null">
          <td
            data-star-part="empty"
            class="star-table__empty"
            [attr.colspan]="visibleColumns().length"
          >
            <i data-star-part="emptyIcon" class="ph-bold ph-tray" aria-hidden="true"></i>
            @if (emptySlot(); as custom) {
              <ng-container *ngTemplateOutlet="custom; context: emptyContext()" />
            } @else {
              {{ text.emptyFilterMessage }}
            }
          </td>
        </tr>
      }
      @for (entry of entries(); track entry.key) {
        @let row = entry.row;
        @if (entry.loading) {
          <tr
            starPart="loading"
            class="star-tree-table__loading"
            [attr.aria-rowindex]="entry.aria"
            [attr.aria-level]="row.level + 1"
          >
            <td data-star-part="loadingCell" [attr.colspan]="visibleColumns().length">
              <span
                data-star-part="first"
                class="star-tree-table__first"
                [style.--star-tree-level]="row.level"
              >
                <span
                  data-star-part="toggle"
                  class="star-tree__toggle star-tree__toggle--leaf"
                ></span>
                <i
                  data-star-part="firstIcon"
                  class="ph-bold ph-spinner-gap star-spin"
                  aria-hidden="true"
                ></i>
                {{ text.loading }}
              </span>
            </td>
          </tr>
        } @else {
          <tr
            starPart="row"
            class="star-table__row"
            [class.star-table__row--selected]="isSelected(row.node.key)"
            [attr.aria-rowindex]="entry.aria"
            [attr.aria-level]="row.level"
            [attr.aria-setsize]="row.setSize"
            [attr.aria-posinset]="row.position"
            [attr.aria-expanded]="isExpandable(row.node) ? isOpen(row.node.key) : null"
            [attr.aria-selected]="selectionMode() ? isSelected(row.node.key) : null"
            [attr.tabindex]="focusKey() === row.node.key && focusCell() === null ? 0 : -1"
            [attr.data-key]="row.node.key"
            (keydown)="onKeydown($event, row)"
            (focusin)="onRowFocus($event, row.node.key)"
            (click)="onRowClick($event, row.node)"
            (contextmenu)="onContextMenu(row.node)"
          >
            @for (
              column of visibleColumns();
              track column.field;
              let first = $first;
              let ci = $index
            ) {
              <td
                data-star-part="rowCell"
                [class]="'star-table__cell--' + (column.align ?? 'start')"
                [class.star-table__cell--frozen]="column.frozen"
                [style.inset-inline-start]="frozenOffset(column)"
                [attr.data-col]="ci"
                [attr.tabindex]="cellTabIndex(row.node.key, ci)"
              >
                @if (first) {
                  <span
                    data-star-part="first"
                    class="star-tree-table__first"
                    [style.--star-tree-level]="row.level - 1"
                  >
                    @if (isExpandable(row.node)) {
                      <button
                        data-star-part="toggle"
                        type="button"
                        class="star-tree__toggle star-tree-table__toggle"
                        tabindex="-1"
                        [attr.aria-label]="
                          isOpen(row.node.key)
                            ? text.collapseItem(row.node.label)
                            : text.expandItem(row.node.label)
                        "
                        (click)="userToggle(row.node)"
                      >
                        <i
                          data-star-part="caretRightIcon"
                          class="star-table__caret-right-icon ph-bold ph-caret-right"
                          aria-hidden="true"
                        ></i>
                      </button>
                    } @else {
                      <span
                        data-star-part="toggle"
                        class="star-tree__toggle star-tree__toggle--leaf"
                      ></span>
                    }
                    @if (selectionMode() === 'checkbox') {
                      <!-- The row owns the keys (Space checks) and the focus; the box takes the pointer. -->
                      <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
                      <span
                        data-star-part="box"
                        class="star-check__box star-tree__check star-tree-table__check"
                        role="checkbox"
                        [class.star-tree__check--on]="checkState(row.node.key) !== false"
                        [attr.aria-checked]="checkState(row.node.key)"
                        [attr.aria-label]="row.node.label"
                        [attr.aria-disabled]="row.node.disabled || null"
                        (click)="onCheckClick($event, row.node)"
                      >
                        @if (checkState(row.node.key) === 'mixed') {
                          <i
                            data-star-part="boxIcon"
                            class="ph-bold ph-minus"
                            aria-hidden="true"
                          ></i>
                        } @else if (checkState(row.node.key) === true) {
                          <i
                            data-star-part="boxIcon"
                            class="ph-bold ph-check"
                            aria-hidden="true"
                          ></i>
                        }
                      </span>
                    }
                    @if (isEditing(row.node, column)) {
                      <ng-container
                        *ngTemplateOutlet="editor; context: { $implicit: row.node, column }"
                      />
                    } @else if (nodeSlot(); as custom) {
                      <ng-container *ngTemplateOutlet="custom; context: nodeContext(row)" />
                    } @else {
                      {{ cellText(row.node, column.field, true) }}
                    }
                  </span>
                } @else if (isEditing(row.node, column)) {
                  <ng-container
                    *ngTemplateOutlet="editor; context: { $implicit: row.node, column }"
                  />
                } @else {
                  {{ row.node.data?.[column.field] }}
                }
              </td>
            }
          </tr>
        }
      }
      @if (window().after > 0) {
        <tr starPart="spacer" class="star-table__spacer" aria-hidden="true">
          <td
            data-star-part="spacerCell"
            class="star-table__spacer-cell"
            [attr.colspan]="visibleColumns().length"
            [style.height.px]="window().after"
          ></td>
        </tr>
      }
    </ng-template>

    <ng-template #editor let-node let-column="column">
      <input
        starPart="editor"
        class="star-input star-input--sm star-table__editor star-tree-table__editor"
        [type]="column.editor === 'number' ? 'number' : 'text'"
        [attr.aria-label]="text.editCell(column.header)"
        [value]="editText(node, column)"
        (blur)="commitEdit(node, column, $any($event.target).value)"
        (keydown)="onEditorKeydown($event, node, column)"
      />
    </ng-template>
  `,
})
export class StarTreeTable {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly doc = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly nodes = input<readonly StarTreeTableNode[]>([]);
  readonly columns = input.required<readonly StarTreeTableColumn[]>();
  readonly expanded = model<readonly string[]>([]);
  readonly ariaLabel = input<string | null>(null);
  /**
   * Maximum height of the table (a CSS length, for example `20rem`). The table scrolls inside it
   * and the header stays at the top.
   */
  readonly scrollHeight = input<string | null>(null);
  /**
   * Windowed rendering for large tables: only the rows in and near the viewport are in the DOM.
   * Needs `scrollHeight`, and every row gets the fixed height `virtualItemSize` with its text on
   * one line. Without `scrollHeight` the table renders all rows as usual. PrimeNG `virtualScroll`.
   */
  readonly virtualScroll = input(false, { transform: booleanAttribute });
  /**
   * Row height in pixels in windowed rendering. The default is the natural height of a row of
   * this table. PrimeNG `virtualScrollItemSize`.
   */
  readonly virtualItemSize = input(TREE_TABLE_ROW_HEIGHT, { transform: numberAttribute });

  // ---- sorting ----
  /** Sort column (the first sort column with `multiSort`). Two-way. PrimeNG `sortField`. */
  readonly sortField = model<string | null>(null);
  /** `1` ascending, `-1` descending. Two-way. PrimeNG `sortOrder`. */
  readonly sortOrder = model<StarSortOrder>(1);
  /**
   * Sort by more than one column: Shift + click (or Shift + Enter) on a header adds it as the
   * next sort column. A plain click sorts by that column only. PrimeNG `sortMode="multiple"`.
   */
  readonly multiSort = input(false, { transform: booleanAttribute });
  /** Sort columns in priority order with `multiSort`. Two-way. PrimeNG `multiSortMeta`. */
  readonly sortMeta = model<readonly StarSortState[]>([]);

  // ---- filtering ----
  /** Shows a search field above the table that sets `globalFilter`. */
  readonly filter = input(false, { transform: booleanAttribute });
  /**
   * Case- and accent-insensitive text search over all columns. Two-way. PrimeNG `filterGlobal`.
   */
  readonly globalFilter = model('');
  /** Column filter texts by column `field` (columns with `filter` set). Two-way. */
  readonly filters = model<Readonly<Record<string, string>>>({});
  /**
   * `'lenient'`: a matching node shows with its ancestors and all its descendants. `'strict'`:
   * only the matching paths show. The ancestors of a match show open. PrimeNG `filterMode`.
   */
  readonly filterMode = input<TreeFilterMode>('lenient');

  // ---- paging ----
  /** Pages over the top-level rows; the children of a row stay on its page. */
  readonly paginator = input(false, { transform: booleanAttribute });
  /** Index of the first top-level row of the page. Two-way. */
  readonly first = model(0);
  /** Top-level rows per page. Two-way. */
  readonly rows = model(10);
  readonly rowsPerPageOptions = input<readonly number[]>([10, 25, 50]);

  // ---- selection ----
  /**
   * `'single'` and `'multiple'`: a click or Space selects a row. `'checkbox'`: each row has a
   * check box, and the checks propagate (see `propagateSelectionUp` / `Down`). PrimeNG
   * `selectionMode`.
   */
  readonly selectionMode = input<'single' | 'multiple' | 'checkbox' | null>(null);
  /** Keys of the selected nodes. Two-way. */
  readonly selection = model<readonly string[]>([]);
  /** Checkbox mode: a parent is checked when all its children are, and shows mixed when some are. */
  readonly propagateSelectionUp = input(true, { transform: booleanAttribute });
  /** Checkbox mode: checking a node checks all its descendants. */
  readonly propagateSelectionDown = input(true, { transform: booleanAttribute });

  // ---- lazy children ----
  /**
   * Lazy children: a node with `leaf: false` shows an expander although it has no children yet.
   * Opening it emits `nodeExpand`; the owner loads the children and sets `loading` meanwhile.
   */
  readonly lazy = input(false, { transform: booleanAttribute });

  // ---- keyboard ----
  /**
   * WAI-ARIA treegrid cell navigation: the cells take the focus, Arrow right on an open branch
   * or a leaf moves into the row, Arrow left and Arrow right move between cells, and Arrow left
   * on the first cell goes back to the row. `undefined` (the default) is automatic: on when a
   * column is `editable`, off otherwise. `true` or `false` sets it.
   */
  readonly cellNavigation = input<boolean | undefined, boolean | string | undefined>(undefined, {
    transform: ɵstarOptionalBoolean,
  });

  // ---- columns ----
  /** The user can change a column width: drag the header edge, or use the arrow keys on it. */
  readonly resizableColumns = input(false, { transform: booleanAttribute });
  /** The user can move a column: drag its header, or use its move buttons. */
  readonly reorderableColumns = input(false, { transform: booleanAttribute });
  /** Column widths in pixels by `field`, set by the user. Two-way. */
  readonly columnWidths = model<Readonly<Record<string, number>>>({});
  /** Column `field`s in display order. Columns not in the list keep their place after it. Two-way. */
  readonly columnOrder = model<readonly string[]>([]);

  // ---- context menu ----
  /**
   * Items of the row context menu (right click, Shift+F10 or the context menu key on a row).
   * Empty: no menu, and the browser menu shows. PrimeNG `contextMenu`.
   */
  readonly contextMenu = input<readonly StarMenuItem[]>([]);

  readonly nodeSelect = output<StarTreeTableNodeEvent>();
  readonly nodeUnselect = output<StarTreeTableNodeEvent>();
  /** The user opened a node. With `lazy`, load the children of `node` here. */
  readonly nodeExpand = output<StarTreeTableNodeEvent>();
  readonly nodeCollapse = output<StarTreeTableNodeEvent>();
  /** The user changed an editable cell (see `StarTreeTableColumn.editable`). */
  readonly cellEdit = output<StarTreeTableCellEditEvent>();
  /** The user chose an item of the row context menu. */
  readonly contextMenuSelect = output<StarTreeTableContextMenuEvent>();

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly header = viewChild<ElementRef<HTMLElement>>('header');

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly headerSlot = starSlot<object>(this.slots, this, 'header');
  protected readonly footerSlot = starSlot<object>(this.slots, this, 'footer');
  protected readonly nodeSlot = starSlot<StarNodeContext<Record<string, unknown>>>(
    this.slots,
    this,
    'node',
  );
  protected readonly emptySlot = starSlot<StarEmptyContext>(this.slots, this, 'empty');
  protected readonly emptyContext = computed<StarEmptyContext>(() => ({
    $implicit: this.globalFilter(),
  }));
  protected readonly cellText = cellText;

  /** Every node of `nodes` by key: events report the node as the owner gave it. */
  private readonly index = computed(() => {
    const map = new Map<string, TreeTableNode>();
    const walk = (list: readonly TreeTableNode[]) =>
      list.forEach((node) => {
        map.set(node.key, node);
        if (node.children) walk(node.children);
      });
    walk(this.nodes());
    return map;
  });
  private readonly parents = computed(() => parentsOf(this.nodes()));

  // ---- columns ----
  /** Columns in display order: frozen columns first, then `columnOrder`. */
  protected readonly visibleColumns = computed(() =>
    orderColumns(this.columns(), this.columnOrder()),
  );
  protected readonly hasColumnFilters = computed(() =>
    this.visibleColumns().some((column) => column.filter),
  );
  /** Header rows: the column headings, and the filter row when there is one. */
  protected readonly headerRows = computed(() => (this.hasColumnFilters() ? 2 : 1));
  /** The cells take the focus (the keys move into the row): `cellNavigation`, or automatic. */
  private readonly cellMode = computed(
    () => this.cellNavigation() ?? this.columns().some((column) => !!column.editable),
  );

  // ---- filter, sort, page ----
  private readonly columnQueries = computed(() => {
    const filters = this.filters();
    return this.columns().flatMap((column) => {
      const query = (filters[column.field] ?? '').trim();
      return column.filter && query ? [{ field: column.field, query }] : [];
    });
  });
  protected readonly filterActive = computed(
    () => !!this.globalFilter().trim() || this.columnQueries().length > 0,
  );
  private readonly filtered = computed<TreeFilterResult<TreeTableNode>>(() => {
    const nodes = this.nodes();
    if (!this.filterActive()) return { nodes, ancestors: new Set(), matches: new Set() };
    const fields = this.visibleColumns().map((column) => column.field);
    const global = this.globalFilter().trim();
    const queries = this.columnQueries();
    return filterTree(
      nodes,
      (node) => nodeMatches(node, fields, global, queries),
      this.filterMode(),
    );
  });
  /** Sort columns in priority order. */
  private readonly sorts = computed<readonly StarSortState[]>(() =>
    ɵstarSortRules(this.multiSort(), this.sortMeta(), this.sortField(), this.sortOrder()),
  );
  /** The filtered nodes, with the siblings of each level sorted. */
  protected readonly sortedNodes = computed(() => sortTree(this.filtered().nodes, this.sorts()));
  private readonly pageNodes = computed(() => {
    const nodes = this.sortedNodes();
    return this.paginator() ? pageRoots(nodes, this.first(), this.rows()) : nodes;
  });
  /** First top-level index of the page (for `aria-posinset` of the top-level rows). */
  private readonly pageStart = computed(() => {
    if (!this.paginator()) return 0;
    const page = this.pageNodes()[0];
    return page ? Math.max(0, this.sortedNodes().indexOf(page)) : 0;
  });

  /**
   * Ancestors of a filter match show open. A user who closes one of them while the filter is on
   * closes it here; the list resets when the filter result changes.
   */
  private readonly filterClosed = linkedSignal<
    TreeFilterResult<TreeTableNode>,
    ReadonlySet<string>
  >({ source: this.filtered, computation: () => new Set<string>() });
  private readonly openKeys = computed(() => {
    const open = new Set(this.expanded());
    const closed = this.filterClosed();
    for (const key of this.filtered().ancestors) if (!closed.has(key)) open.add(key);
    return open;
  });

  /** The node rows whose parents are open, in order. The sibling numbers come from the data. */
  protected readonly rowList = computed<TreeTableRow[]>(() => {
    const rows = flattenVisible(this.pageNodes(), this.openKeys());
    if (!this.paginator()) return rows;
    // The top-level rows count over all pages.
    const start = this.pageStart();
    const total = this.sortedNodes().length;
    return rows.map((row) =>
      row.level === 1 ? { ...row, position: row.position + start, setSize: total } : row,
    );
  });
  private readonly rowIndex = computed(() => rowIndexOf(this.rowList()));
  /** The body rows: the node rows, and a loading row under each open node that loads. */
  private readonly display = computed(() => {
    const rows: { row: TreeTableRow; loading: boolean }[] = [];
    const open = this.openKeys();
    for (const row of this.rowList()) {
      rows.push({ row, loading: false });
      if (row.node.loading && open.has(row.node.key)) rows.push({ row, loading: true });
    }
    return rows;
  });
  /** Body row index of each node row (it differs from `rowIndex` below a loading row). */
  private readonly displayIndex = computed(() => {
    const map = new Map<string, number>();
    this.display().forEach((entry, i) => {
      if (!entry.loading) map.set(entry.row.node.key, i);
    });
    return map;
  });
  /** The empty row shows when there are no rows and the `starEmpty` slot exists or a filter is on. */
  protected readonly showEmpty = computed(
    () => this.display().length === 0 && (!!this.emptySlot() || this.filterActive()),
  );
  protected readonly ariaRowCountValue = computed(() =>
    ariaRowCount(this.display().length + (this.showEmpty() ? 1 : 0), this.headerRows()),
  );

  // ---- selection ----
  private readonly selectedKeys = computed(() => new Set(this.selection()));
  private readonly checkMap = computed(() =>
    this.selectionMode() === 'checkbox'
      ? checkStates(this.nodes(), this.selectedKeys(), this.propagateSelectionUp())
      : new Map<string, boolean | 'mixed'>(),
  );
  protected readonly multiselectable = computed(() =>
    this.selectionMode() === 'multiple' || this.selectionMode() === 'checkbox' ? true : null,
  );

  /**
   * The active row (the one with `tabindex` 0). It stays a row after the rows change, and it is
   * kept in state, not read from the DOM: in windowed rendering its element may not exist.
   */
  protected readonly focusKey = linkedSignal<readonly TreeTableRow[], string | null>({
    source: this.rowList,
    computation: (rows, previous) =>
      stillFocusable(previous?.value, this.rowIndex(), this.parents(), rows[0]?.node.key ?? null),
  });
  /** The active cell of the active row (column index), or null when the row itself is active. */
  protected readonly focusCell = signal<number | null>(null);

  // ---- windowed rendering ----
  protected readonly windowed = computed(
    () => this.virtualScroll() && !!this.scrollHeight() && this.virtualItemSize() > 0,
  );
  private readonly scrollTop = signal(0);
  private readonly viewportHeight = signal(0);
  /** The body rows that are in the DOM. Without windowed rendering: all of them. */
  protected readonly window = computed<RowWindow>(
    () => {
      const count = this.display().length;
      if (!this.windowed()) return { start: 0, end: count, before: 0, after: 0 };
      return rowWindow(
        count,
        this.virtualItemSize(),
        this.scrollTop(),
        this.viewportHeight() || FALLBACK_VIEWPORT,
        BUFFER_ROWS,
      );
    },
    // A scroll of a few pixels does not change the window: skip the work after it.
    {
      equal: (a, b) =>
        a.start === b.start && a.end === b.end && a.before === b.before && a.after === b.after,
    },
  );
  protected readonly entries = computed<TreeTableEntry[]>(() => {
    const display = this.display();
    const windowed = this.windowed();
    const { start, end } = this.window();
    const headerRows = this.headerRows();
    return display.slice(start, end).map(({ row, loading }, i) => ({
      key: loading ? row.node.key + LOADING_KEY : row.node.key,
      row,
      loading,
      aria: windowed ? ariaRowIndex(start + i, headerRows) : null,
    }));
  });
  /** The active row is in the DOM. If it is not, the scroll area takes the Tab stop. */
  protected readonly activeRendered = computed(() => {
    const index = this.displayIndex().get(this.focusKey() ?? '');
    const { start, end } = this.window();
    return index !== undefined && index >= start && index < end;
  });
  /** Row (and cell) to focus as soon as its element exists (it may need scrolling in first). */
  private pendingFocus: { key: string; cell: number | null; retried?: boolean } | null = null;
  /** The focus waits on the scroll area because the focused row left the DOM. */
  protected parked = false;

  // ---- column state ----
  protected readonly dragField = signal<string | null>(null);
  protected readonly dropField = signal<string | null>(null);
  private resizing = false;
  /** Rendered width in pixels of each header cell, by column `field` (resize and freeze only). */
  private readonly headerWidths = signal<Readonly<Record<string, number>>>({});
  protected readonly minColumnWidth = ɵSTAR_MIN_COLUMN_WIDTH;

  // ---- edit and menu ----
  /** The cell in edit mode, or null. */
  private readonly editing = signal<{ readonly key: string; readonly field: string } | null>(null);
  /** The node of the row whose context menu is open. */
  private menuNode: TreeTableNode | null = null;

  constructor() {
    // A filter that changes (also from outside, through the models) shows the first page.
    let lastFilter: { global: string; columns: Readonly<Record<string, string>> } | null = null;
    effect(() => {
      const next = { global: this.globalFilter(), columns: this.filters() };
      const previous = lastFilter;
      lastFilter = next;
      if (previous && (previous.global !== next.global || previous.columns !== next.columns)) {
        untracked(() => this.first.set(0));
      }
    });
    // The rows or the window change (a scroll, a branch closes, new nodes) and the focused row
    // may leave the DOM. This effect runs before the template updates, while the row is still there.
    effect(() => {
      const window = this.window();
      this.displayIndex();
      untracked(() => {
        if (this.windowed()) this.parkFocus(window);
      });
    });
    // The scroll area changes its height with the rows (up to `scrollHeight`) and with the page.
    effect((onCleanup) => {
      const scroller = this.scroller()?.nativeElement;
      if (!this.windowed() || !scroller || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.syncScroll());
      observer.observe(scroller);
      onCleanup(() => observer.disconnect());
    });
    afterEveryRender({
      read: () => {
        this.syncScroll();
        this.measureHeaders();
      },
    });
    afterEveryRender(() => {
      this.applyPendingFocus();
      if (this.parked) this.restoreParkedFocus();
    });
    if (isDevMode()) {
      effect(() => {
        if (this.virtualScroll() && !this.scrollHeight()) {
          console.warn(
            'star-tree-table: virtualScroll needs scrollHeight. Without it the table renders all rows.',
          );
        }
      });
    }
  }

  // ---------------------------------------------------------------- expand

  protected isOpen(key: string): boolean {
    return this.openKeys().has(key);
  }

  /** A node shows an expander: it has children, or it is a lazy node that is not a leaf. */
  protected isExpandable(node: TreeTableNode): boolean {
    return !!node.children?.length || (this.lazy() && node.leaf === false);
  }

  protected nodeContext(row: TreeTableRow): StarNodeContext<Record<string, unknown>> {
    return {
      $implicit: row.node,
      level: row.level,
      expanded: this.isOpen(row.node.key),
      selected: this.isSelected(row.node.key),
    };
  }

  /** Opens or closes one node from code. It emits no event. */
  toggle(key: string, open = !this.isOpen(key)): void {
    this.expanded.update((keys) => {
      if (!open) return keys.filter((k) => k !== key);
      return keys.includes(key) ? keys : [...keys, key];
    });
    if (this.filtered().ancestors.has(key)) {
      this.filterClosed.update((closed) => {
        const next = new Set(closed);
        if (open) next.delete(key);
        else next.add(key);
        return next;
      });
    }
  }

  /** The user opens or closes a node: the table emits `nodeExpand` or `nodeCollapse`. */
  protected userToggle(node: TreeTableNode, open = !this.isOpen(node.key)): void {
    if (open === this.isOpen(node.key)) return;
    this.toggle(node.key, open);
    const event = { node: this.original(node) };
    if (open) this.nodeExpand.emit(event);
    else this.nodeCollapse.emit(event);
  }

  private original(node: TreeTableNode): TreeTableNode {
    return this.index().get(node.key) ?? node;
  }

  // ---------------------------------------------------------------- sort

  /** Sorts by a column. With `multiSort`, `event.shiftKey` adds the column to the sort. */
  sortBy(column: StarTreeTableColumn, event?: MouseEvent | KeyboardEvent): void {
    const { meta, first } = ɵstarNextSort(
      this.sorts(),
      column.field,
      this.multiSort(),
      !!event?.shiftKey,
    );
    this.sortMeta.set(meta);
    // `sortField` / `sortOrder` always hold the first sort column.
    this.sortField.set(first.field);
    this.sortOrder.set(first.order);
    this.first.set(0);
  }

  /** `aria-sort` goes on one column only: the first sort column. */
  protected ariaSort(column: StarTreeTableColumn): string | null {
    return ɵstarAriaSort(column.sortable, this.sorts(), column.field);
  }

  protected sortIcon(column: StarTreeTableColumn): string {
    return ɵstarSortIcon(this.sorts(), column.field);
  }

  /** Position of a column in a sort by two or more columns, else `null`. */
  protected sortRank(column: StarTreeTableColumn): number | null {
    return ɵstarSortRank(this.sorts(), column.field);
  }

  // ---------------------------------------------------------------- filter

  protected setGlobalFilter(text: string): void {
    this.globalFilter.set(text);
    this.first.set(0);
  }

  protected setFilter(field: string, text: string): void {
    this.filters.update((filters) => ({ ...filters, [field]: text }));
    this.first.set(0);
  }

  // ---------------------------------------------------------------- selection

  protected isSelected(key: string): boolean {
    if (this.selectionMode() === 'checkbox') return this.checkMap().get(key) === true;
    return !!this.selectionMode() && this.selectedKeys().has(key);
  }

  protected checkState(key: string): boolean | 'mixed' {
    return this.checkMap().get(key) ?? false;
  }

  /** Selects or unselects a node, as a click on its row does. */
  toggleSelection(node: StarTreeTableNode): void {
    const mode = this.selectionMode();
    if (!mode || node.disabled || node.selectable === false) return;
    const key = node.key;
    let on: boolean;
    if (mode === 'checkbox') {
      on = this.checkState(key) !== true;
      this.selection.set(
        toggleChecked(this.nodes(), key, on, this.selection(), {
          up: this.propagateSelectionUp(),
          down: this.propagateSelectionDown(),
        }),
      );
    } else {
      on = !this.selectedKeys().has(key);
      if (mode === 'single') this.selection.set(on ? [key] : []);
      else this.selection.update((keys) => (on ? [...keys, key] : keys.filter((k) => k !== key)));
    }
    const event = { node: this.original(node) };
    if (on) this.nodeSelect.emit(event);
    else this.nodeUnselect.emit(event);
  }

  protected onCheckClick(event: MouseEvent, node: TreeTableNode): void {
    event.stopPropagation();
    this.focusKey.set(node.key);
    this.toggleSelection(node);
  }

  protected onRowClick(event: MouseEvent, node: TreeTableNode): void {
    // A click on a control (toggle, editor) is not a click on the row.
    if ((event.target as HTMLElement).closest('button, input, a')) return;
    if (this.selectionMode()) this.toggleSelection(node);
  }

  // ---------------------------------------------------------------- columns

  protected canMove(column: StarTreeTableColumn): boolean {
    return this.reorderableColumns() && !column.frozen;
  }

  protected canMoveBy(column: StarTreeTableColumn, delta: 1 | -1): boolean {
    const ordered = this.visibleColumns();
    const target = ordered[ordered.indexOf(column) + delta];
    return !!target && !target.frozen;
  }

  /** Moves a column to the place of another column. Frozen columns do not move. */
  moveColumn(field: string, targetField: string): void {
    const order = moveColumnOrder(this.visibleColumns(), field, targetField);
    if (order) this.columnOrder.set(order);
  }

  protected moveColumnBy(column: StarTreeTableColumn, delta: 1 | -1): void {
    const ordered = this.visibleColumns();
    const target = ordered[ordered.indexOf(column) + delta];
    if (!target) return;
    this.moveColumn(column.field, target.field);
    // The header moves in the DOM, which drops the focus: keep it on the same move button, or on
    // the other one when this one is now disabled.
    afterNextRender(
      () => {
        const th = this.host.nativeElement.querySelector(
          `thead th[data-field="${CSS.escape(column.field)}"]`,
        );
        const buttons = th?.querySelectorAll<HTMLButtonElement>('.star-tree-table__move button');
        if (!buttons?.length) return;
        const same = buttons[delta === -1 ? 0 : 1];
        (same.disabled ? buttons[delta === -1 ? 1 : 0] : same).focus();
      },
      { injector: this.injector },
    );
  }

  protected onDragStart(column: StarTreeTableColumn, event: DragEvent): void {
    if (this.resizing || !this.canMove(column)) {
      event.preventDefault();
      return;
    }
    this.dragField.set(column.field);
    event.dataTransfer?.setData('text/plain', column.field);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected onDragOver(column: StarTreeTableColumn, event: DragEvent): void {
    const field = this.dragField();
    if (!field || field === column.field || column.frozen) return;
    event.preventDefault();
    this.dropField.set(column.field);
  }

  protected onDrop(column: StarTreeTableColumn, event: DragEvent): void {
    const field = this.dragField();
    if (!field) return;
    event.preventDefault();
    this.moveColumn(field, column.field);
    this.endDrag();
  }

  protected endDrag(): void {
    this.dragField.set(null);
    this.dropField.set(null);
  }

  protected widthOf(column: StarTreeTableColumn): string | null {
    return this.resizedWidth(column) ?? column.width ?? null;
  }

  protected resizedWidth(column: StarTreeTableColumn): string | null {
    const width = this.columnWidths()[column.field];
    return width ? `${width}px` : null;
  }

  /** `aria-valuenow` of a resize handle: the width of the column in pixels. */
  protected resizeNow(column: StarTreeTableColumn): number | null {
    const width = this.columnWidths()[column.field] ?? this.headerWidths()[column.field];
    return width === undefined ? null : Math.round(width);
  }

  protected resizeMax(column: StarTreeTableColumn): number {
    return ɵstarResizeMax(this.resizeNow(column));
  }

  /** Sticky offsets of the frozen columns, by column (see `frozenOffset`). */
  private readonly frozenOffsets = computed(() => {
    const frozen = this.visibleColumns().filter((column) => column.frozen);
    const offsets = ɵstarStickyOffsets(frozen, this.headerWidths(), (column) =>
      this.widthOf(column),
    );
    return new Map(frozen.map((column, index) => [column, offsets[index]]));
  });

  /**
   * Offset of a frozen column: the widths of the frozen columns before it. Uses the measured
   * widths; before the first measure (and where layout is not available) the declared widths.
   */
  protected frozenOffset(column: StarTreeTableColumn): string | null {
    if (!column.frozen) return null;
    return this.frozenOffsets().get(column) ?? '0px';
  }

  /** Measures the header cells (for the resize handles and the frozen offsets). */
  private measureHeaders(): void {
    const columns = untracked(this.visibleColumns);
    const frozen = columns.filter((column) => column.frozen).length;
    if (!untracked(this.resizableColumns) && frozen < 2) return;
    const widths: Record<string, number> = {};
    for (const cell of this.host.nativeElement.querySelectorAll<HTMLElement>(
      'thead th[data-field]',
    )) {
      const field = cell.dataset['field'];
      if (field) widths[field] = cell.getBoundingClientRect().width;
    }
    if (!ɵstarSameWidths(widths, untracked(this.headerWidths))) this.headerWidths.set(widths);
  }

  private setWidth(column: StarTreeTableColumn, width: number): void {
    const next = ɵstarClampColumnWidth(width);
    this.columnWidths.update((widths) => ({ ...widths, [column.field]: next }));
  }

  protected startResize(column: StarTreeTableColumn, event: PointerEvent): void {
    const started = ɵstarStartColumnResize(
      event,
      (width) => this.setWidth(column, width),
      () => (this.resizing = false),
    );
    if (started) this.resizing = true;
  }

  protected onResizeKey(column: StarTreeTableColumn, event: KeyboardEvent): void {
    const width = ɵstarResizeByKey(event, this.columnWidths()[column.field]);
    if (width !== null) this.setWidth(column, width);
  }

  // ---------------------------------------------------------------- edit

  protected isEditable(node: TreeTableNode, column: StarTreeTableColumn): boolean {
    const editable = column.editable;
    return typeof editable === 'function' ? editable(this.original(node)) : !!editable;
  }

  protected isEditing(node: TreeTableNode, column: StarTreeTableColumn): boolean {
    const editing = this.editing();
    return editing !== null && editing.key === node.key && editing.field === column.field;
  }

  /** Text in the editor: the raw data value. */
  protected editText(node: TreeTableNode, column: StarTreeTableColumn): string {
    return ɵstarEditText(node.data?.[column.field]);
  }

  /** Opens the editor of a cell (when the column is editable for this node). */
  startEdit(node: StarTreeTableNode, column: StarTreeTableColumn): void {
    if (!this.isEditable(node, column)) return;
    const cell = this.visibleColumns().indexOf(column);
    this.focusKey.set(node.key);
    this.focusCell.set(cell < 0 ? null : cell);
    this.editing.set({ key: node.key, field: column.field });
    afterNextRender(
      () => {
        const input = this.host.nativeElement.querySelector<HTMLInputElement>(
          '.star-tree-table__editor',
        );
        input?.focus();
        if (input?.type === 'text') input.select();
      },
      { injector: this.injector },
    );
  }

  protected commitEdit(node: TreeTableNode, column: StarTreeTableColumn, text: string): void {
    // Enter removes the editor, which also fires `blur`: only the first event commits.
    if (!this.isEditing(node, column)) return;
    const previous = node.data?.[column.field];
    const value = column.editor === 'number' ? (text.trim() === '' ? null : Number(text)) : text;
    this.closeEditor(node.key);
    if (typeof value === 'number' && Number.isNaN(value)) return;
    if (ɵstarUnchangedEdit(value, previous)) return;
    this.cellEdit.emit({ node: this.original(node), field: column.field, value, previous });
  }

  protected onEditorKeydown(
    event: KeyboardEvent,
    node: TreeTableNode,
    column: StarTreeTableColumn,
  ): void {
    // The keys of the editor stay in it: the row does not move or select.
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitEdit(node, column, (event.target as HTMLInputElement).value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeEditor(node.key);
    }
  }

  /** Ends the edit and returns the focus to the cell, if the focus is still in the editor. */
  private closeEditor(key: string): void {
    const editor = this.host.nativeElement.querySelector('.star-tree-table__editor');
    const inEditor = !!editor && editor.contains(this.doc.activeElement);
    this.editing.set(null);
    if (inEditor) this.focusRow(key, this.focusCell());
  }

  protected cellTabIndex(key: string, cell: number): number | null {
    if (!this.cellMode()) return null;
    // The cell in edit is not a focus target itself: its editor is (and the editor covers it).
    const editing = this.editing();
    if (editing?.key === key && this.visibleColumns()[cell]?.field === editing.field) return null;
    return this.focusKey() === key && this.focusCell() === cell ? 0 : -1;
  }

  // ---------------------------------------------------------------- context menu

  protected onContextMenu(node: TreeTableNode): void {
    if (!this.contextMenu().length) return;
    this.menuNode = node;
    this.focusKey.set(node.key);
  }

  protected onMenuItem(item: StarMenuItem): void {
    const node = this.menuNode;
    if (node) this.contextMenuSelect.emit({ node: this.original(node), item });
  }

  /** The menu closed: the focus goes back to the row when it has nowhere else to be. */
  protected onMenuClosed(): void {
    setTimeout(() => {
      const active = this.doc.activeElement;
      if (!active || active === this.doc.body) this.focusRow(this.focusKey(), this.focusCell());
    });
  }

  /** Shift+F10 or the context menu key: opens the menu at the row, as a right click does. */
  private openMenuFromKey(key: string): void {
    const row = this.rowElement(key);
    if (row) ɵstarOpenContextMenu(row);
  }

  // ---------------------------------------------------------------- focus and scroll

  /** Reads the scroll position and the height of the scroll area (windowed rendering). */
  protected syncScroll(): void {
    const scroller = this.scroller()?.nativeElement;
    if (!scroller || !this.windowed()) return;
    this.scrollTop.set(scroller.scrollTop);
    if (scroller.clientHeight) this.viewportHeight.set(scroller.clientHeight);
  }

  protected onRowFocus(event: FocusEvent, key: string): void {
    this.focusKey.set(key);
    this.pendingFocus = null;
    this.parked = false;
    const target = event.target as HTMLElement;
    if (target === event.currentTarget) this.focusCell.set(null);
    else if (target.matches('td[data-col]')) this.focusCell.set(Number(target.dataset['col']));
    // A row that the keyboard or a click focuses may sit under the sticky header.
    if (target === event.currentTarget && this.windowed()) this.revealRow(key);
  }

  /**
   * Moves the focus to a row (or one of its cells). The row becomes the active row at once. In
   * windowed rendering the row is scrolled into the window first, and the focus is applied after
   * its element renders.
   */
  private focusRow(key: string | null | undefined, cell: number | null = null): void {
    if (!key) return;
    this.focusKey.set(key);
    this.focusCell.set(cell);
    this.pendingFocus = { key, cell };
    if (this.windowed()) this.revealRow(key);
    queueMicrotask(() => this.applyPendingFocus());
  }

  /** Scrolls a row fully into view, below the sticky header, with the least movement. */
  private revealRow(key: string): void {
    const scroller = this.scroller()?.nativeElement;
    const index = this.displayIndex().get(key);
    if (!scroller || index === undefined) return;
    const offset = revealRowOffset(
      index,
      this.virtualItemSize(),
      scroller.scrollTop,
      scroller.clientHeight,
      this.header()?.nativeElement.offsetHeight ?? 0,
    );
    if (offset === null) return;
    scroller.scrollTop = offset;
    this.syncScroll();
  }

  private rowElement(key: string): HTMLElement | null {
    return (
      this.scroller()?.nativeElement.querySelector<HTMLElement>(
        `tbody > tr[data-key="${CSS.escape(key)}"]`,
      ) ?? null
    );
  }

  private focusTarget(key: string, cell: number | null): HTMLElement | null {
    const row = this.rowElement(key);
    if (!row || cell === null) return row;
    return row.querySelector<HTMLElement>(`:scope > td[data-col="${cell}"]`) ?? row;
  }

  private applyPendingFocus(): void {
    const pending = this.pendingFocus;
    if (pending === null) return;
    if (!this.rowIndex().has(pending.key)) {
      this.pendingFocus = null;
      return;
    }
    const target = this.focusTarget(pending.key, pending.cell);
    if (!target) return; // not rendered yet: the next render calls this again
    target.focus({ preventScroll: this.windowed() });
    // A cell gets its tabindex back only in the next render (after an edit): try once more then.
    if (this.doc.activeElement === target || pending.retried) this.pendingFocus = null;
    else this.pendingFocus = { ...pending, retried: true };
  }

  /**
   * The browser drops the focus to the page body when the focused element leaves the DOM. Before
   * the focused row leaves the window, the focus moves to the scroll area; the keys still work
   * there, and the focus returns to the row when it renders again.
   */
  private parkFocus(window: RowWindow): void {
    const scroller = this.scroller()?.nativeElement;
    const active = this.doc.activeElement;
    if (!scroller || !active || active === scroller || !scroller.contains(active)) return;
    const key = active.closest<HTMLElement>('tbody > tr[data-key]')?.dataset['key'];
    const index = key === undefined ? undefined : this.displayIndex().get(key);
    if (index !== undefined && index >= window.start && index < window.end) return;
    this.parked = true;
    scroller.focus({ preventScroll: true });
  }

  private restoreParkedFocus(): void {
    const scroller = this.scroller()?.nativeElement;
    if (!scroller || this.doc.activeElement !== scroller) {
      this.parked = false;
      return;
    }
    const key = this.focusKey();
    if (key === null) return;
    this.focusTarget(key, this.focusCell())?.focus({ preventScroll: true });
  }

  /** Tab into the scroll area (no row has the Tab stop): the focus goes to the active row. */
  protected onScrollerFocus(): void {
    if (this.windowed() && !this.parked) this.focusRow(this.focusKey(), this.focusCell());
  }

  /** Keys on the scroll area itself (the focus is parked there): they act on the active row. */
  protected onScrollerKeydown(event: KeyboardEvent): void {
    if (!this.windowed() || event.target !== event.currentTarget) return;
    const row = this.rowList()[this.rowIndex().get(this.focusKey() ?? '') ?? -1];
    if (row) this.onKeydown(event, row);
  }

  protected onKeydown(event: KeyboardEvent, row: TreeTableRow): void {
    if (this.editing()) return;
    const rows = this.rowList();
    // A key that arrives before the last move has rendered (a held key, a far scroll) continues
    // from the row that the last move aimed at, not from the row that still has the DOM focus.
    const pending = this.pendingFocus;
    const item = pending === null ? row : (rows[this.rowIndex().get(pending.key) ?? -1] ?? row);
    const node = item.node;
    const index = this.rowIndex().get(node.key) ?? -1;
    const expandable = this.isExpandable(node);
    const expanded = expandable && this.isOpen(node.key);
    const cell = pending === null ? this.focusCell() : pending.cell;
    const columns = this.visibleColumns();

    if (ɵstarIsContextMenuKey(event)) {
      if (!this.contextMenu().length) return;
      event.preventDefault();
      this.openMenuFromKey(node.key);
      return;
    }
    if (event.key === ' ') {
      if (!this.selectionMode()) return;
      event.preventDefault();
      this.toggleSelection(node);
      return;
    }
    if (event.key === 'Enter' || event.key === 'F2') {
      const column = cell === null ? columns.find((c) => this.isEditable(node, c)) : columns[cell];
      if (!column || !this.isEditable(node, column)) return;
      event.preventDefault();
      this.startEdit(node, column);
      return;
    }
    // Arrow right opens a branch and Arrow left closes it; the two swap in right-to-left.
    const key = starInlineKey(event);
    const move = (target: string | null, toCell: number | null = cell) => {
      if (target === null) return;
      event.preventDefault();
      this.focusRow(target, toCell);
    };
    switch (key) {
      case 'Home':
      case 'End':
        if (cell !== null) return move(node.key, key === 'Home' ? 0 : columns.length - 1);
        return move(navigationTarget(rows, index, key, { hasChildren: expandable, expanded }));
      case 'ArrowDown':
      case 'ArrowUp':
        return move(navigationTarget(rows, index, key, { hasChildren: expandable, expanded }));
      case 'ArrowRight':
        if (cell !== null) {
          event.preventDefault();
          if (cell < columns.length - 1) move(node.key, cell + 1);
          return;
        }
        if (expandable && !expanded) {
          event.preventDefault();
          this.userToggle(node, true);
        } else if (this.cellMode()) {
          move(node.key, 0);
        } else if (expandable) {
          event.preventDefault();
        }
        return;
      case 'ArrowLeft':
        event.preventDefault();
        if (cell !== null) move(node.key, cell === 0 ? null : cell - 1);
        else if (expanded) this.userToggle(node, false);
        else move(item.parentKey, null);
        return;
    }
  }
}
