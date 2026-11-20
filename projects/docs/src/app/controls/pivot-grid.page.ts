import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import {
  StarPivotCellClickEvent,
  StarPivotConfig,
  StarPivotField,
  StarPivotGrid,
} from '@star-ng/ui/pivot-grid';
import { DOCS, DocsRow } from '../shared/docs';

interface Sale {
  readonly region: string;
  readonly product: string;
  readonly date: string;
  readonly amount: number;
  readonly units: number;
}

const REGIONS = ['North', 'South', 'East', 'West'];
const PRODUCTS = ['Desk', 'Chair', 'Lamp', 'Shelf'];
const PRICES = [240, 85, 40, 120];

/** Fictional sales: one order per region, product and month in 2025 and 2026. */
const SALES: readonly Sale[] = REGIONS.flatMap((region, r) =>
  PRODUCTS.flatMap((product, p) =>
    Array.from({ length: 24 }, (_, m) => {
      const units = 1 + ((r * 7 + p * 5 + m * 3) % 9);
      const year = 2025 + Math.floor(m / 12);
      const month = String((m % 12) + 1).padStart(2, '0');
      return { region, product, date: `${year}-${month}-15`, amount: units * PRICES[p], units };
    }),
  ),
);

const EURO = { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 } as const;

const FIELDS: readonly StarPivotField<Sale>[] = [
  { field: 'region', label: 'Region' },
  { field: 'product', label: 'Product' },
  { field: 'date', label: 'Date', dateHierarchy: ['year', 'quarter'] },
  { field: 'amount', label: 'Amount', valueFormat: EURO },
  { field: 'units', label: 'Units' },
];

@Component({
  selector: 'docs-pivot-grid-page',
  imports: [DOCS, StarPivotGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Pivot grid"
      lead="A pivot table that summarizes flat records by rows, columns and values, with totals, member filters, a configurator and CSV export. The engine is pure TypeScript (starPivot) and uses no eval. The Ignite UI equivalent is igx-pivot-grid; the Kendo UI equivalent is PivotGrid; the Syncfusion equivalent is ejs-pivotview; the DevExtreme equivalent is dxPivotGrid; AG Grid has pivot mode."
      importFrom="import { StarPivotGrid, starPivot } from '@star-ng/ui/pivot-grid';"
    >
      <docs-example
        heading="Sales by region, product and quarter"
        source="pivot-grid/sales"
        [script]="salesScript"
        note="Rows nest region and product; the columns split the date into year and quarter. Parent rows show subtotals; each year has a total column. Click a value cell (or press Enter on it) to see its source records: cellClick gives the paths, the value and the records. The date buckets use config.timeZone (an IANA zone; default: the local zone of the runtime). Set it when the data holds instants, so a server render and the browser put a record in the same month."
      >
        <div class="docs-stack">
          <star-pivot-grid
            [data]="sales"
            [(config)]="salesConfig"
            height="24rem"
            ariaLabel="Sales by region and quarter"
            locale="en-IE"
            (cellClick)="onCell($event)"
          />
          <p class="docs-output" role="status">{{ drill() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Configurator"
        source="pivot-grid/configurator"
        [script]="configuratorScript"
        note="Drag fields between Fields, Rows, Columns, Values and Filters, or use the move menu of a field (the keyboard way: Tab to the field's menu button, then Enter). Each move is announced. A value field has an aggregate select; a row, column or filter field has a member filter with search."
      >
        <star-pivot-grid
          [data]="sales"
          [(config)]="openConfig"
          [fields]="fields"
          showConfigurator
          height="22rem"
          ariaLabel="Sales by product"
          locale="en-IE"
        />
      </docs-example>

      <docs-example
        heading="Totals, member order and CSV"
        source="pivot-grid/csv"
        [script]="csvScript"
        note="Turn grand totals and subtotals off per axis, sort members by a value, and show a text in empty cells. toCsv() writes the visible pivot (RFC 4180); text that starts with = + - @ gets a ' prefix, so a spreadsheet does not run it. Excel XML export is not part of the control."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <button
              type="button"
              class="star-btn star-btn--secondary star-btn--sm"
              (click)="showCsv()"
            >
              Show CSV
            </button>
          </div>
          <star-pivot-grid
            #csvGrid
            [data]="sales"
            [(config)]="csvConfig"
            height="16rem"
            ariaLabel="Units by product and region"
            locale="en-IE"
          />
          <pre class="docs-output">{{ csv() }}</pre>
        </div>
      </docs-example>

      <docs-api [of]="['StarPivotGrid']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class PivotGridPage {
  protected readonly sales = SALES;
  protected readonly fields = FIELDS;
  protected readonly salesConfig = signal<StarPivotConfig<Sale>>({
    rows: [
      { field: 'region', label: 'Region' },
      { field: 'product', label: 'Product' },
    ],
    columns: [{ field: 'date', label: 'Date', dateHierarchy: ['year', 'quarter'] }],
    values: [{ field: 'amount', label: 'Amount', aggregate: 'sum', format: EURO }],
    collapsedRows: ['["South"]', '["East"]', '["West"]'],
    timeZone: 'UTC',
  });
  protected readonly openConfig = signal<StarPivotConfig<Sale>>({
    rows: [{ field: 'product', label: 'Product' }],
    columns: [],
    values: [
      { field: 'amount', label: 'Amount', aggregate: 'sum', format: EURO },
      { field: 'units', label: 'Units', aggregate: 'avg', format: { maximumFractionDigits: 1 } },
    ],
  });
  protected readonly csvConfig = signal<StarPivotConfig<Sale>>({
    rows: [{ field: 'product', label: 'Product', sort: { by: 'value', order: 'desc' } }],
    columns: [{ field: 'region', label: 'Region' }],
    values: [{ field: 'units', label: 'Units' }],
    filters: [{ field: 'region', exclude: ['West'] }],
    columnGrandTotals: false,
    emptyText: '–',
  });
  protected readonly drill = signal('Click a value cell to see its records.');
  protected readonly csv = signal('');
  private readonly csvGrid = viewChild.required<StarPivotGrid<Sale>>('csvGrid');

  protected onCell(event: StarPivotCellClickEvent<Sale>): void {
    const where = [...event.rowPath, ...event.columnPath].join(', ') || 'All';
    this.drill.set(`${where}: ${event.records.length} records.`);
  }

  protected showCsv(): void {
    this.csv.set(this.csvGrid().toCsv());
  }

  protected readonly salesScript = `readonly config = signal<StarPivotConfig<Sale>>({
  rows: [{ field: 'region', label: 'Region' }, { field: 'product', label: 'Product' }],
  columns: [{ field: 'date', label: 'Date', dateHierarchy: ['year', 'quarter'] }],
  values: [{ field: 'amount', label: 'Amount', aggregate: 'sum',
    format: { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 } }],
  collapsedRows: ['["South"]', '["East"]', '["West"]'],
});

onCell(event: StarPivotCellClickEvent<Sale>): void {
  // event.rowPath, event.columnPath, event.value, event.records
}`;
  protected readonly configuratorScript = `readonly fields: StarPivotField<Sale>[] = [
  { field: 'region', label: 'Region' },
  { field: 'product', label: 'Product' },
  { field: 'date', label: 'Date', dateHierarchy: ['year', 'quarter'] },
  { field: 'amount', label: 'Amount', valueFormat: { style: 'currency', currency: 'EUR' } },
  { field: 'units', label: 'Units' },
];`;
  protected readonly csvScript = `readonly config = signal<StarPivotConfig<Sale>>({
  rows: [{ field: 'product', sort: { by: 'value', order: 'desc' } }],
  columns: [{ field: 'region' }],
  values: [{ field: 'units' }],
  filters: [{ field: 'region', exclude: ['West'] }],
  columnGrandTotals: false,
  emptyText: '–',
});

showCsv(): void {
  this.csv.set(this.csvGrid().toCsv());
}

// Without the component: the engine alone.
const result = starPivot(sales, config);`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-pivot-row-height', description: 'Height of each row (from rowHeight).' },
    { name: '--star-surface', description: 'Background of the value cells.' },
    { name: '--star-surface-muted', description: 'Headers, totals and subtotals.' },
    { name: '--star-border', description: 'Grid lines.' },
    { name: '--star-accent', description: 'Focus outline of the active cell.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Arrow keys', description: 'Move between cells, row labels and column headers.' },
    { name: 'Home, End', description: 'Move to the row label or the last cell of the row.' },
    { name: 'Control + Home, Control + End', description: 'Move to the first or last cell.' },
    { name: 'Page up, Page down', description: 'Move by the rows in view.' },
    {
      name: 'Enter, Space',
      description: 'On a row label or column header with children: expand or collapse it.',
    },
    {
      name: 'Alt + Arrow right or down, Alt + Arrow left or up',
      description: 'Expand or collapse the member of the focused row label or header.',
    },
    { name: 'Enter on a value cell', description: 'Emit cellClick with the source records.' },
  ];
}
