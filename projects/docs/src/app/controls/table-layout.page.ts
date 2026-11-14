import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarButton } from 'star-ng/button';
import { StarColumn, StarRowExpansionTemplate, StarTable } from 'star-ng/table';
import { StarToggleSwitch } from 'star-ng/toggle-switch';
import { DOCS, DocsRow } from '../shared/docs';
import { DocsFill, formatMoney, Order, orderColumns, ORDERS } from './table-demo';

interface LogEntry {
  readonly id: string;
  readonly action: string;
  readonly user: string;
  readonly order: string;
}

const ACTIONS = ['Created', 'Updated', 'Paid', 'Shipped', 'Cancelled'];
const USERS = ['ava', 'ben', 'chloe', 'dev'];

/** 5,000 log lines: ENT-00001 to ENT-05000. */
const LOG: readonly LogEntry[] = Array.from({ length: 5000 }, (_, i) => ({
  id: `ENT-${String(i + 1).padStart(5, '0')}`,
  action: ACTIONS[i % ACTIONS.length],
  user: USERS[(i * 3) % USERS.length],
  order: `ORD-${1001 + (i % 57)}`,
}));

@Component({
  selector: 'docs-table-layout-page',
  imports: [DOCS, StarTable, StarRowExpansionTemplate, StarButton, StarToggleSwitch, DocsFill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Table layout"
      lead="Show more than one line of data per row: row detail, row groups and a footer. Fit the table to a phone with the stacked layout, and render thousands of rows with virtual scroll."
      importFrom="import { StarTable, StarRowExpansionTemplate } from 'star-ng/table';"
    >
      <docs-example
        heading="Row expansion"
        source="table-layout/expansion"
        [script]="expansionScript"
        note="An ng-template with starRowExpansion gives each row an expand button. The detail shows in a row below. expandedKeys (the dataKey values) is a two-way model. rowExpandMode single closes the other rows when a row opens. expandAll() opens the rows of the page and collapseAll() closes all."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-toggle-switch [(checked)]="single">One row open at a time</star-toggle-switch>
            <star-button size="sm" variant="secondary" (pressed)="detailed.expandAll()">
              Expand all
            </star-button>
            <star-button size="sm" variant="secondary" (pressed)="detailed.collapseAll()">
              Collapse all
            </star-button>
          </div>
          <docs-fill>
            <star-table
              #detailed
              [value]="orders"
              [columns]="columns"
              dataKey="id"
              ariaLabel="Orders with detail"
              [rowExpandMode]="single() ? 'single' : 'multiple'"
              [(expandedKeys)]="expanded"
              paginator
              [rows]="4"
            >
              <ng-template starRowExpansion [starRowExpansionOf]="orders" let-row>
                <dl class="detail">
                  <dt>Email</dt>
                  <dd>{{ row.email }}</dd>
                  <dt>Quantity</dt>
                  <dd>{{ row.quantity }} x {{ row.product }}</dd>
                </dl>
              </ng-template>
            </star-table>
          </docs-fill>
          <p class="docs-output" role="status">Open: {{ expanded().join(', ') || 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Row groups"
        source="table-layout/groups"
        [script]="groupScript"
        note="groupBy takes a property name or a function. Rows with the same heading show together under a heading row, in the order in which the headings first appear after sorting. The heading is a button that closes the group. collapsedGroups is a two-way model. Do not use groups with virtualScroll."
      >
        <div class="docs-stack">
          <star-toggle-switch [(checked)]="grouped">Group by region</star-toggle-switch>
          <docs-fill>
            <star-table
              [value]="orders.slice(0, 12)"
              [columns]="columns"
              dataKey="id"
              ariaLabel="Orders in groups"
              [groupBy]="grouped() ? 'region' : null"
              [(collapsedGroups)]="closed"
            />
          </docs-fill>
          <p class="docs-output" role="status">Closed: {{ closed().join(', ') || 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Footer"
        source="table-layout/footer"
        [script]="footerScript"
        note="footer on a column is fixed text, or a function that gets the filtered rows of all pages. The table has a footer row when at least one visible column has a footer."
      >
        <docs-fill>
          <star-table
            [value]="orders.slice(0, 6)"
            [columns]="footerColumns"
            dataKey="id"
            ariaLabel="Orders with totals"
          />
        </docs-fill>
      </docs-example>

      <docs-example
        heading="Stacked layout"
        source="table-layout/stack"
        note="responsiveLayout stack changes the layout when the table is narrower than 40rem. Each row becomes a block with one line per column (label and value). The sortable headers stay as a row of buttons. The default, scroll, keeps the table and scrolls it sideways."
      >
        <div class="docs-stack">
          <star-table
            [value]="orders.slice(0, 3)"
            [columns]="columns"
            dataKey="id"
            ariaLabel="Orders stacked"
            responsiveLayout="stack"
          />
        </div>
      </docs-example>

      <docs-example
        heading="Virtual scroll"
        source="table-layout/virtual"
        [script]="virtualScript"
        note="virtualScroll renders only the rows in view, plus 5 above and 5 below. It needs scrollHeight. Every row has the height virtualRowHeight (48 px by default) and cell text stays on one line. The table has 5,000 rows."
      >
        <docs-fill>
          <star-table
            [value]="log"
            [columns]="logColumns"
            dataKey="id"
            ariaLabel="Audit log"
            virtualScroll
            [virtualRowHeight]="44"
            scrollHeight="20rem"
            stickyHeader
            striped
          />
        </docs-fill>
      </docs-example>

      <docs-api
        [of]="['StarTable', 'StarRowExpansionTemplate']"
        [slots]="slots"
        [keyboard]="keyboard"
      />

      <h2>Technical notes</h2>
      <p>
        Virtual scroll computes the first row from <code>scrollTop</code> divided by the row height,
        and fills the space of the rows left out with two spacer rows. For that reason every row
        must have the same height. Do not combine it with row expansion (a detail row changes the
        height), row groups or the stacked layout. The table has <code>aria-rowcount</code>, and
        each rendered row has <code>aria-rowindex</code>, so a screen reader knows the position in
        the full list.
      </p>
      <p>
        An expanded row has <code>aria-expanded</code> on its button and
        <code>aria-controls</code> that points to the detail row. A group heading button has
        <code>aria-expanded</code> too.
      </p>
    </docs-page>
  `,
})
export class TableLayoutPage {
  protected readonly orders: readonly Order[] = ORDERS;
  protected readonly columns: StarColumn<Order>[] = orderColumns();
  protected readonly single = signal(false);
  protected readonly expanded = signal<readonly unknown[]>([]);
  protected readonly grouped = signal(false);
  protected readonly closed = signal<readonly string[]>([]);

  protected readonly footerColumns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order', footer: 'Total' },
    { field: 'customer', header: 'Customer' },
    {
      field: 'quantity',
      header: 'Quantity',
      align: 'end',
      footer: (rows) => String(rows.reduce((sum, row) => sum + row.quantity, 0)),
    },
    {
      field: 'total',
      header: 'Total',
      align: 'end',
      format: (row) => formatMoney(row.total),
      footer: (rows) => formatMoney(rows.reduce((sum, row) => sum + row.total, 0)),
    },
  ];

  protected readonly log: readonly LogEntry[] = LOG;
  protected readonly logColumns: StarColumn<LogEntry>[] = [
    { field: 'id', header: 'Entry', width: '8rem', sortable: true },
    { field: 'action', header: 'Action', sortable: true },
    { field: 'user', header: 'User', sortable: true },
    { field: 'order', header: 'Order', width: '9rem' },
  ];

  protected readonly expansionScript = `readonly single = signal(false);
readonly expanded = signal<readonly unknown[]>([]);
// The template reference #detailed gives access to expandAll() and collapseAll().`;
  protected readonly groupScript = `readonly grouped = signal(false);
readonly closed = signal<readonly string[]>([]);`;
  protected readonly footerScript = `readonly footerColumns: StarColumn<Order>[] = [
  { field: 'id', header: 'Order', footer: 'Total' },
  { field: 'customer', header: 'Customer' },
  {
    field: 'quantity',
    header: 'Quantity',
    footer: (rows) => String(rows.reduce((sum, row) => sum + row.quantity, 0)),
  },
  {
    field: 'total',
    header: 'Total',
    format: (row) => formatMoney(row.total),
    footer: (rows) => formatMoney(rows.reduce((sum, row) => sum + row.total, 0)),
  },
];`;
  protected readonly virtualScript = `readonly log: readonly LogEntry[] = Array.from({ length: 5000 }, (_, i) => ({
  id: \`ENT-\${String(i + 1).padStart(5, '0')}\`,
  action: ACTIONS[i % ACTIONS.length],
  user: USERS[(i * 3) % USERS.length],
  order: \`ORD-\${1001 + (i % 57)}\`,
}));`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starRowExpansion]',
      description:
        'Detail of an expanded row, in a row below it that spans all columns. The context has $implicit (the row) and index.',
    },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Enter / Space',
      description: 'On an expand button or a group heading: opens or closes it.',
    },
    {
      name: 'Tab',
      description:
        'Moves through the buttons of the rows. Rows of a closed group are hidden and have no tab stops.',
    },
  ];
}
