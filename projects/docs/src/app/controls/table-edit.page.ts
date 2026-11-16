import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarCellEditEvent, StarColumn, StarRowReorderEvent, StarTable } from '@star-ng/ui/table';
import { DOCS, DocsRow } from '../shared/docs';
import { DocsFill, Order, ORDERS, PRODUCT_NAMES } from './table-demo';

@Component({
  selector: 'docs-table-edit-page',
  imports: [DOCS, StarTable, DocsFill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Table editing"
      lead="Change a cell in place, and move rows up and down. The table does not change its rows: it emits an event, and the owner stores the change."
      importFrom="import { StarTable, StarCellEditEvent, StarRowReorderEvent } from '@star-ng/ui/table';"
    >
      <docs-example
        heading="Inline cell edit"
        source="table-edit/cells"
        [script]="cellScript"
        note="A column with editable: true shows an edit button in each cell. The button opens an editor: text (default), number or select. Enter or leaving the field saves, Escape cancels. The select editor is a small star-select that opens its list when the edit starts: a choice saves at once, and Escape or closing the list without a choice cancels. editable can be a function of the row. cellEdit emits the new value and the previous one, only when the value changed."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="rows()"
              [columns]="editColumns"
              dataKey="id"
              ariaLabel="Editable orders"
              (cellEdit)="applyEdit($event)"
            />
          </docs-fill>
          <p class="docs-output" role="status">{{ message() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Row order"
        source="table-edit/reorder"
        [script]="reorderScript"
        note="reorderableRows adds Move up and Move down buttons to each row. The table emits rowReorder with the row, its index now (from) and the index it must get (to). The buttons work while the table shows value in its own order: with a sort, a filter or groups they are disabled."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="queue()"
              [columns]="queueColumns"
              dataKey="id"
              ariaLabel="Order queue"
              reorderableRows
              (rowReorder)="move($event)"
            />
          </docs-fill>
        </div>
      </docs-example>

      <docs-api [of]="['StarTable']" [keyboard]="keyboard" />

      <h2>Technical notes</h2>
      <p>
        The editor shows the raw value of the cell (the result of <code>value</code>), not the
        display text, so a formatted cell such as a date or a price edits its data. The number
        editor emits a number, or <code>null</code> for an empty field, and it emits nothing for
        text that is not a number. After a save or a cancel the focus returns to the edit button of
        the cell.
      </p>
    </docs-page>
  `,
})
export class TableEditPage {
  protected readonly rows = signal<readonly Order[]>(ORDERS.slice(0, 5));
  protected readonly message = signal('No edit yet.');
  protected readonly editColumns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order' },
    {
      field: 'product',
      header: 'Product',
      editable: true,
      editor: 'select',
      editOptions: PRODUCT_NAMES,
    },
    { field: 'customer', header: 'Customer', editable: true },
    { field: 'status', header: 'Status' },
    {
      field: 'quantity',
      header: 'Quantity',
      align: 'end',
      editable: (row) => row.status !== 'Cancelled',
      editor: 'number',
    },
  ];

  /** The table does not change its rows: store the edited value here. */
  protected applyEdit(event: StarCellEditEvent<Order>): void {
    if (event.field === 'quantity') {
      const quantity = Number(event.value);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9) {
        this.message.set('Quantity not changed: enter a whole number from 1 to 9.');
        return;
      }
    }
    this.rows.update((rows) =>
      rows.map((row) => (row.id === event.row.id ? { ...row, [event.field]: event.value } : row)),
    );
    this.message.set(
      `${event.row.id}: ${event.field} changed from ${event.previous} to ${event.value}.`,
    );
  }

  protected readonly queue = signal<readonly Order[]>(ORDERS.slice(0, 4));
  protected readonly queueColumns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order' },
    { field: 'customer', header: 'Customer' },
    { field: 'product', header: 'Product' },
  ];

  /** The table does not change its rows: move the row here. */
  protected move(event: StarRowReorderEvent<Order>): void {
    this.queue.update((rows) => {
      const next = [...rows];
      next.splice(event.to, 0, ...next.splice(event.from, 1));
      return next;
    });
  }

  protected readonly cellScript = `readonly rows = signal<readonly Order[]>(ORDERS.slice(0, 5));
readonly message = signal('No edit yet.');
readonly editColumns: StarColumn<Order>[] = [
  { field: 'id', header: 'Order' },
  { field: 'product', header: 'Product', editable: true, editor: 'select', editOptions: PRODUCT_NAMES },
  { field: 'customer', header: 'Customer', editable: true },
  { field: 'status', header: 'Status' },
  {
    field: 'quantity',
    header: 'Quantity',
    editable: (row) => row.status !== 'Cancelled',
    editor: 'number',
  },
];

/** The table does not change its rows: store the edited value here. */
applyEdit(event: StarCellEditEvent<Order>): void {
  if (event.field === 'quantity') {
    const quantity = Number(event.value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9) {
      this.message.set('Quantity not changed: enter a whole number from 1 to 9.');
      return;
    }
  }
  this.rows.update((rows) =>
    rows.map((row) => (row.id === event.row.id ? { ...row, [event.field]: event.value } : row)),
  );
}`;
  protected readonly reorderScript = `readonly queue = signal<readonly Order[]>(ORDERS.slice(0, 4));

move(event: StarRowReorderEvent<Order>): void {
  this.queue.update((rows) => {
    const next = [...rows];
    next.splice(event.to, 0, ...next.splice(event.from, 1));
    return next;
  });
}`;

  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Enter / Space',
      description: 'On an edit button: opens the editor and puts the focus in it.',
    },
    { name: 'Enter', description: 'In a text or number editor: saves the value.' },
    {
      name: 'Escape',
      description: 'In an editor: cancels the edit. The focus returns to the edit button.',
    },
    {
      name: 'Arrow up / Arrow down',
      description: 'In a select editor: moves through the choices in the open list.',
    },
    {
      name: 'Enter / Space',
      description: 'In a select editor: saves the focused choice and closes the editor.',
    },
    {
      name: 'Escape / Tab',
      description: 'In a select editor: closes the list and cancels the edit.',
    },
    {
      name: 'Enter / Space',
      description: 'On a Move up or Move down button: asks the owner to move the row.',
    },
  ];
}
