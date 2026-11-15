import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { StarColumn } from '@star-ng/ui/table';
import { DocsRow } from '../shared/docs';

/** Sample data for the table pages: fictional orders, deterministic (no random values). */

export type OrderStatus = 'Open' | 'Paid' | 'Shipped' | 'Overdue' | 'Cancelled';

export interface Order {
  readonly id: string;
  readonly customer: string;
  readonly email: string;
  readonly product: string;
  readonly region: string;
  readonly status: OrderStatus;
  readonly placed: Date;
  readonly quantity: number;
  readonly total: number;
}

const CUSTOMERS = [
  'Ava Stone',
  'Ben Carter',
  'Chloe Park',
  'Dev Patel',
  'Elena Ruiz',
  'Farid Khan',
  'Grace Lin',
  'Hugo Weber',
];
const PRODUCTS: readonly (readonly [string, number])[] = [
  ['Cable kit', 12.5],
  ['Desk lamp', 34],
  ['Notebook', 4.8],
  ['Backpack', 59],
  ['Monitor stand', 42],
  ['Keyboard', 79],
];
const REGIONS = ['Europe', 'Asia', 'Americas'];
const STATUSES: readonly OrderStatus[] = ['Open', 'Paid', 'Shipped', 'Overdue', 'Cancelled'];

export const PRODUCT_NAMES: readonly string[] = PRODUCTS.map(([name]) => name);

/** 57 orders: ORD-1001 to ORD-1057. */
export const ORDERS: readonly Order[] = Array.from({ length: 57 }, (_, i) => {
  const customer = CUSTOMERS[(i * 3) % CUSTOMERS.length];
  const [product, price] = PRODUCTS[(i * 5) % PRODUCTS.length];
  const quantity = 1 + ((i * 7) % 9);
  return {
    id: `ORD-${1001 + i}`,
    customer,
    email: `${customer.split(' ')[0].toLowerCase()}@example.com`,
    product,
    region: REGIONS[i % REGIONS.length],
    status: STATUSES[(i * 2) % STATUSES.length],
    placed: new Date(2026, 0, 1 + ((i * 6) % 330)),
    quantity,
    total: Math.round(quantity * price * 100) / 100,
  };
});

export const STATUS_SEVERITY = {
  Open: 'info',
  Paid: 'success',
  Shipped: 'secondary',
  Overdue: 'danger',
  Cancelled: 'warn',
} as const;

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const day = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

export const formatMoney = (value: number): string => money.format(value);
export const formatDay = (value: Date): string => day.format(value);

/** Five columns that most examples start from. */
export function orderColumns(): StarColumn<Order>[] {
  return [
    { field: 'id', header: 'Order', sortable: true },
    { field: 'customer', header: 'Customer', sortable: true },
    { field: 'product', header: 'Product', sortable: true },
    { field: 'status', header: 'Status', sortable: true },
    {
      field: 'total',
      header: 'Total',
      sortable: true,
      align: 'end',
      format: (row) => formatMoney(row.total),
    },
  ];
}

/** Wrapper that gives a table the full width of the live area of an example. */
@Component({
  selector: 'docs-fill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; width: 100%; min-width: 0; }',
  template: '<ng-content />',
})
export class DocsFill {}

/** Plain reference table (name, type, description) for the types and methods of the table. */
@Component({
  selector: 'docs-ref-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="docs-table-wrap">
      <table class="docs-table">
        <caption>
          {{
            title()
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Type</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.name) {
            <tr>
              <th scope="row">
                <code>{{ row.name }}</code>
              </th>
              <td>
                <code>{{ row.type }}</code>
              </td>
              <td>{{ row.description }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class DocsRefTable {
  readonly title = input.required<string>();
  readonly rows = input.required<readonly (DocsRow & { readonly type: string })[]>();
}
