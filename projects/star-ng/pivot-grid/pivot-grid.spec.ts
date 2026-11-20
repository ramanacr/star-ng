import { Component, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAnnouncer } from '@star-ng/ui/core';
import * as pivotApi from '@star-ng/ui/pivot-grid';
import {
  StarPivotCellClickEvent,
  StarPivotConfig,
  StarPivotField,
  StarPivotGrid,
  starPivotPathKey,
} from '@star-ng/ui/pivot-grid';
import { StarPivotConfigurator } from './pivot-configurator';
import {
  starPivotAreas,
  starPivotClipHeaders,
  starPivotHeaderGrid,
  starPivotMoveField,
  starPivotWindow,
} from './pivot-layout';

interface Sale {
  readonly region: string;
  readonly product: string;
  readonly quarter: string;
  readonly amount: number;
}

const SALES: readonly Sale[] = [
  { region: 'North', product: 'Desk', quarter: 'Q1', amount: 100 },
  { region: 'North', product: 'Lamp', quarter: 'Q2', amount: 50 },
  { region: 'South', product: 'Desk', quarter: 'Q1', amount: 300 },
  { region: 'South', product: 'Chair', quarter: 'Q2', amount: 80 },
];

const FIELDS: readonly StarPivotField<Sale>[] = [
  { field: 'region', label: 'Region' },
  { field: 'product', label: 'Product' },
  { field: 'quarter', label: 'Quarter' },
  { field: 'amount', label: 'Amount' },
];

@Component({
  imports: [StarPivotGrid],
  template: `<star-pivot-grid
    [data]="data()"
    [(config)]="config"
    [fields]="fields"
    [showConfigurator]="configurator()"
    locale="en-US"
    (cellClick)="clicked = $event"
  />`,
})
class Host {
  readonly grid = viewChild.required(StarPivotGrid<Sale>);
  readonly data = signal<readonly Sale[]>(SALES);
  fields: readonly StarPivotField<Sale>[] = FIELDS;
  readonly configurator = signal(false);
  readonly config = signal<StarPivotConfig<Sale>>({
    rows: [
      { field: 'region', label: 'Region' },
      { field: 'product', label: 'Product' },
    ],
    columns: [{ field: 'quarter', label: 'Quarter' }],
    values: [{ field: 'amount', label: 'Amount', aggregate: 'sum' }],
  });
  clicked: StarPivotCellClickEvent<Sale> | null = null;
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, host: fixture.componentInstance, el };
}

function key(target: Element, name: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

function texts(elements: NodeListOf<Element> | Element[]): string[] {
  return Array.from(elements).map((element) => element.textContent!.trim());
}

describe('StarPivotGrid', () => {
  it('renders a grid with column headers, row headers, totals and ARIA indexes', () => {
    const { el } = setup();
    const table = el.querySelector('table')!;
    expect(table.getAttribute('role')).toBe('grid');
    expect(table.getAttribute('aria-label')).toBe('Pivot table');
    expect(table.getAttribute('aria-colcount')).toBe('4');
    expect(table.getAttribute('aria-rowcount')).toBe(String(1 + 7));
    expect(texts(el.querySelectorAll('thead th'))).toEqual([
      'Region / Product',
      'Q1',
      'Q2',
      'Grand total',
    ]);
    const heads = el.querySelectorAll('tbody th[role="rowheader"]');
    expect(texts(heads)).toEqual([
      'North',
      'Desk',
      'Lamp',
      'South',
      'Chair',
      'Desk',
      'Grand total',
    ]);
    expect(heads[0].getAttribute('aria-expanded')).toBe('true');
    expect(heads[1].hasAttribute('aria-expanded')).toBe(false);
    const north = heads[0].closest('tr')!;
    expect(north.getAttribute('aria-rowindex')).toBe('2');
    expect(texts(north.querySelectorAll('td'))).toEqual(['100', '50', '150']);
    expect(north.querySelector('td')!.getAttribute('aria-colindex')).toBe('2');
    expect(texts(el.querySelectorAll('tbody tr:last-child td'))).toEqual(['400', '130', '530']);
  });

  it('collapses and expands a row member with its button and updates the config', () => {
    const { fixture, host, el } = setup();
    const toggle = el.querySelector<HTMLElement>('tbody th .star-pivot__toggle')!;
    expect(toggle.getAttribute('aria-hidden')).toBe('true');
    toggle.click();
    fixture.detectChanges();
    expect(host.config().collapsedRows).toEqual([starPivotPathKey(['North'])]);
    const heads = el.querySelectorAll('tbody th[role="rowheader"]');
    expect(texts(heads)).toEqual(['North', 'South', 'Chair', 'Desk', 'Grand total']);
    expect(heads[0].getAttribute('aria-expanded')).toBe('false');
    host.grid().expandAll();
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody th[role="rowheader"]')).toHaveLength(7);
    host.grid().collapseAll();
    fixture.detectChanges();
    expect(texts(el.querySelectorAll('tbody th[role="rowheader"]'))).toEqual([
      'North',
      'South',
      'Grand total',
    ]);
  });

  it('is one tab stop and moves with the arrow keys, Home, End and Ctrl+End', () => {
    const { fixture, el } = setup();
    const stops = () => el.querySelectorAll('table [tabindex="0"]');
    expect(stops()).toHaveLength(1);
    const first = stops()[0] as HTMLElement;
    expect(first.textContent!.trim()).toBe('North');
    first.focus();
    key(first, 'ArrowRight');
    fixture.detectChanges();
    expect(document.activeElement!.textContent!.trim()).toBe('100');
    key(document.activeElement!, 'ArrowDown');
    fixture.detectChanges();
    expect(document.activeElement!.getAttribute('data-pos')).toBe('1:0');
    key(document.activeElement!, 'End');
    fixture.detectChanges();
    expect(document.activeElement!.getAttribute('data-pos')).toBe('1:2');
    key(document.activeElement!, 'Home');
    fixture.detectChanges();
    expect(document.activeElement!.textContent!.trim()).toBe('Desk');
    key(document.activeElement!, 'End', { ctrlKey: true });
    fixture.detectChanges();
    expect(document.activeElement!.textContent!.trim()).toBe('530');
    key(document.activeElement!, 'Home', { ctrlKey: true });
    fixture.detectChanges();
    expect(document.activeElement!.classList).toContain('star-pivot__corner');
    key(document.activeElement!, 'ArrowRight');
    fixture.detectChanges();
    expect(document.activeElement!.textContent!.trim()).toBe('Q1');
    key(document.activeElement!, 'ArrowDown');
    fixture.detectChanges();
    expect(document.activeElement!.getAttribute('data-pos')).toBe('0:0');
    expect(stops()).toHaveLength(1);
  });

  it('expands and collapses with Enter, Space and Alt+arrows on a row header', () => {
    const { fixture, host, el } = setup();
    const north = el.querySelector<HTMLElement>('tbody th')!;
    north.focus();
    key(north, 'ArrowLeft', { altKey: true });
    fixture.detectChanges();
    expect(host.config().collapsedRows).toEqual([starPivotPathKey(['North'])]);
    key(el.querySelector('tbody th')!, 'ArrowRight', { altKey: true });
    fixture.detectChanges();
    expect(host.config().collapsedRows).toEqual([]);
    key(el.querySelector('tbody th')!, 'Enter');
    fixture.detectChanges();
    expect(host.config().collapsedRows).toHaveLength(1);
    key(el.querySelector('tbody th')!, ' ');
    fixture.detectChanges();
    expect(host.config().collapsedRows).toHaveLength(0);
  });

  it('emits cellClick with the paths, the value and the source records', () => {
    const { fixture, host, el } = setup();
    const cell = el.querySelector<HTMLElement>('[data-pos="1:0"]')!;
    cell.click();
    expect(host.clicked).toMatchObject({
      rowPath: ['North', 'Desk'],
      columnPath: ['Q1'],
      value: 100,
      records: [SALES[0]],
    });
    host.clicked = null;
    cell.focus();
    key(cell, 'Enter');
    fixture.detectChanges();
    expect(host.clicked!.value).toBe(100);
  });

  it('collapses a column member from its header', () => {
    const { fixture, host, el } = setup();
    host.config.update((config) => ({
      ...config,
      columns: [{ field: 'quarter' }, { field: 'product' }],
    }));
    fixture.detectChanges();
    const q2 = Array.from(el.querySelectorAll<HTMLElement>('thead th')).find(
      (th) => th.textContent!.trim() === 'Q2',
    )!;
    expect(q2.getAttribute('aria-expanded')).toBe('true');
    expect(q2.getAttribute('colspan')).toBe('2');
    expect(q2.getAttribute('aria-colspan')).toBe('2');
    q2.querySelector<HTMLElement>('.star-pivot__toggle')!.click();
    fixture.detectChanges();
    expect(host.config().collapsedColumns).toEqual([starPivotPathKey(['Q2'])]);
    const collapsed = Array.from(el.querySelectorAll<HTMLElement>('thead th')).find(
      (th) => th.textContent!.trim() === 'Q2',
    )!;
    expect(collapsed.getAttribute('aria-expanded')).toBe('false');
    expect(collapsed.getAttribute('rowspan')).toBe('2');
    expect(texts(el.querySelectorAll('thead th'))).toContain('Q1 total');
    expect(texts(el.querySelectorAll('thead th'))).not.toContain('Q2 total');
  });

  it('writes the visible pivot as CSV', () => {
    const { host } = setup();
    const lines = host.grid().toCsv().split('\r\n');
    expect(lines[0]).toBe('Region / Product,Q1,Q2,Grand total');
    expect(lines[1]).toBe('North,100,50,150');
    expect(lines.at(-1)).toBe('Grand total,400,130,530');
    const formatted = host.grid().toCsv({ formatted: true, delimiter: ';' }).split('\r\n');
    expect(formatted[1]).toBe('North;100;50;150');
  });

  it('renders rows and columns in a window for large results', () => {
    const { fixture, host, el } = setup();
    // The view size is known before the large data comes (as after the first browser render), so
    // the large result never renders in full (jsdom is slow with 12,000 cells).
    const scroller = el.querySelector<HTMLElement>('.star-pivot__scroller')!;
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 360 });
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 800 });
    scroller.dispatchEvent(new Event('scroll'));
    const many: Sale[] = [];
    for (let r = 0; r < 300; r++) {
      for (let c = 0; c < 40; c++) {
        many.push({ region: `R${r}`, product: 'x', quarter: `C${c}`, amount: 1 });
      }
    }
    host.data.set(many);
    host.config.set({
      rows: [{ field: 'region' }],
      columns: [{ field: 'quarter' }],
      values: [{ field: 'amount' }],
    });
    fixture.detectChanges();
    scroller.scrollTop = 3600;
    scroller.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    const rows = el.querySelectorAll('tbody tr.star-pivot__row');
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.length).toBeLessThan(40);
    expect(rows[0].getAttribute('aria-rowindex')).toBe(String(1 + 94 + 1));
    expect(el.querySelectorAll('tbody tr.star-pivot__spacer-row')).toHaveLength(2);
    const cells = rows[0].querySelectorAll('td.star-pivot__cell');
    expect(cells.length).toBeLessThan(15);
    expect(el.querySelector('table')!.getAttribute('aria-rowcount')).toBe(String(1 + 301));
    // Ctrl+End scrolls to the last cell and focuses it after the render.
    const head = rows[0].querySelector<HTMLElement>('th')!;
    head.focus();
    key(head, 'End', { ctrlKey: true });
    fixture.detectChanges();
    TestBed.tick();
    expect(document.activeElement!.getAttribute('data-pos')).toBe('300:40');
  }, 15_000);

  it('moves fields with the configurator move menu and announces it', () => {
    const { fixture, host, el } = setup();
    host.configurator.set(true);
    fixture.detectChanges();
    const announce = vi.spyOn(TestBed.inject(StarAnnouncer), 'announce');
    const config = fixture.debugElement.query(
      (node) => node.componentInstance instanceof StarPivotConfigurator,
    ).componentInstance as StarPivotConfigurator<Sale>;
    const areas = el.querySelectorAll('[data-pivot-area]');
    expect(Array.from(areas).map((area) => area.getAttribute('data-pivot-area'))).toEqual([
      'fields',
      'rows',
      'columns',
      'values',
      'filters',
    ]);
    expect(
      texts(el.querySelectorAll('[data-pivot-area="rows"] .star-pivot-config__label')),
    ).toEqual(['Region', 'Product']);
    expect(el.querySelector('[data-pivot-move="region"]')!.getAttribute('aria-label')).toBe(
      'Move Region',
    );
    config.move('product', 'columns', 0);
    fixture.detectChanges();
    expect(host.config().columns.map((item) => item.field)).toEqual(['product', 'quarter']);
    expect(announce).toHaveBeenCalledWith('Product moved to Columns');
    config.move('region', 'fields');
    fixture.detectChanges();
    expect(host.config().rows).toEqual([]);
    expect(
      texts(el.querySelectorAll('[data-pivot-area="fields"] .star-pivot-config__label')),
    ).toEqual(['Region']);
  });

  it('changes the aggregate of a value field', () => {
    const { fixture, host, el } = setup();
    host.configurator.set(true);
    fixture.detectChanges();
    const select = el.querySelector<HTMLSelectElement>('[data-pivot-area="values"] select')!;
    expect(select.getAttribute('aria-label')).toBe('Aggregate of Amount');
    select.value = 'count';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(host.config().values[0].aggregate).toBe('count');
    expect(texts(el.querySelectorAll('tbody tr:last-child td'))).toEqual(['2', '2', '4']);
  });

  it('exports only the component, starPivot and starPivotPathKey as values', () => {
    expect(Object.keys(pivotApi).sort()).toEqual([
      'StarPivotGrid',
      'starPivot',
      'starPivotPathKey',
    ]);
  });

  it('does not emit cellClick for a parent row without values', () => {
    const { fixture, host, el } = setup();
    host.config.update((config) => ({ ...config, rowSubtotals: false }));
    fixture.detectChanges();
    el.querySelector<HTMLElement>('[data-pos="0:0"]')!.click();
    expect(host.clicked).toBeNull();
    el.querySelector<HTMLElement>('[data-pos="1:0"]')!.click();
    expect(host.clicked!.value).toBe(100);
  });

  it('hides the aggregate select of a value with a custom aggregate', () => {
    const { fixture, host, el } = setup();
    host.configurator.set(true);
    host.config.update((config) => ({
      ...config,
      values: [{ field: 'amount', aggregate: (values) => values.length }],
    }));
    fixture.detectChanges();
    expect(el.querySelector('[data-pivot-area="values"] select')).toBeNull();
  });

  it('uses the value accessor of a field in the filter list, the filter and a move', async () => {
    const { fixture, host, el } = setup();
    const size: StarPivotField<Sale> = {
      field: 'size',
      label: 'Size',
      value: (sale) => (sale.amount >= 100 ? 'Large' : 'Small'),
    };
    host.fields = [...FIELDS, size];
    host.configurator.set(true);
    host.config.update((config) => ({
      ...config,
      rows: [{ field: 'size', label: 'Size', value: size.value }],
    }));
    fixture.detectChanges();
    expect(texts(el.querySelectorAll('tbody th[role="rowheader"]'))).toEqual([
      'Large',
      'Small',
      'Grand total',
    ]);
    el.querySelector<HTMLButtonElement>('[data-pivot-filter="size"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const panel = document.querySelector<HTMLElement>('.star-pivot-filter__panel')!;
    const boxes = panel.querySelectorAll<HTMLInputElement>('.star-pivot-filter__list input');
    expect(texts(panel.querySelectorAll('.star-pivot-filter__list .star-check__text'))).toEqual([
      'Large',
      'Small',
    ]);
    boxes[1].click();
    fixture.detectChanges();
    expect(texts(el.querySelectorAll('tbody th[role="rowheader"]'))).toEqual([
      'Large',
      'Grand total',
    ]);
    const config = fixture.debugElement.query(
      (node) => node.componentInstance instanceof StarPivotConfigurator,
    ).componentInstance as StarPivotConfigurator<Sale>;
    config.move('size', 'columns');
    fixture.detectChanges();
    expect(host.config().columns.at(-1)!.value).toBe(size.value);
    config.move('size', 'values');
    fixture.detectChanges();
    expect(host.config().values.at(-1)!.value).toBe(size.value);
  });

  it('applies Select all to the members that match the search', async () => {
    const { fixture, host, el } = setup();
    host.configurator.set(true);
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('[data-pivot-filter="product"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const panel = document.querySelector<HTMLElement>('.star-pivot-filter__panel')!;
    const search = panel.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'la';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const all = panel.querySelector<HTMLInputElement>('.star-pivot-filter__all input')!;
    all.click();
    fixture.detectChanges();
    expect(host.config().filters).toEqual([{ field: 'product', exclude: ['Lamp'] }]);
  });

  it('filters members with the filter popover (search, uncheck, clear)', async () => {
    const { fixture, host, el } = setup();
    host.configurator.set(true);
    fixture.detectChanges();
    const button = el.querySelector<HTMLButtonElement>('[data-pivot-filter="product"]')!;
    expect(button.getAttribute('aria-label')).toBe('Filter Product');
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const panel = document.querySelector<HTMLElement>('.star-pivot-filter__panel')!;
    expect(panel).toBeTruthy();
    const search = panel.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'la';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const boxes = panel.querySelectorAll<HTMLInputElement>('.star-pivot-filter__list input');
    expect(boxes).toHaveLength(1);
    boxes[0].click();
    fixture.detectChanges();
    expect(host.config().filters).toEqual([{ field: 'product', exclude: ['Lamp'] }]);
    expect(texts(el.querySelectorAll('tbody th[role="rowheader"]'))).not.toContain('Lamp');
    expect(button.getAttribute('aria-label')).toBe('Filter Product, active');
    const clear = Array.from(panel.querySelectorAll('button')).find(
      (item) => item.textContent!.trim() === 'Clear',
    )!;
    clear.click();
    fixture.detectChanges();
    expect(host.config().filters).toEqual([]);
  });

  it('renders on the server without a browser API', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const { el, host, fixture } = setup();
    expect(el.querySelectorAll('tbody tr.star-pivot__row')).toHaveLength(7);
    host.grid().focusPosition({ row: 1, column: 1 });
    fixture.detectChanges();
    expect(el.querySelector('[tabindex="0"]')!.getAttribute('data-pos')).toBe('1:1');
  });
});

describe('pivot layout helpers', () => {
  const config: StarPivotConfig = {
    rows: [{ field: 'region' }],
    columns: [{ field: 'quarter' }],
    values: [{ field: 'amount' }],
    filters: [{ field: 'product', include: ['Desk'] }],
    collapsedRows: ['["North"]'],
  };

  it('lists the fields of each area', () => {
    expect(starPivotAreas(config)).toEqual({
      rows: ['region'],
      columns: ['quarter'],
      values: ['amount'],
      filters: ['product'],
    });
  });

  it('moves a field between areas, keeps dimension settings and clears collapsed paths', () => {
    const moved = starPivotMoveField(config, { field: 'region' }, 'columns', 0);
    expect(moved.rows).toEqual([]);
    expect(moved.columns.map((item) => item.field)).toEqual(['region', 'quarter']);
    expect(moved.collapsedRows).toEqual([]);
    const value = starPivotMoveField(config, { field: 'product', aggregate: 'count' }, 'values');
    expect(value.values.map((item) => `${item.field}:${item.aggregate ?? 'sum'}`)).toEqual([
      'amount:sum',
      'product:count',
    ]);
    // The member filter of the field stays.
    expect(value.filters).toEqual([{ field: 'product', include: ['Desk'] }]);
    const out = starPivotMoveField(config, { field: 'product' }, null);
    expect(out.filters).toEqual([]);
    const filter = starPivotMoveField(config, { field: 'quarter' }, 'filters', 0);
    expect(filter.filters!.map((item) => item.field)).toEqual(['quarter', 'product']);
    expect(filter.columns).toEqual([]);
  });

  it('windows an axis only above the threshold and with a known viewport', () => {
    expect(starPivotWindow(50, 36, 0, 300, 2, 60)).toEqual({
      start: 0,
      end: 50,
      before: 0,
      after: 0,
    });
    expect(starPivotWindow(500, 36, 0, 0, 2, 60).end).toBe(500);
    expect(starPivotWindow(500, 10, 1000, 100, 2, 60)).toEqual({
      start: 98,
      end: 113,
      before: 980,
      after: 3870,
    });
  });

  it('clips header cells to the rendered columns and maps covered positions', () => {
    const cells = [
      { column: 0, colSpan: 3, row: 0, rowSpan: 1 },
      { column: 3, colSpan: 1, row: 0, rowSpan: 2 },
    ] as never[];
    expect(
      starPivotClipHeaders(cells, 2, 4).map((item) => (item as { span: number }).span),
    ).toEqual([1, 1]);
    const grid = starPivotHeaderGrid([cells, []], 4);
    expect(grid[1][3]).toBe(cells[1]);
    expect(grid[1][0]).toBeUndefined();
  });
});
