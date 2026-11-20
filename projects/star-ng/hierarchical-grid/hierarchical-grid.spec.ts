import { Component, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  StarChildGridCreatedEvent,
  StarHierarchicalGrid,
  StarHierarchicalRowEvent,
  StarRowIsland,
} from '@star-ng/ui/hierarchical-grid';
import { StarColumn } from '@star-ng/ui/table';
import { Subject } from 'rxjs';

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
  { field: 'id', header: 'Id', sortable: true },
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
    [data]="data()"
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
      @if (showLines()) {
        <star-row-island
          label="Lines"
          [childData]="linesLoader()"
          [columns]="lineColumns"
          dataKey="id"
        />
      }
    </star-row-island>
  </star-hierarchical-grid>`,
})
class Host {
  readonly grid = viewChild.required(StarHierarchicalGrid<Customer>);
  readonly data = signal<readonly Customer[]>(CUSTOMERS);
  readonly showLines = signal(true);
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
  /** When set, the loader returns this observable instead of a promise. */
  observable: Subject<Line[]> | null = null;
  readonly signals: AbortSignal[] = [];
  readonly loadLines = (order: Order, signal: AbortSignal) => {
    this.signals.push(signal);
    if (this.observable) return this.observable.asObservable();
    return new Promise<Line[]>((resolve, reject) => {
      void order;
      this.pending.push({ resolve, reject });
    });
  };

  readonly linesLoader = signal<
    (
      order: Order,
      signal: AbortSignal,
    ) => Promise<Line[]> | ReturnType<Subject<Line[]>['asObservable']>
  >(this.loadLines);

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

  it('moves the focus to the loading row after Retry, then into the loaded grid', async () => {
    const { el, host, settle } = await setup();
    host.grid().expandAll();
    await settle();
    const [orders] = childTables(el, /^Orders of Example Ltd\.$/);
    rowsOf(orders)[0].querySelector<HTMLButtonElement>('.star-table__expander button')!.click();
    await settle();
    host.pending[0].reject(new Error('offline'));
    await settle();
    const retry = el.querySelector<HTMLButtonElement>('.star-hierarchical__status--error button')!;
    retry.focus();
    retry.click();
    await settle();
    const status = el.querySelector('.star-hierarchical__status[role="status"]');
    expect(document.activeElement).toBe(status);
    // A second error: the focus goes to the new Retry button.
    host.pending[1].reject(new Error('offline'));
    await settle();
    const again = el.querySelector<HTMLButtonElement>('.star-hierarchical__status--error button')!;
    expect(document.activeElement).toBe(again);
    again.click();
    await settle();
    host.pending[2].resolve([{ id: 1, item: 'Paper, A4', quantity: 3 }]);
    await settle();
    const [lines] = childTables(el, /^Lines of ORD-1$/);
    expect(lines.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('keeps loaded rows and nested expansion when a detail row renders again', async () => {
    const { el, host, settle } = await setup();
    host.grid().expandAll();
    await settle();
    let [orders] = childTables(el, /^Orders of Example Ltd\.$/);
    rowsOf(orders)[0].querySelector<HTMLButtonElement>('.star-table__expander button')!.click();
    await settle();
    host.pending[0].resolve([{ id: 1, item: 'Paper, A4', quantity: 3 }]);
    await settle();
    expect(childTables(el, /^Lines of ORD-1$/)).toHaveLength(1);
    // Collapse and expand the customer: the order stays open, the lines are not loaded again.
    host.grid().collapseAll();
    await settle();
    host.grid().expandAll();
    await settle();
    [orders] = childTables(el, /^Orders of Example Ltd\.$/);
    expect(childTables(el, /^Lines of ORD-1$/)).toHaveLength(1);
    expect(host.signals).toHaveLength(1);
    // A sort of the orders renders the detail rows again: still one load.
    orders
      .querySelector<HTMLElement>('th[data-field="total"] button, th[data-field="total"]')!
      .click();
    await settle();
    expect(childTables(el, /^Lines of ORD-1$/)).toHaveLength(1);
    expect(host.signals).toHaveLength(1);
  });

  it('points the expand button to the child grids with aria-controls', async () => {
    const { el, host, settle } = await setup();
    host.grid().expandAll();
    await settle();
    const button = rowsOf(rootTable(el))[0].querySelector('.star-table__expander button')!;
    const target = document.getElementById(button.getAttribute('aria-controls')!)!;
    expect(target.classList).toContain('star-hierarchical__children');
    expect(target.querySelector('table')!.getAttribute('aria-label')).toBe(
      'Orders of Example Ltd.',
    );
  });

  it('loads from an observable and unsubscribes when the row closes during the load', async () => {
    const { el, host, settle } = await setup();
    host.observable = new Subject<Line[]>();
    host.grid().expandAll();
    await settle();
    const [orders] = childTables(el, /^Orders of Example Ltd\.$/);
    const toggle = () =>
      rowsOf(orders)[0].querySelector<HTMLButtonElement>('.star-table__expander button')!;
    toggle().click();
    await settle();
    expect(host.observable.observed).toBe(true);
    toggle().click();
    await settle();
    expect(host.signals[0].aborted).toBe(true);
    expect(host.observable.observed).toBe(false);
    toggle().click();
    await settle();
    host.observable.next([{ id: 7, item: 'Stapler', quantity: 1 }]);
    await settle();
    expect(childTables(el, /^Lines of ORD-1$/)[0].textContent).toContain('Stapler');
  });

  /** Opens customer 1 and its order ORD-1, and loads the lines of ORD-1 with one line. */
  async function openLines(fixture: Awaited<ReturnType<typeof setup>>) {
    const { el, host, settle } = fixture;
    host.grid().expandAll();
    await settle();
    const [orders] = childTables(el, /^Orders of Example Ltd\.$/);
    rowsOf(orders)[0].querySelector<HTMLButtonElement>('.star-table__expander button')!.click();
    await settle();
    host.pending.at(-1)!.resolve([{ id: 1, item: 'Paper, A4', quantity: 3 }]);
    await settle();
  }

  it('reloads kept child rows when the island loader changes', async () => {
    const fixture = await setup();
    const { el, host, settle } = fixture;
    await openLines(fixture);
    host.linesLoader.set(() => Promise.resolve([{ id: 2, item: 'Folders', quantity: 4 }]));
    await settle();
    expect(childTables(el, /^Lines of ORD-1$/)[0].textContent).toContain('Folders');
  });

  it('reloads when the parent row object is replaced under the same key', async () => {
    const fixture = await setup();
    const { el, host, settle } = fixture;
    await openLines(fixture);
    expect(host.signals).toHaveLength(1);
    host.data.set(
      CUSTOMERS.map((customer) => ({
        ...customer,
        orders: customer.orders.map((order) => ({ ...order })),
      })),
    );
    await settle();
    expect(host.signals).toHaveLength(2);
    host.pending.at(-1)!.resolve([{ id: 3, item: 'Stapler', quantity: 1 }]);
    await settle();
    expect(childTables(el, /^Lines of ORD-1$/)[0].textContent).toContain('Stapler');
  });

  it('reloads the loaded child grids of one root row or of all rows with reloadChildren', async () => {
    const fixture = await setup();
    const { host, settle } = fixture;
    await openLines(fixture);
    host.grid().reloadChildren(CUSTOMERS[1]);
    await settle();
    expect(host.signals).toHaveLength(1);
    host.grid().reloadChildren(CUSTOMERS[0]);
    await settle();
    expect(host.signals).toHaveLength(2);
    host.pending.at(-1)!.resolve([]);
    await settle();
    host.grid().reloadChildren();
    await settle();
    expect(host.signals).toHaveLength(3);
  });

  it('moves the focus to a header cell or the expander when a Retry loads no rows', async () => {
    const { el, host, settle } = await setup();
    host.grid().expandAll();
    await settle();
    const [orders] = childTables(el, /^Orders of Example Ltd\.$/);
    const expander = rowsOf(orders)[0].querySelector<HTMLButtonElement>(
      '.star-table__expander button',
    )!;
    expander.click();
    await settle();
    host.pending[0].reject(new Error('offline'));
    await settle();
    const retry = el.querySelector<HTMLButtonElement>('.star-hierarchical__status--error button')!;
    retry.focus();
    retry.click();
    await settle();
    host.pending[1].resolve([]);
    await settle();
    const active = document.activeElement!;
    expect(active).not.toBe(document.body);
    const [lines] = childTables(el, /^Lines of ORD-1$/);
    const inHeader = !!lines.querySelector('thead')?.contains(active);
    const onParent = rowsOf(orders)[0].contains(active);
    expect(inHeader || onParent).toBe(true);
  });

  it('leaves the focus where the user moved it while a Retry loads', async () => {
    const { el, host, settle } = await setup();
    host.grid().expandAll();
    await settle();
    const [orders] = childTables(el, /^Orders of Example Ltd\.$/);
    rowsOf(orders)[0].querySelector<HTMLButtonElement>('.star-table__expander button')!.click();
    await settle();
    host.pending[0].reject(new Error('offline'));
    await settle();
    const retry = el.querySelector<HTMLButtonElement>('.star-hierarchical__status--error button')!;
    retry.focus();
    retry.click();
    await settle();
    const elsewhere = rowsOf(rootTable(el))[1].querySelector<HTMLElement>('td[data-field="name"]')!;
    elsewhere.focus();
    host.pending[1].resolve([{ id: 1, item: 'Paper, A4', quantity: 3 }]);
    await settle();
    expect(document.activeElement).toBe(elsewhere);
  });

  it('drops the kept state of an island that leaves the layout', async () => {
    const fixture = await setup();
    const { host, settle } = fixture;
    await openLines(fixture);
    interface Node {
      islands: Map<unknown, Map<unknown, Node>>;
    }
    const root = (host.grid() as unknown as { rootCache: Node }).rootCache;
    const ordersEntry = () => [...[...root.islands.values()][0].values()][0];
    expect(ordersEntry().islands.size).toBe(1);
    host.showLines.set(false);
    await settle();
    expect(ordersEntry().islands.size).toBe(0);
  });

  it('keeps aria-controls on the child grids after a sort of the parent', async () => {
    const { el, host, settle } = await setup();
    host.grid().expandAll();
    await settle();
    rootTable(el)
      .querySelector<HTMLElement>('th[data-field="id"] button, th[data-field="id"]')!
      .click();
    await settle();
    rootTable(el)
      .querySelector<HTMLElement>('th[data-field="id"] button, th[data-field="id"]')!
      .click();
    await settle();
    for (const row of rowsOf(rootTable(el))) {
      const button = row.querySelector('.star-table__expander button')!;
      const target = document.getElementById(button.getAttribute('aria-controls')!);
      expect(target?.classList).toContain('star-hierarchical__children');
    }
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

@Component({
  imports: [StarHierarchicalGrid, StarRowIsland],
  template: `<star-hierarchical-grid
    [data]="data"
    [columns]="columns"
    dataKey="id"
    virtualScroll
    scrollHeight="400px"
    [(expandedRows)]="expanded"
  >
    <star-row-island label="Orders" [childData]="load" [columns]="orderColumns" dataKey="id" />
  </star-hierarchical-grid>`,
})
class VirtualHost {
  readonly data: Customer[] = Array.from({ length: 300 }, (_, i) => ({
    id: i + 1,
    name: `Customer ${i + 1}`,
    orders: [],
  }));
  readonly columns = CUSTOMER_COLUMNS;
  readonly orderColumns = ORDER_COLUMNS;
  readonly expanded = signal<readonly unknown[]>([1]);
  calls = 0;
  readonly load = () => {
    this.calls++;
    return Promise.resolve([{ id: 'ORD-9', total: 9 }]);
  };
}

describe('StarHierarchicalGrid with a virtual root', () => {
  it('keeps the child grid of a row that leaves the window and comes back (one load)', async () => {
    const fixture = TestBed.createComponent(VirtualHost);
    const el = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      for (let i = 0; i < 3; i++) {
        fixture.detectChanges();
        await new Promise((resolve) => setTimeout(resolve));
      }
    };
    await settle();
    expect(childTables(el, /^Orders/)).toHaveLength(1);
    // jsdom has no layout: every row is 48 pixels high.
    const rect = vi
      .spyOn(HTMLTableRowElement.prototype, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(0, 0, 600, 48));
    const viewport = el.querySelector<HTMLElement>('.star-table__scroll')!;
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 400 });
    // The body moves up as the view scrolls down.
    const body = vi
      .spyOn(HTMLTableSectionElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => new DOMRect(0, -viewport.scrollTop, 600, 0));
    viewport.dispatchEvent(new Event('scroll'));
    await settle();
    viewport.scrollTop = 6000;
    viewport.dispatchEvent(new Event('scroll'));
    await settle();
    expect(childTables(el, /^Orders/)).toHaveLength(0);
    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event('scroll'));
    await settle();
    expect(childTables(el, /^Orders/)).toHaveLength(1);
    expect(fixture.componentInstance.calls).toBe(1);
    rect.mockRestore();
    body.mockRestore();
  });
});
