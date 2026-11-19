import { STAR_UI_TEXT_DEFAULTS, StarFilterService } from '@star-ng/ui/core';
import { STAR_UI_TEXT_DE } from '@star-ng/ui/i18n/de';
import { STAR_UI_TEXT_ES } from '@star-ng/ui/i18n/es';
import {
  STAR_QUERY_MATCH_MODES,
  starIsQueryGroup,
  StarQueryField,
  StarQueryGroup,
  starQueryIncompleteCount,
  starQueryModesOf,
  starQueryNewRule,
  starQueryRuleComplete,
  starQueryToPredicate,
  starQueryToText,
} from './query-model';

interface Order {
  id: number;
  customer: string;
  total: number;
  placed: string;
  status: string;
  paid: boolean;
}

const orders: Order[] = [
  { id: 1, customer: 'Ana Ruiz', total: 120, placed: '2026-03-02', status: 'open', paid: false },
  { id: 2, customer: 'Ben Okafor', total: 80, placed: '2026-03-10', status: 'paid', paid: true },
  {
    id: 3,
    customer: 'Chloé Martin',
    total: 300,
    placed: '2026-04-01',
    status: 'shipped',
    paid: true,
  },
  { id: 4, customer: 'Dev Patel', total: 45, placed: '2026-02-20', status: 'open', paid: false },
];

const fields: StarQueryField<Order>[] = [
  { field: 'customer', label: 'Customer', type: 'text' },
  { field: 'total', label: 'Total', type: 'number' },
  { field: 'placed', label: 'Placed', type: 'date' },
  {
    field: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Open', value: 'open' },
      { label: 'Paid', value: 'paid' },
      { label: 'Shipped', value: 'shipped' },
    ],
  },
  { field: 'paid', label: 'Paid', type: 'boolean' },
];

const ids = (query: StarQueryGroup, service?: StarFilterService) =>
  orders.filter(starQueryToPredicate(query, fields, service)).map((order) => order.id);
const one = (field: string, matchMode: string, value: unknown): StarQueryGroup => ({
  operator: 'and',
  rules: [{ field, matchMode, value: value as never }],
});

describe('query builder model', () => {
  it('uses the match modes of the table filter per type, plus select and boolean', () => {
    expect(STAR_QUERY_MATCH_MODES.text).toEqual([
      'contains',
      'startsWith',
      'endsWith',
      'equals',
      'notContains',
    ]);
    expect(STAR_QUERY_MATCH_MODES.number).toContain('between');
    expect(STAR_QUERY_MATCH_MODES.date).toEqual([
      'dateIs',
      'dateIsNot',
      'dateBefore',
      'dateAfter',
      'between',
    ]);
    expect(STAR_QUERY_MATCH_MODES.select).toEqual(['equals', 'notEquals', 'in']);
    expect(STAR_QUERY_MATCH_MODES.boolean).toEqual(['equals']);
    expect(
      starQueryModesOf({ field: 'x', label: 'X', type: 'text', matchModes: ['equals'] }),
    ).toEqual(['equals']);
  });

  it('text modes ignore case and accents', () => {
    expect(ids(one('customer', 'contains', 'chloe'))).toEqual([3]);
    expect(ids(one('customer', 'startsWith', 'b'))).toEqual([2]);
    expect(ids(one('customer', 'endsWith', 'patel'))).toEqual([4]);
    expect(ids(one('customer', 'equals', 'ana ruiz'))).toEqual([1]);
    expect(ids(one('customer', 'notContains', 'ru'))).toEqual([2, 3, 4]);
  });

  it('number modes', () => {
    expect(ids(one('total', 'equals', 80))).toEqual([2]);
    expect(ids(one('total', 'notEquals', 80))).toEqual([1, 3, 4]);
    expect(ids(one('total', 'lt', 80))).toEqual([4]);
    expect(ids(one('total', 'lte', 80))).toEqual([2, 4]);
    expect(ids(one('total', 'gt', 120))).toEqual([3]);
    expect(ids(one('total', 'gte', 120))).toEqual([1, 3]);
    expect(ids(one('total', 'between', { min: 50, max: 150 }))).toEqual([1, 2]);
  });

  it('date modes compare calendar days', () => {
    expect(ids(one('placed', 'dateIs', '2026-03-10'))).toEqual([2]);
    expect(ids(one('placed', 'dateIsNot', '2026-03-10'))).toEqual([1, 3, 4]);
    expect(ids(one('placed', 'dateBefore', '2026-03-02'))).toEqual([4]);
    expect(ids(one('placed', 'dateAfter', '2026-03-10'))).toEqual([3]);
    expect(ids(one('placed', 'between', { min: '2026-03-01', max: '2026-03-31' }))).toEqual([1, 2]);
  });

  it('select and boolean modes', () => {
    expect(ids(one('status', 'equals', 'open'))).toEqual([1, 4]);
    expect(ids(one('status', 'notEquals', 'open'))).toEqual([2, 3]);
    expect(ids(one('status', 'in', ['paid', 'shipped']))).toEqual([2, 3]);
    expect(ids(one('paid', 'equals', true))).toEqual([2, 3]);
    expect(ids(one('paid', 'equals', false))).toEqual([1, 4]);
  });

  it('nested groups join with and / or; empty rules and groups match every row', () => {
    const query: StarQueryGroup = {
      operator: 'and',
      rules: [
        { field: 'total', matchMode: 'gte', value: 50 },
        {
          operator: 'or',
          rules: [
            { field: 'status', matchMode: 'equals', value: 'open' },
            { field: 'paid', matchMode: 'equals', value: true },
          ],
        },
        { field: 'customer', matchMode: 'contains', value: '' },
        { operator: 'or', rules: [] },
      ],
    };
    expect(ids(query)).toEqual([1, 2, 3]);
    expect(ids({ operator: 'or', rules: [] })).toEqual([1, 2, 3, 4]);
    expect(ids({ ...query, operator: 'or' })).toEqual([1, 2, 3, 4]);
    expect(starIsQueryGroup(query.rules[1])).toBe(true);
    expect(starIsQueryGroup(query.rules[0])).toBe(false);
  });

  it('an incomplete rule (one bound of between, empty in) does not filter and is left out of the summary', () => {
    const half = one('total', 'between', { min: 100 });
    expect(ids(half)).toEqual([1, 2, 3, 4]);
    expect(ids(one('placed', 'between', { max: '2026-03-01' }))).toEqual([1, 2, 3, 4]);
    expect(ids(one('status', 'in', []))).toEqual([1, 2, 3, 4]);
    expect(starQueryToText(half, fields, STAR_UI_TEXT_DEFAULTS)).toBe('No conditions');
    const mixed: StarQueryGroup = {
      operator: 'and',
      rules: [
        { field: 'total', matchMode: 'between', value: { min: 100, max: null } },
        { field: 'customer', matchMode: 'contains', value: 'an' },
      ],
    };
    expect(starQueryToText(mixed, fields, STAR_UI_TEXT_DEFAULTS)).toBe('Customer contains an');
    expect(starQueryToText(mixed, fields, STAR_UI_TEXT_DEFAULTS)).not.toContain('null');
    // A boolean rule is complete with false too.
    expect(ids(one('paid', 'equals', false))).toEqual([1, 4]);
  });

  it('mode labels: German keeps the case, English and Spanish lower only the first letter', () => {
    const query = one('total', 'gte', 5);
    expect(starQueryToText(query, fields, STAR_UI_TEXT_DEFAULTS)).toBe(
      'Total greater than or equal to 5',
    );
    expect(starQueryToText(query, fields, STAR_UI_TEXT_DE)).toBe(
      `Total ${STAR_UI_TEXT_DE.matchGte} 5`,
    );
    const es = STAR_UI_TEXT_ES.matchGte;
    expect(starQueryToText(query, fields, STAR_UI_TEXT_ES)).toBe(
      `Total ${es.charAt(0).toLocaleLowerCase('es')}${es.slice(1)} 5`,
    );
    expect(STAR_UI_TEXT_DEFAULTS.queryRuleSummary('Name', 'Is IBAN', 'x')).toBe('Name is IBAN x');
  });

  it('a boolean field reads the texts "false" and "0" as false', () => {
    const rows = [{ flag: 'false' }, { flag: 'true' }, { flag: '0' }, { flag: true }];
    const flags: StarQueryField<{ flag: unknown }>[] = [
      { field: 'flag', label: 'Flag', type: 'boolean' },
    ];
    const predicate = starQueryToPredicate(one('flag', 'equals', true), flags);
    expect(rows.map(predicate)).toEqual([false, true, false, true]);
  });

  it('custom match modes come from StarFilterService', () => {
    const service = new StarFilterService();
    service.register('even', (value) => Number(value) % 2 === 0, 'Is even');
    const query = one('total', 'even', 'yes');
    expect(ids(query, service)).toEqual([1, 2, 3]);
    // Without the service an unknown mode matches every row, as in the table.
    expect(ids(query)).toEqual([1, 2, 3, 4]);
  });

  it('a field accessor reads the value', () => {
    const custom: StarQueryField<Order>[] = [
      {
        field: 'name',
        label: 'Name',
        type: 'text',
        value: (order) => order.customer.toUpperCase(),
      },
    ];
    const predicate = starQueryToPredicate<Order>(one('name', 'startsWith', 'DEV'), custom);
    expect(orders.filter(predicate).map((order) => order.id)).toEqual([4]);
  });

  it('completeness: every rule needs a known field, a mode and a value', () => {
    const status = fields[3];
    expect(starQueryRuleComplete({ field: 'status', matchMode: 'in', value: [] }, status)).toBe(
      false,
    );
    expect(
      starQueryRuleComplete({ field: 'status', matchMode: 'in', value: ['open'] }, status),
    ).toBe(true);
    expect(
      starQueryRuleComplete({ field: 'total', matchMode: 'between', value: { min: 1 } }, fields[1]),
    ).toBe(false);
    expect(
      starQueryRuleComplete({ field: 'paid', matchMode: 'equals', value: false }, fields[4]),
    ).toBe(true);
    expect(starQueryRuleComplete({ field: 'x', matchMode: 'equals', value: 'a' }, undefined)).toBe(
      false,
    );
    const query: StarQueryGroup = {
      operator: 'and',
      rules: [
        { field: 'customer', matchMode: 'contains', value: '' },
        { operator: 'or', rules: [{ field: 'total', matchMode: 'gt', value: null }] },
        { field: 'paid', matchMode: 'equals', value: true },
      ],
    };
    expect(starQueryIncompleteCount(query, fields)).toBe(2);
    expect(starQueryIncompleteCount({ operator: 'and', rules: [] }, fields)).toBe(0);
  });

  it('a new rule takes the first mode and an empty value of its field', () => {
    expect(starQueryNewRule(fields[1])).toEqual({
      field: 'total',
      matchMode: 'equals',
      value: null,
    });
    expect(starQueryNewRule(fields[4])).toEqual({
      field: 'paid',
      matchMode: 'equals',
      value: true,
    });
    expect(starQueryNewRule(undefined)).toEqual({ field: '', matchMode: 'contains', value: null });
  });

  it('summary text names fields, modes and values, with groups in brackets', () => {
    const service = new StarFilterService();
    service.register('even', () => true, 'Is even');
    const query: StarQueryGroup = {
      operator: 'and',
      rules: [
        { field: 'customer', matchMode: 'contains', value: 'an' },
        {
          operator: 'or',
          rules: [
            { field: 'status', matchMode: 'in', value: ['open', 'paid'] },
            { field: 'total', matchMode: 'between', value: { min: 10, max: 20 } },
          ],
        },
        { field: 'paid', matchMode: 'equals', value: false },
        { field: 'total', matchMode: 'even', value: 'x' },
        { field: 'placed', matchMode: 'dateIs', value: null },
      ],
    };
    expect(starQueryToText(query, fields, STAR_UI_TEXT_DEFAULTS, service)).toBe(
      'Customer contains an and (Status is one of Open, Paid or Total between 10 and 20) and ' +
        'Paid equals No and Total is even x',
    );
    expect(starQueryToText({ operator: 'and', rules: [] }, fields, STAR_UI_TEXT_DEFAULTS)).toBe(
      'No conditions',
    );
    expect(starQueryToText(one('customer', 'contains', 'an'), fields, STAR_UI_TEXT_DE)).toBe(
      'Customer Enthält an',
    );
  });
});
