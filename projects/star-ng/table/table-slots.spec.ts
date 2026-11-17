import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarEmptyTemplate, StarGroupTemplate, StarLoadingTemplate } from '@star-ng/ui/core';
import { StarSelect } from '@star-ng/ui/select';
import { StarCellTemplate, StarColumn, StarRowExpansionTemplate, StarTable } from './table';
import { StarHeaderCellTemplate } from './table-slots';

interface Order {
  id: string;
  customer: string;
  status: string;
  total: number;
}

const ORDERS: Order[] = [
  { id: 'ORD-1', customer: 'Ava Stone', status: 'Open', total: 40 },
  { id: 'ORD-2', customer: 'Ben Carter', status: 'Paid', total: 12 },
  { id: 'ORD-3', customer: 'Chloe Park', status: 'Open', total: 7 },
];

@Component({
  imports: [
    StarTable,
    StarCellTemplate,
    StarHeaderCellTemplate,
    StarEmptyTemplate,
    StarLoadingTemplate,
    StarGroupTemplate,
    StarSelect,
  ],
  template: `
    <star-table
      class="main"
      [value]="rows()"
      [columns]="columns"
      dataKey="id"
      ariaLabel="Orders"
      [loading]="loading()"
      [globalFilter]="query()"
      [groupBy]="group()"
      [(sortField)]="sortField"
    >
      <h3 starTableCaption>Caption</h3>
      <ng-template starEmpty let-text>Nothing for [{{ text }}]</ng-template>
      <ng-template starLoading><b class="my-loading">Fetching orders</b></ng-template>
      <ng-template starGroup let-label let-count="count">
        <b class="my-group">{{ label }} ({{ count }})</b>
      </ng-template>
      <ng-template starHeaderCell="customer" [starHeaderCellOf]="rows()" let-column>
        <b class="my-head">{{ column.header }}!</b>
      </ng-template>
      <p starTableSummary class="my-summary">3 orders</p>
    </star-table>

    <star-table class="nested" [value]="nestedRows()" [columns]="nestedColumns" ariaLabel="Nested">
      <ng-template starEmpty>Table is empty</ng-template>
      <ng-template starCell="status">
        <star-select class="inner" [options]="[]" ariaLabel="Pick">
          <ng-template starEmpty>Select is empty</ng-template>
        </star-select>
      </ng-template>
    </star-table>
  `,
})
class Host {
  readonly table = viewChild.required<StarTable<Order>>(StarTable);
  readonly rows = signal<readonly Order[]>(ORDERS);
  readonly loading = signal(false);
  readonly query = signal('');
  readonly group = signal<keyof Order | null>(null);
  readonly sortField = signal<string | null>(null);
  readonly columns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order' },
    { field: 'customer', header: 'Customer', sortable: true },
    { field: 'status', header: 'Status' },
  ];
  readonly nestedRows = signal<readonly Order[]>(ORDERS.slice(0, 1));
  readonly nestedColumns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order' },
    { field: 'status', header: 'Status' },
  ];
}

@Component({
  imports: [StarTable, StarLoadingTemplate, StarGroupTemplate, StarRowExpansionTemplate],
  template: `
    <star-table
      class="wide"
      [value]="ORDERS"
      [columns]="columns"
      dataKey="id"
      ariaLabel="Wide"
      selectionMode="multiple"
      loading
    >
      <ng-template starLoading><b class="wide-load">Fetching</b></ng-template>
      <ng-template starRowExpansion [starRowExpansionOf]="ORDERS" let-row>{{ row.id }}</ng-template>
    </star-table>
    <star-table
      class="narrow"
      [value]="ORDERS"
      [columns]="columns"
      dataKey="id"
      ariaLabel="Narrow"
      loading
    >
      <ng-template starLoading><b class="narrow-load">Fetching</b></ng-template>
    </star-table>
    <star-table
      class="paged"
      [value]="ORDERS"
      [columns]="columns"
      dataKey="id"
      ariaLabel="Paged"
      paginator
      [rows]="2"
    >
      <p starTableSummary class="paged-summary">Summary</p>
    </star-table>
    <star-table
      class="counted"
      [value]="ORDERS"
      [columns]="columns"
      dataKey="id"
      ariaLabel="Counted"
      groupBy="status"
      [globalFilter]="query()"
    >
      <ng-template starGroup let-label let-count="count">
        <b class="cg">{{ label }} ({{ count }})</b>
      </ng-template>
    </star-table>
  `,
})
class MoreHost {
  readonly ORDERS = ORDERS;
  readonly query = signal('');
  readonly columns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order' },
    { field: 'customer', header: 'Customer' },
    { field: 'status', header: 'Status' },
  ];
}

describe('table slots, more cases', () => {
  async function setup() {
    const fixture = TestBed.createComponent(MoreHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, host: fixture.componentInstance, el };
  }
  const groups = (el: HTMLElement) =>
    [...el.querySelectorAll('.counted .cg')].map((n) => n.textContent?.trim());

  it('loading row spans the data columns, the selection column and the expansion column', async () => {
    const { el } = await setup();
    const wide = el.querySelector('.wide .star-table__loading')!;
    expect(wide.getAttribute('colspan')).toBe('5');
    expect(wide.querySelector('.wide-load')?.textContent).toBe('Fetching');
    const narrow = el.querySelector('.narrow .star-table__loading')!;
    expect(narrow.getAttribute('colspan')).toBe('3');
  });

  it('summary content comes before the paginator in the DOM', async () => {
    const { el } = await setup();
    const table = el.querySelector<HTMLElement>('star-table.paged')!;
    const summary = table.querySelector('.paged-summary')!;
    const paginator = table.querySelector('star-paginator')!;
    expect(paginator).not.toBeNull();
    expect(
      summary.compareDocumentPosition(paginator) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(summary.parentElement).toBe(table);
  });

  it('group count follows the global filter', async () => {
    const { fixture, host, el } = await setup();
    expect(groups(el)).toEqual(['Open (2)', 'Paid (1)']);
    host.query.set('ava');
    await fixture.whenStable();
    expect(groups(el)).toEqual(['Open (1)']);
    host.query.set('ben');
    await fixture.whenStable();
    expect(groups(el)).toEqual(['Paid (1)']);
  });

  it('group count stays the same when a group is collapsed', async () => {
    const { fixture, el } = await setup();
    const toggles = el.querySelectorAll<HTMLButtonElement>('.counted .star-table__group-toggle');
    toggles[0].click();
    await fixture.whenStable();
    expect(toggles[0].getAttribute('aria-expanded')).toBe('false');
    expect(groups(el)).toEqual(['Open (2)', 'Paid (1)']);
  });
});

describe('table slots', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: fixture.componentInstance,
      main: el.querySelector<HTMLElement>('star-table.main')!,
      nested: el.querySelector<HTMLElement>('star-table.nested')!,
    };
  }

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('empty slot receives the global filter text', async () => {
    const { fixture, host, main } = await setup();
    host.query.set('zz');
    await fixture.whenStable();
    expect(main.querySelector('.star-table__empty')?.textContent?.trim()).toBe('Nothing for [zz]');
    host.query.set('');
    host.rows.set([]);
    await fixture.whenStable();
    expect(main.querySelector('.star-table__empty')?.textContent?.trim()).toBe('Nothing for []');
  });

  it('loading slot replaces the skeleton', async () => {
    const { fixture, host, main } = await setup();
    host.loading.set(true);
    await fixture.whenStable();
    expect(main.querySelector('.my-loading')?.textContent).toBe('Fetching orders');
    expect(main.querySelector('star-skeleton')).toBeNull();
    expect(main.querySelector('table')?.getAttribute('aria-busy')).toBe('true');
    host.loading.set(false);
    await fixture.whenStable();
    expect(main.querySelector('.my-loading')).toBeNull();
  });

  it('group slot gets label and count and keeps the toggle', async () => {
    const { fixture, host, main } = await setup();
    host.group.set('status');
    await fixture.whenStable();
    const toggles = [...main.querySelectorAll<HTMLButtonElement>('.star-table__group-toggle')];
    expect(toggles.map((t) => t.querySelector('.my-group')?.textContent)).toEqual([
      'Open (2)',
      'Paid (1)',
    ]);
    expect(main.querySelector('.star-table__group-count')).toBeNull();
    expect(toggles[0].getAttribute('aria-expanded')).toBe('true');
    toggles[0].click();
    await fixture.whenStable();
    expect(toggles[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('header cell slot replaces the label and keeps sorting', async () => {
    const { fixture, host, main } = await setup();
    const th = main.querySelector<HTMLElement>('th[data-field="customer"]')!;
    const button = th.querySelector<HTMLButtonElement>('.star-table__sort')!;
    expect(button.querySelector('.my-head')?.textContent).toBe('Customer!');
    expect(button.querySelector('i')).not.toBeNull();
    // Other headers keep the plain label.
    expect(main.querySelector('th[data-field="id"]')?.textContent?.trim()).toBe('Order');
    button.click();
    await fixture.whenStable();
    expect(host.sortField()).toBe('customer');
    expect(th.getAttribute('aria-sort')).toBe('ascending');
  });

  it('summary content renders below the body', async () => {
    const { main } = await setup();
    const summary = main.querySelector('.my-summary')!;
    const scroller = main.querySelector('.star-table__scroll')!;
    expect(summary.textContent).toBe('3 orders');
    expect(summary.parentElement).toBe(main);
    expect(
      scroller.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const caption = main.querySelector('[starTableCaption]')!;
    expect(
      caption.compareDocumentPosition(scroller) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('select in a cell does not take the table empty slot', async () => {
    const { fixture, host, nested } = await setup();
    expect(nested.querySelector('.star-table__empty')).toBeNull();
    nested.querySelector<HTMLElement>('.inner [role=combobox]')!.click();
    await fixture.whenStable();
    expect(document.querySelector('.star-listbox__empty')?.textContent?.trim()).toBe(
      'Select is empty',
    );
    host.nestedRows.set([]);
    await fixture.whenStable();
    expect(nested.querySelector('.star-table__empty')?.textContent?.trim()).toBe('Table is empty');
  });
});
