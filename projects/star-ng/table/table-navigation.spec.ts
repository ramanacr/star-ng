import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarColumn, StarTable } from './table';
import {
  alignedOffset,
  cellNavigationTarget,
  columnScrollOffset,
  StarTableCellRef,
  uncoveredRow,
} from './table-navigation';

describe('cellNavigationTarget', () => {
  const key = (name: string, ctrl = false) => ({ key: name, ctrlKey: ctrl, metaKey: false });
  const at = { row: 2, col: 1 };

  it('moves one cell with the arrow keys and stops at the edges', () => {
    expect(cellNavigationTarget(key('ArrowUp'), at, 5, 3, 2)).toEqual({ row: 1, col: 1 });
    expect(cellNavigationTarget(key('ArrowDown'), at, 5, 3, 2)).toEqual({ row: 3, col: 1 });
    expect(cellNavigationTarget(key('ArrowLeft'), at, 5, 3, 2)).toEqual({ row: 2, col: 0 });
    expect(cellNavigationTarget(key('ArrowRight'), at, 5, 3, 2)).toEqual({ row: 2, col: 2 });
    const corner = { row: 0, col: 0 };
    expect(cellNavigationTarget(key('ArrowUp'), corner, 5, 3, 2)).toEqual(corner);
    expect(cellNavigationTarget(key('ArrowLeft'), corner, 5, 3, 2)).toEqual(corner);
  });

  it('goes to the row ends with Home / End and to the grid corners with Ctrl', () => {
    expect(cellNavigationTarget(key('Home'), at, 5, 3, 2)).toEqual({ row: 2, col: 0 });
    expect(cellNavigationTarget(key('End'), at, 5, 3, 2)).toEqual({ row: 2, col: 2 });
    expect(cellNavigationTarget(key('Home', true), at, 5, 3, 2)).toEqual({ row: 0, col: 0 });
    expect(cellNavigationTarget(key('End', true), at, 5, 3, 2)).toEqual({ row: 4, col: 2 });
    expect(
      cellNavigationTarget({ key: 'End', ctrlKey: false, metaKey: true }, at, 5, 3, 2),
    ).toEqual({ row: 4, col: 2 });
  });

  it('moves by a page and clamps', () => {
    expect(cellNavigationTarget(key('PageDown'), at, 5, 3, 2)).toEqual({ row: 4, col: 1 });
    expect(cellNavigationTarget(key('PageDown'), at, 50, 3, 10)).toEqual({ row: 12, col: 1 });
    expect(cellNavigationTarget(key('PageUp'), at, 50, 3, 10)).toEqual({ row: 0, col: 1 });
  });

  it('ignores other keys and empty grids', () => {
    expect(cellNavigationTarget(key('a'), at, 5, 3, 2)).toBeNull();
    expect(cellNavigationTarget(key('ArrowUp'), at, 0, 3, 2)).toBeNull();
  });
});

describe('table scroll math', () => {
  it('aligns a span in a view', () => {
    // In view: no move.
    expect(alignedOffset(100, 40, 200, 80)).toBe(80);
    // Above: its start; below: its end at the bottom.
    expect(alignedOffset(40, 40, 200, 80)).toBe(40);
    expect(alignedOffset(300, 40, 200, 80)).toBe(140);
    expect(alignedOffset(300, 40, 200, 80, 'start')).toBe(300);
    expect(alignedOffset(300, 40, 200, 80, 'center')).toBe(220);
    expect(alignedOffset(300, 40, 200, 80, 'end')).toBe(140);
    expect(alignedOffset(10, 40, 200, 80, 'center')).toBe(0);
  });

  it('gives the scroll offset of a virtual column', () => {
    const widths = [100, 100, 100, 100, 100];
    expect(columnScrollOffset(widths, 4, 0, 250)).toBe(250);
    expect(columnScrollOffset(widths, 0, 250, 250)).toBe(0);
    expect(columnScrollOffset(widths, 3, 0, 250, 'start')).toBe(300);
  });

  it('skips the rows that a merged cell covers', () => {
    // Rows 0-2 merge, rows 3-4 merge.
    const spans = [3, 0, 0, 2, 0];
    const spanAt = (row: number) => spans[row];
    expect(uncoveredRow(1, 1, 5, spanAt)).toBe(3);
    expect(uncoveredRow(2, -1, 5, spanAt)).toBe(0);
    expect(uncoveredRow(4, 1, 5, spanAt)).toBe(3);
    expect(uncoveredRow(3, 1, 5, spanAt)).toBe(3);
  });
});

interface Item {
  sku: string;
  name: string;
  stock: number;
  city: string;
}

const ITEMS: Item[] = Array.from({ length: 30 }, (_, i) => ({
  sku: `SKU-${i + 1}`,
  name: `Item ${i + 1}`,
  stock: (i * 7) % 40,
  city: i < 15 ? 'Oslo' : 'Lima',
}));

@Component({
  imports: [StarTable],
  template: `<div [attr.dir]="dir()">
    <star-table
      [value]="rows()"
      [columns]="columns()"
      dataKey="sku"
      ariaLabel="Inventory"
      [cellNavigation]="nav()"
      [pinnedColumns]="pins()"
      [groupBy]="merged() ? 'city' : null"
      [rowGroupMode]="merged() ? 'rowspan' : 'subheader'"
      (activeCellChange)="changes.push($event)"
      (cellEdit)="edits.push($event.value)"
    />
  </div>`,
})
class NavHost {
  readonly table = viewChild.required<StarTable<Item>>(StarTable);
  readonly rows = signal(ITEMS);
  readonly nav = signal<boolean | undefined>(true);
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  readonly merged = signal(false);
  readonly pins = signal({});
  readonly columns = signal<StarColumn<Item>[]>([
    { field: 'sku', header: 'SKU' },
    { field: 'name', header: 'Name' },
    { field: 'stock', header: 'Stock', editable: false },
    { field: 'city', header: 'City' },
  ]);
  readonly changes: (StarTableCellRef | null)[] = [];
  readonly edits: unknown[] = [];
}

async function setupNav(change: (host: NavHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(NavHost);
  change(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const cell = (row: number, field: string) =>
    el.querySelector<HTMLElement>(`tbody tr[data-row="SKU-${row}"] td[data-field="${field}"]`)!;
  const focused = () => {
    const active = document.activeElement as HTMLElement;
    const td = active.closest<HTMLElement>('td[data-field]');
    return td ? `${td.parentElement!.dataset['row']}|${td.dataset['field']}` : active.tagName;
  };
  const press = async (key: string, init: KeyboardEventInit = {}) => {
    const target = document.activeElement as HTMLElement;
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
    await fixture.whenStable();
  };
  return { fixture, el, host: fixture.componentInstance, cell, focused, press };
}

describe('StarTable cell navigation', () => {
  afterEach(() => document.body.replaceChildren());

  it('is off without editable columns and on with them (automatic)', async () => {
    const { fixture, el, host } = await setupNav((h) => h.nav.set(undefined));
    document.body.append(el);
    expect(el.querySelector('table')!.getAttribute('role')).toBeNull();
    expect(el.querySelector('tbody td[tabindex]')).toBeNull();

    host.columns.update((columns) =>
      columns.map((column) => (column.field === 'name' ? { ...column, editable: true } : column)),
    );
    await fixture.whenStable();
    expect(el.querySelector('table')!.getAttribute('role')).toBe('grid');
    // One tab stop: the first cell. The edit buttons take the focus of their cells.
    const stops = el.querySelectorAll('tbody [tabindex="0"]');
    expect(stops.length).toBe(1);
    expect((stops[0] as HTMLElement).dataset['field']).toBe('sku');
    expect(el.querySelector('tbody .star-table__edit')!.getAttribute('tabindex')).toBe('-1');
  });

  it('moves between cells with the arrow, Home, End and page keys', async () => {
    const { el, cell, focused, press, host } = await setupNav();
    document.body.append(el);
    cell(1, 'sku').focus();
    expect(host.table().activeCell()).toEqual({ rowKey: 'SKU-1', field: 'sku' });

    await press('ArrowRight');
    expect(focused()).toBe('SKU-1|name');
    await press('ArrowDown');
    expect(focused()).toBe('SKU-2|name');
    await press('End');
    expect(focused()).toBe('SKU-2|city');
    await press('ArrowRight');
    expect(focused()).toBe('SKU-2|city');
    await press('Home');
    expect(focused()).toBe('SKU-2|sku');
    await press('End', { ctrlKey: true });
    expect(focused()).toBe('SKU-30|city');
    await press('Home', { ctrlKey: true });
    expect(focused()).toBe('SKU-1|sku');
    // Without a measured view a page is ten rows.
    await press('PageDown');
    expect(focused()).toBe('SKU-11|sku');
    await press('PageUp');
    expect(focused()).toBe('SKU-1|sku');

    // The tab stop follows the active cell.
    await press('ArrowDown');
    expect(cell(2, 'sku').getAttribute('tabindex')).toBe('0');
    expect(cell(1, 'sku').getAttribute('tabindex')).toBe('-1');
    expect(host.changes.at(-1)).toEqual({ rowKey: 'SKU-2', field: 'sku' });
  });

  it('mirrors Left and Right in right-to-left', async () => {
    const { el, cell, focused, press } = await setupNav((h) => h.dir.set('rtl'));
    document.body.append(el);
    cell(1, 'name').focus();
    await press('ArrowLeft');
    expect(focused()).toBe('SKU-1|stock');
    await press('ArrowRight');
    expect(focused()).toBe('SKU-1|name');
  });

  it('follows the display order with pinned columns', async () => {
    const { el, cell, focused, press } = await setupNav((h) =>
      h.pins.set({ sku: 'end', city: 'start' }),
    );
    document.body.append(el);
    cell(1, 'city').focus();
    await press('ArrowRight');
    expect(focused()).toBe('SKU-1|name');
    await press('End');
    expect(focused()).toBe('SKU-1|sku');
    await press('Home');
    expect(focused()).toBe('SKU-1|city');
  });

  it('maps a move with no vertical step to the cell that covers the target', () => {
    const spans = [3, 0, 0, 2, 0];
    const spanAt = (row: number) => spans[row];
    expect(uncoveredRow(2, 0, 5, spanAt)).toBe(0);
    expect(uncoveredRow(4, 0, 5, spanAt)).toBe(3);
  });

  it('skips the rows that a merged cell covers', async () => {
    const { el, cell, focused, press } = await setupNav((h) => h.merged.set(true));
    document.body.append(el);
    cell(1, 'city').focus();
    await press('ArrowDown');
    expect(focused()).toBe('SKU-16|city');
    await press('ArrowUp');
    expect(focused()).toBe('SKU-1|city');
    await press('ArrowRight');
    expect(focused()).toBe('SKU-1|city');
    await press('ArrowLeft');
    await press('ArrowDown');
    expect(focused()).toBe('SKU-2|stock');
    // A move to the side into a covered cell lands on the merged cell above it.
    await press('ArrowDown');
    await press('ArrowRight');
    expect(focused()).toBe('SKU-1|city');
    await press('ArrowLeft');
    await press('ArrowDown');
    await press('ArrowDown');
    await press('Home');
    await press('End');
    expect(focused()).toBe('SKU-1|city');
  });

  it('starts an edit with Enter or F2 and goes back to the cell with Escape', async () => {
    const { fixture, el, host, focused, press } = await setupNav((h) =>
      h.columns.update((columns) =>
        columns.map((column) => (column.field === 'name' ? { ...column, editable: true } : column)),
      ),
    );
    document.body.append(el);
    const button = () =>
      el.querySelector<HTMLElement>(
        'tr[data-row="SKU-3"] td[data-field="name"] .star-table__edit',
      )!;
    button().focus();
    await fixture.whenStable();
    expect(host.table().activeCell()).toEqual({ rowKey: 'SKU-3', field: 'name' });
    expect(button().getAttribute('tabindex')).toBe('0');

    await press('F2');
    const editor = el.querySelector<HTMLInputElement>('.star-table__editor')!;
    expect(document.activeElement).toBe(editor);
    // Keys in the editor stay in the editor.
    await press('ArrowDown');
    expect(document.activeElement).toBe(editor);
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(focused()).toBe('SKU-3|name');

    await press('Enter');
    const second = el.querySelector<HTMLInputElement>('.star-table__editor')!;
    second.value = 'Renamed';
    second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();
    expect(host.edits).toEqual(['Renamed']);
    expect(focused()).toBe('SKU-3|name');
    await press('ArrowRight');
    expect(focused()).toBe('SKU-3|stock');
    // Enter on a cell that is not editable does nothing.
    await press('Enter');
    expect(el.querySelector('.star-table__editor')).toBeNull();
  });

  it('keeps the row keys when cell navigation is off', async () => {
    const { el } = await setupNav((h) => h.nav.set(false));
    expect(el.querySelector('tbody td[data-field]')).toBeNull();
    expect(el.querySelector('table')!.getAttribute('role')).toBeNull();
  });
});

type Metric = Record<string, number | string>;

@Component({
  imports: [StarTable],
  template: `<star-table
    [value]="rows"
    [columns]="columns"
    dataKey="id"
    cellNavigation
    virtualColumns
    virtualScroll
    [virtualRowHeight]="40"
    scrollHeight="300px"
    ariaLabel="Metrics"
  />`,
})
class WideNavHost {
  readonly table = viewChild.required<StarTable<Metric>>(StarTable);
  readonly rows: Metric[] = Array.from({ length: 400 }, (_, row) => {
    const values: Metric = { id: row + 1 };
    for (let i = 1; i <= 40; i++) values[`m${i}`] = row * 100 + i;
    return values;
  });
  readonly columns: StarColumn<Metric>[] = [
    { field: 'id', header: 'Row', pinned: 'start', width: '80px' },
    ...Array.from({ length: 40 }, (_, i) => ({
      field: `m${i + 1}`,
      header: `Metric ${i + 1}`,
      width: '100px',
    })),
  ];
}

describe('StarTable cell navigation with virtual rows and columns', () => {
  afterEach(() => document.body.replaceChildren());

  it('scrolls a column and a row into the window before it focuses the cell', async () => {
    const fixture = TestBed.createComponent(WideNavHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    document.body.append(el);
    const scroller = el.querySelector<HTMLElement>('.star-table__scroll')!;
    const first = el.querySelector<HTMLElement>('tbody tr[data-row="1"] td[data-field="id"]')!;
    first.focus();
    expect(el.querySelector('thead th[data-field="m40"]')).toBeNull();

    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', ctrlKey: true, bubbles: true }),
    );
    await fixture.whenStable();
    const active = document.activeElement as HTMLElement;
    expect(active.dataset['field']).toBe('m40');
    expect(active.parentElement!.dataset['row']).toBe('400');
    expect(scroller.scrollLeft).toBeGreaterThan(0);
    expect(scroller.scrollTop).toBeGreaterThan(0);
    expect(fixture.componentInstance.table().activeCell()).toEqual({ rowKey: 400, field: 'm40' });
  }, 20_000);
});
