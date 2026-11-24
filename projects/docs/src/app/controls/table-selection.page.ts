import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import {
  StarCellTemplate,
  StarColumn,
  StarTable,
  StarTableSelectionChangingEvent,
} from '@star-ng/ui/table';
import { StarTag } from '@star-ng/ui/tag';
import { DOCS, DocsRow } from '../shared/docs';
import { DocsFill, formatMoney, Order, orderColumns, ORDERS, STATUS_SEVERITY } from './table-demo';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './table-selection.page.scss',
  selector: 'docs-table-selection-page',
  imports: [DOCS, StarTable, StarCellTemplate, StarTag, StarButton, DocsFill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Table selection"
      lead="Let the user pick one row or many rows, react to a row click, and put actions in the rows. The selection holds the row objects; the table compares rows by dataKey."
      importFrom="import { StarTable } from '@star-ng/ui/table';"
    >
      <docs-example
        heading="Multiple selection"
        source="table-selection/multiple"
        [script]="multipleScript"
        note="selectionMode multiple adds a checkbox to each row. The header checkbox selects the rows of the current page: it is checked when all are selected and mixed when some are. selection is a two-way model."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button size="sm" variant="secondary" (pressed)="selectOpen()">
              Select open orders
            </star-button>
            <star-button size="sm" variant="secondary" (pressed)="selected.set([])">
              Clear selection
            </star-button>
          </div>
          <docs-fill>
            <star-table
              [value]="orders"
              [columns]="columns"
              dataKey="id"
              ariaLabel="Orders with checkboxes"
              selectionMode="multiple"
              [(selection)]="selected"
              paginator
              [rows]="5"
            />
          </docs-fill>
          <p class="docs-output" role="status">{{ selected().length }} selected</p>
        </div>
      </docs-example>

      <docs-example
        heading="Check box selection"
        source="table-selection/checkbox"
        [script]="checkboxScript"
        note="With selectionPageOnly set to false the header checkbox selects every row of the filter result, on all pages. rowSelectable disables the checkbox of cancelled orders; the header checkbox and ranges skip them. selectionKeys holds the dataKey of each selected row, so the selection survives new row objects. selectionChanging fires before each change: this example cancels a selection of more than 20 orders. Shift + Space on a checkbox selects the rows from the last toggled row."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="orders"
              [columns]="columns"
              dataKey="id"
              ariaLabel="Orders with selectable rows"
              selectionMode="multiple"
              [(selectionKeys)]="keys"
              [rowSelectable]="notCancelled"
              [selectionPageOnly]="false"
              (selectionChanging)="limit($event)"
              paginator
              [rows]="5"
            />
          </docs-fill>
          <p class="docs-output" role="status">
            {{ keys()?.length ?? 0 }} selected{{ refused() ? ', more than 20 refused' : '' }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Meta-key selection"
        source="table-selection/meta"
        [script]="metaScript"
        note="metaKeySelection makes a click select only that row. Ctrl or Cmd + click adds or removes a row, and Shift + click selects a range. The rows are one tab stop: Arrow up and Arrow down move between them, Space toggles the focused row, and Shift + Space or Shift + an arrow key extends the range."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="orders.slice(0, 8)"
              [columns]="columns"
              dataKey="id"
              ariaLabel="Orders with meta-key selection"
              selectionMode="multiple"
              metaKeySelection
              [(selection)]="metaSelected"
              (rowSelect)="lastEvent.set('Selected ' + $event.row.id)"
              (rowUnselect)="lastEvent.set('Cleared ' + $event.row.id)"
            />
          </docs-fill>
          <p class="docs-output" role="status">
            {{ metaSelected().length }} selected. {{ lastEvent() }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Single selection"
        source="table-selection/single"
        [script]="singleScript"
        note="selectionMode single adds a radio button to each row. A click on the row also selects it. selection holds one row."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="orders"
              [columns]="columns"
              dataKey="id"
              ariaLabel="Orders with one choice"
              selectionMode="single"
              [(selection)]="chosen"
              paginator
              [rows]="5"
            />
          </docs-fill>
          <p class="docs-output" role="status">Chosen: {{ chosen()[0]?.id ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Selection without the column"
        source="table-selection/row"
        [script]="rowScript"
        note="selectionColumn false removes the radio or checkbox column: the selected row shows a tint and an edge on its start side, and the row itself selects. A click selects the row; with selectionMode multiple, Ctrl or Cmd + click adds or removes a row and Shift + click selects a range. The rows are one tab stop: Arrow up and Arrow down move between them, and Space or Enter selects the focused row. With selectOnFocus (single mode) the arrow keys move the selection, as in a list box. Here the selection fills a details panel."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="orders.slice(0, 6)"
              [columns]="rowColumns"
              dataKey="id"
              ariaLabel="Orders without a selection column"
              selectionMode="single"
              [selectionColumn]="false"
              selectOnFocus
              [(selection)]="rowSelected"
            />
          </docs-fill>
          <p class="docs-output" role="status">
            @if (rowSelected()[0]; as order) {
              {{ order.id }}: {{ order.customer }}, {{ order.region }}, {{ order.status }}
            } @else {
              No order selected
            }
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Row click"
        source="table-selection/click"
        [script]="clickScript"
        note="rowClick emits the row when the user clicks a row. A click on a button, link or field inside the row does not count. Use it to open a detail page."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="orders.slice(0, 5)"
              [columns]="columns"
              dataKey="id"
              ariaLabel="Orders with row click"
              (rowClick)="opened.set($event.id)"
            />
          </docs-fill>
          <p class="docs-output" role="status">Opened: {{ opened() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Row actions"
        source="table-selection/actions"
        [script]="actionsScript"
        note="A cell template can hold buttons. Give such a column exportable: false so that it stays out of the exports. A click on a button does not select the row."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="actionOrders()"
              [columns]="actionColumns"
              dataKey="id"
              ariaLabel="Orders with actions"
              selectionMode="single"
              [(selection)]="actionSelection"
            >
              <ng-template starCell="status" [starCellOf]="actionOrders()" let-row>
                <star-tag [severity]="severityOf(row.status)" [value]="row.status" rounded />
              </ng-template>
              <ng-template starCell="actions" [starCellOf]="actionOrders()" let-row>
                <star-button
                  size="sm"
                  variant="secondary"
                  [disabled]="row.status === 'Cancelled'"
                  (pressed)="cancel(row)"
                >
                  Cancel {{ row.id }}
                </star-button>
              </ng-template>
            </star-table>
          </docs-fill>
          <p class="docs-output" role="status">
            Selected: {{ actionSelection()[0]?.id ?? 'none' }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Column selection"
        source="table-selection/columns"
        [script]="columnScript"
        note="selectionMode column adds a select button to each header. A click selects that column only, Ctrl or Cmd + click adds or removes it, and Shift + click selects the columns from the last clicked one. columnSelection is a two-way model of the selected fields, in display order."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="orders"
              [columns]="columnPickColumns"
              dataKey="id"
              ariaLabel="Orders with column selection"
              selectionMode="column"
              [(columnSelection)]="pickedColumns"
              paginator
              [rows]="4"
            />
          </docs-fill>
          <p class="docs-output" role="status">
            Columns: {{ pickedColumns().join(', ') || 'none' }}
          </p>
        </div>
      </docs-example>

      <docs-api [of]="['StarTable']" [keyboard]="keyboard" />

      <h2>Technical notes</h2>
      <p>
        The selection holds the row objects, and a row counts as selected when its
        <code>dataKey</code> matches. A selection survives sorting, filtering and paging, and a row
        that is no longer in <code>value</code> stays in the selection until the owner removes it.
        Each selected row has <code>aria-selected="true"</code> and the selected style. Export only
        the selected rows with the <code>selectionOnly</code> option.
      </p>
    </docs-page>
  `,
})
export class TableSelectionPage {
  protected readonly orders: readonly Order[] = ORDERS;
  protected readonly columns: StarColumn<Order>[] = orderColumns();
  protected readonly severityOf = (status: Order['status']) => STATUS_SEVERITY[status];

  protected readonly selected = signal<readonly Order[]>([]);
  protected readonly pickedColumns = signal<readonly string[]>([]);
  protected readonly columnPickColumns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order' },
    { field: 'customer', header: 'Customer' },
    { field: 'region', header: 'Region' },
    { field: 'total', header: 'Total', align: 'end', format: (row) => formatMoney(row.total) },
  ];
  protected readonly columnScript = `readonly pickedColumns = signal<readonly string[]>([]);`;
  protected selectOpen(): void {
    this.selected.set(ORDERS.filter((order) => order.status === 'Open'));
  }
  protected readonly chosen = signal<readonly Order[]>([]);

  protected readonly keys = signal<readonly unknown[] | null>([]);
  protected readonly refused = signal(false);
  protected readonly notCancelled = (order: Order) => order.status !== 'Cancelled';
  protected limit(event: StarTableSelectionChangingEvent<Order>): void {
    this.refused.set(event.next.length > 20);
    if (event.next.length > 20) event.cancel();
  }

  protected readonly metaSelected = signal<readonly Order[]>([]);
  protected readonly lastEvent = signal('');
  protected readonly opened = signal<string | null>(null);

  protected readonly rowSelected = signal<readonly Order[]>([]);
  protected readonly rowColumns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order' },
    { field: 'customer', header: 'Customer' },
    { field: 'total', header: 'Total', align: 'end', format: (row) => formatMoney(row.total) },
  ];

  protected readonly actionOrders = signal<readonly Order[]>(ORDERS.slice(0, 5));
  protected readonly actionSelection = signal<readonly Order[]>([]);
  protected readonly actionColumns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order' },
    { field: 'customer', header: 'Customer' },
    { field: 'status', header: 'Status' },
    { field: 'actions', header: 'Actions', exportable: false, value: () => '' },
  ];
  protected cancel(order: Order): void {
    this.actionOrders.update((rows) =>
      rows.map((row) => (row.id === order.id ? { ...row, status: 'Cancelled' } : row)),
    );
  }

  protected readonly multipleScript = `readonly selected = signal<readonly Order[]>([]);

selectOpen(): void {
  this.selected.set(ORDERS.filter((order) => order.status === 'Open'));
}`;
  protected readonly checkboxScript = `readonly keys = signal<readonly unknown[] | null>([]);
readonly refused = signal(false);
readonly notCancelled = (order: Order) => order.status !== 'Cancelled';

limit(event: StarTableSelectionChangingEvent<Order>): void {
  this.refused.set(event.next.length > 20);
  if (event.next.length > 20) event.cancel();
}`;
  protected readonly metaScript = `readonly metaSelected = signal<readonly Order[]>([]);
readonly lastEvent = signal('');`;
  protected readonly singleScript = `readonly chosen = signal<readonly Order[]>([]);`;
  protected readonly rowScript = `readonly rowSelected = signal<readonly Order[]>([]);
readonly rowColumns: StarColumn<Order>[] = [
  { field: 'id', header: 'Order' },
  { field: 'customer', header: 'Customer' },
  { field: 'total', header: 'Total', align: 'end', format: (row) => formatMoney(row.total) },
];`;
  protected readonly clickScript = `readonly opened = signal<string | null>(null);`;
  protected readonly actionsScript = `// Import StarCellTemplate, StarTag and StarButton in the component imports.
readonly actionOrders = signal<readonly Order[]>(ORDERS.slice(0, 5));
readonly actionColumns: StarColumn<Order>[] = [
  { field: 'id', header: 'Order' },
  { field: 'customer', header: 'Customer' },
  { field: 'status', header: 'Status' },
  { field: 'actions', header: 'Actions', exportable: false, value: () => '' },
];

cancel(order: Order): void {
  this.actionOrders.update((rows) =>
    rows.map((row) => (row.id === order.id ? { ...row, status: 'Cancelled' } : row)),
  );
}`;

  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab',
      description:
        'Moves to the header checkbox, then to the checkbox or radio button of each row, then to the buttons in the cells.',
    },
    {
      name: 'Space',
      description:
        'On a row checkbox or radio button: selects or clears the row. On the header checkbox: selects or clears the rows of the page (the whole filter result with selectionPageOnly false). On a focused row (metaKeySelection or selectionColumn false): toggles the row; in single mode without the selection column it selects the row.',
    },
    {
      name: 'Enter (selectionColumn false)',
      description:
        'On a focused row: selects the row (multiple: toggles it). On a button or link in a cell, Enter runs that control.',
    },
    {
      name: 'Shift + Space',
      description:
        'On a row checkbox, or on a focused row (metaKeySelection or selectionColumn false): selects the rows from the last toggled row to this row.',
    },
    {
      name: 'Shift + Arrow up / Shift + Arrow down',
      description:
        'On a row checkbox, or on a focused row (metaKeySelection or selectionColumn false): moves to the previous or next row and extends the range.',
    },
    {
      name: 'Arrow up / Arrow down (metaKeySelection or selectionColumn false)',
      description:
        'On a focused row: moves the focus to the previous or next row. With selectOnFocus in single mode, the selection moves with the focus.',
    },
    {
      name: 'Arrow up / Arrow down',
      description:
        'In a group of radio buttons (single selection): moves the choice to the previous or next row.',
    },
  ];
}
