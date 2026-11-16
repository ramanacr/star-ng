import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarInput } from '@star-ng/ui/field';
import {
  StarCellTemplate,
  StarColumn,
  StarColumnFilters,
  StarSortOrder,
  StarSortState,
  StarTable,
} from '@star-ng/ui/table';
import { StarTag } from '@star-ng/ui/tag';
import { DOCS, DocsRow } from '../shared/docs';
import { DocsFill, formatDay, formatMoney, Order, ORDERS, STATUS_SEVERITY } from './table-demo';

@Component({
  selector: 'docs-table-sort-filter-page',
  imports: [DOCS, StarTable, StarCellTemplate, StarTag, StarButton, StarInput, DocsFill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Table sorting and filtering"
      lead="Sort by one or more columns and filter the rows with a global search or with a filter in each column. Sorting and filtering run in the browser; the lazy mode on the Table paging page sends them to a server instead."
      importFrom="import { StarTable, StarColumn, StarColumnFilters } from '@star-ng/ui/table';"
    >
      <docs-example
        heading="Sorting"
        source="table-sort-filter/sort"
        [script]="sortScript"
        note="A column with sortable: true has a header button. Click, Enter or Space sorts ascending, then descending. sortField and sortOrder are two-way models, so the owner can set the sort too."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="orders"
              [columns]="sortColumns"
              dataKey="id"
              ariaLabel="Sortable orders"
              [(sortField)]="sortField"
              [(sortOrder)]="sortOrder"
              paginator
              [rows]="4"
            />
          </docs-fill>
          <p class="docs-output" role="status">
            Sort: {{ sortField() ?? 'none' }} ({{ sortOrder() === 1 ? 'ascending' : 'descending' }})
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Sort by several columns"
        source="table-sort-filter/multi"
        [script]="multiScript"
        note="With multiSort, Shift + click (or Shift + Enter) on a header adds the column as the next sort column. A plain click sorts by that column only. A number on the header shows the priority. sortMeta lists the sort columns."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="orders"
              [columns]="sortColumns"
              dataKey="id"
              ariaLabel="Orders sorted by several columns"
              multiSort
              [(sortMeta)]="sortMeta"
              paginator
              [rows]="4"
            />
          </docs-fill>
          <p class="docs-output" role="status">Sorts: {{ sortText() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Global filter"
        source="table-sort-filter/global"
        [script]="globalScript"
        note="globalFilter is a one-way input. The table searches the display text of every column, and it ignores case and accents. A new filter goes back to page 1."
      >
        <div class="docs-stack">
          <input
            starInput
            type="search"
            aria-label="Search orders"
            placeholder="Search orders"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
          />
          <docs-fill>
            <star-table
              [value]="orders"
              [columns]="sortColumns"
              dataKey="id"
              ariaLabel="Searchable orders"
              [globalFilter]="query()"
              paginator
              [rows]="4"
            />
          </docs-fill>
        </div>
      </docs-example>

      <docs-example
        heading="Column filters"
        source="table-sort-filter/columns"
        [script]="filterScript"
        note="filter on a column adds a field in a second header row: text, select, multiselect, number or date. The filters model holds the values by column field. The owner can set it, and clearFilters() empties it."
      >
        <div class="docs-stack">
          <star-button size="sm" variant="secondary" (pressed)="filtered.clearFilters()">
            Clear filters
          </star-button>
          <docs-fill>
            <star-table
              #filtered
              [value]="orders"
              [columns]="filterColumns"
              dataKey="id"
              ariaLabel="Orders with column filters"
              [(filters)]="filters"
              paginator
              [rows]="4"
            >
              <ng-template starCell="status" [starCellOf]="orders" let-row>
                <star-tag [severity]="severityOf(row.status)" [value]="row.status" rounded />
              </ng-template>
            </star-table>
          </docs-fill>
          <p class="docs-output" role="status">Filters: {{ filterText() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Combined"
        source="table-sort-filter/combined"
        note="Filters, the global filter and the sort work together. The global filter narrows the rows first, then the column filters, then the sort orders what is left."
      >
        <div class="docs-stack">
          <input
            starInput
            type="search"
            aria-label="Search combined orders"
            placeholder="Search combined orders"
            [value]="combinedQuery()"
            (input)="combinedQuery.set($any($event.target).value)"
          />
          <docs-fill>
            <star-table
              [value]="orders"
              [columns]="filterColumns"
              dataKey="id"
              ariaLabel="Orders with search, filters and sort"
              [globalFilter]="combinedQuery()"
              size="sm"
              paginator
              [rows]="4"
            />
          </docs-fill>
        </div>
      </docs-example>

      <docs-api [of]="['StarTable']" [slots]="slots" [keyboard]="keyboard" />

      <h2>Technical notes</h2>
      <p>
        The text filter and the global filter match case- and accent-insensitive substrings of the
        display text. The select filter needs the exact display text. It is a small
        <code>star-select</code> with a clear button: "All" is its placeholder, and the clear button
        shows every row again. The multiselect filter keeps the rows whose display text is in the
        list. The number filter compares the cell value, and the date filter compares the local
        calendar day of the cell value, so a <code>format</code> function does not change what a
        range matches.
      </p>
      <p>
        <code>aria-sort</code> is set on one header only: the first sort column. The other sortable
        headers have <code>aria-sort="none"</code>.
      </p>
    </docs-page>
  `,
})
export class TableSortFilterPage {
  protected readonly orders: readonly Order[] = ORDERS;
  protected readonly severityOf = (status: Order['status']) => STATUS_SEVERITY[status];

  protected readonly sortColumns: StarColumn<Order>[] = [
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
  protected readonly sortField = signal<string | null>(null);
  protected readonly sortOrder = signal<StarSortOrder>(1);
  protected readonly sortMeta = signal<readonly StarSortState[]>([]);
  protected sortText(): string {
    const meta = this.sortMeta();
    return meta.length
      ? meta.map((sort) => `${sort.field} ${sort.order === 1 ? 'up' : 'down'}`).join(', ')
      : 'none';
  }

  protected readonly query = signal('');
  protected readonly combinedQuery = signal('');

  protected readonly filters = signal<StarColumnFilters>({});
  protected filterText(): string {
    return JSON.stringify(this.filters());
  }
  protected readonly filterColumns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order', sortable: true },
    { field: 'customer', header: 'Customer', sortable: true, filter: 'text' },
    {
      field: 'region',
      header: 'Region',
      filter: 'select',
      filterOptions: ['Europe', 'Asia', 'Americas'],
    },
    { field: 'status', header: 'Status', filter: 'multiselect' },
    {
      field: 'placed',
      header: 'Placed',
      sortable: true,
      filter: 'date',
      value: (row) => row.placed,
      format: (row) => formatDay(row.placed),
    },
    {
      field: 'total',
      header: 'Total',
      sortable: true,
      align: 'end',
      filter: 'number',
      format: (row) => formatMoney(row.total),
    },
  ];

  protected readonly sortScript = `readonly sortField = signal<string | null>(null);
readonly sortOrder = signal<StarSortOrder>(1); // 1 ascending, -1 descending`;
  protected readonly multiScript = `readonly sortMeta = signal<readonly StarSortState[]>([]);`;
  protected readonly globalScript = `readonly query = signal('');`;
  protected readonly filterScript = `readonly filters = signal<StarColumnFilters>({});
readonly filterColumns: StarColumn<Order>[] = [
  { field: 'customer', header: 'Customer', filter: 'text' },
  { field: 'region', header: 'Region', filter: 'select', filterOptions: ['Europe', 'Asia', 'Americas'] },
  { field: 'status', header: 'Status', filter: 'multiselect' },
  { field: 'placed', header: 'Placed', filter: 'date', value: (row) => row.placed },
  { field: 'total', header: 'Total', filter: 'number' },
];`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'column.filter',
      description:
        "'text': the display text contains the query. 'select': the display text equals the choice. 'multiselect': the display text is one of the choices. 'number': the value is in a range { min, max }. 'date': the day is in a range { min, max } as yyyy-mm-dd.",
    },
    {
      name: 'column.filterOptions',
      description:
        'Choices of a select or multiselect filter. Default: the distinct display texts of the column, sorted.',
    },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Enter / Space',
      description: 'On a sortable header: sorts by the column. A second press reverses the order.',
    },
    {
      name: 'Shift + Enter / Shift + Space',
      description:
        'On a sortable header with multiSort: adds the column to the sort, or reverses its order.',
    },
    {
      name: 'Tab',
      description: 'Moves from the header buttons to the filter fields of the second header row.',
    },
  ];
}
