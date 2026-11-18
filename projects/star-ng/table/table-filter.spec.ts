import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarFilterService } from '@star-ng/ui/core';
import { StarColumn, StarLazyLoadEvent, StarTable, StarTableFilterEvent } from './table';
import {
  StarColumnFilters,
  StarFilterCell,
  starIsActiveFilter,
  starMatchesFilter,
  starMatchesRule,
} from './table-filter';

interface Invoice {
  id: number;
  customer: string;
  status: string;
  amount: number;
  due: string;
}

const INVOICES: Invoice[] = [
  { id: 1, customer: 'Málaga Trading', status: 'Paid', amount: 120, due: '2026-03-01' },
  { id: 2, customer: 'Berlin Supplies', status: 'Open', amount: 45, due: '2026-03-15' },
  { id: 3, customer: 'Zürich Office', status: 'Overdue', amount: 300, due: '2026-02-20' },
  { id: 4, customer: 'Oslo Parts', status: 'Open', amount: 80, due: '2026-04-02' },
];

@Component({
  imports: [StarTable],
  template: `
    <star-table
      [value]="rows"
      [columns]="columns"
      dataKey="id"
      [(filters)]="filters"
      [globalFilter]="query()"
      [globalFilterFields]="fields()"
      [globalFilterMatchMode]="globalMode()"
      [filterLocale]="locale()"
      [lazy]="lazy()"
      (filter)="events.push($event)"
      (lazyLoad)="lazyEvents.push($event)"
    />
  `,
})
class Host {
  readonly table = viewChild.required<StarTable<Invoice>>(StarTable);
  readonly rows = INVOICES;
  readonly columns: StarColumn<Invoice>[] = [
    { field: 'customer', header: 'Customer', filter: 'text', filterMatchMode: 'startsWith' },
    { field: 'status', header: 'Status', filter: 'multiselect' },
    { field: 'amount', header: 'Amount', filter: 'number' },
    { field: 'due', header: 'Due', filter: 'date' },
  ];
  readonly filters = signal<StarColumnFilters>({});
  readonly query = signal('');
  readonly fields = signal<readonly string[] | null>(null);
  readonly globalMode = signal<'contains' | 'startsWith'>('contains');
  readonly locale = signal<string | null>(null);
  readonly lazy = signal(false);
  readonly events: StarTableFilterEvent<Invoice>[] = [];
  readonly lazyEvents: StarLazyLoadEvent[] = [];
}

describe('StarTable filter rules', () => {
  async function setup(change?: (host: Host) => void) {
    const fixture = TestBed.createComponent(Host);
    change?.(fixture.componentInstance);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const host = fixture.componentInstance;
    const ids = () =>
      [...el.querySelectorAll('tbody tr.star-table__row td:first-child')].map((cell) =>
        cell.textContent?.trim(),
      );
    const apply = async (filters: StarColumnFilters) => {
      host.filters.set(filters);
      await fixture.whenStable();
    };
    return { fixture, el, host, ids, apply };
  }

  it('text modes match with starFilterMatch (case and accents ignored)', async () => {
    const { ids, apply } = await setup();
    const rule = (matchMode: string, value: string) => ({
      customer: { operator: 'and' as const, rules: [{ matchMode, value }] },
    });
    await apply(rule('contains', 'TRAD'));
    expect(ids()).toEqual(['Málaga Trading']);
    await apply(rule('startsWith', 'malaga'));
    expect(ids()).toEqual(['Málaga Trading']);
    await apply(rule('endsWith', 'office'));
    expect(ids()).toEqual(['Zürich Office']);
    await apply(rule('equals', 'oslo parts'));
    expect(ids()).toEqual(['Oslo Parts']);
    await apply(rule('notContains', 'o'));
    expect(ids()).toEqual(['Málaga Trading', 'Berlin Supplies']);
    await apply(rule('notContains', 'parts'));
    expect(ids()).toHaveLength(3);
  });

  it('number modes', async () => {
    const { ids, apply } = await setup();
    const rule = (matchMode: string, value: unknown) => ({
      amount: { operator: 'and' as const, rules: [{ matchMode, value: value as number }] },
    });
    await apply(rule('equals', 45));
    expect(ids()).toEqual(['Berlin Supplies']);
    await apply(rule('notEquals', 45));
    expect(ids()).toHaveLength(3);
    await apply(rule('lt', 80));
    expect(ids()).toEqual(['Berlin Supplies']);
    await apply(rule('lte', 80));
    expect(ids()).toEqual(['Berlin Supplies', 'Oslo Parts']);
    await apply(rule('gt', 120));
    expect(ids()).toEqual(['Zürich Office']);
    await apply(rule('gte', 120));
    expect(ids()).toEqual(['Málaga Trading', 'Zürich Office']);
    await apply(rule('between', { min: 50, max: 150 }));
    expect(ids()).toEqual(['Málaga Trading', 'Oslo Parts']);
  });

  it('date modes', async () => {
    const { ids, apply } = await setup();
    const rule = (matchMode: string, value: unknown) => ({
      due: { operator: 'and' as const, rules: [{ matchMode, value: value as string }] },
    });
    await apply(rule('dateIs', '2026-03-15'));
    expect(ids()).toEqual(['Berlin Supplies']);
    await apply(rule('dateIsNot', '2026-03-15'));
    expect(ids()).toHaveLength(3);
    await apply(rule('dateBefore', '2026-03-01'));
    expect(ids()).toEqual(['Zürich Office']);
    await apply(rule('dateAfter', '2026-03-01'));
    expect(ids()).toEqual(['Berlin Supplies', 'Oslo Parts']);
    await apply(rule('between', { min: '2026-03-01', max: '2026-03-31' }));
    expect(ids()).toEqual(['Málaga Trading', 'Berlin Supplies']);
  });

  it('in mode for choice lists', async () => {
    const { ids, apply } = await setup();
    await apply({
      status: { operator: 'and', rules: [{ matchMode: 'in', value: ['Paid', 'Overdue'] }] },
    });
    expect(ids()).toEqual(['Málaga Trading', 'Zürich Office']);
  });

  it('joins rules with and / or and skips empty rules', async () => {
    const { ids, apply } = await setup();
    await apply({
      amount: {
        operator: 'and',
        rules: [
          { matchMode: 'gt', value: 50 },
          { matchMode: 'lt', value: 200 },
          { matchMode: 'equals', value: null },
        ],
      },
    });
    expect(ids()).toEqual(['Málaga Trading', 'Oslo Parts']);
    await apply({
      amount: {
        operator: 'or',
        rules: [
          { matchMode: 'lt', value: 50 },
          { matchMode: 'gt', value: 200 },
        ],
      },
    });
    expect(ids()).toEqual(['Berlin Supplies', 'Zürich Office']);
    // Only empty rules: no filter.
    await apply({ amount: { operator: 'or', rules: [{ matchMode: 'lt', value: null }] } });
    expect(ids()).toHaveLength(4);
  });

  it('old value shapes keep working, a text uses the column filterMatchMode', async () => {
    const { ids, apply } = await setup();
    await apply({ customer: 'zur' });
    expect(ids()).toEqual(['Zürich Office']);
    // `startsWith`: "office" is not at the start.
    await apply({ customer: 'office' });
    expect(ids()).toEqual([]);
    await apply({ status: ['Open'] });
    expect(ids()).toEqual(['Berlin Supplies', 'Oslo Parts']);
    await apply({ amount: { min: 80, max: 120 } });
    expect(ids()).toEqual(['Málaga Trading', 'Oslo Parts']);
    await apply({ due: { min: '2026-03-02' } });
    expect(ids()).toEqual(['Berlin Supplies', 'Oslo Parts']);
  });

  it('custom match modes from StarFilterService', async () => {
    const service = TestBed.inject(StarFilterService);
    service.register('even', (value) => Number(value) % 2 === 0, 'Even amount');
    expect(service.get('even')?.label).toBe('Even amount');
    const { ids, apply } = await setup();
    await apply({ amount: { operator: 'and', rules: [{ matchMode: 'even', value: 'yes' }] } });
    expect(ids()).toEqual(['Málaga Trading', 'Zürich Office', 'Oslo Parts']);
    // A mode that is not registered filters nothing.
    service.unregister('even');
    await apply({ amount: { operator: 'and', rules: [{ matchMode: 'even', value: 'x' }] } });
    expect(ids()).toHaveLength(4);
  });

  it('global filter: fields, match mode and locale', async () => {
    const { host, fixture, ids } = await setup();
    host.query.set('o');
    await fixture.whenStable();
    expect(ids()).toEqual(['Berlin Supplies', 'Zürich Office', 'Oslo Parts']);
    host.fields.set(['customer']);
    await fixture.whenStable();
    expect(ids()).toEqual(['Zürich Office', 'Oslo Parts']);
    host.globalMode.set('startsWith');
    await fixture.whenStable();
    expect(ids()).toEqual(['Oslo Parts']);
    host.fields.set(['customer']);
    host.query.set('zu');
    host.locale.set('de');
    await fixture.whenStable();
    expect(ids()).toEqual(['Zürich Office']);
  });

  it('emits filter with the filters and the filtered rows (client mode)', async () => {
    const { host, apply } = await setup();
    expect(host.events).toEqual([]);
    await apply({ status: ['Paid'] });
    expect(host.events.at(-1)?.filters).toEqual({ status: ['Paid'] });
    expect(host.events.at(-1)?.filteredValue.map((row) => row.id)).toEqual([1]);
  });

  it('lazy mode carries the rule filters in lazyLoad and does not emit filter', async () => {
    const { host, apply } = await setup((h) => h.lazy.set(true));
    const filters: StarColumnFilters = {
      amount: { operator: 'or', rules: [{ matchMode: 'gt', value: 100 }] },
    };
    await apply(filters);
    expect(host.lazyEvents.at(-1)?.filters).toEqual(filters);
    expect(host.events).toEqual([]);
  });

  it('pure helpers', () => {
    const cell: StarFilterCell = { raw: 5, text: '5' };
    expect(starMatchesRule(cell, undefined, { matchMode: 'gt', value: 4 })).toBe(true);
    expect(starMatchesRule(cell, undefined, { matchMode: 'notEquals', value: '5' })).toBe(false);
    expect(
      starMatchesRule({ raw: 'x', text: 'x' }, 'select', { matchMode: 'in', value: 'x' }),
    ).toBe(true);
    expect(
      starMatchesRule({ raw: '2026-01-02', text: '' }, undefined, {
        matchMode: 'dateAfter',
        value: '2026-01-01',
      }),
    ).toBe(true);
    expect(starMatchesFilter({ raw: 'B', text: 'B' }, 'select', 'b', undefined)).toBe(false);
    expect(starIsActiveFilter({ operator: 'and', rules: [] })).toBe(false);
    expect(starIsActiveFilter({ operator: 'and', rules: [{ matchMode: 'in', value: [] }] })).toBe(
      false,
    );
    expect(starIsActiveFilter({ min: null, max: 3 })).toBe(true);
    expect(starIsActiveFilter('')).toBe(false);
  });
});
