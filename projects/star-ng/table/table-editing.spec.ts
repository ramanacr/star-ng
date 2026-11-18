import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { STAR_UI_TEXT_DEFAULTS } from '@star-ng/ui/core';
import { StarCellEditEvent, StarColumn, StarTable } from './table';
import {
  StarBatchChanges,
  starCellError,
  StarEditBatch,
  StarEditCellEvent,
  StarRowEditSaveEvent,
  StarRowEvent,
} from './table-editing';
import { StarRowEditActionsTemplate } from './table-slots';

interface Order {
  id: string;
  customer: string;
  status: string;
  quantity: number | null;
}

const ORDERS: Order[] = [
  { id: 'ORD-1', customer: 'North Office', status: 'Open', quantity: 2 },
  { id: 'ORD-2', customer: 'Harbor Shop', status: 'Shipped', quantity: 5 },
  { id: 'ORD-3', customer: 'City Library', status: 'Open', quantity: 1 },
];

const COLUMNS: StarColumn<Order>[] = [
  { field: 'id', header: 'Order' },
  { field: 'customer', header: 'Customer', editable: true, required: true },
  {
    field: 'status',
    header: 'Status',
    editable: true,
    editor: 'select',
    editOptions: ['Open', 'Shipped'],
  },
  {
    field: 'quantity',
    header: 'Quantity',
    editable: true,
    editor: 'number',
    min: 1,
    max: 9,
    validators: (value, row) =>
      row.status === 'Shipped' && value !== 5 ? 'A shipped order keeps its quantity.' : null,
  },
];

@Component({
  imports: [StarTable, StarRowEditActionsTemplate],
  template: `<star-table
    [value]="rows()"
    [columns]="columns"
    [dataKey]="keyed() ? 'id' : null"
    [editMode]="mode()"
    [hiddenColumns]="hidden()"
    [reorderableRows]="reorder()"
    [batchEdit]="batch()"
    [(editingRowKeys)]="editingKeys"
    (cellEdit)="log.push(['cellEdit', $event])"
    (editInit)="log.push(['editInit', $event])"
    (editCancel)="log.push(['editCancel', $event])"
    (rowEditInit)="log.push(['rowEditInit', $event])"
    (rowEditSave)="log.push(['rowEditSave', $event])"
    (rowEditCancel)="log.push(['rowEditCancel', $event])"
    (rowAdd)="log.push(['rowAdd', $event])"
    (rowDelete)="log.push(['rowDelete', $event])"
    (batchSave)="log.push(['batchSave', $event])"
  >
    @if (customActions()) {
      <ng-template starRowEditActions let-save="save" let-cancel="cancel" let-valid="valid">
        <button type="button" class="custom-save" [disabled]="!valid" (click)="save()">Keep</button>
        <button type="button" class="custom-cancel" (click)="cancel()">Drop</button>
      </ng-template>
    }
  </star-table>`,
})
class EditingHost {
  readonly table = viewChild.required<StarTable<Order>>(StarTable);
  readonly rows = signal(ORDERS);
  readonly columns = COLUMNS;
  readonly mode = signal<'cell' | 'row'>('cell');
  readonly batch = signal(false);
  readonly customActions = signal(false);
  readonly keyed = signal(true);
  readonly hidden = signal<readonly string[]>([]);
  readonly reorder = signal(false);
  readonly editingKeys = signal<readonly unknown[]>([]);
  readonly log: [
    string,
    (
      | StarCellEditEvent<Order>
      | StarEditCellEvent<Order>
      | StarRowEvent<Order>
      | StarRowEditSaveEvent<Order>
      | StarBatchChanges<Order>
    ),
  ][] = [];
}

const tick = () => new Promise((resolve) => setTimeout(resolve));
const key = (target: Element, name: string, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }),
  );

async function setup(
  options: {
    mode?: 'cell' | 'row';
    batch?: boolean;
    custom?: boolean;
    keyed?: boolean;
    reorder?: boolean;
    rows?: Order[];
  } = {},
) {
  const fixture = TestBed.createComponent(EditingHost);
  const host = fixture.componentInstance;
  host.mode.set(options.mode ?? 'cell');
  host.batch.set(options.batch ?? false);
  host.customActions.set(options.custom ?? false);
  host.keyed.set(options.keyed ?? true);
  host.reorder.set(options.reorder ?? false);
  if (options.rows) host.rows.set(options.rows);
  const announcer = TestBed.inject(LiveAnnouncer);
  const announce = vi.spyOn(announcer, 'announce').mockResolvedValue();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const stable = async () => {
    await fixture.whenStable();
    await tick();
    await fixture.whenStable();
  };
  const row = (index: number) =>
    el.querySelectorAll<HTMLElement>('tbody tr.star-table__row')[index];
  const cell = (index: number, column: number) =>
    row(index).querySelectorAll<HTMLElement>('td')[column];
  const messages = () => announce.mock.calls.map((call) => call[0]);
  const names = () => host.log.map(([name]) => name);
  return { fixture, host, el, stable, row, cell, messages, names, table: host.table() };
}

describe('starCellError', () => {
  const text = STAR_UI_TEXT_DEFAULTS;
  it('checks required, min, max, pattern and own validators in that order', () => {
    expect(starCellError({ required: true }, '', {}, text)).toBe('Enter a value.');
    expect(starCellError({ required: true }, null, {}, text)).toBe('Enter a value.');
    expect(starCellError({ min: 1 }, 0, {}, text)).toBe('Enter 1 or more.');
    expect(starCellError({ max: 9 }, 10, {}, text)).toBe('Enter 9 or less.');
    expect(starCellError({ min: 1 }, null, {}, text)).toBeNull();
    // A text pattern matches the whole value.
    expect(starCellError({ pattern: '[A-Z]+' }, 'AB1', {}, text)).toBe(
      'Enter the value in the expected format.',
    );
    expect(starCellError({ pattern: /^\d+$/ }, '42', {}, text)).toBeNull();
    const rules = {
      validators: [() => null, (value: unknown) => (value === 'x' ? 'No x.' : null)],
    };
    expect(starCellError(rules, 'x', {}, text)).toBe('No x.');
    expect(starCellError(rules, 'y', {}, text)).toBeNull();
  });
});

describe('StarEditBatch', () => {
  const rowA = { id: 1, name: 'A' };
  const rowB = { id: 2, name: 'B' };
  it('collects changes, drops a change back to the original, and undoes and redoes steps', () => {
    const batch = new StarEditBatch<typeof rowA>((row) => row.id);
    expect(batch.change(rowA, [{ field: 'name', value: 'A2', original: 'A' }])).toBe(true);
    expect(batch.pending(rowA, 'name')).toEqual({ value: 'A2' });
    expect(batch.change(rowA, [{ field: 'name', value: 'A2', original: 'A' }])).toBe(false);
    batch.remove(rowB);
    expect(batch.changes()).toEqual({
      updated: [{ row: rowA, changes: { name: 'A2' }, previous: { name: 'A' } }],
      added: [],
      deleted: [rowB],
    });
    expect(batch.undo()).toBe(true);
    expect(batch.isDeleted(rowB)).toBe(false);
    expect(batch.canRedo()).toBe(true);
    expect(batch.redo()).toBe(true);
    expect(batch.isDeleted(rowB)).toBe(true);
    // Back to the original value: the change goes away.
    batch.change(rowA, [{ field: 'name', value: 'A', original: 'A' }]);
    expect(batch.pending(rowA, 'name')).toBeNull();
    batch.reset();
    expect(batch.canUndo()).toBe(false);
  });

  it('merges the edits of a new row into it and drops a deleted new row', () => {
    const batch = new StarEditBatch<{ id?: number; name?: string }>((row) => row);
    const fresh = {};
    batch.add(fresh, 'top');
    batch.change(fresh, [{ field: 'name', value: 'New', original: undefined }]);
    expect(batch.changes()).toEqual({ updated: [], added: [{ name: 'New' }], deleted: [] });
    batch.remove(fresh);
    expect(batch.changes().added).toEqual([]);
  });
});

describe('StarTable cell edit events and validation', () => {
  it('emits editInit and editCancel, and keeps cellEdit', async () => {
    const { host, cell, stable, el } = await setup();
    cell(0, 1).querySelector<HTMLButtonElement>('.star-table__edit')!.click();
    await stable();
    const editor = el.querySelector<HTMLInputElement>('input.star-table__editor')!;
    key(editor, 'Escape');
    await stable();
    cell(0, 1).querySelector<HTMLButtonElement>('.star-table__edit')!.click();
    await stable();
    const again = el.querySelector<HTMLInputElement>('input.star-table__editor')!;
    again.value = 'South Office';
    key(again, 'Enter');
    await stable();
    expect(host.log).toEqual([
      ['editInit', { row: ORDERS[0], field: 'customer' }],
      ['editCancel', { row: ORDERS[0], field: 'customer' }],
      ['editInit', { row: ORDERS[0], field: 'customer' }],
      [
        'cellEdit',
        { row: ORDERS[0], field: 'customer', value: 'South Office', previous: 'North Office' },
      ],
    ]);
  });

  it('shows the message of an invalid value and does not save it', async () => {
    const { host, cell, stable, el, names, messages } = await setup();
    cell(0, 3).querySelector<HTMLButtonElement>('.star-table__edit')!.click();
    await stable();
    const editor = el.querySelector<HTMLInputElement>('input.star-table__editor')!;
    editor.value = '12';
    editor.dispatchEvent(new Event('input'));
    await stable();
    expect(editor.getAttribute('aria-invalid')).toBe('true');
    const error = el.querySelector('#' + editor.getAttribute('aria-describedby'));
    expect(error?.textContent?.trim()).toBe('Enter 9 or less.');
    key(editor, 'Enter');
    await stable();
    expect(names()).toEqual(['editInit']);
    expect(el.querySelector('input.star-table__editor')).toBe(editor);
    expect(messages()).toContain('Enter 9 or less.');
    editor.value = '3';
    editor.dispatchEvent(new Event('input'));
    key(editor, 'Enter');
    await stable();
    expect(host.log.at(-1)).toEqual([
      'cellEdit',
      { row: ORDERS[0], field: 'quantity', value: 3, previous: 2 },
    ]);
  });

  it('runs the own validator with the row', async () => {
    const { cell, stable, el } = await setup();
    cell(1, 3).querySelector<HTMLButtonElement>('.star-table__edit')!.click();
    await stable();
    const editor = el.querySelector<HTMLInputElement>('input.star-table__editor')!;
    editor.value = '4';
    editor.dispatchEvent(new Event('input'));
    await stable();
    expect(el.querySelector('.star-table__error')?.textContent?.trim()).toBe(
      'A shipped order keeps its quantity.',
    );
  });
});

describe('StarTable row edit mode', () => {
  it('opens all editors of a row with the Edit button and saves with Enter', async () => {
    const { host, row, stable, el, messages } = await setup({ mode: 'row' });
    const edit = row(0).querySelector<HTMLButtonElement>('[data-row-edit="ORD-1"]')!;
    expect(edit.getAttribute('aria-label')).toBe('Edit row');
    expect(el.querySelector('th.star-table__row-actions')?.textContent?.trim()).toBe('Row actions');
    // Row mode: no edit button per cell.
    expect(el.querySelector('.star-table__edit')).toBeNull();
    edit.click();
    await stable();
    expect(host.editingKeys()).toEqual(['ORD-1']);
    const editors = [...row(0).querySelectorAll<HTMLElement>('[data-row-editor]')];
    expect(editors.map((editor) => editor.tagName)).toEqual(['INPUT', 'SELECT', 'INPUT']);
    expect(document.activeElement).toBe(editors[0]);
    // Tab order in the row: the editors, then Save and Cancel.
    const order = [...row(0).querySelectorAll<HTMLElement>('input, select, button')];
    expect(order.map((item) => item.getAttribute('aria-label'))).toEqual([
      'Edit Customer',
      'Edit Status',
      'Edit Quantity',
      'Save',
      'Cancel',
    ]);
    const customer = editors[0] as HTMLInputElement;
    customer.value = 'West Office';
    customer.dispatchEvent(new Event('input'));
    const status = editors[1] as HTMLSelectElement;
    status.value = 'Shipped';
    status.dispatchEvent(new Event('change'));
    // The quantity of a shipped order must stay 5: Save is blocked.
    await stable();
    key(customer, 'Enter');
    await stable();
    expect(host.log.map(([name]) => name)).toEqual(['rowEditInit']);
    const quantity = editors[2] as HTMLInputElement;
    expect(quantity.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(quantity);
    expect(messages()).toContain('Correct the errors, then save.');
    expect(row(0).querySelector('[data-row-save]')!.getAttribute('aria-disabled')).toBe('true');
    status.value = 'Open';
    status.dispatchEvent(new Event('change'));
    await stable();
    key(quantity, 'Enter');
    await stable();
    expect(host.log.at(-1)).toEqual([
      'rowEditSave',
      {
        row: ORDERS[0],
        changes: { customer: 'West Office' },
        previous: { customer: 'North Office' },
      },
    ]);
    expect(host.editingKeys()).toEqual([]);
    expect(el.querySelector('[data-row-editor]')).toBeNull();
    expect(document.activeElement).toBe(row(0).querySelector('[data-row-edit="ORD-1"]'));
    expect(messages()).toContain('Changes saved.');
  });

  it('opens with F2 and cancels with Escape; the focus returns to the row', async () => {
    const { host, row, stable, messages } = await setup({ mode: 'row' });
    const edit = row(1).querySelector<HTMLButtonElement>('[data-row-edit]')!;
    key(edit, 'F2');
    await stable();
    const editor = row(1).querySelector<HTMLInputElement>('[data-row-editor]')!;
    expect(document.activeElement).toBe(editor);
    editor.value = 'Changed';
    editor.dispatchEvent(new Event('input'));
    key(editor, 'Escape');
    await stable();
    expect(host.log).toEqual([
      ['rowEditInit', { row: ORDERS[1] }],
      ['rowEditCancel', { row: ORDERS[1] }],
    ]);
    expect(document.activeElement).toBe(row(1).querySelector('[data-row-edit="ORD-2"]'));
    expect(messages()).toContain('Edit canceled.');
  });

  it('follows editingRowKeys set by the owner', async () => {
    const { host, row, stable } = await setup({ mode: 'row' });
    host.editingKeys.set(['ORD-3']);
    await stable();
    expect(row(2).querySelectorAll('[data-row-editor]').length).toBe(3);
    host.table().cancelRowEdit(ORDERS[2]);
    await stable();
    expect(host.editingKeys()).toEqual([]);
  });

  it('uses the starRowEditActions slot for Save and Cancel', async () => {
    const { host, row, stable } = await setup({ mode: 'row', custom: true });
    host.table().initRowEdit(ORDERS[0]);
    await stable();
    expect(row(0).querySelector('[data-row-save]')).toBeNull();
    const editor = row(0).querySelector<HTMLInputElement>('[data-row-editor]')!;
    editor.value = '';
    editor.dispatchEvent(new Event('input'));
    await stable();
    expect(row(0).querySelector<HTMLButtonElement>('.custom-save')!.disabled).toBe(true);
    row(0).querySelector<HTMLButtonElement>('.custom-cancel')!.click();
    await stable();
    expect(host.log.at(-1)).toEqual(['rowEditCancel', { row: ORDERS[0] }]);
  });
});

describe('StarTable add and delete rows', () => {
  it('opens a new row in edit (row mode) and emits rowAdd on save', async () => {
    const { host, el, stable } = await setup({ mode: 'row' });
    const added = host.table().addRow({ id: 'ORD-9', status: 'Open' } as Partial<Order>, 'top');
    await stable();
    const first = el.querySelector<HTMLElement>('tbody tr.star-table__row')!;
    expect(first.querySelector('[data-row-editor="ORD-9"]')).not.toBeNull();
    expect(host.log).toEqual([['rowEditInit', { row: added }]]);
    const customer = first.querySelector<HTMLInputElement>('[data-row-editor]')!;
    customer.value = 'Park Cafe';
    customer.dispatchEvent(new Event('input'));
    const quantity = first.querySelectorAll<HTMLInputElement>('[data-row-editor]')[2];
    quantity.value = '4';
    quantity.dispatchEvent(new Event('input'));
    key(customer, 'Enter');
    await stable();
    expect(host.log.at(-1)).toEqual([
      'rowAdd',
      { row: { id: 'ORD-9', status: 'Open', customer: 'Park Cafe', quantity: 4 } },
    ]);
    // The owner did not add it to value: the row is gone.
    expect(el.querySelectorAll('tbody tr.star-table__row').length).toBe(3);
  });

  it('drops a new row on cancel, and emits rowAdd at once in cell mode', async () => {
    const rowMode = await setup({ mode: 'row' });
    rowMode.host.table().addRow();
    await rowMode.stable();
    expect(rowMode.el.querySelectorAll('tbody tr.star-table__row').length).toBe(4);
    const editor = rowMode.el.querySelector<HTMLInputElement>('[data-row-editor]')!;
    key(editor, 'Escape');
    await rowMode.stable();
    expect(rowMode.el.querySelectorAll('tbody tr.star-table__row').length).toBe(3);
    expect(rowMode.names()).not.toContain('rowAdd');

    const cellMode = await setup();
    cellMode.host.table().addRow({ customer: 'Park Cafe' });
    expect(cellMode.host.log).toEqual([['rowAdd', { row: { customer: 'Park Cafe' } }]]);
  });

  it('emits rowDelete without batch edit', async () => {
    const { host } = await setup();
    host.table().deleteRow(ORDERS[1]);
    expect(host.log).toEqual([['rowDelete', { row: ORDERS[1] }]]);
  });
});

describe('StarTable batch edit', () => {
  it('collects cell edits, marks the cells and emits batchSave on commit', async () => {
    const { host, cell, stable, el, names, messages } = await setup({ batch: true });
    cell(0, 1).querySelector<HTMLButtonElement>('.star-table__edit')!.click();
    await stable();
    const editor = el.querySelector<HTMLInputElement>('input.star-table__editor')!;
    editor.value = 'East Office';
    key(editor, 'Enter');
    await stable();
    expect(names()).toEqual(['editInit']);
    expect(cell(0, 1).classList).toContain('star-table__cell--changed');
    const button = cell(0, 1).querySelector('.star-table__edit')!;
    expect(button.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'Edit Customer: East Office , changed',
    );
    expect(host.table().pendingChanges().updated).toEqual([
      {
        row: ORDERS[0],
        changes: { customer: 'East Office' },
        previous: { customer: 'North Office' },
      },
    ]);
    // The rows themselves do not change.
    expect(host.rows()[0].customer).toBe('North Office');
    host.table().commitEdits();
    await stable();
    expect(host.log.at(-1)).toEqual([
      'batchSave',
      {
        updated: [
          {
            row: ORDERS[0],
            changes: { customer: 'East Office' },
            previous: { customer: 'North Office' },
          },
        ],
        added: [],
        deleted: [],
      },
    ]);
    expect(host.table().canUndo()).toBe(false);
    expect(cell(0, 1).classList).not.toContain('star-table__cell--changed');
    expect(messages()).toContain('Changes saved.');
  });

  it('deletes rows as pending, struck through, and restores them with Ctrl+Z', async () => {
    const { host, row, stable, el, messages } = await setup({ batch: true });
    host.table().deleteRow(ORDERS[1]);
    await stable();
    expect(row(1).classList).toContain('star-table__row--deleted');
    expect(row(1).querySelector('.star-sr-only')?.textContent).toContain('deleted');
    expect(row(1).querySelector('.star-table__edit')).toBeNull();
    expect(host.log).toEqual([]);
    expect(host.table().pendingChanges().deleted).toEqual([ORDERS[1]]);

    const table = el.querySelector('star-table')!;
    const button = row(0).querySelector<HTMLElement>('.star-table__edit')!;
    key(button, 'z', { ctrlKey: true });
    await stable();
    expect(row(1).classList).not.toContain('star-table__row--deleted');
    expect(messages()).toContain('Change undone.');
    key(button, 'y', { ctrlKey: true });
    await stable();
    expect(row(1).classList).toContain('star-table__row--deleted');
    key(table, 'z', { ctrlKey: true });
    await stable();
    expect(row(1).classList).not.toContain('star-table__row--deleted');
    key(table, 'Z', { ctrlKey: true, shiftKey: true });
    await stable();
    expect(row(1).classList).toContain('star-table__row--deleted');
    expect(messages()).toContain('Change redone.');
    host.table().discardEdits();
    await stable();
    expect(row(1).classList).not.toContain('star-table__row--deleted');
    expect(host.table().canUndo()).toBe(false);
    expect(messages()).toContain('Changes discarded.');
  });

  it('keeps the text undo of an editor', async () => {
    const { host, cell, stable, el } = await setup({ batch: true });
    host.table().deleteRow(ORDERS[0]);
    cell(1, 1).querySelector<HTMLButtonElement>('.star-table__edit')!.click();
    await stable();
    const editor = el.querySelector<HTMLInputElement>('input.star-table__editor')!;
    const event = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    editor.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(host.table().pendingChanges().deleted).toEqual([ORDERS[0]]);
  });

  it('adds rows to the batch, in edit with row mode, and saves row edits as pending', async () => {
    const { host, el, stable, names, messages } = await setup({ batch: true, mode: 'row' });
    const added = host.table().addRow({ id: 'ORD-7' } as Partial<Order>);
    await stable();
    const rows = el.querySelectorAll<HTMLElement>('tbody tr.star-table__row');
    expect(rows.length).toBe(4);
    const editors = rows[3].querySelectorAll<HTMLInputElement>('[data-row-editor]');
    editors[0].value = 'Park Cafe';
    editors[0].dispatchEvent(new Event('input'));
    editors[2].value = '2';
    editors[2].dispatchEvent(new Event('input'));
    key(editors[0], 'Enter');
    await stable();
    expect(names()).toEqual(['rowEditInit']);
    expect(host.table().pendingChanges().added).toEqual([
      { id: 'ORD-7', customer: 'Park Cafe', quantity: 2 },
    ]);
    expect(messages()).toContain('Change added.');
    expect(messages()).not.toContain('Changes saved.');
    // Open the saved new row again, then undo its add: its edit ends with it.
    host.table().initRowEdit(added);
    await stable();
    expect(host.editingKeys()).toEqual(['ORD-7']);
    host.table().undo();
    await stable();
    expect(el.querySelectorAll('tbody tr.star-table__row').length).toBe(3);
    expect(host.editingKeys()).toEqual([]);
    expect(host.table().canUndo()).toBe(false);
  });

  it('does not keep a new row that was canceled before its first save (row mode)', async () => {
    const { host, el, stable } = await setup({ batch: true, mode: 'row' });
    host.table().addRow({ id: 'ORD-8' } as Partial<Order>);
    await stable();
    key(el.querySelector('[data-row-editor="ORD-8"]')!, 'Escape');
    await stable();
    expect(host.table().pendingChanges().added).toEqual([]);
    expect(host.table().canUndo()).toBe(false);
    expect(el.querySelectorAll('tbody tr.star-table__row').length).toBe(3);
  });

  it('checks the rows before commitEdits and opens the first invalid cell', async () => {
    const { host, el, stable, names, messages } = await setup({ batch: true });
    host.table().addRow({ id: 'ORD-8' } as Partial<Order>);
    await stable();
    host.table().commitEdits();
    await stable();
    expect(names()).not.toContain('batchSave');
    expect(messages()).toContain('Correct the errors, then save.');
    const editor = el.querySelector<HTMLInputElement>('input.star-table__editor')!;
    expect(editor.getAttribute('aria-label')).toBe('Edit Customer');
    expect(editor.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(editor);
    editor.value = 'Park Cafe';
    key(editor, 'Enter');
    await stable();
    host.table().commitEdits();
    await stable();
    expect(host.log.at(-1)).toEqual([
      'batchSave',
      { updated: [], added: [{ id: 'ORD-8', customer: 'Park Cafe' }], deleted: [] },
    ]);
  });

  it('closes the cell editor of a row that is deleted', async () => {
    const { host, cell, stable, el } = await setup({ batch: true });
    cell(0, 1).querySelector<HTMLButtonElement>('.star-table__edit')!.click();
    await stable();
    expect(el.querySelector('.star-table__editor')).not.toBeNull();
    host.table().deleteRow(ORDERS[0]);
    await stable();
    expect(el.querySelector('.star-table__editor')).toBeNull();
  });

  it('keeps Ctrl+Z for the batch on a checkbox', async () => {
    const { host, cell, stable } = await setup({ batch: true });
    host.table().deleteRow(ORDERS[0]);
    await stable();
    const box = document.createElement('input');
    box.type = 'checkbox';
    cell(1, 0).append(box);
    key(box, 'z', { ctrlKey: true });
    await stable();
    expect(host.table().pendingChanges().deleted).toEqual([]);
  });
});

describe('StarTable edit fixes', () => {
  it('finds the controls of the right row without dataKey', async () => {
    const { host, row, stable } = await setup({ mode: 'row', keyed: false });
    host.table().initRowEdit(host.rows()[1]);
    await stable();
    expect(row(1).querySelectorAll('[data-row-editor]').length).toBe(3);
    expect(row(0).querySelectorAll('[data-row-editor]').length).toBe(0);
    expect(document.activeElement).toBe(row(1).querySelector('[data-row-editor]'));
    key(row(1).querySelector('[data-row-editor]')!, 'Escape');
    await stable();
    expect(document.activeElement).toBe(row(1).querySelector('[data-row-edit]'));
    const ids = [0, 1, 2].map((i) =>
      row(i).querySelector('[data-row-edit]')!.getAttribute('data-row-edit'),
    );
    expect(new Set(ids).size).toBe(3);
  });

  it('keeps two new rows without a key apart', async () => {
    const { host, el, stable } = await setup({ mode: 'row' });
    const first = host.table().addRow();
    const second = host.table().addRow();
    await stable();
    const editors = [...el.querySelectorAll<HTMLElement>('[data-row-editor]')];
    const owners = new Set(editors.map((editor) => editor.getAttribute('data-row-editor')));
    expect(owners.size).toBe(2);
    host.table().cancelRowEdit(first);
    await stable();
    expect(el.querySelectorAll('[data-row-editor]').length).toBe(3);
    host.table().cancelRowEdit(second);
  });

  it('opens one cell editor for one of two new rows without a key (batch, cell mode)', async () => {
    const { host, el, stable } = await setup({ batch: true });
    host.table().addRow();
    host.table().addRow();
    await stable();
    el.querySelector<HTMLButtonElement>('tbody tr:nth-child(4) .star-table__edit')!.click();
    await stable();
    expect(el.querySelectorAll('.star-table__editor').length).toBe(1);
  });

  it('shows a message for text that is not a number and keeps the typed text', async () => {
    const { host, row, stable, el } = await setup({ mode: 'row' });
    host.table().initRowEdit(ORDERS[0]);
    await stable();
    const quantity = row(0).querySelectorAll<HTMLInputElement>('[data-row-editor]')[2];
    const setter = vi.fn();
    Object.defineProperty(quantity, 'validity', { value: { badInput: true } });
    Object.defineProperty(quantity, 'value', { get: () => '', set: setter, configurable: true });
    quantity.dispatchEvent(new Event('input'));
    await stable();
    expect(el.querySelector('.star-table__error')?.textContent?.trim()).toBe('Enter a number.');
    expect(quantity.getAttribute('aria-invalid')).toBe('true');
    // The table does not write the editor value back while the user types.
    expect(setter).not.toHaveBeenCalled();
  });

  it('does not block Save on a hidden column', async () => {
    const rows = [{ ...ORDERS[0], customer: '' }, ...ORDERS.slice(1)];
    const { host, stable } = await setup({ mode: 'row', rows });
    host.hidden.set(['customer']);
    await stable();
    host.table().initRowEdit(rows[0]);
    await stable();
    host.table().saveRowEdit(rows[0]);
    expect(host.log.at(-1)?.[0]).toBe('rowEditSave');
  });

  it('clears the draft of a row that the owner takes out of edit', async () => {
    const { host, row, stable } = await setup({ mode: 'row' });
    host.table().initRowEdit(ORDERS[0]);
    await stable();
    const editor = row(0).querySelector<HTMLInputElement>('[data-row-editor]')!;
    editor.value = 'Changed';
    editor.dispatchEvent(new Event('input'));
    host.editingKeys.set([]);
    await stable();
    host.editingKeys.set(['ORD-1']);
    await stable();
    host.table().saveRowEdit(ORDERS[0]);
    expect(host.log.at(-1)).toEqual(['rowEditSave', { row: ORDERS[0], changes: {}, previous: {} }]);
  });

  it('cannot move a new row', async () => {
    const { host, row, stable } = await setup({ mode: 'row', reorder: true });
    host.table().addRow({ id: 'ORD-9' } as Partial<Order>);
    await stable();
    const moves = row(3).querySelectorAll<HTMLButtonElement>('.star-table__reorder button');
    expect(moves.length).toBe(2);
    expect([...moves].every((button) => button.disabled)).toBe(true);
  });
});
