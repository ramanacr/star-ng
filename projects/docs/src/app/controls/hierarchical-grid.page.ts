import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  StarChildGridCreatedEvent,
  StarHierarchicalGrid,
  StarHierarchicalRowEvent,
  StarRowIsland,
} from '@star-ng/ui/hierarchical-grid';
import { StarColumn } from '@star-ng/ui/table';
import { DOCS, DocsRow } from '../shared/docs';

interface OrderLine {
  readonly id: number;
  readonly item: string;
  readonly quantity: number;
  readonly price: number;
}

interface Order {
  readonly id: string;
  readonly date: string;
  readonly status: string;
  readonly total: number;
}

interface Customer {
  readonly id: number;
  readonly name: string;
  readonly city: string;
  readonly orders: readonly Order[];
}

const CITIES = ['Lisbon', 'Oslo', 'Porto', 'Graz', 'Lyon', 'Turin'];
const STATUSES = ['Open', 'Shipped', 'Delivered'];
const ITEMS = ['Paper, A4', 'Pens', 'Stapler', 'Folders', 'Desk lamp', 'Notebooks'];

/** Fictional customers, each with a few orders. */
const CUSTOMERS: readonly Customer[] = Array.from({ length: 12 }, (_, c) => ({
  id: c + 1,
  name: `Customer ${String(c + 1).padStart(2, '0')}`,
  city: CITIES[c % CITIES.length],
  orders: Array.from({ length: 1 + (c % 4) }, (_, o) => ({
    id: `ORD-${1000 + c * 10 + o}`,
    date: `2026-${String(1 + ((c + o) % 12)).padStart(2, '0')}-${String(3 + o * 7).padStart(2, '0')}`,
    status: STATUSES[(c + o) % 3],
    total: 40 + ((c * 37 + o * 53) % 400),
  })),
}));

/** Order lines, made up from the order id. */
function linesOf(order: Order): OrderLine[] {
  const seed = Number(order.id.slice(4));
  return Array.from({ length: 1 + (seed % 3) }, (_, i) => ({
    id: i + 1,
    item: ITEMS[(seed + i) % ITEMS.length],
    quantity: 1 + ((seed + i * 2) % 5),
    price: 2 + ((seed * 3 + i) % 30),
  }));
}

@Component({
  selector: 'docs-hierarchical-grid-page',
  imports: [DOCS, StarHierarchicalGrid, StarRowIsland],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Hierarchical grid"
      lead="A grid whose rows expand into child grids, level by level: customers, their orders, the lines of each order. Every child grid is a star-table configured from its row island (columns, sort, filter, paging, selection, editing). The Ignite UI equivalent is igx-hierarchical-grid; Kendo UI has the Grid hierarchy; Syncfusion has the hierarchy grid; DevExtreme has master-detail; AG Grid has master/detail."
      importFrom="import { StarHierarchicalGrid, StarRowIsland } from '@star-ng/ui/hierarchical-grid';"
    >
      <docs-example
        heading="Customers, orders and order lines"
        source="hierarchical-grid/customers"
        [script]="customersScript"
        note="Orders come from the orders field of each customer (key). Order lines load when an order opens (childData returns a promise): a loading row shows first. Alt+Arrow Down expands the focused row, Arrow Down goes into its child grid, Control+Arrow Up or Escape goes back to the parent row."
      >
        <div class="docs-stack">
          <star-hierarchical-grid
            [data]="customers"
            [columns]="customerColumns"
            dataKey="id"
            [rowLabel]="customerName"
            ariaLabel="Customers"
            [(expandedRows)]="expanded"
            (rowExpand)="onExpand($event)"
            (childGridCreated)="onChild($event)"
          >
            <star-row-island
              key="orders"
              label="Orders"
              dataKey="id"
              [columns]="orderColumns"
              [rowLabel]="orderId"
            >
              <star-row-island
                label="Order lines"
                dataKey="id"
                [childData]="loadLines"
                [columns]="lineColumns"
              />
            </star-row-island>
          </star-hierarchical-grid>
          <p class="docs-output" role="status">{{ status() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Cancel an expand and load errors"
        source="hierarchical-grid/errors"
        [script]="errorsScript"
        note="rowExpand and rowCollapse can be canceled: Customer 03 stays closed. The order lines of this example fail on the first load: the error row has a Retry button, and the second load works."
      >
        <star-hierarchical-grid
          [data]="fewCustomers"
          [columns]="customerColumns"
          dataKey="id"
          [rowLabel]="customerName"
          ariaLabel="Customers with errors"
          (rowExpand)="blockThird($event)"
        >
          <star-row-island
            key="orders"
            label="Orders"
            dataKey="id"
            [columns]="orderColumns"
            [rowLabel]="orderId"
          >
            <star-row-island
              label="Order lines"
              dataKey="id"
              [childData]="flakyLines"
              [columns]="lineColumns"
            />
          </star-row-island>
        </star-hierarchical-grid>
      </docs-example>

      <docs-api
        [of]="['StarHierarchicalGrid', 'StarRowIsland']"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class HierarchicalGridPage {
  protected readonly customers = CUSTOMERS;
  protected readonly fewCustomers = CUSTOMERS.slice(0, 4);
  protected readonly expanded = signal<readonly unknown[]>([1]);
  protected readonly status = signal('Customer 01 is open.');
  protected readonly customerColumns: StarColumn<Customer>[] = [
    { field: 'id', header: 'Id', width: '5rem', sortable: true },
    { field: 'name', header: 'Name', sortable: true },
    { field: 'city', header: 'City', sortable: true },
  ];
  protected readonly orderColumns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order', sortable: true },
    { field: 'date', header: 'Date', sortable: true },
    { field: 'status', header: 'Status', sortable: true },
    { field: 'total', header: 'Total', sortable: true, align: 'end' },
  ];
  protected readonly lineColumns: StarColumn<OrderLine>[] = [
    { field: 'item', header: 'Item' },
    { field: 'quantity', header: 'Quantity', align: 'end', editable: true, editor: 'number' },
    { field: 'price', header: 'Price', align: 'end' },
  ];
  protected readonly customerName = (row: Customer) => row.name;
  protected readonly orderId = (row: Order) => row.id;
  protected readonly loadLines = (order: Order) =>
    new Promise<OrderLine[]>((resolve) => setTimeout(() => resolve(linesOf(order)), 400));
  private readonly failed = new Set<string>();
  protected readonly flakyLines = (order: Order) =>
    new Promise<OrderLine[]>((resolve, reject) =>
      setTimeout(() => {
        if (this.failed.has(order.id)) resolve(linesOf(order));
        else {
          this.failed.add(order.id);
          reject(new Error('The service did not answer.'));
        }
      }, 300),
    );

  protected onExpand(event: StarHierarchicalRowEvent<Customer>): void {
    const name = event.level === 1 ? event.row.name : String((event.row as unknown as Order).id);
    this.status.set(`${name} opened (level ${event.level}).`);
  }

  protected onChild(event: StarChildGridCreatedEvent<Customer>): void {
    void event.grid;
  }

  protected blockThird(event: StarHierarchicalRowEvent<Customer>): void {
    if (event.level === 1 && event.row.id === 3) event.cancel();
  }

  protected readonly customersScript = `<star-hierarchical-grid [data]="customers" [columns]="customerColumns"
  dataKey="id" [rowLabel]="customerName" [(expandedRows)]="expanded">
  <star-row-island key="orders" label="Orders" dataKey="id" [columns]="orderColumns">
    <star-row-island label="Order lines" [childData]="loadLines" [columns]="lineColumns" />
  </star-row-island>
</star-hierarchical-grid>

readonly loadLines = (order: Order) => this.http.get<OrderLine[]>(\`/api/orders/\${order.id}/lines\`);`;
  protected readonly errorsScript = `blockThird(event: StarHierarchicalRowEvent<Customer>): void {
  if (event.level === 1 && event.row.id === 3) event.cancel();
}`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-border-strong', description: 'The line beside the child grids.' },
    { name: '--star-surface-muted', description: 'Background of the loading row.' },
    { name: '--star-danger, --star-danger-soft', description: 'The error row.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Alt + Arrow down, Alt + Arrow right', description: 'Expand the focused row.' },
    { name: 'Alt + Arrow up, Alt + Arrow left', description: 'Collapse the focused row.' },
    { name: 'Arrow down on an expanded row', description: 'Go into the first child grid.' },
    {
      name: 'Control + Arrow up, Escape',
      description: 'In a child grid: go back to the parent row.',
    },
    { name: 'Other keys', description: 'Cell navigation of each star-table.' },
  ];
}
