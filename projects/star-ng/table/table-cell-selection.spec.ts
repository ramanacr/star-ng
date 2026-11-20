import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarColumn, StarTable } from './table';
import { StarTableCellRef } from './table-navigation';

interface Stock {
  sku: string;
  name: string;
  stock: number;
  city: string;
}

const STOCK: Stock[] = Array.from({ length: 6 }, (_, i) => ({
  sku: `SKU-${i + 1}`,
  name: `Item ${i + 1}`,
  stock: i * 3,
  city: ['Oslo', 'Lima', 'Perth'][i % 3],
}));

@Component({
  imports: [StarTable],
  template: `<star-table
    [value]="rows"
    [columns]="columns"
    dataKey="sku"
    ariaLabel="Stock"
    [selectionMode]="mode()"
    [reorderableRows]="reorder()"
    [pinnedColumns]="pins()"
    [(cellSelection)]="cells"
  />`,
})
class RangeHost {
  readonly rows = STOCK;
  readonly mode = signal<'cell' | 'range'>('range');
  readonly reorder = signal(false);
  readonly pins = signal({});
  readonly cells = signal<readonly StarTableCellRef[]>([]);
  readonly columns: StarColumn<Stock>[] = [
    { field: 'sku', header: 'SKU' },
    { field: 'name', header: 'Name' },
    { field: 'stock', header: 'Stock' },
    { field: 'city', header: 'City' },
  ];
}

async function setup(change: (host: RangeHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(RangeHost);
  change(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  document.body.append(el);
  const cell = (row: number, field: string) =>
    el.querySelector<HTMLElement>(`tbody tr[data-row="SKU-${row}"] td[data-field="${field}"]`)!;
  const click = async (row: number, field: string, init: MouseEventInit = {}) => {
    const target = cell(row, field);
    // As in a browser: a mousedown that the table prevents does not move the focus.
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(down);
    if (!down.defaultPrevented) target.focus();
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }));
    await fixture.whenStable();
  };
  const press = async (key: string, init: KeyboardEventInit = {}) => {
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
    );
    await fixture.whenStable();
  };
  const selected = () =>
    fixture.componentInstance.cells().map((item) => `${String(item.rowKey)}|${item.field}`);
  return { fixture, el, host: fixture.componentInstance, cell, click, press, selected };
}

describe('StarTable cell and range selection', () => {
  afterEach(() => document.body.replaceChildren());

  it('turns on cell navigation without a selection column', async () => {
    const { el } = await setup();
    const table = el.querySelector('table')!;
    expect(table.getAttribute('role')).toBe('grid');
    expect(table.getAttribute('aria-multiselectable')).toBe('true');
    expect(el.querySelector('.star-table__select')).toBeNull();
    expect(el.querySelector('tbody td[data-field]')!.getAttribute('aria-selected')).toBe('false');
  });

  it('selects a rectangle with a click and Shift + click, across pinned columns', async () => {
    const { click, selected, cell } = await setup((host) => host.pins.set({ city: 'start' }));
    await click(2, 'city');
    expect(selected()).toEqual(['SKU-2|city']);
    expect(cell(2, 'city').classList).toContain('star-table__cell--selected');
    expect(cell(2, 'city').getAttribute('aria-selected')).toBe('true');

    // Display order: city (pinned), sku, name, stock.
    const shift = new MouseEvent('mousedown', { bubbles: true, cancelable: true, shiftKey: true });
    cell(3, 'name').dispatchEvent(shift);
    expect(shift.defaultPrevented).toBe(true);
    await click(3, 'name', { shiftKey: true });
    expect(selected()).toEqual([
      'SKU-2|city',
      'SKU-2|sku',
      'SKU-2|name',
      'SKU-3|city',
      'SKU-3|sku',
      'SKU-3|name',
    ]);
    expect(document.activeElement).toBe(cell(3, 'name'));

    // Ctrl + click adds or removes one cell; it becomes the new anchor.
    await click(6, 'stock', { ctrlKey: true });
    expect(selected()).toContain('SKU-6|stock');
    await click(2, 'sku', { ctrlKey: true });
    expect(selected()).not.toContain('SKU-2|sku');
  });

  it('stretches a range with Shift + Arrow keys from the anchor', async () => {
    const { cell, press, selected } = await setup();
    cell(1, 'sku').focus();
    await press(' ');
    expect(selected()).toEqual(['SKU-1|sku']);
    await press('ArrowDown', { shiftKey: true });
    await press('ArrowRight', { shiftKey: true });
    expect(selected()).toEqual(['SKU-1|sku', 'SKU-1|name', 'SKU-2|sku', 'SKU-2|name']);
    await press('ArrowUp', { shiftKey: true });
    expect(selected()).toEqual(['SKU-1|sku', 'SKU-1|name']);
    await press('End', { shiftKey: true });
    expect(selected()).toEqual(['SKU-1|sku', 'SKU-1|name', 'SKU-1|stock', 'SKU-1|city']);

    // A plain move keeps the selection and moves the anchor.
    await press('ArrowDown');
    expect(selected()).toHaveLength(4);
    await press('ArrowDown', { shiftKey: true });
    expect(selected()).toEqual(['SKU-2|city', 'SKU-3|city']);
  });

  it('selects one cell at a time in cell mode', async () => {
    const { click, press, selected, el } = await setup((host) => host.mode.set('cell'));
    expect(el.querySelector('table')!.getAttribute('aria-multiselectable')).toBeNull();
    await click(1, 'name');
    await click(4, 'stock', { shiftKey: true });
    expect(selected()).toEqual(['SKU-4|stock']);
    await click(4, 'stock', { ctrlKey: true });
    expect(selected()).toEqual([]);
    await press('ArrowDown', { shiftKey: true });
    expect(selected()).toEqual([]);
    await press(' ');
    expect(selected()).toEqual(['SKU-4|stock']);
  });

  it('starts a range at the first data cell after a lead cell', async () => {
    const { fixture, el, press, selected } = await setup((h) => h.reorder.set(true));
    el.querySelector<HTMLElement>('tbody tr[data-row="SKU-2"] td[data-field="$reorder"]')!.focus();
    await fixture.whenStable();
    await press('ArrowRight', { shiftKey: true });
    await press('ArrowRight', { shiftKey: true });
    await press('ArrowDown', { shiftKey: true });
    expect(selected()).toEqual(['SKU-2|sku', 'SKU-2|name', 'SKU-3|sku', 'SKU-3|name']);
  });

  it('starts a range at the cell that got the focus (Tab in, focusCell)', async () => {
    const { fixture, host, cell, press, selected } = await setup();
    // Tab into the grid: the focus lands on a cell without a click or Space.
    cell(1, 'sku').focus();
    await fixture.whenStable();
    await press('ArrowRight', { shiftKey: true });
    await press('ArrowRight', { shiftKey: true });
    expect(selected()).toEqual(['SKU-1|sku', 'SKU-1|name', 'SKU-1|stock']);

    const table = fixture.debugElement.children[0].componentInstance as {
      focusCell(key: unknown, field: string): boolean;
    };
    expect(table.focusCell('SKU-4', 'city')).toBe(true);
    await fixture.whenStable();
    await press('ArrowDown', { shiftKey: true });
    expect(selected()).toEqual(['SKU-4|city', 'SKU-5|city']);
    expect(host.cells()).toHaveLength(2);
  });

  it('shows the selection that the owner sets', async () => {
    const { fixture, host, cell } = await setup();
    host.cells.set([{ rowKey: 'SKU-5', field: 'city' }]);
    await fixture.whenStable();
    expect(cell(5, 'city').classList).toContain('star-table__cell--selected');
    expect(cell(5, 'name').classList).not.toContain('star-table__cell--selected');
  });
});
