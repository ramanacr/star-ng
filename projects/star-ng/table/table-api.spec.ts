import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarColumn, StarTable } from './table';
import { revealDelta, StarTableCellRef } from './table-navigation';

describe('revealDelta', () => {
  it('scrolls the least, or aligns the start, the center or the end', () => {
    expect(revealDelta(50, 40, 200)).toBe(0);
    expect(revealDelta(-30, 40, 200)).toBe(-30);
    expect(revealDelta(190, 40, 200)).toBe(30);
    expect(revealDelta(190, 400, 200)).toBe(190);
    expect(revealDelta(190, 40, 200, 'start')).toBe(190);
    expect(revealDelta(190, 40, 200, 'center')).toBe(110);
    expect(revealDelta(190, 40, 200, 'end')).toBe(30);
  });
});

interface Stock {
  sku: string;
  name: string;
  qty: number;
}

const STOCK: Stock[] = Array.from({ length: 23 }, (_, i) => ({
  sku: `S-${i + 1}`,
  name: `Part ${i + 1}`,
  qty: i,
}));

@Component({
  imports: [StarTable],
  template: `<star-table
    [value]="rows"
    [columns]="columns"
    dataKey="sku"
    ariaLabel="Stock"
    cellNavigation
    paginator
    [rows]="5"
    [(first)]="first"
    [hiddenColumns]="hidden()"
    scrollHeight="200px"
    (activeCellChange)="changes.push($event)"
  />`,
})
class PagedHost {
  readonly table = viewChild.required<StarTable<Stock>>(StarTable);
  readonly rows = STOCK;
  readonly first = signal(0);
  readonly hidden = signal<readonly string[]>(['qty']);
  readonly changes: (StarTableCellRef | null)[] = [];
  readonly columns: StarColumn<Stock>[] = [
    { field: 'sku', header: 'SKU' },
    { field: 'name', header: 'Name' },
    { field: 'qty', header: 'Quantity' },
  ];
}

describe('StarTable keyboard and scroll API', () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.documentElement.removeAttribute('data-star-motion');
  });

  async function paged() {
    const fixture = TestBed.createComponent(PagedHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    document.body.append(el);
    return {
      fixture,
      el,
      host: fixture.componentInstance,
      table: fixture.componentInstance.table(),
    };
  }

  it('focusCell opens the page of the row and focuses the cell', async () => {
    const { fixture, host, table } = await paged();
    expect(table.focusCell('S-13', 'name')).toBe(true);
    await fixture.whenStable();
    expect(host.first()).toBe(10);
    const active = document.activeElement as HTMLElement;
    expect(active.dataset['field']).toBe('name');
    expect(active.parentElement!.dataset['row']).toBe('S-13');
    expect(table.activeCell()).toEqual({ rowKey: 'S-13', field: 'name' });
    expect(host.changes).toEqual([{ rowKey: 'S-13', field: 'name' }]);
    // Unknown rows and hidden columns.
    expect(table.focusCell('S-99', 'name')).toBe(false);
    expect(table.focusCell('S-1', 'qty')).toBe(false);
  });

  it('navigateTo takes the row index over all pages and keeps the active column', async () => {
    const { fixture, host, table } = await paged();
    table.navigateTo(21, 'sku');
    await fixture.whenStable();
    expect(host.first()).toBe(20);
    expect(table.activeCell()).toEqual({ rowKey: 'S-22', field: 'sku' });
    table.navigateTo(2);
    await fixture.whenStable();
    expect(table.activeCell()).toEqual({ rowKey: 'S-3', field: 'sku' });
    expect(table.navigateTo(99)).toBe(false);
  });

  it('scrollToRow aligns the row smoothly, or at once with reduced motion', async () => {
    window.matchMedia = vi.fn(() => ({ matches: false })) as unknown as typeof window.matchMedia;
    const { fixture, el, host, table } = await paged();
    const scroller = el.querySelector<HTMLElement>('.star-table__scroll')!;
    const scrollTo = vi.fn();
    scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo;
    Object.defineProperty(scroller, 'clientHeight', { value: 200 });
    const rect = (top: number, height: number) =>
      ({ top, bottom: top + height, height, left: 0, right: 300, width: 300 }) as DOMRect;
    scroller.getBoundingClientRect = () => rect(0, 200);
    const row = () => el.querySelector<HTMLElement>('tbody tr[data-row="S-9"]')!;

    expect(table.scrollToRow('S-9', { align: 'start' })).toBe(true);
    await fixture.whenStable();
    expect(host.first()).toBe(5);
    row().getBoundingClientRect = () => rect(260, 40);
    table.scrollToRow('S-9', { align: 'start' });
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 260, behavior: 'smooth' });
    table.scrollToRow('S-9');
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 100, behavior: 'smooth' });

    document.documentElement.setAttribute('data-star-motion', 'reduced');
    table.scrollToRow(8, { align: 'center' });
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 180, behavior: 'auto' });
    expect(table.scrollToRow('S-404')).toBe(false);
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
class WideHost {
  readonly table = viewChild.required<StarTable<Metric>>(StarTable);
  readonly rows: Metric[] = Array.from({ length: 300 }, (_, row) => {
    const values: Metric = { id: row + 1 };
    for (let i = 1; i <= 30; i++) values[`m${i}`] = row * 100 + i;
    return values;
  });
  readonly columns: StarColumn<Metric>[] = [
    { field: 'id', header: 'Row', pinned: 'start', width: '80px' },
    ...Array.from({ length: 30 }, (_, i) => ({
      field: `m${i + 1}`,
      header: `Metric ${i + 1}`,
      width: '100px',
    })),
  ];
}

describe('StarTable scroll API with virtual rows and columns', () => {
  afterEach(() => document.body.replaceChildren());

  it('renders the row and the column first, then focuses the cell', async () => {
    const fixture = TestBed.createComponent(WideHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    document.body.append(el);
    const table = fixture.componentInstance.table();
    const scroller = el.querySelector<HTMLElement>('.star-table__scroll')!;

    expect(table.scrollToRow(250)).toBe(true);
    await fixture.whenStable();
    expect(el.querySelector('tbody tr[data-row="250"]')).not.toBeNull();
    expect(scroller.scrollTop).toBeGreaterThan(0);

    expect(table.scrollToColumn('m28')).toBe(true);
    await fixture.whenStable();
    expect(el.querySelector('thead th[data-field="m28"]')).not.toBeNull();
    expect(scroller.scrollLeft).toBeGreaterThan(0);
    // A pinned column is always in view.
    expect(table.scrollToColumn('id')).toBe(true);
    expect(table.scrollToColumn('nope')).toBe(false);

    expect(table.focusCell(20, 'm2')).toBe(true);
    await fixture.whenStable();
    const active = document.activeElement as HTMLElement;
    expect(active.dataset['field']).toBe('m2');
    expect(active.parentElement!.dataset['row']).toBe('20');
  }, 20_000);
});
