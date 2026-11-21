import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarCellTemplate, StarColumn, StarTable } from '@star-ng/ui/table';
import { StarTag } from '@star-ng/ui/tag';
import { DOCS, DocsRow } from '../shared/docs';
import {
  DocsFill,
  DocsRefTable,
  formatDay,
  formatMoney,
  Order,
  ORDERS,
  STATUS_SEVERITY,
} from './table-demo';

/** One invoice of the print examples. */
interface Invoice {
  readonly id: string;
  readonly customer: string;
  readonly project: string;
  readonly status: string;
  readonly region: string;
  readonly quantity: number;
  readonly amount: number;
  readonly note: string;
}

const INVOICE_CUSTOMERS = ['Ava Stone', 'Ben Carter', 'Chloe Park', 'Dev Patel', 'Elena Ruiz'];
const INVOICE_PROJECTS = ['Website rebuild', 'Warehouse scanner', 'Mobile app', 'Data import'];
const INVOICE_STATUSES = ['Open', 'Paid', 'Overdue'];
const INVOICE_REGIONS = ['Europe', 'Asia', 'Americas'];
const SHORT_NOTES = ['', 'Paid in two parts', 'Reminder sent', 'Needs a purchase order'];

/** 240 invoices. Row 13 has a long unbroken signature text; every 7th row has a long note. */
const INVOICES: readonly Invoice[] = Array.from({ length: 240 }, (_, i) => ({
  id: `INV-${String(i + 1).padStart(4, '0')}`,
  customer: INVOICE_CUSTOMERS[(i * 3) % INVOICE_CUSTOMERS.length],
  project: INVOICE_PROJECTS[(i * 5) % INVOICE_PROJECTS.length],
  status: INVOICE_STATUSES[(i * 2) % INVOICE_STATUSES.length],
  region: INVOICE_REGIONS[i % INVOICE_REGIONS.length],
  quantity: 1 + ((i * 7) % 9),
  amount: Math.round((50 + ((i * 37) % 900) + ((i * 13) % 100) / 100) * 100) / 100,
  note:
    i === 12
      ? 'Signature Q2FsY3VsYXRlZC1mcm9tLXRoZS1zaWduZWQtYWNjZXB0YW5jZS1mb3JtLTIwMjYtMDEtMTUtdmVyeS1sb25nLXJlZmVyZW5jZS1mb3ItdGhlLXdyYXAtY2hlY2s'
      : i % 7 === 3
        ? 'Delivery in two steps: the hardware arrives first, the training and the data import follow after the customer has signed the acceptance form for the first step.'
        : SHORT_NOTES[i % SHORT_NOTES.length],
}));

/** A row of the wide table: 16 columns, wider than a portrait page. */
type WideRow = Readonly<Record<string, string | number>>;
const WIDE_FIELDS = [
  'Order',
  'Customer',
  'Email',
  'Product',
  'Region',
  'Status',
  'Placed',
  'Shipped',
  'Quantity',
  'Unit price',
  'Discount',
  'Tax',
  'Total',
  'Carrier',
  'Tracking',
  'Note',
] as const;
const WIDE_ROWS: readonly WideRow[] = Array.from({ length: 30 }, (_, i) => ({
  Order: `ORD-${1001 + i}`,
  Customer: INVOICE_CUSTOMERS[i % INVOICE_CUSTOMERS.length],
  Email: `${INVOICE_CUSTOMERS[i % INVOICE_CUSTOMERS.length].split(' ')[0].toLowerCase()}@example.com`,
  Product: INVOICE_PROJECTS[i % INVOICE_PROJECTS.length],
  Region: INVOICE_REGIONS[i % INVOICE_REGIONS.length],
  Status: INVOICE_STATUSES[i % INVOICE_STATUSES.length],
  Placed: `2026-01-${String(1 + (i % 28)).padStart(2, '0')}`,
  Shipped: `2026-02-${String(1 + (i % 28)).padStart(2, '0')}`,
  Quantity: 1 + (i % 9),
  'Unit price': 10 + i,
  Discount: i % 10,
  Tax: i % 5,
  Total: 100 + i * 3,
  Carrier: 'Example Freight',
  Tracking: `TRK-${100000 + i * 17}`,
  Note: i % 4 === 0 ? 'Fragile goods' : '',
}));

/** One part of the formatted print example: numbers that a `format` function turns into text. */
interface Part {
  readonly code: string;
  readonly name: string;
  readonly zone: string;
  readonly stock: number;
  readonly price: number;
}
const PARTS: readonly Part[] = [
  { code: 'PRT-100', name: 'Steel bolt', zone: 'North', stock: 1250, price: 0.35 },
  { code: 'PRT-101', name: 'Brass washer', zone: 'North', stock: 48, price: 12.5 },
  { code: 'PRT-102', name: 'Cable tie', zone: 'South', stock: 9, price: 120 },
  { code: 'PRT-103', name: 'Hinge', zone: 'East', stock: 305, price: 7.75 },
];

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './table-export.page.scss',
  selector: 'docs-table-export-page',
  imports: [DOCS, StarTable, StarCellTemplate, StarTag, StarButton, DocsFill, DocsRefTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Table export"
      lead="Download the table as a CSV file or an Excel workbook, or print it. The export uses the visible columns in display order and the rows after filtering and sorting, on all pages. No third-party library is used: the Excel file is built in the browser."
      importFrom="import { StarTable, StarExportOptions, StarCsvOptions } from '@star-ng/ui/table';"
    >
      <docs-example
        heading="Download and print"
        source="table-export/basic"
        [script]="basicScript"
        note="exportCsv, exportExcel and print are methods of the table: get the table with a template reference. Each takes an options object. The CSV file starts with a byte order mark so that Excel reads UTF-8 text. print opens the browser print dialog, where the user can also save a PDF."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button
              size="sm"
              variant="secondary"
              leadingIcon="ph-bold ph-download-simple"
              (pressed)="exportTable.exportCsv({ fileName: 'orders' })"
            >
              Export CSV
            </star-button>
            <star-button
              size="sm"
              variant="secondary"
              leadingIcon="ph-bold ph-microsoft-excel-logo"
              (pressed)="exportTable.exportExcel({ fileName: 'orders' })"
            >
              Export Excel
            </star-button>
            <star-button
              size="sm"
              variant="secondary"
              leadingIcon="ph-bold ph-printer"
              (pressed)="exportTable.print()"
            >
              Print
            </star-button>
            <star-button
              size="sm"
              variant="secondary"
              [disabled]="!selected().length"
              (pressed)="
                exportTable.exportCsv({ fileName: 'selected-orders', selectionOnly: true })
              "
            >
              Export selected rows
            </star-button>
          </div>
          <docs-fill>
            <star-table
              #exportTable
              ariaLabel="Orders"
              [value]="orders"
              [columns]="columns"
              dataKey="id"
              selectionMode="multiple"
              [(selection)]="selected"
              paginator
              [rows]="5"
            >
              <ng-template starCell="status" [starCellOf]="orders" let-row>
                <star-tag [severity]="severityOf(row.status)" [value]="row.status" rounded />
              </ng-template>
              <ng-template starCell="customer" [starCellOf]="orders" let-row let-value="value">
                <strong>{{ value }}</strong>
                <br />
                <small>{{ row.email }}</small>
              </ng-template>
            </star-table>
          </docs-fill>
          <p class="docs-output" role="status">{{ selected().length }} selected</p>
        </div>
      </docs-example>

      <docs-example
        heading="Export text and options"
        source="table-export/text"
        [script]="textScript"
        note="toCsv and toXlsx return the data without a download, for a test or an upload. separator changes the CSV field separator. rows exports rows that you pass instead of the table rows: use it in lazy mode, where the table holds one page only. selectionOnly exports the selected rows. title is the sheet name (Excel) or the heading (print)."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button size="sm" variant="secondary" (pressed)="show(preview.toCsv())">
              Comma separated
            </star-button>
            <star-button
              size="sm"
              variant="secondary"
              (pressed)="show(preview.toCsv({ separator: ';' }))"
            >
              Semicolon separated
            </star-button>
            <star-button
              size="sm"
              variant="secondary"
              (pressed)="show(preview.toCsv({ rows: [orders[40]] }))"
            >
              Rows from the options
            </star-button>
          </div>
          <docs-fill>
            <star-table
              #preview
              ariaLabel="Order preview"
              [value]="orders.slice(0, 3)"
              [columns]="columns"
              dataKey="id"
            />
          </docs-fill>
          <pre class="docs-output" aria-label="CSV text" tabindex="0">{{ text() }}</pre>
        </div>
      </docs-example>

      <docs-example
        heading="Print a long table"
        source="table-export/print-long"
        [script]="printLongScript"
        note="The table shows 10 rows per page, but print prints all 240 filtered rows in the current sort order. The Region column is hidden, the Open column (a button) has exportable: false, and the selection column is never printed. A long unbroken signature text and long notes wrap inside their cells."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button
              size="sm"
              variant="secondary"
              leadingIcon="ph-bold ph-printer"
              (pressed)="longTable.print()"
            >
              Print invoices
            </star-button>
          </div>
          <docs-fill>
            <star-table
              #longTable
              ariaLabel="Invoices"
              [value]="invoices"
              [columns]="invoiceColumns"
              dataKey="id"
              selectionMode="multiple"
              [hiddenColumns]="['region']"
              paginator
              [rows]="10"
            >
              <ng-template starCell="open" [starCellOf]="invoices" let-row>
                <star-button size="sm" variant="secondary" (pressed)="opened.set(row.id)">
                  Open
                </star-button>
              </ng-template>
            </star-table>
          </docs-fill>
          <p class="docs-output" role="status">Opened: {{ opened() || 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Print a wide table"
        source="table-export/print-wide"
        [script]="printWideScript"
        note="This table has 16 columns, more than a portrait page can show at the normal text size. See What the printout looks like for what the print engine does."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button
              size="sm"
              variant="secondary"
              leadingIcon="ph-bold ph-printer"
              (pressed)="wideTable.print()"
            >
              Print wide table
            </star-button>
          </div>
          <docs-fill>
            <star-table
              #wideTable
              ariaLabel="Wide orders"
              [value]="wideRows"
              [columns]="wideColumns"
              dataKey="Order"
            />
          </docs-fill>
        </div>
      </docs-example>

      <docs-example
        heading="Print formatted numbers"
        source="table-export/print-format"
        [script]="printFormatScript"
        note="Stock and Price have a format function, so their cell text is a string (for example 1,250 pcs). The printout still aligns both columns to the end, and their headers too: Stock because every value is a number, Price because of align: 'end'. Zone has align: 'center'."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button
              size="sm"
              variant="secondary"
              leadingIcon="ph-bold ph-printer"
              (pressed)="partsTable.print()"
            >
              Print parts
            </star-button>
          </div>
          <docs-fill>
            <star-table
              #partsTable
              ariaLabel="Parts"
              [value]="parts"
              [columns]="partColumns"
              dataKey="code"
            />
          </docs-fill>
        </div>
      </docs-example>

      <docs-api [of]="['StarTable']" [slots]="slots" />
      <docs-ref-table
        title="Export options (StarExportOptions, StarCsvOptions)"
        [rows]="optionRows"
      />

      <h2>Technical notes</h2>
      <p>
        A cell uses the column <code>exportValue</code> when it has one, else the display text
        (<code>format</code> or <code>value</code>). A custom cell template is not exported. A
        number stays a number in Excel when the column has neither <code>format</code> nor
        <code>exportValue</code> that returns text.
      </p>
      <p>
        Text that a spreadsheet would read as a formula (it starts with <code>=</code>,
        <code>+</code>, <code>-</code> or <code>@</code>) gets a leading apostrophe in the CSV file,
        so exported user data cannot run as a formula. In the Excel file all text is stored as
        inline strings, which are never formulas.
      </p>
      <p>
        The Excel file is a ZIP archive of small XML parts, written without compression, with one
        sheet and a bold header row. The sheet name is 31 characters at most.
      </p>
      <p>
        <code>print</code> adds a hidden frame (<code>iframe</code>) to the page, writes a plain
        document with one table into it (with its own style rules: borders, a repeated header on
        each page, no page break inside a row), measures the table in the frame and adds the rules
        that make it fit the paper (wrapping, smaller text), calls the print dialog of the frame and
        removes the frame after printing. The page styles do not apply to the printed table.
      </p>

      <h2>What the printout looks like</h2>
      <p>
        The tests of this page print the examples above with the print engine of Chromium (headless,
        print media, margin 0.4 inch) on A4 portrait, A4 landscape and US Letter portrait, and read
        the resulting PDF. Other tests print a table of 16 and of 24 columns with deliberately wide
        text (a monospace font, with letter spacing for the larger table) on A4 portrait, US Letter
        portrait and A5 portrait. What they found:
      </p>
      <ul>
        <li>
          <strong>All rows, once.</strong> The 240 invoices print on all pages (11 pages on A4
          portrait), in the sort order and with the filter of the table, not only the 10 rows of the
          screen page. Hidden columns, the selection column and columns with
          <code>exportable: false</code> are not printed.
        </li>
        <li>
          <strong>Repeated header.</strong> The header row is at the top of every page. The title (a
          heading) is on the first page only. The export adds no caption, no print date and no page
          numbers. The browser can add its own date, address and page number, with the option
          "Headers and footers" of its print dialog.
        </li>
        <li>
          <strong>No split rows.</strong> A row is never split between two pages (<code
            >break-inside: avoid</code
          >).
        </li>
        <li>
          <strong>Alignment comes from the column.</strong> The column <code>align</code> sets the
          alignment of the header and of every cell: <code>'start'</code>, <code>'center'</code> or
          <code>'end'</code>. A column without <code>align</code>, in which every value is a number,
          is aligned to the end (on the right in a left-to-right table). Any other column is aligned
          to the start. The type of the printed text does not matter: a number column with a
          <code>format</code> function (its cell text is then a string) is still aligned by its
          column, as on the screen. The CSV file and the Excel workbook have no alignment. A column
          with a <code>format</code> function and no <code>exportValue</code> that returns a number
          exports its formatted text there, so Excel gets text, not a number.
        </li>
        <li>
          <strong>Language and direction.</strong> The printout sets <code>lang</code> and
          <code>dir</code> on its <code>html</code> element. They come from the nearest element
          around the table that has the attribute (the table itself first), and else from the
          <code>html</code> element of the page. A table in a right-to-left block prints
          right-to-left: the first column is on the right, text columns are aligned to the right and
          number columns to the left, which are the start and the end of the line. An empty
          <code>lang</code>, and a <code>dir</code> of <code>auto</code>, are skipped. The printout
          has no <code>lang</code> when the page has none. The tests print the invoice table with
          <code>dir="rtl"</code> on the page and check the columns in the PDF.
        </li>
        <li>
          <strong>Long text wraps.</strong> A cell with several words wraps at the spaces. A word of
          more than 20 characters (a code, a signature, an address) gets soft break points, so it
          wraps inside its cell. A cell of one short word, such as <code>INV-0001</code> or
          <code>2026-01-05</code>, is not wrapped as long as the table fits the paper (see Wide
          tables).
        </li>
        <li>
          <strong>Wide tables.</strong> The print dialog decides the paper, the margins and the
          scale after the document is built, so the document gives way by itself when the table is
          wider than the page. It does this in steps, and takes the first step that fits:
          <ol>
            <li>
              The table as it is built: text of 9 pt, a cell of one short word is not wrapped.
            </li>
            <li>A cell of one short word may wrap (at a hyphen). The text keeps its size.</li>
            <li>
              Smaller text: 8.25, 7.5, 6.75 and 6 pt. The padding of the cells gets smaller too.
            </li>
            <li>
              Last resort: a word may break at any character. The columns then share the width of
              the page by the length of their longest word.
            </li>
          </ol>
          No column is cut off, and no text is lost, on any paper size and with any font. 6 pt is
          the smallest text. The document measures the table in its own fonts, so a wide font gets
          more steps than a narrow one. The browser shrink-to-fit is not used for this: Chromium
          shrinks a page by 1.5 times at most (to 6 pt) and cuts off everything that is still too
          wide. With the fonts of the test machine (Windows), the table with 16 columns prints in A4
          landscape at 9 pt on 3 pages, and in A4 portrait at 6 pt on one page. The sizes depend on
          the fonts of the platform. A table with many columns on narrow paper (24 columns on A5)
          prints at 6 pt with broken words: it is complete, but hard to read. Use landscape for a
          table with more than about 8 columns. The export does not set the paper size or the
          orientation: the user chooses them in the print dialog. The steps need container queries
          (all current browsers); a browser without them prints the table as it is built.
        </li>
        <li>
          <strong>Always on white paper.</strong> The printout is a separate document. It does not
          get the dark theme or any other style of the page: black text, a gray border and a light
          gray header row on white.
        </li>
      </ul>
      <p>
        Not checked: the print engines of Firefox and Safari (including their answer to the
        container queries of the steps above), real printers, and the print dialog itself (the paper
        chosen by the user, the scale, the margins, "Background graphics"). Chromium prints the
        light gray header background only when "Background graphics" is on; the header text is bold,
        so the header stays visible without it.
      </p>

      <h2>Content Security Policy</h2>
      <p>
        The frame is created from a string (<code>srcdoc</code>). A frame of that kind uses the
        Content Security Policy of the page that holds it. The print document has no
        <code>style</code> element and no <code>style</code> attribute. When the frame has loaded,
        StarNG adds its styles as constructed style sheets (<code>new CSSStyleSheet()</code> made in
        the frame, <code>replaceSync(css)</code> and <code>document.adoptedStyleSheets</code> of the
        frame document). The base style of the table, the rules that make it fit the paper and the
        measuring of the table use the same way.
      </p>
      <ul>
        <li>
          With the policy of this documentation application (<code>script-src 'self'</code> and
          <code>style-src 'self' 'unsafe-inline'</code>), the print works and the browser reports no
          violation. The page, not a script inside the frame, calls the print dialog, so
          <code>script-src 'self'</code> is enough.
        </li>
        <li>
          With a <code>style-src</code> that has no <code>'unsafe-inline'</code> (for example
          <code>style-src 'self'</code>), the print works the same: the browser does not block a
          constructed style sheet, the printout keeps its collapsed borders, the rule that keeps a
          row on one page, the alignment and the fit rules, and the frame reports no violation. A
          test serves the page with that policy and checks the borders in the frame and in the PDF.
        </li>
        <li>
          An environment without constructed style sheets gets a <code>style</code> element in the
          frame instead. A strict <code>style-src</code> blocks it (violation
          <code>style-src-elem</code>), and then the printout is plain: the print dialog opens with
          all rows, but without the table style. Not checked: Firefox and Safari under a strict
          policy.
        </li>
      </ul>
    </docs-page>
  `,
})
export class TableExportPage {
  protected readonly orders: readonly Order[] = ORDERS;
  protected readonly severityOf = (status: Order['status']) => STATUS_SEVERITY[status];
  protected readonly selected = signal<readonly Order[]>([]);
  protected readonly text = signal('Choose a button to see the CSV text.');
  protected show(csv: string): void {
    this.text.set(csv);
  }

  protected readonly columns: StarColumn<Order>[] = [
    { field: 'id', header: 'Order' },
    {
      field: 'customer',
      header: 'Customer',
      exportValue: (row) => `${row.customer} <${row.email}>`,
    },
    { field: 'product', header: 'Product' },
    { field: 'status', header: 'Status' },
    {
      field: 'placed',
      header: 'Placed',
      value: (row) => row.placed,
      format: (row) => formatDay(row.placed),
    },
    {
      field: 'total',
      header: 'Total',
      align: 'end',
      format: (row) => formatMoney(row.total),
      exportValue: (row) => row.total,
    },
  ];

  protected readonly invoices = INVOICES;
  protected readonly opened = signal('');
  protected readonly invoiceColumns: StarColumn<Invoice>[] = [
    { field: 'id', header: 'Invoice', sortable: true },
    { field: 'customer', header: 'Customer', sortable: true, filter: 'text' },
    { field: 'project', header: 'Project', sortable: true },
    { field: 'status', header: 'Status', sortable: true },
    { field: 'region', header: 'Region' },
    { field: 'quantity', header: 'Quantity', sortable: true, align: 'end' },
    {
      field: 'amount',
      header: 'Amount',
      sortable: true,
      align: 'end',
      format: (row) => formatMoney(row.amount),
      // A number: right-aligned in print, and a number cell in Excel.
      exportValue: (row) => row.amount,
    },
    { field: 'note', header: 'Note' },
    { field: 'open', header: 'Open', exportable: false },
  ];

  protected readonly wideRows = WIDE_ROWS;
  protected readonly wideColumns: StarColumn<WideRow>[] = WIDE_FIELDS.map((header) => ({
    field: header,
    header,
    align: typeof WIDE_ROWS[0][header] === 'number' ? ('end' as const) : ('start' as const),
  }));

  protected readonly parts = PARTS;
  protected readonly partColumns: StarColumn<Part>[] = [
    { field: 'code', header: 'Code' },
    { field: 'name', header: 'Part' },
    { field: 'zone', header: 'Zone', align: 'center' },
    // A number column without align: every value is a number.
    {
      field: 'stock',
      header: 'Stock',
      format: (row) => `${row.stock.toLocaleString('en-US')} pcs`,
    },
    // An explicit align: the column definition decides, not the type of the text.
    { field: 'price', header: 'Price', align: 'end', format: (row) => formatMoney(row.price) },
  ];

  protected readonly printLongScript = `readonly invoiceColumns: StarColumn<Invoice>[] = [
  { field: 'id', header: 'Invoice', sortable: true },
  { field: 'customer', header: 'Customer', sortable: true, filter: 'text' },
  // ...
  { field: 'amount', header: 'Amount', align: 'end', format: (row) => formatMoney(row.amount) },
  { field: 'note', header: 'Note' },
  // A column with a button: left out of every export.
  { field: 'open', header: 'Open', exportable: false },
];
// <star-table #longTable [hiddenColumns]="['region']" selectionMode="multiple" paginator [rows]="10" ... />
// longTable.print();`;
  protected readonly printFormatScript = `readonly partColumns: StarColumn<Part>[] = [
  { field: 'code', header: 'Code' },
  { field: 'name', header: 'Part' },
  { field: 'zone', header: 'Zone', align: 'center' },
  // Every value is a number: the print column is aligned to the end, although the cell text is a string.
  { field: 'stock', header: 'Stock', format: (row) => \`\${row.stock.toLocaleString('en-US')} pcs\` },
  // An explicit align wins.
  { field: 'price', header: 'Price', align: 'end', format: (row) => formatMoney(row.price) },
];
// partsTable.print();`;
  protected readonly printWideScript = `readonly wideColumns: StarColumn<WideRow>[] = fields.map((header) => ({ field: header, header }));
// wideTable.print();`;

  protected readonly basicScript = `// The template reference #exportTable gives access to the export methods.
readonly selected = signal<readonly Order[]>([]);
readonly columns: StarColumn<Order>[] = [
  { field: 'id', header: 'Order' },
  {
    field: 'customer',
    header: 'Customer',
    // The cell template shows name and email: the export needs its own text.
    exportValue: (row) => \`\${row.customer} <\${row.email}>\`,
  },
  { field: 'product', header: 'Product' },
  { field: 'status', header: 'Status' },
  { field: 'placed', header: 'Placed', value: (row) => row.placed, format: (row) => formatDay(row.placed) },
  {
    field: 'total',
    header: 'Total',
    format: (row) => formatMoney(row.total),
    exportValue: (row) => row.total, // a number: Excel can sum it
  },
];`;
  protected readonly textScript = `readonly text = signal('Choose a button to see the CSV text.');
show(csv: string): void {
  this.text.set(csv);
}`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'column.exportable',
      description: 'false leaves a column out of every export (CSV, Excel and print).',
    },
    {
      name: 'column.exportValue',
      description:
        'Cell value in an export: text, or a number that stays a number in Excel. Use it for a column with a cell template.',
    },
  ];
  protected readonly optionRows = [
    {
      name: 'fileName',
      type: 'string',
      description: 'File name without extension (default export).',
    },
    {
      name: 'selectionOnly',
      type: 'boolean',
      description:
        'Export the selected rows only (default: all filtered rows, in the current sort order).',
    },
    {
      name: 'rows',
      type: 'readonly T[]',
      description: 'Rows to export instead of the table rows. Use it in lazy mode.',
    },
    {
      name: 'title',
      type: 'string',
      description: 'Sheet name (Excel) or heading (print). Default: the table ariaLabel.',
    },
    { name: 'separator', type: 'string', description: 'CSV only: field separator (default ,).' },
  ];
}
