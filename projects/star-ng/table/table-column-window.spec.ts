import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarColumn, StarTable } from './table';
import { StarColumnGroup } from './table-column-groups';
import { columnWindow, cssPixels, sameWindow } from './table-column-window';

interface Col {
  readonly field: string;
  readonly pin?: boolean;
}

const COLUMNS: Col[] = [
  { field: 'id', pin: true },
  ...Array.from({ length: 20 }, (_, i) => ({ field: `m${i + 1}` })),
  { field: 'total', pin: true },
];

const window = (scroll: number, viewport = 500, buffer = 1) =>
  columnWindow({
    columns: COLUMNS,
    isPinned: (column) => !!column.pin,
    widthOf: (column) => (column.pin ? 50 : 100),
    scroll,
    viewport,
    fixed: 0,
    buffer,
  });

describe('columnWindow', () => {
  it('renders the pinned columns and the unpinned columns in view plus the buffer', () => {
    // 500 - 100 pinned = 400 px of unpinned view: m1 to m4, plus one buffer column.
    const start = window(0);
    expect(start.columns.map((column) => column.field)).toEqual([
      'id',
      'm1',
      'm2',
      'm3',
      'm4',
      'm5',
      'total',
    ]);
    expect(start.before).toBe(0);
    expect(start.first).toBeNull();
    expect(start.after).toBe(15 * 100);
    expect(start.last?.field).toBe('m5');
  });

  it('moves the window with the scroll offset and keeps the total width', () => {
    const middle = window(1050);
    // In view: m11 (from 1000) to m15 (starts at 1400 < 1450); buffer m10 and m16.
    expect(middle.columns.map((column) => column.field)).toEqual([
      'id',
      'm10',
      'm11',
      'm12',
      'm13',
      'm14',
      'm15',
      'm16',
      'total',
    ]);
    expect(middle.before).toBe(900);
    expect(middle.after).toBe(400);
    expect(middle.first?.field).toBe('m10');
    const rendered = middle.columns.filter((column) => !column.pin).length * 100;
    expect(middle.before + rendered + middle.after).toBe(2000);
  });

  it('clamps an offset past the end to the last columns', () => {
    const end = window(99_999);
    expect(end.after).toBe(0);
    expect(end.last).toBeNull();
    expect(end.columns.at(-2)?.field).toBe('m20');
  });

  it('compares two windows by their columns and spacers', () => {
    expect(sameWindow(window(1050), window(1060))).toBe(true);
    expect(sameWindow(window(1050), window(1150))).toBe(false);
  });

  it('reads px and rem widths', () => {
    expect(cssPixels('120px')).toBe(120);
    expect(cssPixels('7.5rem')).toBe(120);
    expect(cssPixels('20%')).toBeNull();
    expect(cssPixels(undefined)).toBeNull();
  });
});

type Metric = Record<string, number | string>;

@Component({
  imports: [StarTable],
  template: `<star-table
    [value]="rows"
    [columns]="columns"
    [columnGroups]="groups()"
    [loading]="loading()"
    [groupBy]="grouped() ? 'group' : null"
    groupSummary
    dataKey="id"
    selectionMode="multiple"
    virtualColumns
    [virtualScroll]="!grouped()"
    [virtualRowHeight]="40"
    scrollHeight="300px"
    ariaLabel="Metrics"
  />`,
})
class WideHost {
  readonly rows: Metric[] = Array.from({ length: 50 }, (_, row) => {
    const values: Metric = { id: row + 1, group: 'All' };
    for (let i = 1; i <= 60; i++) values[`m${i}`] = row * 100 + i;
    return values;
  });
  readonly columns: StarColumn<Metric>[] = [
    { field: 'id', header: 'Row', pinned: 'start', width: '80px' },
    ...Array.from({ length: 60 }, (_, i) => ({
      field: `m${i + 1}`,
      header: `Metric ${i + 1}`,
      width: '100px',
      summary: 'sum' as const,
    })),
  ];
  readonly groups = signal<readonly StarColumnGroup[]>([]);
  readonly loading = signal(false);
  readonly grouped = signal(false);
}

describe('StarTable virtualColumns', () => {
  async function setup() {
    const fixture = TestBed.createComponent(WideHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const scroller = el.querySelector<HTMLElement>('.star-table__scroll')!;
    const fields = () =>
      [...el.querySelectorAll<HTMLElement>('thead th[data-field]')].map(
        (th) => th.dataset['field'],
      );
    return { fixture, el, host: fixture.componentInstance, scroller, fields };
  }

  it('renders a window of columns with spacers, aligned in header and body', async () => {
    const { fixture, el, scroller, fields } = await setup();
    // 960 px fallback - 80 px pinned = 880 px: m1 to m9 in view, plus 2 buffer columns.
    expect(fields()).toEqual(['id', ...Array.from({ length: 11 }, (_, i) => `m${i + 1}`)]);
    const table = el.querySelector('table')!;
    // Selection column + 61 columns.
    expect(table.getAttribute('aria-colcount')).toBe('62');
    const headSpacers = el.querySelectorAll<HTMLElement>('thead .star-table__col-spacer');
    expect([...headSpacers].map((cell) => cell.style.width)).toEqual(['4900px']);
    const firstRow = el.querySelector('tbody tr.star-table__row')!;
    expect(firstRow.querySelectorAll('td').length).toBe(1 + 12 + 1);
    expect(firstRow.querySelector<HTMLElement>('td.star-table__col-spacer')!.style.width).toBe(
      '4900px',
    );
    expect(el.querySelector('thead th[data-field="m3"]')!.getAttribute('aria-colindex')).toBe('5');

    Object.defineProperty(scroller, 'clientWidth', { value: 600, configurable: true });
    scroller.scrollLeft = 3000;
    scroller.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    // 600 - 80 = 520 px from 3000: m31 to m36 in view, plus m29, m30, m37, m38.
    expect(fields()).toEqual(['id', ...Array.from({ length: 10 }, (_, i) => `m${i + 29}`)]);
    const spacers = [...el.querySelectorAll<HTMLElement>('thead .star-table__col-spacer')];
    expect(spacers.map((cell) => cell.style.width)).toEqual(['2800px', '2200px']);
    const cells = [...el.querySelector('tbody tr.star-table__row')!.querySelectorAll('td')];
    expect(cells.length).toBe(1 + 1 + 1 + 10 + 1);
    expect(cells[3].getAttribute('aria-colindex')).toBe('31');
    expect(cells[3].textContent?.trim()).toBe(String(29));
  });

  it('puts aria-colindex on group summary and skeleton cells', async () => {
    const { fixture, el, host } = await setup();
    host.grouped.set(true);
    await fixture.whenStable();
    const summary = el.querySelector('tr.star-table__group-footer')!;
    const cells = [...summary.querySelectorAll('td:not(.star-table__select)')].filter(
      (td) => !td.classList.contains('star-table__col-spacer'),
    );
    expect(cells[1].getAttribute('aria-colindex')).toBe('3');
    host.loading.set(true);
    await fixture.whenStable();
    const skeleton = el.querySelector('tbody tr')!;
    const data = [...skeleton.querySelectorAll('td')].filter(
      (td) =>
        !td.classList.contains('star-table__select') &&
        !td.classList.contains('star-table__col-spacer'),
    );
    expect(data[1].getAttribute('aria-colindex')).toBe('3');
  });

  it('keeps column groups aligned with the window', async () => {
    const { fixture, el, host } = await setup();
    host.groups.set([
      { header: 'First ten', children: Array.from({ length: 10 }, (_, i) => `m${i + 1}`) },
      { header: 'Rest', children: Array.from({ length: 50 }, (_, i) => `m${i + 11}`) },
    ]);
    await fixture.whenStable();
    const groups = [...el.querySelectorAll<HTMLTableCellElement>('th.star-table__column-group')];
    expect(groups.map((th) => `${th.textContent?.trim()}:${th.colSpan}`)).toEqual([
      'First ten:10',
      'Rest:1',
    ]);
    const spacer = el.querySelector<HTMLTableCellElement>('thead .star-table__col-spacer')!;
    expect(spacer.rowSpan).toBe(2);
    expect(groups[0].getAttribute('aria-colindex')).toBe('3');
  });
});
