import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { STAR_UI_TEXT_DEFAULTS } from '@star-ng/ui/core';
import { StarColumn, StarTable } from './table';
import { summarize, summaryCell, summaryText, suppliedSummaryCell } from './table-summaries';

describe('table summary helpers', () => {
  it('computes the built-in summaries over the values', () => {
    const values = [4, null, 10, '', undefined, 1, Number.NaN];
    expect(summarize(values, 'sum')).toBe(15);
    expect(summarize(values, 'avg')).toBe(5);
    expect(summarize(values, 'min')).toBe(1);
    expect(summarize(values, 'max')).toBe(10);
    expect(summarize(values, 'count')).toBe(4);
    expect(summarize([null, 'text'], 'sum')).toBeNull();
    expect(summarize([], 'count')).toBe(0);
  });

  it('takes the smallest and largest date', () => {
    const dates = [new Date(2026, 4, 2), new Date(2026, 0, 9), new Date(2026, 8, 1)];
    expect((summarize(dates, 'min') as Date).getMonth()).toBe(0);
    expect((summarize(dates, 'max') as Date).getMonth()).toBe(8);
  });

  it('formats numbers with the locale and the Intl options', () => {
    expect(summaryText(1234.5, undefined, 'en-US')).toBe('1,234.5');
    expect(summaryText(1234.5, { maximumFractionDigits: 0 }, 'de-DE')).toBe('1.235');
    expect(summaryText(0.25, { style: 'percent' }, 'en-US')).toBe('25%');
    expect(summaryText(null, undefined, 'en-US')).toBe('');
    expect(summaryText('n/a', undefined, 'en-US')).toBe('n/a');
  });

  it('labels the built-in summaries and leaves a function summary without label', () => {
    const rows = [{ units: 2 }, { units: 5 }];
    const value = (row: { units: number }) => row.units;
    const text = STAR_UI_TEXT_DEFAULTS;
    expect(summaryCell({ summary: 'avg' }, rows, value, text, 'en-US')).toEqual({
      label: 'Average',
      text: '3.5',
    });
    expect(
      summaryCell({ summary: (all) => `${all.length} rows` }, rows, value, text, 'en-US'),
    ).toEqual({ label: null, text: '2 rows' });
    expect(summaryCell({}, rows, value, text, 'en-US')).toBeNull();
    expect(suppliedSummaryCell({ summary: 'sum' }, 9000, text, 'en-US')).toEqual({
      label: 'Sum',
      text: '9,000',
    });
  });
});

interface Sale {
  id: number;
  region: string;
  city: string;
  units: number;
  revenue: number;
}

const SALES: Sale[] = [
  { id: 1, region: 'North', city: 'Oslo', units: 4, revenue: 1000 },
  { id: 2, region: 'South', city: 'Lima', units: 6, revenue: 2500.5 },
  { id: 3, region: 'North', city: 'Riga', units: 10, revenue: 500 },
];

@Component({
  imports: [StarTable],
  template: `<star-table
    [value]="rows"
    [columns]="columns"
    dataKey="id"
    locale="en-US"
    [groupBy]="groupBy()"
    [groupSummary]="groupSummary()"
    [lazy]="lazy()"
    [summaries]="summaries()"
    [globalFilter]="query()"
    [(collapsedGroups)]="closed"
  />`,
})
class SummaryHost {
  readonly rows = SALES;
  readonly columns: StarColumn<Sale>[] = [
    { field: 'city', header: 'City', summary: 'count' },
    { field: 'region', header: 'Region' },
    { field: 'units', header: 'Units', summary: 'sum', footer: 'Units total' },
    {
      field: 'revenue',
      header: 'Revenue',
      summary: 'sum',
      summaryFormat: { style: 'currency', currency: 'USD' },
    },
  ];
  readonly groupBy = signal<keyof Sale | null>(null);
  readonly groupSummary = signal(false);
  readonly lazy = signal(false);
  readonly summaries = signal<Record<string, unknown> | null>(null);
  readonly query = signal('');
  readonly closed = signal<readonly string[]>([]);
}

describe('StarTable summaries', () => {
  async function setup() {
    const fixture = TestBed.createComponent(SummaryHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const footer = () =>
      [...el.querySelectorAll<HTMLElement>('tfoot td')].map((td) =>
        td.textContent?.replace(/\s+/g, ' ').trim(),
      );
    const groupFooters = () =>
      [...el.querySelectorAll<HTMLElement>('tbody tr.star-table__group-footer')]
        .filter((tr) => !tr.hidden)
        .map((tr) =>
          [...tr.querySelectorAll('td')].map((td) => td.textContent?.replace(/\s+/g, ' ').trim()),
        );
    return { fixture, el, host: fixture.componentInstance, footer, groupFooters };
  }

  it('shows the summary row over the filtered rows; footer wins over summary', async () => {
    const { fixture, host, footer } = await setup();
    expect(footer()).toEqual(['Count 3', '', 'Units total', 'Sum $4,000.50']);
    host.query.set('North');
    await fixture.whenStable();
    expect(footer()).toEqual(['Count 2', '', 'Units total', 'Sum $1,500.00']);
  });

  it('adds a summary row below each group, over the rows of the group (footer is for the footer row only)', async () => {
    const { fixture, host, el, groupFooters } = await setup();
    host.groupBy.set('region');
    host.groupSummary.set(true);
    await fixture.whenStable();
    expect(groupFooters()).toEqual([
      ['Count 2', '', 'Sum 14', 'Sum $1,500.00'],
      ['Count 1', '', 'Sum 6', 'Sum $2,500.50'],
    ]);
    // The summary row comes after the last row of its group.
    const lines = [...el.querySelectorAll<HTMLElement>('tbody tr')].map((tr) =>
      tr.classList.contains('star-table__group-footer')
        ? 'summary'
        : tr.classList.contains('star-table__group')
          ? 'group'
          : 'row',
    );
    expect(lines).toEqual(['group', 'row', 'row', 'summary', 'group', 'row', 'summary']);
    host.closed.set(['North']);
    await fixture.whenStable();
    expect(groupFooters().length).toBe(1);
  });

  it('takes the footer values from summaries in lazy mode', async () => {
    const { fixture, host, footer } = await setup();
    host.lazy.set(true);
    host.summaries.set({ city: 120, revenue: 98765.4 });
    await fixture.whenStable();
    expect(footer()).toEqual(['Count 120', '', 'Units total', 'Sum $98,765.40']);
  });
});
