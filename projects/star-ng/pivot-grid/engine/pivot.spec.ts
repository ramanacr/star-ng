import {
  starPivot,
  StarPivotConfig,
  starPivotFormatValue,
  starPivotMembers,
  starPivotPathKey,
  StarPivotRow,
  starPivotToCsv,
} from './index';

interface Sale {
  readonly region: string | null;
  readonly product: string;
  readonly date: string;
  readonly amount: number;
  readonly units: number;
}

const SALES: readonly Sale[] = [
  { region: 'North', product: 'Desk', date: '2025-01-15', amount: 100, units: 1 },
  { region: 'North', product: 'Desk', date: '2025-04-02', amount: 200, units: 2 },
  { region: 'North', product: 'Lamp', date: '2025-02-20', amount: 50, units: 5 },
  { region: 'South', product: 'Desk', date: '2025-07-09', amount: 300, units: 3 },
  { region: 'South', product: 'Chair', date: '2026-01-03', amount: 80, units: 4 },
  { region: 'East', product: 'Lamp', date: '2026-05-30', amount: 40, units: 2 },
];

const BY_REGION: StarPivotConfig<Sale> = {
  rows: [{ field: 'region' }],
  columns: [],
  values: [{ field: 'amount', aggregate: 'sum' }],
};

function labels(result: { readonly rows: readonly StarPivotRow[] }): string[] {
  return result.rows.map((row) => `${'  '.repeat(row.level)}${row.kind}:${row.label}`);
}

describe('starPivot engine', () => {
  it('sums a value by one row dimension, members sorted by label, with a grand total', () => {
    const result = starPivot(SALES, BY_REGION);
    expect(labels(result)).toEqual(['member:East', 'member:North', 'member:South', 'total:']);
    expect(result.cells.map((row) => row[0])).toEqual([40, 350, 380, 770]);
    expect(result.columns).toHaveLength(1);
    expect(result.columns[0].kind).toBe('total');
    expect(result.headerRows).toHaveLength(1);
    expect(result.headerRows[0][0]).toMatchObject({ kind: 'value', label: 'amount', colSpan: 1 });
  });

  it('computes every built-in aggregate', () => {
    const values = (['sum', 'count', 'avg', 'min', 'max', 'distinctCount'] as const).map(
      (aggregate) => ({ field: aggregate === 'distinctCount' ? 'product' : 'amount', aggregate }),
    );
    const result = starPivot(SALES, { rows: [{ field: 'region' }], columns: [], values });
    const north = result.rows.findIndex((row) => row.label === 'North');
    expect(result.cells[north]).toEqual([350, 3, 350 / 3, 50, 200, 2]);
    const total = result.rows.length - 1;
    expect(result.cells[total]).toEqual([770, 6, 770 / 6, 40, 300, 3]);
    expect(result.headerRows[0].map((cell) => cell.label)).toEqual([
      'amount',
      'amount',
      'amount',
      'amount',
      'amount',
      'product',
    ]);
  });

  it('calls a custom aggregate with the values and the records of the cell', () => {
    const spread = vi.fn((values: readonly unknown[], records: readonly Sale[]) => {
      const numbers = values as number[];
      return records.length ? Math.max(...numbers) - Math.min(...numbers) : null;
    });
    const result = starPivot(SALES, {
      rows: [{ field: 'region' }],
      columns: [],
      values: [{ field: 'amount', aggregate: spread, label: 'Spread' }],
    });
    expect(result.cells.map((row) => row[0])).toEqual([0, 150, 220, 260]);
    expect(spread).toHaveBeenCalledWith([100, 200, 50], [SALES[0], SALES[1], SALES[2]]);
    expect(result.headerRows[0][0].label).toBe('Spread');
  });

  it('ignores values that are not numbers in sum, avg, min and max', () => {
    const rows = [
      { group: 'A', value: 5 },
      { group: 'A', value: null },
      { group: 'A', value: 'x' },
      { group: 'A', value: '7' },
    ];
    const result = starPivot(rows, {
      rows: [{ field: 'group' }],
      columns: [],
      values: [
        { field: 'value', aggregate: 'sum' },
        { field: 'value', aggregate: 'avg' },
        { field: 'value', aggregate: 'min' },
        { field: 'value', aggregate: 'count' },
      ],
      rowGrandTotals: false,
    });
    expect(result.cells).toEqual([[12, 6, 5, 4]]);
  });

  it('nests rows and columns with subtotals and grand totals', () => {
    const result = starPivot(SALES, {
      rows: [{ field: 'region' }, { field: 'product' }],
      columns: [{ field: 'product' }],
      values: [{ field: 'units', aggregate: 'sum' }],
    });
    expect(labels(result)).toEqual([
      'member:East',
      '  member:Lamp',
      'member:North',
      '  member:Desk',
      '  member:Lamp',
      'member:South',
      '  member:Chair',
      '  member:Desk',
      'total:',
    ]);
    expect(result.columns.map((column) => `${column.kind}:${column.label}`)).toEqual([
      'member:Chair',
      'member:Desk',
      'member:Lamp',
      'total:',
    ]);
    const north = result.rows.findIndex((row) => row.label === 'North');
    // The parent row carries the subtotal of its children.
    expect(result.cells[north]).toEqual([null, 3, 5, 8]);
    expect(result.rows[north]).toMatchObject({
      expandable: true,
      expanded: true,
      hasValues: true,
      path: ['North'],
      key: starPivotPathKey(['North']),
    });
    expect(result.rows[north + 1]).toMatchObject({ path: ['North', 'Desk'], expandable: false });
    expect(result.cells.at(-1)).toEqual([4, 6, 7, 17]);
  });

  it('builds multi-level column headers with spans, subtotal and grand total columns', () => {
    const result = starPivot(SALES, {
      rows: [],
      columns: [{ field: 'region' }, { field: 'product' }],
      values: [{ field: 'amount', aggregate: 'sum' }],
    });
    const header = result.headerRows.map((row) =>
      row.map(
        (cell) => `${cell.kind}:${cell.label}@${cell.column}+${cell.colSpan}x${cell.rowSpan}`,
      ),
    );
    expect(header).toEqual([
      [
        'member:East@0+1x1',
        'subtotal:East@1+1x2',
        'member:North@2+2x1',
        'subtotal:North@4+1x2',
        'member:South@5+2x1',
        'subtotal:South@7+1x2',
        'total:@8+1x2',
      ],
      [
        'member:Lamp@0+1x1',
        'member:Desk@2+1x1',
        'member:Lamp@3+1x1',
        'member:Chair@5+1x1',
        'member:Desk@6+1x1',
      ],
    ]);
    // Without row dimensions there is one row: the grand total.
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].kind).toBe('total');
    expect(result.cells[0]).toEqual([40, 40, 100 + 200, 50, 350, 80, 300, 380, 770]);
  });

  it('adds a value header row when there are several values', () => {
    const result = starPivot(SALES, {
      rows: [{ field: 'region' }],
      columns: [{ field: 'product' }],
      values: [
        { field: 'amount', aggregate: 'sum', label: 'Amount' },
        { field: 'units', aggregate: 'sum', label: 'Units' },
      ],
      columnGrandTotals: false,
    });
    expect(result.headerRows).toHaveLength(2);
    expect(result.headerRows[0].map((cell) => `${cell.label}+${cell.colSpan}`)).toEqual([
      'Chair+2',
      'Desk+2',
      'Lamp+2',
    ]);
    expect(result.headerRows[1].map((cell) => cell.label)).toEqual([
      'Amount',
      'Units',
      'Amount',
      'Units',
      'Amount',
      'Units',
    ]);
    expect(result.columns.map((column) => column.valueIndex)).toEqual([0, 1, 0, 1, 0, 1]);
  });

  it('turns totals and subtotals off per axis', () => {
    const result = starPivot(SALES, {
      rows: [{ field: 'region' }, { field: 'product' }],
      columns: [{ field: 'region' }, { field: 'product' }],
      values: [{ field: 'units', aggregate: 'sum' }],
      rowGrandTotals: false,
      rowSubtotals: false,
      columnGrandTotals: false,
      columnSubtotals: false,
    });
    expect(result.rows.some((row) => row.kind === 'total')).toBe(false);
    expect(result.columns.every((column) => column.kind === 'member')).toBe(true);
    expect(result.columns).toHaveLength(5);
    const north = result.rows.findIndex((row) => row.label === 'North');
    expect(result.rows[north].hasValues).toBe(false);
    expect(result.cells[north].every((value) => value === null)).toBe(true);
  });

  it('builds a year > quarter > month date hierarchy', () => {
    const result = starPivot(
      SALES,
      {
        rows: [{ field: 'date', dateHierarchy: true }],
        columns: [],
        values: [{ field: 'amount', aggregate: 'sum' }],
      },
      { locale: 'en-US' },
    );
    expect(labels(result)).toEqual([
      'member:2025',
      '  member:Q1',
      '    member:Jan',
      '    member:Feb',
      '  member:Q2',
      '    member:Apr',
      '  member:Q3',
      '    member:Jul',
      'member:2026',
      '  member:Q1',
      '    member:Jan',
      '  member:Q2',
      '    member:May',
      'total:',
    ]);
    expect(result.rows[2].path).toEqual([2025, 1, 1]);
    expect(result.cells.map((row) => row[0])).toEqual([
      650, 150, 100, 50, 200, 200, 300, 300, 120, 80, 80, 40, 40, 770,
    ]);
  });

  it('uses only the date levels that a dimension names, and accepts Date values', () => {
    const rows = [
      { at: new Date(2025, 0, 31), n: 1 },
      { at: new Date(2025, 11, 1), n: 2 },
    ];
    const result = starPivot(
      rows,
      {
        rows: [{ field: 'at', dateHierarchy: ['year', 'month'] }],
        columns: [],
        values: [{ field: 'n', aggregate: 'sum' }],
      },
      { locale: 'en-US' },
    );
    expect(labels(result)).toEqual(['member:2025', '  member:Jan', '  member:Dec', 'total:']);
  });

  it('formats member labels and leaves blank members last', () => {
    const data = [
      ...SALES,
      { region: null, product: 'Desk', date: '2025-03-03', amount: 1, units: 1 },
    ];
    const result = starPivot(
      data,
      {
        rows: [{ field: 'region', format: (value) => `Region ${value}` }],
        columns: [],
        values: [{ field: 'amount' }],
      },
      { blankLabel: '(empty)' },
    );
    expect(result.rows.map((row) => row.label)).toEqual([
      'Region East',
      'Region North',
      'Region South',
      '(empty)',
      '',
    ]);
  });

  it('filters records by include and exclude member lists', () => {
    const include = starPivot(SALES, {
      ...BY_REGION,
      filters: [{ field: 'product', include: ['Desk', 'Chair'] }],
    });
    expect(include.cells.map((row) => row[0])).toEqual([300, 380, 680]);
    const exclude = starPivot(SALES, {
      ...BY_REGION,
      filters: [{ field: 'region', exclude: ['North'] }],
    });
    expect(exclude.rows.map((row) => row.label)).toEqual(['East', 'South', '']);
    expect(exclude.recordCount).toBe(3);
  });

  it('sorts members descending, or by a value', () => {
    const desc = starPivot(SALES, {
      ...BY_REGION,
      rows: [{ field: 'region', sort: { order: 'desc' } }],
    });
    expect(desc.rows.map((row) => row.label)).toEqual(['South', 'North', 'East', '']);
    const byValue = starPivot(SALES, {
      rows: [{ field: 'product', sort: { by: 'value', value: 1, order: 'desc' } }],
      columns: [{ field: 'region', sort: { by: 'value', value: 0 } }],
      values: [
        { field: 'amount', aggregate: 'sum' },
        { field: 'units', aggregate: 'sum' },
      ],
    });
    // Units: Lamp 7, Desk 6, Chair 4. Amount by region: East 40, North 350, South 380.
    expect(byValue.rows.map((row) => row.label)).toEqual(['Lamp', 'Desk', 'Chair', '']);
    expect(byValue.headerRows[0].map((cell) => cell.label)).toEqual(['East', 'North', 'South', '']);
  });

  it('collapses row and column members: the member shows its subtotal, children hide', () => {
    const result = starPivot(SALES, {
      rows: [{ field: 'region' }, { field: 'product' }],
      columns: [{ field: 'region' }, { field: 'product' }],
      values: [{ field: 'amount', aggregate: 'sum' }],
      collapsedRows: [starPivotPathKey(['North'])],
      collapsedColumns: [starPivotPathKey(['South'])],
    });
    const north = result.rows.findIndex((row) => row.label === 'North');
    expect(result.rows[north]).toMatchObject({ expandable: true, expanded: false });
    expect(result.rows[north + 1].label).toBe('South');
    const south = result.columns.findIndex((column) => column.label === 'South');
    expect(result.columns[south]).toMatchObject({ kind: 'member', path: ['South'] });
    expect(result.columns.filter((column) => column.path[0] === 'South')).toHaveLength(1);
    const head = result.headerRows[0].find((cell) => cell.label === 'South');
    expect(head).toMatchObject({ expandable: true, expanded: false, rowSpan: 2, colSpan: 1 });
    expect(result.cells[north][south]).toBeNull();
    expect(result.cells.at(-1)![south]).toBe(380);
  });

  it('returns the source records of a cell for drill-down', () => {
    const result = starPivot(SALES, {
      rows: [{ field: 'region' }],
      columns: [{ field: 'product' }],
      values: [{ field: 'amount', aggregate: 'sum' }],
    });
    const north = result.rows.findIndex((row) => row.label === 'North');
    const desk = result.columns.findIndex((column) => column.label === 'Desk');
    expect(result.records(north, desk)).toEqual([SALES[0], SALES[1]]);
    expect(result.records(result.rows.length - 1, result.columns.length - 1)).toHaveLength(6);
    expect(result.records(99, 0)).toEqual([]);
  });

  it('handles empty data', () => {
    const result = starPivot([] as Sale[], {
      rows: [{ field: 'region' }],
      columns: [{ field: 'product' }],
      values: [{ field: 'amount', aggregate: 'sum' }],
    });
    expect(result.rows.map((row) => row.kind)).toEqual(['total']);
    expect(result.columns.map((column) => column.kind)).toEqual(['total']);
    expect(result.cells).toEqual([[null]]);
    expect(result.recordCount).toBe(0);
  });

  it('reads a value through an accessor function', () => {
    const result = starPivot(SALES, {
      rows: [{ field: 'zone', value: (sale: Sale) => (sale.region === 'North' ? 'N' : 'Other') }],
      columns: [],
      values: [{ field: 'net', value: (sale: Sale) => sale.amount - sale.units, aggregate: 'sum' }],
    });
    expect(result.rows.map((row) => row.label)).toEqual(['N', 'Other', '']);
    expect(result.cells.map((row) => row[0])).toEqual([342, 411, 753]);
  });

  it('lists the members of a field for a filter list', () => {
    expect(starPivotMembers(SALES, { field: 'product' })).toEqual([
      { key: 's:Chair', value: 'Chair', label: 'Chair' },
      { key: 's:Desk', value: 'Desk', label: 'Desk' },
      { key: 's:Lamp', value: 'Lamp', label: 'Lamp' },
    ]);
  });

  it('formats values with Intl options or a function', () => {
    expect(starPivotFormatValue(1234.5, { field: 'a' }, 'en-US')).toBe('1,234.5');
    expect(
      starPivotFormatValue(
        1234.5,
        { field: 'a', format: { style: 'currency', currency: 'EUR' } },
        'de-DE',
      ).replace(/\s/g, ' '),
    ).toBe('1.234,50 €');
    expect(starPivotFormatValue(2, { field: 'a', format: (value) => `#${value}` }, 'en')).toBe(
      '#2',
    );
    expect(starPivotFormatValue(null, { field: 'a' }, 'en', '–')).toBe('–');
    expect(starPivotFormatValue('x', { field: 'a' }, 'en')).toBe('x');
  });

  it('buckets instants of a date hierarchy in the config time zone', () => {
    // 23:30 UTC on 31 March is 1 April in Berlin (UTC+2 in summer time).
    const data = [
      { at: '2025-03-31T23:30:00Z', n: 1 },
      { at: Date.UTC(2025, 5, 30, 23, 0), n: 2 },
    ];
    const config: StarPivotConfig = {
      rows: [{ field: 'at', dateHierarchy: ['quarter', 'month'] }],
      columns: [],
      values: [{ field: 'n' }],
      rowGrandTotals: false,
    };
    const utc = starPivot(data, { ...config, timeZone: 'UTC' }, { locale: 'en-US' });
    expect(labels(utc)).toEqual(['member:Q1', '  member:Mar', 'member:Q2', '  member:Jun']);
    const berlin = starPivot(data, { ...config, timeZone: 'Europe/Berlin' }, { locale: 'en-US' });
    expect(labels(berlin)).toEqual(['member:Q2', '  member:Apr', 'member:Q3', '  member:Jul']);
    // A date-only text is a calendar date in every zone.
    const day = starPivot([{ at: '2025-03-31', n: 1 }], {
      ...config,
      timeZone: 'Pacific/Kiritimati',
    });
    expect(day.rows.map((row) => row.label)).toEqual(['Q1', expect.any(String)]);
  });

  it('falls back to the runtime zone for an unknown time zone and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const config: StarPivotConfig = {
      rows: [{ field: 'at', dateHierarchy: ['month'] }],
      columns: [],
      values: [{ field: 'n' }],
      rowGrandTotals: false,
      timeZone: 'Bogus/Zone',
    };
    const data = [{ at: new Date(2025, 4, 15, 12), n: 1 }];
    expect(() => starPivot(data, config, { locale: 'en-US' })).not.toThrow();
    expect(starPivot(data, config, { locale: 'en-US' }).rows.map((row) => row.label)).toEqual([
      'May',
    ]);
    expect(warn.mock.calls.filter((call) => String(call[0]).includes('Bogus/Zone'))).toHaveLength(
      1,
    );
    warn.mockRestore();
  });

  it('reads an ISO date-time text without an offset as wall time in every zone', () => {
    const data = [
      { at: '2025-03-31T23:30:00', n: 1 },
      { at: '2025-06-30 23:59', n: 2 },
    ];
    for (const timeZone of [undefined, 'UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
      const result = starPivot(
        data,
        {
          rows: [{ field: 'at', dateHierarchy: ['quarter', 'month'] }],
          columns: [],
          values: [{ field: 'n' }],
          rowGrandTotals: false,
          ...(timeZone ? { timeZone } : {}),
        },
        { locale: 'en-US' },
      );
      expect(labels(result)).toEqual(['member:Q1', '  member:Mar', 'member:Q2', '  member:Jun']);
    }
  });

  it('drops date texts with a month or day out of range as invalid (blank)', () => {
    const data = ['2025-13-45T10:00', '2025-00-10', '2025-02-32 08:00', '2025-02-03T08:00'].map(
      (at) => ({ at, n: 1 }),
    );
    const result = starPivot(
      data,
      {
        rows: [{ field: 'at', dateHierarchy: ['month'] }],
        columns: [],
        values: [{ field: 'n' }],
        rowGrandTotals: false,
      },
      { locale: 'en-US', blankLabel: '(blank)' },
    );
    expect(
      result.rows.map((row) => `${row.label}:${result.cells[result.rows.indexOf(row)][0]}`),
    ).toEqual(['Feb:1', '(blank):3']);
  });

  it('labels quarters with the quarterLabel option', () => {
    const result = starPivot(
      SALES,
      {
        rows: [{ field: 'date', dateHierarchy: ['quarter'] }],
        columns: [],
        values: [{ field: 'n' }],
      },
      { quarterLabel: (quarter) => `T${quarter}` },
    );
    expect(result.rows.slice(0, 3).map((row) => row.label)).toEqual(['T1', 'T2', 'T3']);
  });

  it('keeps NaN, booleans and objects apart from blanks and from each other', () => {
    const a = { id: 1 };
    const b = { id: 2 };
    const data = [
      { k: NaN },
      { k: null },
      { k: true },
      { k: 'true' },
      { k: a },
      { k: b },
      { k: Infinity },
    ];
    const result = starPivot(data, {
      rows: [{ field: 'k' }],
      columns: [],
      values: [{ field: 'k', aggregate: 'count' }],
    });
    const keys = result.rows.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(result.rows).toHaveLength(8);
  });

  it('sorts members without a numeric total last, also in ascending value order', () => {
    const data = [
      { g: 'A', v: 5 },
      { g: 'B', v: 'x' },
      { g: 'C', v: 1 },
    ];
    const result = starPivot(data, {
      rows: [{ field: 'g', sort: { by: 'value' } }],
      columns: [],
      values: [{ field: 'v' }],
      rowGrandTotals: false,
    });
    expect(result.rows.map((row) => row.label)).toEqual(['C', 'A', 'B']);
  });

  it('reads only plain decimal texts as numbers', () => {
    const data = ['0x10', '1e3', ' 7 ', '-2.5', '0b1'].map((v) => ({ g: 'A', v }));
    const result = starPivot(data, {
      rows: [{ field: 'g' }],
      columns: [],
      values: [{ field: 'v' }],
      rowGrandTotals: false,
    });
    expect(result.cells).toEqual([[4.5]]);
  });

  it('filters through the value accessor of a filter or a value definition', () => {
    const byFilter = starPivot(SALES, {
      ...BY_REGION,
      filters: [
        {
          field: 'size',
          value: (sale: Sale) => (sale.amount > 100 ? 'big' : 'small'),
          exclude: ['small'],
        },
      ],
    });
    expect(byFilter.cells.map((row) => row[0])).toEqual([200, 300, 500]);
  });

  // The best of three runs, with headroom: the CI and local machines run other work in parallel.
  it('pivots 10,000 records fast (best of three runs under 1.5 s)', () => {
    const regions = ['North', 'South', 'East', 'West'];
    const products = Array.from({ length: 25 }, (_, i) => `Product ${i}`);
    const data: Sale[] = Array.from({ length: 10_000 }, (_, i) => ({
      region: regions[i % 4],
      product: products[(i * 7) % 25],
      date: `${2023 + (i % 3)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      amount: (i * 13) % 1000,
      units: i % 9,
    }));
    const run = () =>
      starPivot(data, {
        rows: [{ field: 'region' }, { field: 'product' }],
        columns: [{ field: 'date', dateHierarchy: true }],
        values: [
          { field: 'amount', aggregate: 'sum' },
          { field: 'units', aggregate: 'avg' },
          { field: 'product', aggregate: 'distinctCount' },
        ],
      });
    let elapsed = Infinity;
    let result = run();
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      result = run();
      elapsed = Math.min(elapsed, performance.now() - start);
    }
    expect(result.rows).toHaveLength(4 + 100 + 1);
    expect(result.cells.at(-1)![result.columns.length - 3]).toBe(
      data.reduce((sum, sale) => sum + sale.amount, 0),
    );
    expect(elapsed).toBeLessThan(1500);
  });
});

describe('starPivotToCsv', () => {
  const result = starPivot(SALES, {
    rows: [{ field: 'region' }],
    columns: [{ field: 'product' }],
    values: [{ field: 'amount', aggregate: 'sum' }],
    rowGrandTotals: false,
  });
  const names = {
    corner: 'Region',
    total: 'Grand total',
    subtotal: (label: string) => `${label} total`,
  };

  it('writes the header rows and the visible rows (RFC 4180, CRLF)', () => {
    const csv = starPivotToCsv(result, names);
    expect(csv.split('\r\n')).toEqual([
      'Region,Chair,Desk,Lamp,Grand total',
      'East,,,40,40',
      'North,,300,50,350',
      'South,80,300,,380',
    ]);
  });

  it('escapes text that a spreadsheet would run as a formula, unless turned off', () => {
    const risky = starPivot(
      [
        { name: '=SUM(A1)', n: 1 },
        { name: 'a,"b"', n: 2 },
        { name: '-x', n: -3 },
      ],
      { rows: [{ field: 'name' }], columns: [], values: [{ field: 'n' }], rowGrandTotals: false },
    );
    const lines = starPivotToCsv(risky, { ...names, corner: '+Name' }).split('\r\n');
    expect(lines).toEqual(["'+Name,n", "'-x,-3", "'=SUM(A1),1", '"a,""b""",2']);
    expect(starPivotToCsv(risky, { ...names, escapeFormulas: false }).split('\r\n')[1]).toBe(
      '-x,-3',
    );
  });

  it('never escapes number cells, also when formatted as negative numbers', () => {
    const negative = starPivot([{ g: 'A', n: -1234.5 }], {
      rows: [{ field: 'g' }],
      columns: [],
      values: [{ field: 'n' }],
      rowGrandTotals: false,
    });
    const csv = starPivotToCsv(negative, {
      ...names,
      format: (value) => new Intl.NumberFormat('en-US').format(value as number),
    });
    expect(csv.split('\r\n')[1]).toBe('A,"-1,234.5"');
    expect(starPivotToCsv(negative, names).split('\r\n')[1]).toBe('A,-1234.5');
  });

  it('escapes text that starts with a tab or a carriage return', () => {
    const risky = starPivot([{ name: '\t=1', n: 1 }], {
      rows: [{ field: 'name' }],
      columns: [],
      values: [{ field: 'n' }],
      rowGrandTotals: false,
    });
    expect(starPivotToCsv(risky, names).split('\r\n')[1]).toBe("'\t=1,1");
  });

  it('writes formatted values when asked', () => {
    const csv = starPivotToCsv(result, { ...names, format: (value) => `${value} EUR` });
    expect(csv.split('\r\n')[1]).toBe('East,,,40 EUR,40 EUR');
  });
});
