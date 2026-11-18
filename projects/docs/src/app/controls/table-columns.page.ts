import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarColumn, StarColumnPins, StarTable } from '@star-ng/ui/table';
import { DOCS, DocsRow } from '../shared/docs';
import { DocsFill, formatDay, formatMoney, Order, ORDERS } from './table-demo';

@Component({
  selector: 'docs-table-columns-page',
  imports: [DOCS, StarTable, StarButton, DocsFill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Table columns"
      lead="Let the user hide, move and resize columns, keep columns in view while the table scrolls sideways, and keep the view for the next visit."
      importFrom="import { StarTable, StarColumn } from '@star-ng/ui/table';"
    >
      <docs-example
        heading="Hide and move columns"
        source="table-columns/panel"
        [script]="panelScript"
        note="columnToggle adds a Columns button with a panel of checkboxes. reorderableColumns lets the user drag a header, or use the arrow buttons in the panel. hideable: false locks a column, and the last visible column cannot be hidden. columnOrder and hiddenColumns are two-way models."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="orders"
              [columns]="columns"
              dataKey="id"
              ariaLabel="Orders with column panel"
              columnToggle
              reorderableColumns
              [(columnOrder)]="order"
              [(hiddenColumns)]="hidden"
              paginator
              [rows]="4"
            />
          </docs-fill>
          <p class="docs-output" role="status">
            Order: {{ order().join(', ') || 'default' }}. Hidden:
            {{ hidden().join(', ') || 'none' }}.
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Resize columns"
        source="table-columns/resize"
        [script]="resizeScript"
        note="resizableColumns adds a handle on the edge of each header. Drag it with the mouse, or focus it and press Arrow left or Arrow right (16 px a step). The smallest width is 48 px. columnWidths is a two-way model with the widths in pixels by field."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="orders"
              [columns]="columns"
              dataKey="id"
              ariaLabel="Orders with resizable columns"
              resizableColumns
              [(columnWidths)]="widths"
              paginator
              [rows]="4"
            />
          </docs-fill>
          <p class="docs-output" role="status">Widths: {{ widthText() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Frozen columns"
        source="table-columns/frozen"
        [script]="frozenScript"
        note="frozen: true keeps a column at the start edge while the table scrolls sideways. Frozen columns come first. The table measures them to place the next one, so width is optional."
      >
        <docs-fill>
          <star-table
            [value]="orders.slice(0, 6)"
            [columns]="wideColumns"
            dataKey="id"
            ariaLabel="Wide orders"
          />
        </docs-fill>
      </docs-example>

      <docs-example
        heading="Pin to start and end"
        source="table-columns/pinned"
        [script]="pinnedScript"
        note="pinned: 'end' keeps a column at the end edge (frozen: true is the same as pinned: 'start'). pinnableColumns adds Pin to start, Pin to end and Unpin buttons to the Columns panel. pinnedColumns is a two-way model of the pins by field, and pinColumn(field, side) does the same from code. With start pins the selection column sticks too. A shadow marks the inner edge of each pinned area. Pinned columns move within their side only."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="orders.slice(0, 6)"
              [columns]="pinnedColumns"
              dataKey="id"
              ariaLabel="Orders with pinned columns"
              selectionMode="multiple"
              pinnableColumns
              reorderableColumns
              [(pinnedColumns)]="pins"
              (columnPin)="lastPin.set($event.field + ' ' + ($event.side ?? 'unpinned'))"
            />
          </docs-fill>
          <p class="docs-output" role="status">
            Pins: {{ pinText() }}. Last change: {{ lastPin() || 'none' }}.
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Saved view"
        source="table-columns/state"
        [script]="stateScript"
        note="stateKey saves the sort, the filters, the column order, hidden columns, widths, the page size and the closed groups in the browser, and restores them on the next visit. stateStorage chooses local (default) or session storage. clearState() removes the saved copy."
      >
        <div class="docs-stack">
          <star-button size="sm" variant="secondary" (pressed)="saved.clearState()">
            Clear saved view
          </star-button>
          <docs-fill>
            <star-table
              #saved
              [value]="orders"
              [columns]="columns"
              dataKey="id"
              ariaLabel="Orders with saved view"
              columnToggle
              resizableColumns
              stateKey="docs-table-saved-view"
              stateStorage="session"
              paginator
              [rows]="4"
            />
          </docs-fill>
        </div>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        In a right-to-left page the first column is on the right, the resize handle is on the left
        edge of a header, start pins (and frozen columns) stick to the right edge, end pins stick to
        the left edge, and the separator shadows mirror. Arrow left makes a column wider. A drag to
        the left makes it wider. See the Right-to-left guide.
      </p>

      <docs-api [of]="['StarTable']" [keyboard]="keyboard" />

      <h2>Technical notes</h2>
      <p>
        The column panel is a popover (see the Popover page). The resize handle is a
        <code>separator</code> with a label such as "Resize Customer", and its
        <code>aria-valuenow</code> is the width in pixels once the user has set one. Dragging a
        header starts a column move only when the pointer did not start on a resize handle.
      </p>
    </docs-page>
  `,
})
export class TableColumnsPage {
  protected readonly orders: readonly Order[] = ORDERS;
  protected readonly columns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order', sortable: true, hideable: false },
    { field: 'customer', header: 'Customer', sortable: true },
    { field: 'product', header: 'Product', sortable: true },
    { field: 'region', header: 'Region', sortable: true },
    {
      field: 'total',
      header: 'Total',
      sortable: true,
      align: 'end',
      format: (row) => formatMoney(row.total),
    },
  ];
  protected readonly order = signal<readonly string[]>([]);
  protected readonly hidden = signal<readonly string[]>([]);
  protected readonly widths = signal<Readonly<Record<string, number>>>({});
  protected widthText(): string {
    const entries = Object.entries(this.widths());
    return entries.length
      ? entries.map(([field, width]) => `${field} ${width}px`).join(', ')
      : 'default';
  }

  protected readonly wideColumns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order', frozen: true },
    { field: 'customer', header: 'Customer', frozen: true },
    { field: 'email', header: 'Email', width: '14rem' },
    { field: 'product', header: 'Product', width: '12rem' },
    { field: 'region', header: 'Region', width: '10rem' },
    { field: 'status', header: 'Status', width: '10rem' },
    {
      field: 'placed',
      header: 'Placed',
      width: '10rem',
      value: (row) => row.placed,
      format: (row) => formatDay(row.placed),
    },
    { field: 'quantity', header: 'Quantity', width: '8rem', align: 'end' },
    {
      field: 'total',
      header: 'Total',
      width: '10rem',
      align: 'end',
      format: (row) => formatMoney(row.total),
    },
  ];

  protected readonly pinnedColumns: StarColumn<Order>[] = this.wideColumns.map((column) =>
    column.field === 'customer'
      ? { ...column, frozen: false }
      : column.field === 'total'
        ? { ...column, pinned: 'end' as const }
        : column,
  );
  protected readonly pins = signal<StarColumnPins>({});
  protected readonly lastPin = signal('');
  protected pinText(): string {
    const entries = Object.entries(this.pins());
    return entries.length
      ? entries.map(([field, side]) => `${field} ${side ?? 'unpinned'}`).join(', ')
      : 'from the columns';
  }

  protected readonly pinnedScript = `readonly pins = signal<StarColumnPins>({});
readonly lastPin = signal('');
readonly pinnedColumns: StarColumn<Order>[] = [
  { field: 'id', header: 'Order', frozen: true },
  { field: 'customer', header: 'Customer' },
  { field: 'email', header: 'Email', width: '14rem' },
  // ... more columns than fit the width
  { field: 'total', header: 'Total', width: '10rem', pinned: 'end' },
];`;
  protected readonly panelScript = `readonly order = signal<readonly string[]>([]);
readonly hidden = signal<readonly string[]>([]);
readonly columns: StarColumn<Order>[] = [
  { field: 'id', header: 'Order', hideable: false },
  { field: 'customer', header: 'Customer' },
  { field: 'product', header: 'Product' },
];`;
  protected readonly resizeScript = `readonly widths = signal<Readonly<Record<string, number>>>({});`;
  protected readonly frozenScript = `readonly wideColumns: StarColumn<Order>[] = [
  { field: 'id', header: 'Order', frozen: true },
  { field: 'customer', header: 'Customer', frozen: true },
  { field: 'email', header: 'Email', width: '14rem' },
  // ... more columns than fit the width
];`;
  protected readonly stateScript = `// The template reference #saved gives access to clearState().`;

  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Enter / Space',
      description:
        'On the Columns button: opens the panel. On a checkbox: shows or hides the column.',
    },
    {
      name: 'Tab',
      description:
        'In the panel: moves through the checkboxes, the pin buttons and the move buttons.',
    },
    {
      name: 'Arrow left / Arrow right',
      description:
        'On a resize handle: makes the column 16 px narrower or wider (never below 48 px).',
    },
    { name: 'Escape', description: 'Closes the Columns panel.' },
  ];
}
