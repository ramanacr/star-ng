import { Component, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  StarChildGridCreatedEvent,
  StarHierarchicalGrid,
  StarHierarchicalRowEvent,
  StarRowIsland,
} from '@star-ng/ui/hierarchical-grid';
import { StarColumn } from '@star-ng/ui/table';

interface Line {
  readonly id: number;
  readonly item: string;
  readonly quantity: number;
}
interface Order {
  readonly id: string;
  readonly total: number;
}
interface Customer {
  readonly id: number;
  readonly name: string;
  readonly orders: readonly Order[];
}

const CUSTOMERS: readonly Customer[] = [
  {
    id: 1,
    name: 'Example Ltd.',
    orders: [
      { id: 'ORD-1', total: 120 },
      { id: 'ORD-2', total: 80 },
    ],
  },
  { id: 2, name: 'Sample GmbH', orders: [{ id: 'ORD-3', total: 45 }] },
];

const CUSTOMER_COLUMNS: StarColumn<Customer>[] = [
  { field: 'id', header: 'Id' },
  { field: 'name', header: 'Name' },
];
const ORDER_COLUMNS: StarColumn<Order>[] = [
  { field: 'id', header: 'Order' },
  { field: 'total', header: 'Total', sortable: true },
];
const LINE_COLUMNS: StarColumn<Line>[] = [
  { field: 'item', header: 'Item' },
  { field: 'quantity', header: 'Quantity' },
];

@Component({
  imports: [StarHierarchicalGrid, StarRowIsland],
  template: `<star-hierarchical-grid
    [data]="data"
    [columns]="customerColumns"
    dataKey="id"
    [rowLabel]="customerName"
    ariaLabel="Customers"
    [(expandedRows)]="expanded"
    (rowExpand)="onExpand($event)"
    (rowCollapse)="collapses.push($event)"
    (childGridCreated)="created.push($event)"
  >
    <star-row-island
      key="orders"
      label="Orders"
      dataKey="id"
      [columns]="orderColumns"
      [rowLabel]="orderLabel"
    >
      <star-row-island label="Lines" [childData]="loadLines" [columns]="lineColumns" dataKey="id" />
    </star-row-island>
  </star-hierarchical-grid>`,
})
class Host {
  readonly grid = viewChild.required(StarHierarchicalGrid<Customer>);
  readonly data = CUSTOMERS;
  readonly customerColumns = CUSTOMER_COLUMNS;
  readonly orderColumns = ORDER_COLUMNS;
  readonly lineColumns = LINE_COLUMNS;
  readonly customerName = (row: Customer) => row.name;
  readonly orderLabel = (row: Order) => row.id;
  readonly expanded = signal<readonly unknown[]>([]);
  cancelNext = false;
  readonly expands: StarHierarchicalRowEvent<Customer>[] = [];
  readonly collapses: StarHierarchicalRowEvent<Customer>[] = [];
  readonly created: StarChildGridCreatedEvent<Customer>[] = [];
  pending: { resolve: (rows: Line[]) => void; reject: (error: unknown) => void }[] = [];
  readonly loadLines = (order: Order) =>
    new Promise<Line[]>((resolve, reject) => {
      void order;
      this.pending.push({ resolve, reject });
    });

  onExpand(event: StarHierarchicalRowEvent<Customer>): void {
    this.expands.push(event);
    if (this.cancelNext) event.cancel();
  }
}

async function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  // Not whenStable: a pending child load keeps the application unstable.
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve));
    }
    fixture.detectChanges();
  };
  await settle();
  return { fixture, host: fixture.componentInstance, el, settle };
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

/** The body rows of a grid, without the rows of the nested grids. */
function rowsOf(table: Element): HTMLTableRowElement[] {
  return Array.from(
    table.querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr.star-table__row'),
  );
}

function rootTable(el: HTMLElement): HTMLTableElement {
  return el.querySelector('table')!;
}

function childTables(el: HTMLElement, name: RegExp): HTMLTableElement[] {
  return Array.from(el.querySelectorAll<HTMLTableElement>('table')).filter((table) =>
    name.test(table.getAttribute('aria-label') ?? ''),
  );
}

describe('StarHierarchicalGrid', () => {
  it('renders the collapsed root as a named grid', async () => {
    const { el } = await setup();
    const table = rootTable(el);
    expect(table.getAttribute('role')).toBe('grid');
    expect(table.getAttribute('aria-label')).toBe('Customers');
    const rows = rowsOf(table);
    expect(rows).toHaveLength(2);
    // aria-level and aria-expanded on a row are valid only in a treegrid (axe).
    expect(rows[0].hasAttribute('aria-level')).toBe(false);
    expect(
      rows[0].querySelector('.star-table__expander button')!.getAttribute('aria-expanded'),
    ).toBe('false');
    expect(el.querySelectorAll('table')).toHaveLength(1);
  });

  it('expands a row into a child grid of its island', async () => {
    const { el, host, settle } = await setup();
    rowsOf(rootTable(el))[0]
      .querySelector<HTMLButtonElement>('.star-table__expander button')!
      .click();
    await settle();
    expect(host.expanded()).toEqual([1]);
    expect(host.expands.map((event) => [event.row.name, event.level, event.island])).toEqual([
      ['Example Ltd.', 1, null],
    ]);
    const [orders] = childTables(el, /^Orders of Example Ltd\.$/);
    expect(orders.getAttribute('role')).toBe('grid');
    const rows = rowsOf(orders);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('ORD-1'),
      expect.stringContaining('ORD-2'),
    ]);
    expect(rows[0].getAttribute('aria-rowindex')).toBeNull();
    expect(
      rowsOf(rootTable(el))[0]
        .querySelector('.star-table__expander button')!
        .getAttribute('aria-expanded'),
    ).toBe('true');
    expect(host.created).toHaveLength(1);
    expect(host.created[0].parentRow).toBe(CUSTOMERS[0]);
    expect(host.created[0].island.label()).toBe('Orders');
    expect(typeof host.created[0].grid.toCsv).toBe('function');
  });

  it('keeps a row collapsed when rowExpand is canceled, and expanded when rowCollapse is', async () => {
    const { el, host, settle } = await setup();
    host.cancelNext = true;
    const button = () =>
      rowsOf(rootTable(el))[1].querySelector<HTMLButtonElement>('.star-table__expander button')!;
    button().click();
    await settle();
    expect(host.expanded()).toEqual([]);
    expect(button().getAttribute('aria-expanded')).toBe('false');
    expect(childTables(el, /Orders/)).toHaveLength(0);
    host.cancelNext = false;
    button().click();
    await settle();
    expect(host.expanded()).toEqual([2]);
    host.collapses.length = 0;
    const collapse = (event: StarHierarchicalRowEvent<Customer>) => event.cancel();
    const sub = host.grid().rowCollapse.subscribe(collapse);
    button().click();
    await settle();
    expect(host.expanded()).toEqual([2]);
    expect(button().getAttribute('aria-expanded')).toBe('true');
    sub.unsubscribe();
  });

  it('loads child rows lazily with a loading row, an error row and a retry', async () => {
    const { el, host, settle } = await setup();
    host.grid().expandAll();
    await settle();
    const [orders] = childTables(el, /^Orders of Example Ltd\.$/);
    rowsOf(orders)[0].querySelector<HTMLButtonElement>('.star-table__expander button')!.click();
    await settle();
    expect(el.querySelector('.star-hierarchical__status[role="status"]')!.textContent).toContain(
      'Loading',
    );
    host.pending[0].reject(new Error('offline'));
    await settle();
    const alert = el.querySelector('.star-hierarchical__status[role="alert"]')!;
    expect(alert.textContent).toContain('The rows could not be loaded.');
    alert.querySelector('button')!.click();
    await settle();
    expect(host.pending).toHaveLength(2);
    host.pending[1].resolve([{ id: 1, item: 'Paper, A4', quantity: 3 }]);
    await settle();
    const [lines] = childTables(el, /^Lines of ORD-1$/);
    expect(rowsOf(lines)).toHaveLength(1);
    expect(lines.textContent).toContain('Paper, A4');
  });

  it('expands with Alt+Arrow keys, goes into the child grid and back to the parent row', async () => {
    const { el, host, settle } = await setup();
    const root = rootTable(el);
    const cell = rowsOf(root)[0].querySelector<HTMLElement>('td[data-field="name"]')!;
    cell.focus();
    key(cell, 'ArrowDown', { altKey: true });
    await settle();
    expect(host.expanded()).toEqual([1]);
    expect(document.activeElement).toBe(cell);
    key(cell, 'ArrowDown');
    await settle();
    const [orders] = childTables(el, /^Orders of Example Ltd\.$/);
    expect(orders.contains(document.activeElement)).toBe(true);
    key(document.activeElement!, 'ArrowUp', { ctrlKey: true });
    await settle();
    expect(rowsOf(root)[0].contains(document.activeElement)).toBe(true);
    key(document.activeElement!, 'ArrowLeft', { altKey: true });
    await settle();
    expect(host.expanded()).toEqual([]);
    expect(host.collapses).toHaveLength(1);
  });

  it('expands and collapses all root rows without events', async () => {
    const { el, host, settle } = await setup();
    host.grid().expandAll();
    await settle();
    expect(host.expanded()).toEqual([1, 2]);
    expect(childTables(el, /^Orders of /)).toHaveLength(2);
    host.grid().collapseAll();
    await settle();
    expect(host.expanded()).toEqual([]);
    expect(host.expands).toHaveLength(0);
    expect(host.grid().grid).toBeTruthy();
  });

  it('renders the collapsed root on the server', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const { el } = await setup();
    expect(rowsOf(rootTable(el))).toHaveLength(2);
    expect(el.querySelectorAll('table')).toHaveLength(1);
  });
});
