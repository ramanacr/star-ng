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

interface Ticket {
  readonly id: string;
  readonly subject: string;
  readonly status: string;
  readonly city: string;
  readonly owner: string;
  /** Lines in the history of the detail row: 1 to 4. */
  readonly steps: number;
}

const SUBJECTS = [
  'Invoice copy',
  'Change the delivery address of the next order to the office address',
  'Login code does not arrive',
  'The parcel arrived with a torn box, and two items of the packing list are missing',
  'Refund',
  'Add a second user to the account and give the user access to the invoices',
];
const CITIES = ['Lisbon', 'Oslo', 'Prague', 'Seoul', 'Lima', 'Perth', 'Quebec', 'Nairobi'];
const TICKET_STATUSES = ['Open', 'Waiting', 'Closed'];
const HISTORY = ['Received', 'Assigned', 'Answered', 'Closed'];

/** 50,000 support tickets: TCK-00001 to TCK-50000. Subjects of different lengths wrap. */
const TICKETS: readonly Ticket[] = Array.from({ length: 50_000 }, (_, i) => ({
  id: `TCK-${String(i + 1).padStart(5, '0')}`,
  subject: SUBJECTS[(i * 7) % SUBJECTS.length],
  status: TICKET_STATUSES[i % TICKET_STATUSES.length],
  city: CITIES[(i * 5) % CITIES.length],
  owner: USERS[i % USERS.length],
  steps: 1 + (i % 4),
}));

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
        note="groupBy takes a property name or a function. Rows with the same heading show together under a heading row, in the order in which the headings first appear after sorting. The heading is a button that closes the group. collapsedGroups is a two-way model. Groups work with virtualScroll too (see below)."
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
        note="virtualScroll renders only the rows in view, plus 5 above and 5 below. It needs scrollHeight. Without row expansion, groups or the stacked layout, every row has the height virtualRowHeight (48 px by default), cell text stays on one line and the table measures nothing: the fastest mode. The table has 5,000 rows."
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

      <docs-example
        heading="Virtual scroll with row detail"
        source="table-layout/virtual-detail"
        [script]="ticketScript"
        note="Row expansion with virtualScroll gives rows of different heights: the table measures each rendered row and keeps its height. The subject text wraps, and each detail row has 1 to 4 lines. virtualRowHeight is the estimate for rows that were not in view yet. The table has 50,000 rows; the CSV, Excel and print exports still have all of them."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="tickets"
              [columns]="ticketColumns"
              dataKey="id"
              ariaLabel="Tickets with detail"
              selectionMode="multiple"
              [(selection)]="ticketSelection"
              [(expandedKeys)]="ticketsOpen"
              virtualScroll
              [virtualRowHeight]="52"
              scrollHeight="24rem"
              stickyHeader
            >
              <ng-template starRowExpansion [starRowExpansionOf]="tickets" let-row>
                <ol class="history">
                  @for (step of historyOf(row); track step) {
                    <li>{{ step }} by {{ row.owner }} in {{ row.city }}</li>
                  }
                </ol>
              </ng-template>
            </star-table>
          </docs-fill>
          <p class="docs-output" role="status">
            Open: {{ ticketsOpen().length }}, selected: {{ ticketSelection().length }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Virtual scroll with groups"
        source="table-layout/virtual-groups"
        [script]="ticketGroupScript"
        note="groupBy with virtualScroll: the heading rows are part of the virtual list, and the rows of a closed group take no space, so the scroll bar gets shorter. The table has 20,000 rows in 8 groups."
      >
        <div class="docs-stack">
          <docs-fill>
            <star-table
              [value]="groupedTickets"
              [columns]="ticketColumns"
              dataKey="id"
              ariaLabel="Tickets by city"
              groupBy="city"
              [(collapsedGroups)]="closedCities"
              virtualScroll
              [virtualRowHeight]="52"
              scrollHeight="24rem"
              stickyHeader
            />
          </docs-fill>
          <p class="docs-output" role="status">Closed: {{ closedCities().join(', ') || 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Virtual scroll in the stacked layout"
        source="table-layout/virtual-stack"
        note="responsiveLayout stack with virtualScroll: below 40rem of table width each row is a block whose height depends on its content, and the table measures it. Make the window narrow to see it. The table has 1,000 rows."
      >
        <docs-fill>
          <star-table
            [value]="stackedTickets"
            [columns]="ticketColumns"
            dataKey="id"
            ariaLabel="Tickets stacked"
            responsiveLayout="stack"
            virtualScroll
            scrollHeight="24rem"
          />
        </docs-fill>
      </docs-example>

      <docs-api
        [of]="['StarTable', 'StarRowExpansionTemplate']"
        [slots]="slots"
        [keyboard]="keyboard"
      />

      <h2>Virtual scroll: how it works and limits</h2>
      <p>
        With one fixed row height (the default), the table computes the first row from
        <code>scrollTop</code> divided by <code>virtualRowHeight</code> and fills the space of the
        rows left out with two spacer rows. It measures nothing, so this is the fastest mode. Cell
        text stays on one line.
      </p>
      <p>
        Row expansion, <code>groupBy</code> and <code>responsiveLayout="stack"</code> turn on rows
        of different heights; <code>virtualRowHeights="variable"</code> turns them on for wrapped
        cell text. Then:
      </p>
      <ol>
        <li>
          A row that was never in view has the estimated height <code>virtualRowHeight</code> (a row
          with an open detail: two times that). Choose an estimate close to the real average, so the
          scroll bar is accurate from the start.
        </li>
        <li>
          After each render a <code>ResizeObserver</code> measures the rendered rows. The table
          keeps each height by row key (<code>dataKey</code>, else the row object), so sorting and
          filtering keep the heights. New data with new keys starts from the estimate again, and a
          new table width (text wraps differently) clears the heights.
        </li>
        <li>
          The heights are in a prefix-sum tree: the offset of a row, the row at an offset and a
          height change take O(log n), so 100,000 rows stay fast.
        </li>
        <li>
          When a row above the view gets its real height, the table moves the scroll offset by the
          difference, so the rows in view do not jump. A row in view that grows (a detail opens)
          pushes the rows below it down.
        </li>
        <li>
          The row that has the focus stays rendered when it leaves the view, so an open cell editor
          keeps its text and the focus never falls back to the page. Tab from that row scrolls the
          next row in and focuses it.
        </li>
      </ol>
      <p>
        What makes it slow: cell templates that are expensive to render (every scroll renders new
        rows), images without a fixed size (each load measures again), and estimates far from the
        real height (more corrections while scrolling). Prefer paging when users look for a row by
        its position, when a page of 25 to 100 rows is enough, or in lazy mode, where the server
        sends one page at a time. The scroll position is approximate until rows are measured: the
        scroll bar can move a little while you scroll into rows that were never in view.
      </p>
      <p>
        The table has <code>aria-rowcount</code> (header rows, group heading rows, rows, detail rows
        and the footer row), and each rendered row has <code>aria-rowindex</code>, so a screen
        reader knows the position in the full list.
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

  protected readonly tickets: readonly Ticket[] = TICKETS;
  protected readonly groupedTickets: readonly Ticket[] = TICKETS.slice(0, 20_000);
  protected readonly stackedTickets: readonly Ticket[] = TICKETS.slice(0, 1_000);
  protected readonly ticketColumns: StarColumn<Ticket>[] = [
    { field: 'id', header: 'Ticket', width: '7.5rem', sortable: true },
    { field: 'subject', header: 'Subject', sortable: true },
    { field: 'status', header: 'Status', width: '7rem', sortable: true },
    { field: 'city', header: 'City', width: '7rem' },
  ];
  protected readonly ticketsOpen = signal<readonly unknown[]>([]);
  protected readonly ticketSelection = signal<readonly Ticket[]>([]);
  protected readonly closedCities = signal<readonly string[]>([]);

  protected historyOf(ticket: Ticket): readonly string[] {
    return HISTORY.slice(0, ticket.steps);
  }

  protected readonly ticketScript = `readonly tickets: readonly Ticket[] = Array.from({ length: 50_000 }, (_, i) => ({
  id: \`TCK-\${String(i + 1).padStart(5, '0')}\`,
  subject: SUBJECTS[(i * 7) % SUBJECTS.length], // short and long texts
  status: STATUSES[i % STATUSES.length],
  city: CITIES[(i * 5) % CITIES.length],
  owner: USERS[i % USERS.length],
  steps: 1 + (i % 4), // lines in the detail row
}));
readonly ticketsOpen = signal<readonly unknown[]>([]);
readonly ticketSelection = signal<readonly Ticket[]>([]);
historyOf(ticket: Ticket) {
  return ['Received', 'Assigned', 'Answered', 'Closed'].slice(0, ticket.steps);
}`;
  protected readonly ticketGroupScript = `readonly groupedTickets = tickets.slice(0, 20_000);
readonly closedCities = signal<readonly string[]>([]);`;

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
        'Moves through the buttons of the rows. Rows of a closed group are hidden and have no tab stops. With virtualScroll the rows follow the focus: Tab reaches every row, and Tab from a focused row that is out of view scrolls the next row in and focuses it.',
    },
    {
      name: 'Arrow keys, Page Up / Page Down, Home / End',
      description:
        'In the scroll area of a table without controls in its rows (Chrome and Firefox give that area a tab stop): scroll it. With virtualScroll the rows in view render as it scrolls.',
    },
  ];
}
