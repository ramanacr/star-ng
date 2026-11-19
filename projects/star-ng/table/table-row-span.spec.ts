import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarColumn, StarTable } from './table';
import { rowSpans } from './table-row-span';

interface Sale {
  id: number;
  region: string;
  city: string;
  status: string;
  units: number;
}

const SALES: Sale[] = [
  { id: 1, region: 'North', city: 'Oslo', status: 'Open', units: 4 },
  { id: 2, region: 'North', city: 'Riga', status: 'Open', units: 6 },
  { id: 3, region: 'North', city: 'Turku', status: 'Paid', units: 1 },
  { id: 4, region: 'South', city: 'Lima', status: 'Paid', units: 3 },
  { id: 5, region: 'South', city: 'Quito', status: '', units: 2 },
  { id: 6, region: 'South', city: 'Cusco', status: '', units: 8 },
];

const text = (row: Sale, field: string) => String(row[field as keyof Sale]);

describe('rowSpans', () => {
  it('merges runs of equal texts: the first row gets the span, the others 0', () => {
    const spans = rowSpans(SALES, ['region', 'status'], { textOf: text });
    expect(spans.get('region')).toEqual([3, 0, 0, 3, 0, 0]);
    // An empty text never merges.
    expect(spans.get('status')).toEqual([2, 0, 2, 0, 1, 1]);
  });

  it('breaks a run at a group border and after a row with an open detail', () => {
    const spans = rowSpans(SALES, ['status'], { textOf: text, groupOf: (row) => row.region });
    expect(spans.get('status')).toEqual([2, 0, 1, 1, 1, 1]);
    const open = rowSpans(SALES, ['region'], { textOf: text, endsRun: (row) => row.id === 2 });
    expect(open.get('region')).toEqual([2, 0, 1, 3, 0, 0]);
  });

  it('handles no rows and one row', () => {
    expect(rowSpans([], ['region'], { textOf: text }).get('region')).toEqual([]);
    expect(rowSpans(SALES.slice(0, 1), ['region'], { textOf: text }).get('region')).toEqual([1]);
  });
});

@Component({
  imports: [StarTable],
  template: `<star-table
    [value]="rows()"
    [columns]="columns"
    dataKey="id"
    selectionMode="multiple"
    groupBy="region"
    [rowGroupMode]="mode()"
    [virtualScroll]="virtual()"
    scrollHeight="400px"
    [(selection)]="selection"
  />`,
})
class RowSpanHost {
  readonly rows = signal(SALES);
  readonly columns: StarColumn<Sale>[] = [
    { field: 'region', header: 'Region' },
    { field: 'city', header: 'City' },
    { field: 'status', header: 'Status', mergeCells: true },
    { field: 'units', header: 'Units' },
  ];
  readonly mode = signal<'subheader' | 'rowspan'>('rowspan');
  readonly virtual = signal(false);
  readonly selection = signal<readonly Sale[]>([]);
}

describe('StarTable rowGroupMode rowspan', () => {
  async function setup() {
    const fixture = TestBed.createComponent(RowSpanHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const grid = () =>
      [...el.querySelectorAll<HTMLElement>('tbody tr')].map((tr) =>
        [...tr.querySelectorAll<HTMLTableCellElement>('td:not(.star-table__select)')].map(
          (td) => `${td.textContent?.trim()}${td.rowSpan > 1 ? `/${td.rowSpan}` : ''}`,
        ),
      );
    return { fixture, el, host: fixture.componentInstance, grid };
  }

  it('merges the group column and mergeCells columns, without heading rows', async () => {
    const { el, grid } = await setup();
    expect(el.querySelectorAll('tbody tr.star-table__group').length).toBe(0);
    expect(grid()).toEqual([
      ['North/3', 'Oslo', 'Open/2', '4'],
      ['Riga', '6'],
      ['Turku', 'Paid', '1'],
      ['South/3', 'Lima', 'Paid', '3'],
      ['Quito', '', '2'],
      ['Cusco', '', '8'],
    ]);
    const merged = el.querySelector('td.star-table__cell--merged')!;
    expect(merged.getAttribute('rowspan')).toBe('3');
  });

  it('keeps selection per row: every row keeps its own check box', async () => {
    const { fixture, el, host } = await setup();
    const boxes = el.querySelectorAll<HTMLInputElement>('tbody td.star-table__select input');
    expect(boxes.length).toBe(6);
    boxes[1].click();
    await fixture.whenStable();
    expect(host.selection().map((row) => row.id)).toEqual([2]);
  });

  it('falls back to group heading rows with virtual scroll and in subheader mode', async () => {
    const { fixture, el, host } = await setup();
    host.mode.set('subheader');
    await fixture.whenStable();
    expect(el.querySelectorAll('tbody tr.star-table__group').length).toBe(2);
    expect(el.querySelectorAll('td[rowspan]').length).toBe(0);
    host.mode.set('rowspan');
    host.virtual.set(true);
    await fixture.whenStable();
    expect(el.querySelectorAll('tbody tr.star-table__group').length).toBe(2);
    expect(el.querySelectorAll('td[rowspan]').length).toBe(0);
  });
});
