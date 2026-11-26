import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { STAR_SLOTS } from '@star-ng/ui/core';
import { StarInput } from '@star-ng/ui/field';
import {
  StarCellTemplate,
  StarColumn,
  StarHeaderCellTemplate,
  StarRowExpansionTemplate,
  StarTable,
  StarTableRowTone,
} from '@star-ng/ui/table';
import { StarTag } from '@star-ng/ui/tag';
import { DOCS, DocsRow } from '../shared/docs';
import {
  DocsFill,
  DocsRefTable,
  formatDay,
  formatMoney,
  Order,
  orderColumns,
  ORDERS,
  STATUS_SEVERITY,
} from './table-demo';

/** A sign-in log entry (example data). */
interface Login {
  id: number;
  time: string;
  ip: string;
  device: string;
  status: 'Success' | 'Failed';
}

const LOGINS: readonly Login[] = [
  { id: 1, time: '2026-11-03 08:02', ip: '192.0.2.10', device: 'Laptop', status: 'Success' },
  { id: 2, time: '2026-11-03 09:41', ip: '192.0.2.43', device: 'Phone', status: 'Failed' },
  { id: 3, time: '2026-11-03 09:42', ip: '192.0.2.43', device: 'Phone', status: 'Failed' },
  { id: 4, time: '2026-11-03 09:45', ip: '192.0.2.43', device: 'Phone', status: 'Success' },
  { id: 5, time: '2026-11-04 07:58', ip: '198.51.100.7', device: 'Desktop', status: 'Success' },
  { id: 6, time: '2026-11-04 12:15', ip: '203.0.113.9', device: 'Tablet', status: 'Failed' },
];

/** A day off (example data). */
interface Leave {
  id: number;
  day: string;
  kind: string;
  state: 'Approved' | 'Pending' | 'Withdrawn';
}

const LEAVES: readonly Leave[] = [
  { id: 1, day: '2026-11-03', kind: 'Annual leave', state: 'Approved' },
  { id: 2, day: '2026-11-10', kind: 'Annual leave', state: 'Withdrawn' },
  { id: 3, day: '2026-11-17', kind: 'Training', state: 'Pending' },
  { id: 4, day: '2026-11-24', kind: 'Annual leave', state: 'Withdrawn' },
];

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './table.page.scss',
  selector: 'docs-table-page',
  imports: [
    DOCS,
    StarTable,
    StarCellTemplate,
    StarRowExpansionTemplate,
    StarHeaderCellTemplate,
    STAR_SLOTS,
    StarInput,
    StarTag,
    StarButton,
    DocsFill,
    DocsRefTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Table"
      lead="A data table with typed columns. It has custom cell templates, sorting, filters, paging, selection, row expansion, inline edit, column tools, virtual scroll, row groups, export and a stacked layout for phones. The PrimeNG equivalent is p-table. This page covers the basics and the full API; the pages of the Table group cover each feature."
      importFrom="import { StarTable, StarCellTemplate, StarRowExpansionTemplate } from '@star-ng/ui/table';"
    >
      <docs-example
        heading="Columns and rows"
        source="table/basic"
        [script]="basicScript"
        note="value is the list of rows and columns describes them. Each column reads row[field]. dataKey names the property that identifies a row. ariaLabel names the table for a screen reader."
      >
        <docs-fill>
          <star-table
            [value]="orders"
            [columns]="columns"
            dataKey="id"
            ariaLabel="Orders"
            paginator
            [rows]="5"
          />
        </docs-fill>
      </docs-example>

      <docs-example
        heading="Cell templates"
        source="table/templates"
        [script]="templateScript"
        note="A content child ng-template with starCell and the column field draws the cell. The context has the row ($implicit), the value and the index. Pass starCellOf to type the row."
      >
        <docs-fill>
          <star-table
            [value]="orders"
            [columns]="columns"
            dataKey="id"
            ariaLabel="Orders with status tags"
            paginator
            [rows]="5"
          >
            <ng-template starCell="status" [starCellOf]="orders" let-row>
              <star-tag [severity]="severityOf(row.status)" [value]="row.status" rounded />
            </ng-template>
            <ng-template starCell="customer" [starCellOf]="orders" let-row let-value="value">
              <strong>{{ value }}</strong>
              <br />
              <small>{{ row.email }}</small>
            </ng-template>
          </star-table>
        </docs-fill>
      </docs-example>

      <docs-example
        heading="Value, format and alignment"
        source="table/format"
        [script]="formatScript"
        note="value reads the cell from the row (default row[field]); sort and filter use it. format makes the display text. align is start, center or end."
      >
        <docs-fill>
          <star-table
            [value]="orders"
            [columns]="formatColumns"
            dataKey="id"
            ariaLabel="Orders with formatted values"
            paginator
            [rows]="5"
          />
        </docs-fill>
      </docs-example>

      <docs-example
        heading="Size, stripes and sticky header"
        source="table/looks"
        note="size sm makes the rows smaller. striped shades every second row. stickyHeader keeps the header in view while the body scrolls inside scrollHeight."
      >
        <docs-fill>
          <star-table
            [value]="orders"
            [columns]="columns"
            dataKey="id"
            ariaLabel="Compact orders"
            size="sm"
            striped
            stickyHeader
            scrollHeight="14rem"
          />
        </docs-fill>
      </docs-example>

      <docs-example
        heading="Row tones and row classes"
        source="table/row-tones"
        [script]="toneScript"
        note="rowTone tints a whole row from the row data: danger, warn, success, info or muted (soft text on a subtle surface). Frozen and pinned cells get the tint too; the header does not. A selected row shows the selection fill. rowClass adds your own classes to a row (a string, a list or a record, as in [class]); they add to the classes of the table and never replace them. The tint is decorative: keep the state as text in a cell, as the Status column does here."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="logins"
              [columns]="loginColumns"
              dataKey="id"
              ariaLabel="Sign-in log"
              striped
              stickyHeader
              selectionMode="multiple"
              [rowTone]="loginTone"
              [rowClass]="loginClass"
            />
          </docs-fill>
          <docs-fill>
            <star-table
              [value]="leaves"
              [columns]="leaveColumns"
              dataKey="id"
              ariaLabel="Days off"
              size="sm"
              [rowTone]="leaveTone"
            />
          </docs-fill>
        </div>
      </docs-example>

      <docs-example
        heading="Loading and empty state"
        source="table/states"
        [script]="statesScript"
        note="loading replaces the rows with skeleton rows and sets aria-busy on the table. An empty value shows the empty state; emptyMessage changes its text."
      >
        <div class="docs-stack">
          <star-button size="sm" variant="secondary" (pressed)="loading.set(!loading())">
            {{ loading() ? 'Stop loading' : 'Start loading' }}
          </star-button>
          <star-table
            [value]="orders.slice(0, 3)"
            [columns]="columns"
            dataKey="id"
            ariaLabel="Orders being loaded"
            [loading]="loading()"
          />
          <star-table
            [value]="[]"
            [columns]="columns"
            ariaLabel="No orders"
            emptyMessage="No orders yet. Add the first one."
          />
        </div>
      </docs-example>

      <docs-example
        heading="Caption"
        source="table/caption"
        note="Content with the attribute starTableCaption is placed above the table. Use it for a title or a short description."
      >
        <docs-fill>
          <star-table
            [value]="orders.slice(0, 3)"
            [columns]="columns"
            dataKey="id"
            ariaLabel="Latest orders"
          >
            <h3 starTableCaption>Latest orders</h3>
          </star-table>
        </docs-fill>
      </docs-example>

      <docs-example
        heading="Row detail"
        source="table/expansion-basic"
        note="With an ng-template that has starRowExpansion, every row gets an expand button. The page Table layout shows the full set of options."
      >
        <docs-fill>
          <star-table
            [value]="orders.slice(0, 4)"
            [columns]="columns"
            dataKey="id"
            ariaLabel="Orders with detail"
          >
            <ng-template starRowExpansion [starRowExpansionOf]="orders" let-row>
              {{ row.quantity }} x {{ row.product }} for {{ row.customer }} ({{ row.email }}).
            </ng-template>
          </star-table>
        </docs-fill>
      </docs-example>

      <docs-example
        heading="Slots"
        source="table/slots"
        [script]="slotsScript"
        note="Content child templates change parts of the table. starHeaderCell with a column field replaces the header label; the sort button, the sort icon, the resize handle and aria-sort stay. starGroup replaces the label and the count of a group heading, and the toggle stays. starEmpty gets the global filter text. starLoading replaces the skeleton rows while loading is true. Content with starTableSummary goes below the table and above the paginator."
      >
        <div class="docs-stack">
          <input
            starInput
            type="search"
            aria-label="Search orders"
            placeholder="Search orders"
            [value]="slotQuery()"
            (input)="slotQuery.set($any($event.target).value)"
          />
          <star-button size="sm" variant="secondary" (pressed)="slotLoading.set(!slotLoading())">
            {{ slotLoading() ? 'Stop loading' : 'Start loading' }}
          </star-button>
          <docs-fill>
            <star-table
              [value]="slotOrders"
              [columns]="columns"
              dataKey="id"
              ariaLabel="Orders by status"
              groupBy="status"
              [globalFilter]="slotQuery()"
              [loading]="slotLoading()"
            >
              <ng-template starHeaderCell="total" let-column>
                {{ column.header }} (USD)
              </ng-template>
              <ng-template starGroup let-status let-count="count">
                {{ status }}: {{ count }} orders
              </ng-template>
              <ng-template starEmpty let-text>No order matches "{{ text }}".</ng-template>
              <ng-template starLoading>Loading the orders.</ng-template>
              <p starTableSummary class="docs-output">{{ slotOrders.length }} orders in total</p>
            </star-table>
          </docs-fill>
        </div>
      </docs-example>

      <docs-api
        [of]="[
          'StarTable',
          'StarCellTemplate',
          'StarRowExpansionTemplate',
          'StarHeaderCellTemplate',
        ]"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />

      <docs-ref-table title="Column definition (StarColumn)" [rows]="columnRows" />
      <docs-ref-table title="Methods of StarTable" [rows]="methodRows" />
      <docs-ref-table title="Types" [rows]="typeRows" />

      <h2>Technical notes</h2>
      <p>
        The table never changes <code>value</code>. Sorting, filtering and paging work on a copy. An
        edit, a row move or a lazy load goes to the owner as an event, and the owner stores the
        change. The table is the PrimeNG <code>p-table</code> equivalent; the other pages of this
        group show what is the same and what is simpler.
      </p>
      <p>
        Every column header is a <code>th</code> with <code>scope="col"</code>. A sortable header
        holds a button, and <code>aria-sort</code> is set on one header only: the first sort column.
        A selected row has <code>aria-selected="true"</code>.
      </p>
    </docs-page>
  `,
})
export class TablePage {
  protected readonly orders: readonly Order[] = ORDERS;
  protected readonly columns: StarColumn<Order>[] = orderColumns();
  protected readonly severityOf = (status: Order['status']) => STATUS_SEVERITY[status];
  protected readonly loading = signal(false);
  protected readonly formatColumns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order' },
    {
      field: 'placed',
      header: 'Placed',
      value: (row) => row.placed,
      format: (row) => formatDay(row.placed),
    },
    { field: 'region', header: 'Region', value: (row) => row.region.toUpperCase() },
    { field: 'quantity', header: 'Quantity', align: 'center' },
    {
      field: 'total',
      header: 'Total',
      align: 'end',
      format: (row) => formatMoney(row.total),
    },
  ];

  protected readonly basicScript = `interface Order {
  id: string;
  customer: string;
  product: string;
  status: string;
  total: number;
}

readonly orders: readonly Order[] = [ /* ... */ ];
readonly columns: StarColumn<Order>[] = [
  { field: 'id', header: 'Order', sortable: true },
  { field: 'customer', header: 'Customer', sortable: true },
  { field: 'product', header: 'Product', sortable: true },
  { field: 'status', header: 'Status', sortable: true },
  { field: 'total', header: 'Total', sortable: true, align: 'end' },
];`;
  protected readonly templateScript = `// Import StarCellTemplate and StarTag in the component imports.
readonly severityOf = (status: Order['status']) => STATUS_SEVERITY[status];`;
  protected readonly formatScript = `readonly formatColumns: StarColumn<Order>[] = [
  { field: 'id', header: 'Order' },
  {
    field: 'placed',
    header: 'Placed',
    value: (row) => row.placed,
    format: (row) => formatDay(row.placed),
  },
  { field: 'region', header: 'Region', value: (row) => row.region.toUpperCase() },
  { field: 'quantity', header: 'Quantity', align: 'center' },
  { field: 'total', header: 'Total', align: 'end', format: (row) => formatMoney(row.total) },
];`;
  protected readonly logins: readonly Login[] = LOGINS;
  protected readonly loginColumns: StarColumn<Login>[] = [
    { field: 'time', header: 'Time', frozen: true },
    { field: 'ip', header: 'IP address' },
    { field: 'device', header: 'Device' },
    { field: 'status', header: 'Status' },
  ];
  protected readonly loginTone = (row: Login): StarTableRowTone | null =>
    row.status === 'Failed' ? 'danger' : null;
  protected readonly loginClass = (row: Login) => ({
    'login-row--failed': row.status === 'Failed',
  });
  protected readonly leaves: readonly Leave[] = LEAVES;
  protected readonly leaveColumns: StarColumn<Leave>[] = [
    { field: 'day', header: 'Day' },
    { field: 'kind', header: 'Kind' },
    { field: 'state', header: 'State' },
  ];
  protected readonly leaveTone = (row: Leave): StarTableRowTone | null =>
    row.state === 'Withdrawn' ? 'muted' : null;
  protected readonly toneScript = `// Import StarTableRowTone from '@star-ng/ui/table'.
interface Login {
  id: number;
  time: string;
  ip: string;
  device: string;
  status: 'Success' | 'Failed';
}

interface Leave {
  id: number;
  day: string;
  kind: string;
  state: 'Approved' | 'Pending' | 'Withdrawn';
}

// A failed sign-in gets the danger tone; the Status cell keeps the text.
readonly loginTone = (row: Login): StarTableRowTone | null =>
  row.status === 'Failed' ? 'danger' : null;
// Your own classes: a string, a list or a record. The table keeps its own classes.
readonly loginClass = (row: Login) => ({ 'login-row--failed': row.status === 'Failed' });

// A withdrawn day off gets the muted tone: soft text on a subtle surface.
readonly leaveTone = (row: Leave): StarTableRowTone | null =>
  row.state === 'Withdrawn' ? 'muted' : null;

// Change the tint with tokens, no ::ng-deep:
// star-table { --star-table-row-danger-surface: #fde8e8; }`;
  protected readonly statesScript = `readonly loading = signal(false);`;
  protected readonly slotOrders: readonly Order[] = ORDERS.slice(0, 8);
  protected readonly slotQuery = signal('');
  protected readonly slotLoading = signal(false);
  protected readonly slotsScript = `// Import STAR_SLOTS from '@star-ng/ui/core', StarHeaderCellTemplate and StarInput in the component imports.
readonly slotOrders: readonly Order[] = ORDERS.slice(0, 8);
readonly columns: StarColumn<Order>[] = [
  { field: 'id', header: 'Order', sortable: true },
  { field: 'customer', header: 'Customer', sortable: true },
  { field: 'product', header: 'Product', sortable: true },
  { field: 'status', header: 'Status', sortable: true },
  { field: 'total', header: 'Total', sortable: true, align: 'end', format: (row) => formatMoney(row.total) },
];
readonly slotQuery = signal('');
readonly slotLoading = signal(false);`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: '[starTableCaption]',
      description: 'Content slot above the table (and above the Columns button): a title.',
    },
    {
      name: '[starTableSummary]',
      description:
        'Content slot directly below the table and above the paginator: a total or a short note.',
    },
    {
      name: 'ng-template[starHeaderCell="<field>"]',
      description:
        'Content child. Replaces the header label of the column with that field. The sort button, the sort icon and rank, the resize handle and aria-sort stay. On a sortable column the content is inside the sort button: do not add focusable elements. The context has $implicit (the column).',
    },
    {
      name: 'ng-template[starGroup]',
      description:
        'Content child. Replaces the label and the row count of a group heading (groupBy). The toggle button and aria-expanded stay. The context has $implicit (the group label) and count (the rows of that group on the current page). Do not put focusable elements in it: the content goes inside the toggle button.',
    },
    {
      name: 'ng-template[starEmpty]',
      description:
        "Content child. Replaces the empty message. $implicit is the globalFilter text, '' when there is none.",
    },
    {
      name: 'ng-template[starLoading]',
      description:
        'Content child. Replaces the skeleton rows while loading is true: one row with one cell over all columns.',
    },
    {
      name: 'ng-template[starCell="<field>"]',
      description:
        'Content child. Draws the cells of the column with that field. The context has $implicit (the row), value (the cell value) and index. The input starCellOf types the row.',
    },
    {
      name: 'ng-template[starRowExpansion]',
      description:
        'Content child. Detail of an expanded row. When the table has it, each row has an expand button. The context has $implicit (the row) and index.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of the table area and of frozen cells.' },
    {
      name: '--star-surface-muted',
      description: 'Header, filter row, footer, hover row and expansion background.',
    },
    { name: '--star-border', description: 'Table border and the lines between rows.' },
    { name: '--star-border-strong', description: 'Line above the footer and the resize handle.' },
    { name: '--star-primary-soft', description: 'Background of a selected row.' },
    {
      name: '--star-table-row-<tone>-surface',
      description:
        'Fill of a row with that rowTone (danger, warn, success, info, muted), also on its frozen and pinned cells. Default: the soft color of the role (--star-danger-soft, --star-warning-soft, --star-success-soft, --star-accent-soft) or --star-surface-muted.',
    },
    {
      name: '--star-table-row-<tone>-surface-hover',
      description:
        'Fill of a toned row under the pointer. Default: the surface mixed with the role color.',
    },
    {
      name: '--star-table-row-<tone>-text',
      description:
        'Text color of a toned row. Default: --star-text; muted: --star-text-muted mixed with --star-text (4.5:1 also on the hover fill).',
    },
    {
      name: '--star-primary',
      description: 'Drop mark of a column move and the resize handle hover.',
    },
    { name: '--star-accent', description: 'Focus ring of the buttons in the table.' },
    { name: '--star-radius-lg', description: 'Corner radius of the table area.' },
    {
      name: '--star-table-row-height',
      description:
        'Set by the table from virtualRowHeight when virtualScroll is on (pixels). Cells use it as their height only with one fixed row height.',
    },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab',
      description:
        'Moves through the buttons, links and fields in the header, the rows and the pager.',
    },
    {
      name: 'Enter / Space',
      description:
        'On a sortable header: sorts by the column. On an expand button, a group heading or an edit button: acts on it.',
    },
    {
      name: 'Shift + Enter / Shift + click',
      description: 'On a sortable header with multiSort: adds the column to the sort.',
    },
    {
      name: 'Arrow left / Arrow right',
      description: 'On a column resize handle (resizableColumns): changes the width by 16 px.',
    },
    { name: 'Enter / Escape', description: 'In a cell editor: saves or cancels the edit.' },
  ];

  protected readonly columnRows = [
    {
      name: 'field',
      type: 'string',
      description: 'Unique column id. It is also the property that is read when value is not set.',
    },
    { name: 'header', type: 'string', description: 'Header text.' },
    {
      name: 'value',
      type: '(row) => unknown',
      description: 'Cell value (default row[field]). Used for display, sort and filter.',
    },
    {
      name: 'format',
      type: '(row) => string',
      description:
        'Display text (default String(value)). Filters and the global filter match this text.',
    },
    { name: 'sortable', type: 'boolean', description: 'Makes the header a sort button.' },
    { name: 'width', type: 'string', description: 'CSS width of the column.' },
    {
      name: 'align',
      type: "'start' | 'center' | 'end'",
      description: 'Text alignment of the header and the cells.',
    },
    {
      name: 'filter',
      type: "'text' | 'select' | 'multiselect' | 'number' | 'date'",
      description: 'Adds a filter field of that kind in a second header row.',
    },
    {
      name: 'filterOptions',
      type: 'readonly string[]',
      description:
        'Choices of a select or multiselect filter (default: the distinct display texts, sorted).',
    },
    {
      name: 'exportable',
      type: 'boolean',
      description: 'false leaves the column out of every export (CSV, Excel, print).',
    },
    {
      name: 'exportValue',
      type: '(row) => string | number | null | undefined',
      description:
        'Cell value in an export. Use it for a column with a cell template. A number stays a number in Excel.',
    },
    {
      name: 'frozen',
      type: 'boolean',
      description: "Same as pinned: 'start'.",
    },
    {
      name: 'pinned',
      type: "'start' | 'end' | null",
      description:
        'Keeps the column in view when the table scrolls sideways, at the start or the end edge. pinnedColumns overrides it at run time.',
    },
    {
      name: 'hideable',
      type: 'boolean',
      description: 'false: the user cannot hide the column in the Columns panel.',
    },
    {
      name: 'editable',
      type: 'boolean | (row) => boolean',
      description:
        'The user can change the cell in place. The table emits cellEdit and does not change value.',
    },
    {
      name: 'editor',
      type: "'text' | 'number' | 'select'",
      description: "Editor of an editable cell (default 'text'). 'number' emits a number or null.",
    },
    { name: 'editOptions', type: 'readonly string[]', description: 'Choices of a select editor.' },
    {
      name: 'footer',
      type: 'string | (rows) => string',
      description:
        'Footer cell: fixed text, or a function of the filtered rows (all pages). The table has a footer row when one column has a footer.',
    },
    {
      name: 'summary',
      type: "'sum' | 'avg' | 'min' | 'max' | 'count' | (rows) => unknown",
      description:
        'Summary in the footer row (all filtered rows) and, with groupSummary, below each group. footer wins in the footer row.',
    },
    {
      name: 'summaryFormat',
      type: 'Intl.NumberFormatOptions',
      description: 'Number format of the summary, with the table locale.',
    },
    {
      name: 'mergeCells',
      type: 'boolean',
      description: 'With rowGroupMode rowspan: equal cells below each other merge (rowspan).',
    },
  ];

  protected readonly methodRows = [
    {
      name: 'sortBy(column, event?)',
      type: 'void',
      description: 'Sorts by a column. With multiSort, event.shiftKey adds the column to the sort.',
    },
    { name: 'clearFilters()', type: 'void', description: 'Removes every column filter.' },
    {
      name: 'moveColumn(field, targetField)',
      type: 'void',
      description: 'Moves a column to the place of another column.',
    },
    {
      name: 'pinColumn(field, side)',
      type: 'void',
      description: "Pins a column to 'start' or 'end', or unpins it (null). Emits columnPin.",
    },
    {
      name: 'toggleExpansion(row)',
      type: 'void',
      description: 'Opens or closes the detail of one row.',
    },
    {
      name: 'expandAll()',
      type: 'void',
      description: 'Opens the detail of every row on the current page.',
    },
    { name: 'collapseAll()', type: 'void', description: 'Closes every row detail.' },
    {
      name: 'clearState()',
      type: 'void',
      description:
        'Removes the saved state of this table (stateKey). The current view does not change.',
    },
    { name: 'toCsv(options?)', type: 'string', description: 'CSV text of the table.' },
    {
      name: 'exportCsv(options?)',
      type: 'void',
      description: 'Downloads the CSV as <fileName>.csv.',
    },
    {
      name: 'toXlsx(options?)',
      type: 'Uint8Array',
      description: 'Bytes of an Excel workbook (.xlsx) with the same columns and rows.',
    },
    {
      name: 'exportExcel(options?)',
      type: 'void',
      description: 'Downloads the workbook as <fileName>.xlsx.',
    },
    {
      name: 'print(options?)',
      type: 'void',
      description:
        'Opens the browser print dialog with a plain table of the same columns and rows.',
    },
  ];

  protected readonly typeRows = [
    {
      name: 'StarCellContext<T>',
      type: '{ $implicit: T; value: unknown; index: number }',
      description: 'Context of a starCell template.',
    },
    {
      name: 'StarHeaderCellContext<T>',
      type: '{ $implicit: StarColumn<T> }',
      description: 'Context of a starHeaderCell template.',
    },
    {
      name: 'StarRowContext<T>',
      type: '{ $implicit: T; index: number }',
      description: 'Context of a starRowExpansion template.',
    },
    {
      name: 'StarTableRowTone',
      type: "'success' | 'info' | 'warn' | 'danger' | 'muted'",
      description: 'Built-in tint of a row (rowTone).',
    },
    {
      name: 'StarTableRowClass',
      type: 'string | readonly string[] | Record<string, boolean> | null | undefined',
      description:
        'Classes for a row (rowClass). The function gets the row and its position in the shown rows (-1 for a pinned row).',
    },
    {
      name: 'StarSortState',
      type: '{ field: string | null; order: 1 | -1 }',
      description: 'One sort column. Order 1 is ascending.',
    },
    {
      name: 'StarLazyLoadEvent',
      type: 'StarSortState & { first; rows; filter; filters; sorts }',
      description: 'Emitted by lazyLoad. sorts holds every sort column in priority order.',
    },
    {
      name: 'StarCellEditEvent<T>',
      type: '{ row: T; field: string; value: string | number | null; previous: unknown }',
      description: 'Emitted by cellEdit.',
    },
    {
      name: 'StarRowReorderEvent<T>',
      type: '{ row: T; from: number; to: number }',
      description:
        'Emitted by rowReorder. from is the index in value now; to is the index the row must get.',
    },
    {
      name: 'StarRangeFilter',
      type: '{ min?: number | string | null; max?: number | string | null }',
      description: 'Value of a number filter (numbers) or a date filter (yyyy-mm-dd text).',
    },
    {
      name: 'StarFilterValue',
      type: 'string | readonly string[] | StarRangeFilter',
      description: 'Text (text, select), list (multiselect) or range (number, date).',
    },
    {
      name: 'StarColumnFilters',
      type: 'Record<string, StarFilterValue>',
      description:
        'Column filter values by column field. An empty or missing value means no filter.',
    },
    {
      name: 'StarExportOptions<T>',
      type: '{ fileName?; selectionOnly?; rows?; title? }',
      description: 'Options of toXlsx, exportExcel and print. See Table export.',
    },
    {
      name: 'StarCsvOptions<T>',
      type: 'StarExportOptions<T> & { separator? }',
      description: 'Options of toCsv and exportCsv.',
    },
  ];
}
