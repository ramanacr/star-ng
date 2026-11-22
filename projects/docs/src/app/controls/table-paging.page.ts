import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import {
  StarColumn,
  StarLazyLoadEvent,
  StarPaginatorEndTemplate,
  StarPaginatorStartTemplate,
  StarTable,
} from '@star-ng/ui/table';
import { DOCS, DocsRow } from '../shared/docs';
import { DocsFill, formatMoney, Order, orderColumns, ORDERS } from './table-demo';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './table-paging.page.scss',
  selector: 'docs-table-paging-page',
  imports: [DOCS, StarTable, StarPaginatorStartTemplate, StarPaginatorEndTemplate, DocsFill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Table paging"
      lead="The table has a built-in paginator. In client mode it slices the rows itself. In lazy mode it shows the rows that you load and tells you which page, sort and filters it needs."
      importFrom="import { StarTable, StarLazyLoadEvent } from '@star-ng/ui/table';"
    >
      <docs-example
        heading="Client paging"
        source="table-paging/client"
        [script]="clientScript"
        note="paginator adds the paginator below the table. first (the index of the first row) and rows (the page size) are two-way models. rowsPerPageOptions fills the page size select."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="orders"
              [columns]="columns"
              dataKey="id"
              ariaLabel="Paged orders"
              paginator
              [(first)]="first"
              [(rows)]="rows"
              [rowsPerPageOptions]="[5, 10, 20]"
            />
          </docs-fill>
          <p class="docs-output" role="status">first = {{ first() }}, rows = {{ rows() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Paginator content"
        source="table-paging/paginator-slots"
        note="An ng-template with starPaginatorStart or starPaginatorEnd puts content at the start or the end of the paginator (logical sides, so they swap in right-to-left). The context is the page state: first, rows, page and pageCount."
      >
        <docs-fill>
          <star-table
            [value]="orders"
            [columns]="columns"
            dataKey="id"
            ariaLabel="Orders with paginator content"
            paginator
            [rows]="5"
          >
            <ng-template starPaginatorStart let-state>
              <span>Page {{ state.page + 1 }} of {{ state.pageCount }}</span>
            </ng-template>
            <ng-template starPaginatorEnd>
              <span>{{ orders.length }} orders</span>
            </ng-template>
          </star-table>
        </docs-fill>
      </docs-example>

      <docs-example
        heading="Lazy loading"
        source="table-paging/lazy"
        [script]="lazyScript"
        note="With lazy, the table renders value as it is and does not sort, filter or slice. It emits lazyLoad on start and on every page, sort or filter change. Set totalRecords to the number of rows on the server and loading while the request runs. Here a timer plays the server."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="lazyRows()"
              [columns]="lazyColumns"
              dataKey="id"
              ariaLabel="Orders from the server"
              lazy
              paginator
              [rows]="5"
              [rowsPerPageOptions]="[5, 10]"
              [totalRecords]="lazyTotal()"
              [loading]="lazyLoading()"
              (lazyLoad)="load($event)"
            />
          </docs-fill>
          <p class="docs-output" role="status">Last request: {{ request() }}</p>
        </div>
      </docs-example>

      <docs-api [of]="['StarTable']" [keyboard]="keyboard" />

      <h2>Technical notes</h2>
      <p>
        A new global filter or column filter sets <code>first</code> back to 0. In lazy mode the
        export methods only know the rows that are loaded: pass all rows with the
        <code>rows</code> option (see Table export). The paginator is the same control as on the
        Paginator page, so its keyboard and labels are the same.
      </p>
    </docs-page>
  `,
})
export class TablePagingPage {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly orders: readonly Order[] = ORDERS;
  protected readonly columns: StarColumn<Order>[] = orderColumns();
  protected readonly first = signal(0);
  protected readonly rows = signal(5);

  protected readonly lazyColumns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order', sortable: true },
    { field: 'customer', header: 'Customer', sortable: true, filter: 'text' },
    { field: 'product', header: 'Product', sortable: true },
    {
      field: 'total',
      header: 'Total',
      sortable: true,
      align: 'end',
      format: (row) => formatMoney(row.total),
    },
  ];
  protected readonly lazyRows = signal<readonly Order[]>([]);
  protected readonly lazyTotal = signal(0);
  protected readonly lazyLoading = signal(false);
  protected readonly request = signal('none yet');
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.timer));
  }

  /** A fake server: filters, sorts and slices the sample orders after a short delay. */
  protected load(event: StarLazyLoadEvent): void {
    this.request.set(
      `first ${event.first}, rows ${event.rows}, sort ${event.field ?? 'none'}, filter ${JSON.stringify(event.filters)}`,
    );
    this.lazyLoading.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const customer = event.filters['customer'];
      let matches = ORDERS.filter(
        (order) =>
          typeof customer !== 'string' ||
          order.customer.toLowerCase().includes(customer.toLowerCase()),
      );
      const field = event.field as keyof Order | null;
      if (field) {
        matches = [...matches].sort(
          (a, b) =>
            event.order * String(a[field]).localeCompare(String(b[field]), 'en', { numeric: true }),
        );
      }
      this.lazyTotal.set(matches.length);
      this.lazyRows.set(matches.slice(event.first, event.first + event.rows));
      this.lazyLoading.set(false);
    }, 150);
  }

  protected readonly clientScript = `readonly first = signal(0);
readonly rows = signal(5);`;
  protected readonly lazyScript = `// The table asks for a page; httpResource loads it again when the request changes.
readonly request = signal<StarLazyLoadEvent | null>(null);
readonly page = httpResource<{ rows: Order[]; total: number }>(() => {
  const event = this.request();
  if (!event) return undefined; // nothing to load yet
  return {
    url: '/api/orders',
    params: {
      first: event.first,
      rows: event.rows,
      sortField: event.field ?? '',
      sortOrder: event.order,
      filter: event.filter,
      // Column filters and all sort columns (multiSort) go as JSON text.
      filters: JSON.stringify(event.filters),
      sorts: JSON.stringify(event.sorts),
    },
  };
});

// [value]="page.value()?.rows ?? []" [totalRecords]="page.value()?.total ?? 0"
// [loading]="page.isLoading()" (lazyLoad)="request.set($event)"`;

  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab',
      description: 'Moves the focus through the paginator buttons and the rows select.',
    },
    { name: 'Enter / Space', description: 'On a paginator button: goes to that page.' },
  ];
}
