import { ChangeDetectionStrategy, Component, computed, signal, viewChild } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarInput } from '@star-ng/ui/field';
import type { StarMenuItem } from '@star-ng/ui/menu';
import {
  StarCellEditEvent,
  StarColumn,
  StarTable,
  StarTableCellRef,
  StarTableContextMenuEvent,
  StarTableMenuDefault,
  StarTablePasteEvent,
} from '@star-ng/ui/table';
import { DOCS, DocsRow } from '../shared/docs';
import { DocsFill, DocsRefTable, formatMoney, Order, orderColumns, ORDERS } from './table-demo';

/** One line of the stock list: fictional parts in fictional warehouses. */
interface StockLine {
  readonly sku: string;
  readonly item: string;
  readonly warehouse: string;
  readonly bin: string;
  readonly onHand: number;
  readonly reorderAt: number;
}

const ITEMS = ['Cable kit', 'Desk lamp', 'Notebook', 'Backpack', 'Monitor stand', 'Keyboard'];
const WAREHOUSES = ['Lisbon', 'Oslo', 'Prague', 'Lima'];

/** 40 stock lines: SKU-101 to SKU-140. */
const STOCK: readonly StockLine[] = Array.from({ length: 40 }, (_, i) => ({
  sku: `SKU-${101 + i}`,
  item: ITEMS[(i * 5) % ITEMS.length],
  warehouse: WAREHOUSES[i % WAREHOUSES.length],
  bin: `${String.fromCharCode(65 + (i % 6))}-${1 + ((i * 7) % 12)}`,
  onHand: (i * 13) % 60,
  reorderAt: 10 + ((i * 3) % 4) * 5,
}));

function stockColumns(editable: boolean): StarColumn<StockLine>[] {
  return [
    { field: 'sku', header: 'SKU', sortable: true },
    { field: 'item', header: 'Item', sortable: true },
    { field: 'warehouse', header: 'Warehouse', sortable: true },
    { field: 'bin', header: 'Bin', editable, pattern: '[A-F]-\\d{1,2}' },
    {
      field: 'onHand',
      header: 'On hand',
      align: 'end',
      sortable: true,
      editable,
      editor: 'number',
      min: 0,
      max: 999,
    },
    {
      field: 'reorderAt',
      header: 'Reorder at',
      align: 'end',
      editable,
      editor: 'number',
      min: 0,
    },
  ];
}

/** The owner stores an edit (the table never changes its rows). */
function applyEdit(rows: readonly StockLine[], event: StarCellEditEvent<StockLine>): StockLine[] {
  return rows.map((row) =>
    row.sku === event.row.sku ? { ...row, [event.field]: event.value } : row,
  );
}

@Component({
  selector: 'docs-table-interaction-page',
  imports: [DOCS, StarTable, StarButton, StarInput, DocsFill, DocsRefTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Table interaction"
      lead="Move between cells with the keyboard, select cells and ranges, open a context menu, copy and paste with a spreadsheet, highlight search matches, and drive the focus and the scroll from code."
      importFrom="import { StarTable, StarTableCellRef, StarTableContextMenuEvent, StarTablePasteEvent } from '@star-ng/ui/table';"
    >
      <docs-example
        heading="Cell navigation"
        source="table-interaction/navigation"
        [script]="navigationScript"
        note="With cellNavigation (automatic when a column is editable) the table is a WAI-ARIA grid with one tab stop. The arrow keys move between cells, Home and End go to the row ends, Ctrl+Home and Ctrl+End to the corners, PageUp and PageDown by the rows in view. Enter or F2 edits an editable cell and Escape returns to the cell. Left and Right swap in right-to-left. activeCell and activeCellChange report the focused cell."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="stock()"
              [columns]="editColumns"
              dataKey="sku"
              ariaLabel="Stock with cell navigation"
              [pinnedColumns]="{ sku: 'start' }"
              paginator
              [rows]="8"
              (activeCellChange)="active.set($event)"
              (cellEdit)="stock.set(apply(stock(), $event))"
            />
          </docs-fill>
          <p class="docs-output" role="status">Active cell: {{ activeText() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Cell and range selection"
        source="table-interaction/range"
        [script]="rangeScript"
        note='selectionMode="cell" selects one cell; selectionMode="range" selects a rectangle: click or Space starts it, Shift + click and Shift + Arrow stretch it, Ctrl + click adds or removes one cell. [(cellSelection)] holds the cells as { rowKey, field }. The selection fill differs from the focus ring, and it works across pinned columns.'
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="stockRows"
              [columns]="viewColumns"
              dataKey="sku"
              ariaLabel="Stock with range selection"
              selectionMode="range"
              [pinnedColumns]="{ sku: 'start' }"
              [(cellSelection)]="cells"
              paginator
              [rows]="8"
            />
          </docs-fill>
          <p class="docs-output" role="status">
            Selected: {{ cells().length }} {{ cells().length === 1 ? 'cell' : 'cells' }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Context menu"
        source="table-interaction/menu"
        [script]="menuScript"
        note="contextMenu takes menu items or a function of the row and the column. contextMenuDefaults adds built-in items (copy, copyWithHeaders, pinStart, pinEnd, unpin, sortAsc, sortDesc, hideColumn, export). The menu opens on a right click, Shift+F10 or the context menu key; [(contextMenuSelection)] holds the row and contextMenuSelect emits the row, the column and the item. The focus returns to the cell."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="orders"
              [columns]="orderColumns"
              dataKey="id"
              ariaLabel="Orders with a context menu"
              cellNavigation
              [contextMenu]="orderMenu"
              [contextMenuDefaults]="menuDefaults"
              paginator
              [rows]="5"
              (contextMenuSelect)="chosen.set(describe($event))"
            />
          </docs-fill>
          <p class="docs-output" role="status">Last choice: {{ chosen() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Copy and paste"
        source="table-interaction/clipboard"
        [script]="clipboardScript"
        note="Ctrl+C copies the cell range, else the selected rows, else the focused cell, as tab-separated text that a spreadsheet reads (copyHeaders adds the header line). With pasteEditable, Ctrl+V on a cell writes tab-separated text into the editable cells to the right and down: each value goes through the column rules, invalid values are left out, and cellEdit fires for each changed cell. beforePaste can cancel. Both are announced."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="pasteStock()"
              [columns]="editColumns"
              dataKey="sku"
              ariaLabel="Stock with copy and paste"
              selectionMode="range"
              copyHeaders
              pasteEditable
              paginator
              [rows]="8"
              (beforePaste)="pasted.set(pasteText($event))"
              (cellEdit)="pasteStock.set(apply(pasteStock(), $event))"
            />
          </docs-fill>
          <p class="docs-output" role="status">Last paste: {{ pasted() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Search highlight"
        source="table-interaction/search"
        [script]="searchScript"
        note="searchText marks the matches in the cells (case- and accent-insensitive) without hiding rows. searchMatches counts them over all pages, findNext and findPrevious step through them with wrap and scroll the active match into view (on another page too), clearSearch empties the text. A cell template shows the marks when it uses the highlight(text) function of its context."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <input
              starInput
              type="search"
              aria-label="Find in stock"
              placeholder="Find in stock"
              [value]="search()"
              (input)="search.set($any($event.target).value)"
              (keydown.enter)="found.findNext()"
            />
            <star-button size="sm" variant="secondary" (pressed)="found.findPrevious()">
              Previous
            </star-button>
            <star-button size="sm" variant="secondary" (pressed)="found.findNext()">
              Next
            </star-button>
            <star-button size="sm" variant="secondary" (pressed)="found.clearSearch()">
              Clear
            </star-button>
          </div>
          <docs-fill>
            <star-table
              #found
              [value]="stockRows"
              [columns]="viewColumns"
              dataKey="sku"
              ariaLabel="Stock with search"
              [(searchText)]="search"
              paginator
              [rows]="8"
            />
          </docs-fill>
          <p class="docs-output" role="status">
            Matches: {{ found.searchMatches().count }}, active:
            {{ found.searchMatches().active + 1 || 'none' }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Keyboard and scroll methods"
        source="table-interaction/api"
        [script]="apiScript"
        note="focusCell(rowKey, field) and navigateTo(rowIndex, field) move the focus to a cell; scrollToRow(rowKeyOrIndex, { align }) and scrollToColumn(field, { align }) scroll without the focus. Rows of virtualScroll and columns of virtualColumns render first; the scroll is smooth unless the user asks for reduced motion."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button
              size="sm"
              variant="secondary"
              (pressed)="wide.focusCell('SKU-130', 'onHand')"
            >
              Focus SKU-130 on hand
            </star-button>
            <star-button size="sm" variant="secondary" (pressed)="wide.navigateTo(0, 'sku')">
              Go to the first cell
            </star-button>
            <star-button
              size="sm"
              variant="secondary"
              (pressed)="wide.scrollToRow(35, { align: 'center' })"
            >
              Scroll to row 36
            </star-button>
            <star-button size="sm" variant="secondary" (pressed)="wide.scrollToColumn('reorderAt')">
              Scroll to Reorder at
            </star-button>
          </div>
          <docs-fill>
            <star-table
              #wide
              [value]="stockRows"
              [columns]="viewColumns"
              dataKey="sku"
              ariaLabel="Stock with the scroll API"
              cellNavigation
              virtualScroll
              [virtualRowHeight]="44"
              scrollHeight="18rem"
            />
          </docs-fill>
          <p class="docs-output" role="status">Active cell: {{ wideText() }}</p>
        </div>
      </docs-example>

      <docs-api [of]="['StarTable']" [keyboard]="keyboard" />
      <docs-ref-table title="Methods and signals" [rows]="methodRows" />

      <h2>Technical notes</h2>
      <p>
        Cell navigation follows the WAI-ARIA grid pattern: the table gets
        <code>role="grid"</code> and a roving <code>tabindex</code>, so Tab enters and leaves the
        table in one step. The edit button of an editable cell takes the focus of its cell. The
        selection, expander, reorder and row action cells are grid cells too: their controls have
        <code>tabindex="-1"</code>, Space on the selection cell toggles the row, Enter or F2 moves
        the focus into the controls of the cell, and Escape or F2 brings it back (F2 on the row
        action cell edits the row). Their <code>activeCell</code> field is <code>$select</code>,
        <code>$expander</code>, <code>$reorder</code> or <code>$actions</code>. Give the buttons and
        links of a custom cell template <code>tabindex="-1"</code>, so that the grid keeps one tab
        stop; Space on them still activates them. The keys skip the rows that a merged cell
        (<code>rowGroupMode="rowspan"</code>) covers, and they move between the rows of the page;
        Tab inside an editor keeps the edit behaviour.
      </p>
      <p>
        The copied text is tab-separated values with a CR LF line end: a cell with a tab, a line
        break or a double quote is quoted and its quotes doubled, as spreadsheets write it. A cell
        copies its <code>exportValue</code>, else its display text. Paste parses the same format. In
        a batch edit table the whole paste is one undo step. For a copy and paste round trip of a
        formatted column (a price, a date), give it an <code>exportValue</code> with the raw value:
        the display text of <code>format</code> does not parse in a number editor. A range copy
        takes the selected cells of the current page.
      </p>
      <p>
        <code>searchText</code> does not filter: use <code>globalFilter</code> for that. The matches
        are counted on the display text of the cells, so a custom template that shows other text can
        show other marks than the count.
      </p>
    </docs-page>
  `,
})
export class TableInteractionPage {
  protected readonly stockRows = STOCK;
  protected readonly stock = signal<readonly StockLine[]>(STOCK);
  protected readonly pasteStock = signal<readonly StockLine[]>(STOCK);
  protected readonly editColumns = stockColumns(true);
  protected readonly viewColumns = stockColumns(false);
  protected readonly apply = applyEdit;

  protected readonly active = signal<StarTableCellRef | null>(null);
  protected readonly activeText = computed(() => {
    const cell = this.active();
    return cell ? `${String(cell.rowKey)}, ${cell.field}` : 'none';
  });

  protected readonly cells = signal<readonly StarTableCellRef[]>([]);

  protected readonly orders: readonly Order[] = ORDERS;
  protected readonly orderColumns: StarColumn<Order>[] = [
    ...orderColumns().slice(0, 4),
    {
      field: 'total',
      header: 'Total',
      sortable: true,
      align: 'end',
      format: (row) => formatMoney(row.total),
    },
  ];
  protected readonly menuDefaults: readonly StarTableMenuDefault[] = [
    'copy',
    'copyWithHeaders',
    'sortAsc',
    'sortDesc',
  ];
  protected readonly orderMenu: StarMenuItem[] = [
    { label: 'Open order', icon: 'ph-bold ph-arrow-square-out' },
    { label: 'Cancel order', icon: 'ph-bold ph-x-circle', danger: true },
  ];
  protected readonly chosen = signal('none yet');

  protected readonly pasted = signal('none yet');
  protected readonly search = signal('');

  private readonly wide = viewChild<StarTable<StockLine>>('wide');
  protected readonly wideText = computed(() => {
    const cell = this.wide()?.activeCell();
    return cell ? `${String(cell.rowKey)}, ${cell.field}` : 'none';
  });

  protected describe(event: StarTableContextMenuEvent<Order>): string {
    return `${event.item.label} on ${event.row.id}${event.column ? `, ${event.column.header}` : ''}`;
  }

  protected pasteText(event: StarTablePasteEvent<StockLine>): string {
    return `${event.cells.length} ${event.cells.length === 1 ? 'cell' : 'cells'} from ${
      event.cells[0]?.row.sku ?? 'none'
    }`;
  }

  protected readonly navigationScript = `readonly stock = signal<readonly StockLine[]>(STOCK);
readonly active = signal<StarTableCellRef | null>(null);
readonly columns: StarColumn<StockLine>[] = [
  { field: 'sku', header: 'SKU' },
  { field: 'bin', header: 'Bin', editable: true, pattern: '[A-F]-\\\\d{1,2}' },
  { field: 'onHand', header: 'On hand', editable: true, editor: 'number', min: 0 },
];

apply(rows: readonly StockLine[], event: StarCellEditEvent<StockLine>): StockLine[] {
  return rows.map((row) =>
    row.sku === event.row.sku ? { ...row, [event.field]: event.value } : row,
  );
}`;

  protected readonly rangeScript = `readonly cells = signal<readonly StarTableCellRef[]>([]);
// <star-table selectionMode="range" [(cellSelection)]="cells" ... />`;

  protected readonly menuScript = `readonly menuDefaults: StarTableMenuDefault[] = ['copy', 'copyWithHeaders', 'sortAsc', 'sortDesc'];
readonly orderMenu: StarMenuItem[] = [
  { label: 'Open order', icon: 'ph-bold ph-arrow-square-out' },
  { label: 'Cancel order', icon: 'ph-bold ph-x-circle', danger: true },
];

describe(event: StarTableContextMenuEvent<Order>): string {
  return \`\${event.item.label} on \${event.row.id}\`;
}`;

  protected readonly clipboardScript = `pasteText(event: StarTablePasteEvent<StockLine>): string {
  // Call event.cancel() to stop the paste.
  return \`\${event.cells.length} cells from \${event.cells[0]?.row.sku}\`;
}`;

  protected readonly searchScript = `readonly search = signal('');
// <star-table #found [(searchText)]="search" ... />
// found.findNext(), found.findPrevious(), found.clearSearch(), found.searchMatches()`;

  protected readonly apiScript = `// <star-table #wide cellNavigation virtualScroll ... />
wide.focusCell('SKU-130', 'onHand');
wide.navigateTo(0, 'sku');
wide.scrollToRow(35, { align: 'center' });
wide.scrollToColumn('reorderAt');`;

  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Arrow keys', description: 'With cell navigation: move one cell.' },
    { name: 'Home / End', description: 'Go to the first or the last cell of the row.' },
    {
      name: 'Ctrl+Home / Ctrl+End',
      description: 'Go to the first cell of the first row or the last cell of the last row.',
    },
    { name: 'PageUp / PageDown', description: 'Move up or down by the rows in view.' },
    { name: 'Enter / F2', description: 'On an editable cell: start the edit.' },
    { name: 'Escape', description: 'In a cell editor: cancel and go back to the cell.' },
    {
      name: 'Space',
      description:
        'With a cell selection mode: select the focused cell. On a selection cell: toggle the row.',
    },
    {
      name: 'Enter / F2, Escape',
      description:
        'On a selection, expander, reorder or row action cell: go into its controls, and back.',
    },
    {
      name: 'Shift+Arrow keys',
      description: 'With selectionMode="range": stretch the range from the anchor cell.',
    },
    { name: 'Ctrl+C', description: 'Copy the range, the selected rows or the focused cell.' },
    { name: 'Ctrl+V', description: 'With pasteEditable: paste into the editable cells.' },
    {
      name: 'Shift+F10 / Context menu key',
      description: 'Open the context menu at the focused cell.',
    },
  ];

  protected readonly methodRows: readonly (DocsRow & { readonly type: string })[] = [
    {
      name: 'focusCell(rowKey, field)',
      type: 'boolean',
      description: 'Focuses a cell; opens its page and renders a virtual row or column first.',
    },
    {
      name: 'navigateTo(rowIndex, field?)',
      type: 'boolean',
      description: 'Focuses the cell of the row at an index over all pages (Ignite UI name).',
    },
    {
      name: 'scrollToRow(rowKeyOrIndex, { align })',
      type: 'boolean',
      description: 'Scrolls a row into view: nearest, start, center or end.',
    },
    {
      name: 'scrollToColumn(field, { align })',
      type: 'boolean',
      description: 'Scrolls a column into view beside the pinned columns.',
    },
    {
      name: 'copyToClipboard({ headers })',
      type: 'Promise<number>',
      description: 'Copies the range, the selected rows or the active cell; gives the cell count.',
    },
    {
      name: 'findNext() / findPrevious()',
      type: 'number',
      description: 'Makes the next or previous search match active and scrolls to it.',
    },
    { name: 'clearSearch()', type: 'void', description: 'Empties searchText.' },
    {
      name: 'activeCell',
      type: 'Signal<StarTableCellRef | null>',
      description: 'The focused cell, or the cell that had the focus last.',
    },
    {
      name: 'searchMatches',
      type: 'Signal<StarTableSearchMatches>',
      description: 'The count of the search matches and the index of the active one (-1: none).',
    },
  ];
}
