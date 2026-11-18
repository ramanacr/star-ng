import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import {
  StarBatchChanges,
  StarCellEditEvent,
  StarCellTemplate,
  StarColumn,
  StarRowEditSaveEvent,
  StarRowEvent,
  StarRowReorderEvent,
  StarTable,
} from '@star-ng/ui/table';
import { DOCS, DocsRow } from '../shared/docs';
import { DocsFill, Order, ORDERS, PRODUCT_NAMES } from './table-demo';

const ORDER_STATUSES = ['Open', 'Paid', 'Shipped', 'Overdue', 'Cancelled'];

/** Applies batch changes to a list of orders (owner side). */
function applyBatch(rows: readonly Order[], changes: StarBatchChanges<Order>): Order[] {
  const deleted = new Set(changes.deleted.map((row) => row.id));
  const updated = new Map(changes.updated.map((change) => [change.row.id, change.changes]));
  return [
    ...rows
      .filter((row) => !deleted.has(row.id))
      .map((row) => (updated.has(row.id) ? { ...row, ...updated.get(row.id) } : row)),
    ...changes.added,
  ];
}

@Component({
  selector: 'docs-table-edit-page',
  imports: [DOCS, StarTable, StarCellTemplate, StarButton, DocsFill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Table editing"
      lead="Change a cell or a whole row in place, check the values, collect changes in a batch with undo, add and delete rows, and move rows up and down. The table does not change its rows: it emits an event, and the owner stores the change."
      importFrom="import { StarTable, StarCellEditEvent, StarRowEditSaveEvent, StarBatchChanges, StarRowReorderEvent } from '@star-ng/ui/table';"
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
        heading="Row edit with validation"
        source="table-edit/rows"
        [script]="rowScript"
        note='editMode="row" adds an actions column. Edit (or F2 in the row) opens an editor for every editable cell of the row; Tab moves between them, Enter saves and Escape cancels, and the focus returns to the Edit button of the row. required, min, max, pattern and validators check the values: an invalid editor shows its message, and Save stays blocked until all values are valid. rowEditSave emits the changed fields and their previous values. [(editingRowKeys)] holds the keys of the rows in edit.'
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="crew()"
              [columns]="rowColumns"
              dataKey="id"
              ariaLabel="Orders with row edit"
              editMode="row"
              (rowEditSave)="saveRow($event)"
            />
          </docs-fill>
          <p class="docs-output" role="status">{{ rowMessage() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Batch edit with undo"
        source="table-edit/batch"
        [script]="batchScript"
        note='batchEdit collects saved cells, new rows and deleted rows in a pending change set. Changed cells have a mark (screen readers hear "changed"). undo() and redo() step through the set, also with Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z in the table. commitEdits() emits batchSave with updated, added and deleted rows; discardEdits() drops the set. pendingChanges(), canUndo() and canRedo() are signals.'
      >
        <div class="docs-stack">
          <div class="docs-row" role="toolbar" aria-label="Batch changes">
            <star-button
              size="sm"
              variant="secondary"
              leadingIcon="ph-bold ph-arrow-counter-clockwise"
              [disabled]="!batchTable.canUndo()"
              (pressed)="batchTable.undo()"
            >
              Undo
            </star-button>
            <star-button
              size="sm"
              variant="secondary"
              leadingIcon="ph-bold ph-arrow-clockwise"
              [disabled]="!batchTable.canRedo()"
              (pressed)="batchTable.redo()"
            >
              Redo
            </star-button>
            <star-button
              size="sm"
              variant="secondary"
              [disabled]="!batchTable.canUndo()"
              (pressed)="batchTable.discardEdits()"
            >
              Discard
            </star-button>
            <star-button
              size="sm"
              [disabled]="!batchTable.canUndo()"
              (pressed)="batchTable.commitEdits()"
            >
              Save {{ pendingCount(batchTable.pendingChanges()) }} changes
            </star-button>
          </div>
          <docs-fill>
            <star-table
              #batchTable
              [value]="batchRows()"
              [columns]="batchColumns"
              dataKey="id"
              ariaLabel="Orders with batch edit"
              batchEdit
              (batchSave)="saveBatch($event)"
            />
          </docs-fill>
          <p class="docs-output" role="status">{{ batchMessage() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Add and delete rows"
        source="table-edit/add-delete"
        [script]="addScript"
        note="addRow(partial, position) opens a new row in edit at the top or the bottom (row mode). Its save emits rowAdd with the edited values, its cancel drops it. deleteRow(row) emits rowDelete. With batchEdit both join the pending change set instead, and a deleted row shows struck through until the save."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button
              size="sm"
              leadingIcon="ph-bold ph-plus"
              (pressed)="addTable.addRow(newOrder(), 'top')"
            >
              Add order
            </star-button>
          </div>
          <docs-fill>
            <star-table
              #addTable
              [value]="list()"
              [columns]="addColumns"
              dataKey="id"
              ariaLabel="Orders to add and delete"
              editMode="row"
              (rowAdd)="addOrder($event)"
              (rowDelete)="deleteOrder($event)"
              (rowEditSave)="updateOrder($event)"
            >
              <ng-template starCell="remove" let-row [starCellOf]="list()">
                <button
                  type="button"
                  class="star-table__toggle"
                  [attr.aria-label]="'Delete ' + row.id"
                  (click)="addTable.deleteRow(row)"
                >
                  <i class="ph-bold ph-trash" aria-hidden="true"></i>
                </button>
              </ng-template>
            </star-table>
          </docs-fill>
          <p class="docs-output" role="status">{{ addMessage() }}</p>
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
      <p>
        Validation uses plain signals: each editor keeps its value in a draft, and the rules of the
        column (<code>required</code>, <code>min</code>, <code>max</code>, <code>pattern</code>,
        <code>validators</code>) check it. A message shows after the user changed the field or tried
        to save. An invalid editor has <code>aria-invalid="true"</code> and
        <code>aria-describedby</code> on its message. Save, Cancel, undo, redo and blocked saves are
        announced to screen readers. The <code>starRowEditActions</code> template replaces the Save
        and Cancel buttons; its context has <code>save</code>, <code>cancel</code>,
        <code>valid</code> and <code>row</code>.
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

  protected readonly crew = signal<readonly Order[]>(ORDERS.slice(5, 9));
  protected readonly rowMessage = signal('No row saved yet.');
  protected readonly rowColumns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order' },
    { field: 'customer', header: 'Customer', editable: true, required: true },
    {
      field: 'status',
      header: 'Status',
      editable: true,
      editor: 'select',
      editOptions: ORDER_STATUSES,
    },
    {
      field: 'quantity',
      header: 'Quantity',
      align: 'end',
      editable: true,
      editor: 'number',
      required: true,
      min: 1,
      max: 9,
      validators: (value, row) =>
        row.status === 'Shipped' && value !== this.crew().find((o) => o.id === row.id)?.quantity
          ? 'A shipped order keeps its quantity.'
          : null,
    },
  ];

  /** The table does not change its rows: store the saved row here. */
  protected saveRow(event: StarRowEditSaveEvent<Order>): void {
    this.crew.update((rows) =>
      rows.map((row) => (row.id === event.row.id ? { ...row, ...event.changes } : row)),
    );
    const fields = Object.keys(event.changes);
    this.rowMessage.set(
      fields.length
        ? `${event.row.id}: ${fields.join(', ')} changed.`
        : `${event.row.id}: no change.`,
    );
  }

  protected readonly batchRows = signal<readonly Order[]>(ORDERS.slice(10, 15));
  protected readonly batchMessage = signal('No batch saved yet.');
  protected readonly batchColumns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order' },
    { field: 'customer', header: 'Customer', editable: true, required: true },
    {
      field: 'quantity',
      header: 'Quantity',
      align: 'end',
      editable: true,
      editor: 'number',
      min: 1,
      max: 9,
    },
  ];

  protected pendingCount(changes: StarBatchChanges<Order>): number {
    return changes.updated.length + changes.added.length + changes.deleted.length;
  }

  /** The table does not change its rows: apply the batch here. */
  protected saveBatch(changes: StarBatchChanges<Order>): void {
    this.batchRows.update((rows) => applyBatch(rows, changes));
    this.batchMessage.set(`Saved: ${changes.updated.length} rows changed.`);
  }

  protected readonly list = signal<readonly Order[]>(ORDERS.slice(20, 23));
  protected readonly addMessage = signal('No row added or deleted yet.');
  private nextId = 900;
  protected readonly addColumns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order' },
    { field: 'customer', header: 'Customer', editable: true, required: true },
    {
      field: 'quantity',
      header: 'Quantity',
      align: 'end',
      editable: true,
      editor: 'number',
      required: true,
      min: 1,
      max: 9,
    },
    { field: 'remove', header: 'Delete', exportable: false },
  ];

  /** A new order with a fresh id; the user fills the other fields. */
  protected newOrder(): Partial<Order> {
    return { id: `ORD-${this.nextId++}` };
  }

  protected addOrder(event: StarRowEvent<Order>): void {
    this.list.update((rows) => [event.row, ...rows]);
    this.addMessage.set(`${event.row.id} added.`);
  }

  protected deleteOrder(event: StarRowEvent<Order>): void {
    this.list.update((rows) => rows.filter((row) => row.id !== event.row.id));
    this.addMessage.set(`${event.row.id} deleted.`);
  }

  protected updateOrder(event: StarRowEditSaveEvent<Order>): void {
    this.list.update((rows) =>
      rows.map((row) => (row.id === event.row.id ? { ...row, ...event.changes } : row)),
    );
  }

  protected readonly rowScript = `readonly crew = signal<readonly Order[]>(ORDERS.slice(5, 9));
readonly rowColumns: StarColumn<Order>[] = [
  { field: 'id', header: 'Order' },
  { field: 'customer', header: 'Customer', editable: true, required: true },
  { field: 'status', header: 'Status', editable: true, editor: 'select', editOptions: ORDER_STATUSES },
  {
    field: 'quantity',
    header: 'Quantity',
    editable: true,
    editor: 'number',
    required: true,
    min: 1,
    max: 9,
    // The row holds the editor values, so a rule can compare fields.
    validators: (value, row) =>
      row.status === 'Shipped' && value !== this.crew().find((o) => o.id === row.id)?.quantity
        ? 'A shipped order keeps its quantity.'
        : null,
  },
];

saveRow(event: StarRowEditSaveEvent<Order>): void {
  this.crew.update((rows) =>
    rows.map((row) => (row.id === event.row.id ? { ...row, ...event.changes } : row)),
  );
}`;
  protected readonly batchScript = `readonly batchRows = signal<readonly Order[]>(ORDERS.slice(10, 15));

pendingCount(changes: StarBatchChanges<Order>): number {
  return changes.updated.length + changes.added.length + changes.deleted.length;
}

/** The table does not change its rows: apply the batch here. */
saveBatch(changes: StarBatchChanges<Order>): void {
  const deleted = new Set(changes.deleted.map((row) => row.id));
  const updated = new Map(changes.updated.map((change) => [change.row.id, change.changes]));
  this.batchRows.update((rows) => [
    ...rows
      .filter((row) => !deleted.has(row.id))
      .map((row) => (updated.has(row.id) ? { ...row, ...updated.get(row.id) } : row)),
    ...changes.added,
  ]);
}`;
  protected readonly addScript = `readonly list = signal<readonly Order[]>(ORDERS.slice(20, 23));
private nextId = 900;

newOrder(): Partial<Order> {
  return { id: \`ORD-\${this.nextId++}\` };
}

addOrder(event: StarRowEvent<Order>): void {
  this.list.update((rows) => [event.row, ...rows]);
}

deleteOrder(event: StarRowEvent<Order>): void {
  this.list.update((rows) => rows.filter((row) => row.id !== event.row.id));
}`;

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
      name: 'F2',
      description: 'In a row (row edit mode): opens the editors of the row.',
    },
    {
      name: 'Tab',
      description: 'In a row in edit: moves between its editors and Save and Cancel.',
    },
    {
      name: 'Enter',
      description: 'In a row editor: saves the row (blocked while a value is not valid).',
    },
    {
      name: 'Escape',
      description:
        'In a row editor: cancels the edit. The focus returns to the Edit button of the row.',
    },
    { name: 'Ctrl+Z', description: 'In a table with batch edit: undoes the last change.' },
    {
      name: 'Ctrl+Y / Ctrl+Shift+Z',
      description: 'In a table with batch edit: applies the undone change again.',
    },
    {
      name: 'Enter / Space',
      description: 'On a Move up or Move down button: asks the owner to move the row.',
    },
  ];
}
