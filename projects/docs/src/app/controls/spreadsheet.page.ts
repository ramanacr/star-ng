import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import {
  StarSpreadsheet,
  StarSpreadsheetCells,
  StarSpreadsheetSelection,
  StarSpreadsheetSheet,
} from '@star-ng/ui/spreadsheet';
import { DOCS, DocsRow } from '../shared/docs';

const money = { type: 'currency', currency: 'EUR' } as const;
const head = { bold: true, background: 'muted' } as const;

/** A monthly household budget: income, costs and totals with formulas. */
const BUDGET: StarSpreadsheetCells = {
  A1: { value: 'Item', format: head },
  B1: { value: 'January', format: { ...head, align: 'end' } },
  C1: { value: 'February', format: { ...head, align: 'end' } },
  D1: { value: 'March', format: { ...head, align: 'end' } },
  E1: { value: 'Quarter', format: { ...head, align: 'end' } },
  A2: { value: 'Salary' },
  B2: { value: 3200, format: money },
  C2: { value: 3200, format: money },
  D2: { value: 3350, format: money },
  A3: { value: 'Rent' },
  B3: { value: -1150, format: money },
  C3: { value: -1150, format: money },
  D3: { value: -1150, format: money },
  A4: { value: 'Groceries' },
  B4: { value: -420, format: money },
  C4: { value: -385, format: money },
  D4: { value: -440, format: money },
  A5: { value: 'Transport' },
  B5: { value: -96, format: money },
  C5: { value: -96, format: money },
  D5: { value: -120, format: money },
  A6: { value: 'Savings', format: { bold: true } },
  B6: { formula: '=SUM(B2:B5)', format: { ...money, bold: true, background: 'success' } },
  C6: { formula: '=SUM(C2:C5)', format: { ...money, bold: true, background: 'success' } },
  D6: { formula: '=SUM(D2:D5)', format: { ...money, bold: true, background: 'success' } },
  E2: { formula: '=SUM(B2:D2)', format: money },
  E3: { formula: '=SUM(B3:D3)', format: money },
  E4: { formula: '=SUM(B4:D4)', format: money },
  E5: { formula: '=SUM(B5:D5)', format: money },
  E6: { formula: '=SUM(E2:E5)', format: { ...money, bold: true, background: 'success' } },
  A8: { value: 'Savings rate' },
  B8: { formula: '=E6/E2', format: { type: 'percent', decimals: 1 } },
  A9: { value: 'Status' },
  B9: { formula: '=IF(B8>=0.4,"On track","Below target")' },
};

const SHEETS: readonly StarSpreadsheetSheet[] = [
  {
    name: 'Summary',
    cells: {
      A1: { value: 'Total costs', format: { bold: true } },
      B1: { formula: '=SUM(Costs!B2:B4)', format: money },
      A2: { value: 'Largest cost', format: { bold: true } },
      B2: { formula: '=MAX(Costs!B2:B4)', format: money },
      A3: { value: 'Items', format: { bold: true } },
      B3: { formula: '=COUNTA(Costs!A2:A4)' },
      A4: { value: 'Reviewed on', format: { bold: true } },
      B4: { formula: '=DATE(2026,11,19)', format: { type: 'date' } },
    },
  },
  {
    name: 'Costs',
    cells: {
      A1: { value: 'Item', format: head },
      B1: { value: 'Amount', format: { ...head, align: 'end' } },
      A2: { value: 'Rent' },
      B2: { value: 1150, format: money },
      A3: { value: 'Groceries' },
      B3: { value: 420, format: money },
      A4: { value: 'Transport' },
      B4: { value: 96, format: money },
    },
  },
];

@Component({
  selector: 'docs-spreadsheet-page',
  imports: [DOCS, StarSpreadsheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Spreadsheet"
      lead="A grid of cells with formulas, formats, clipboard, fill handle, undo and sheets. The formula engine is part of the library and uses no eval. The Syncfusion equivalent is ejs-spreadsheet; the Kendo UI equivalent is Spreadsheet; the Ignite UI equivalent is igx-spreadsheet; DevExtreme has none."
      importFrom="import { StarSpreadsheet, starEvaluate } from '@star-ng/ui/spreadsheet';"
    >
      <docs-example
        heading="Budget"
        source="spreadsheet/budget"
        [script]="budgetScript"
        note="Type to replace a cell, or press F2, Enter or double-click to edit it. The formula bar shows the formula of the active cell. Drag the small square at the corner of the selection to fill. Control+C and Control+V copy and paste tab-separated text, also from and to Excel and Google Sheets."
      >
        <div class="docs-stack">
          <star-spreadsheet
            [(cells)]="budget"
            [rows]="200"
            [columns]="12"
            [columnWidths]="{ A: 140 }"
            height="20rem"
            ariaLabel="Budget"
            locale="en-IE"
            (selectionChange)="onSelection($event)"
          />
          <p class="docs-output" role="status">{{ status() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Sheets and cross-sheet formulas"
        source="spreadsheet/sheets"
        [script]="sheetsScript"
        note="sheets is a two-way model of named sheets; the tabs switch between them. A formula reads another sheet with Sheet!A1 (quote names with spaces: 'My sheet'!A1)."
      >
        <star-spreadsheet
          [(sheets)]="sheets"
          [(activeSheet)]="activeSheet"
          [rows]="20"
          [columns]="6"
          [columnWidths]="{ A: 140 }"
          height="14rem"
          ariaLabel="Cost summary"
          locale="en-IE"
          [showToolbar]="false"
        />
      </docs-example>

      <docs-example
        heading="CSV import and export"
        source="spreadsheet/csv"
        [script]="csvScript"
        note="toCsv() writes the computed values (or the formulas with { formulas: true }) with RFC 4180 quoting; fromCsv() reads them back and can be undone. toJson() returns every sheet. XLSX is out of scope."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <button
              type="button"
              class="star-btn star-btn--secondary star-btn--sm"
              (click)="exportCsv()"
            >
              Export CSV
            </button>
            <button
              type="button"
              class="star-btn star-btn--secondary star-btn--sm"
              (click)="importCsv()"
            >
              Import the CSV again
            </button>
          </div>
          <star-spreadsheet
            #csvSheet
            [(cells)]="csvCells"
            [rows]="20"
            [columns]="6"
            height="12rem"
            ariaLabel="CSV data"
            [showToolbar]="false"
          />
          <pre class="docs-output">{{ csv() }}</pre>
        </div>
      </docs-example>

      <docs-api [of]="['StarSpreadsheet']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class SpreadsheetPage {
  protected readonly budget = signal<StarSpreadsheetCells>(BUDGET);
  protected readonly status = signal('Active cell A1.');
  protected readonly sheets = signal<readonly StarSpreadsheetSheet[]>(SHEETS);
  protected readonly activeSheet = signal(0);
  protected readonly csvCells = signal<StarSpreadsheetCells>({
    A1: { value: 'Product' },
    B1: { value: 'Units' },
    C1: { value: 'Price' },
    D1: { value: 'Total' },
    A2: { value: 'Paper, A4' },
    B2: { value: 12 },
    C2: { value: 4.5 },
    D2: { formula: '=B2*C2' },
    A3: { value: 'Pens "fine"' },
    B3: { value: 30 },
    C3: { value: 0.8 },
    D3: { formula: '=B3*C3' },
  });
  protected readonly csv = signal('');
  private readonly csvSheet = viewChild.required<StarSpreadsheet>('csvSheet');

  protected onSelection(selection: StarSpreadsheetSelection): void {
    this.status.set(
      selection.address === selection.active
        ? `Active cell ${selection.active}.`
        : `Active cell ${selection.active}, range ${selection.address}.`,
    );
  }

  protected exportCsv(): void {
    this.csv.set(this.csvSheet().toCsv({ formulas: true }));
  }

  protected importCsv(): void {
    const text = this.csv() || this.csvSheet().toCsv({ formulas: true });
    this.csvSheet().fromCsv(text);
  }

  protected readonly budgetScript = `readonly budget = signal<StarSpreadsheetCells>({
  A1: { value: 'Item', format: { bold: true, background: 'muted' } },
  B2: { value: 3200, format: { type: 'currency', currency: 'EUR' } },
  // …
  B6: { formula: '=SUM(B2:B5)', format: { type: 'currency', currency: 'EUR', bold: true } },
  B8: { formula: '=E6/E2', format: { type: 'percent', decimals: 1 } },
  B9: { formula: '=IF(B8>=0.4,"On track","Below target")' },
});`;
  protected readonly sheetsScript = `readonly sheets = signal<readonly StarSpreadsheetSheet[]>([
  { name: 'Summary', cells: { B1: { formula: '=SUM(Costs!B2:B4)' } /* … */ } },
  { name: 'Costs', cells: { A2: { value: 'Rent' }, B2: { value: 1150 } /* … */ } },
]);
readonly activeSheet = signal(0);`;
  protected readonly csvScript = `private readonly csvSheet = viewChild.required<StarSpreadsheet>('csvSheet');

exportCsv(): void {
  this.csv.set(this.csvSheet().toCsv({ formulas: true }));
}
importCsv(): void {
  this.csvSheet().fromCsv(this.csv());
}

// Without the component: the engine alone.
starEvaluate('=ROUND(2.5)'); // 3`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of the cells.' },
    { name: '--star-surface-muted', description: 'Background of the headers and the sheet tabs.' },
    { name: '--star-border', description: 'Grid lines.' },
    { name: '--star-accent', description: 'Active cell, selection outline and fill handle.' },
    { name: '--star-accent-soft', description: 'Selected headers; the "Blue" background.' },
    {
      name: '--star-success-soft, --star-warning-soft, --star-danger-soft',
      description: 'The "Green", "Amber" and "Red" cell backgrounds.',
    },
    { name: '--star-danger', description: 'Text of a cell with an error such as #DIV/0!.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Arrow keys', description: 'Move the active cell. With Shift: extend the selection.' },
    {
      name: 'Control + arrow keys',
      description: 'Move to the first or last row or column. With Shift: select to there.',
    },
    { name: 'Home, End, Page up, Page down', description: 'Move along the row or by a page.' },
    { name: 'Tab, Shift + Tab', description: 'Move right or left; at the edge, leave the grid.' },
    { name: 'Typing', description: 'Replaces the content of the active cell.' },
    { name: 'F2, Enter', description: 'Edit the active cell in place.' },
    {
      name: 'Enter, Tab (editing)',
      description: 'Commit and move down or right (with Shift: up or left).',
    },
    { name: 'Escape (editing)', description: 'Cancel the edit.' },
    { name: 'Delete, Backspace', description: 'Clear the selected cells (the format stays).' },
    { name: 'Control + C, X, V', description: 'Copy, cut and paste tab-separated text.' },
    { name: 'Control + Z, Control + Y', description: 'Undo and redo.' },
    { name: 'Control + D, Control + R', description: 'Fill down or right.' },
    { name: 'Control + B, Control + I', description: 'Bold and italic.' },
    { name: 'Control + A', description: 'Select all cells.' },
    { name: 'Shift + Space, Control + Space', description: 'Select the row or the column.' },
  ];
}
