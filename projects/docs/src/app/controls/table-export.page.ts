import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarButton } from 'star-ng/button';
import { StarCellTemplate, StarColumn, StarTable } from 'star-ng/table';
import { StarTag } from 'star-ng/tag';
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

@Component({
  selector: 'docs-table-export-page',
  imports: [DOCS, StarTable, StarCellTemplate, StarTag, StarButton, DocsFill, DocsRefTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Table export"
      lead="Download the table as a CSV file or an Excel workbook, or print it. The export uses the visible columns in display order and the rows after filtering and sorting, on all pages. No third-party library is used: the Excel file is built in the browser."
      importFrom="import { StarTable, StarExportOptions, StarCsvOptions } from 'star-ng/table';"
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
        each page, no page break inside a row), calls the print dialog of the frame and removes the
        frame after printing. The page styles do not apply to the printed table.
      </p>
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
