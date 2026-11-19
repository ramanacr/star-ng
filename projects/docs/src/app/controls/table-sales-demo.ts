import { StarColumn, StarColumnGroup } from '@star-ng/ui/table';

/** Sample data for the table layout examples: fictional monthly sales by region and city. */

export interface CitySales {
  readonly id: string;
  readonly region: string;
  readonly city: string;
  readonly jan: number;
  readonly feb: number;
  readonly mar: number;
  readonly apr: number;
  readonly may: number;
  readonly jun: number;
}

const CITIES: readonly (readonly [string, string])[] = [
  ['Europe', 'Lisbon'],
  ['Europe', 'Oslo'],
  ['Europe', 'Prague'],
  ['Asia', 'Seoul'],
  ['Asia', 'Perth'],
  ['Americas', 'Lima'],
  ['Americas', 'Quebec'],
  ['Americas', 'Bogota'],
];

/** Eight cities in three regions, sorted by region, with sales for six months (deterministic). */
export const CITY_SALES: readonly CitySales[] = CITIES.map(([region, city], i) => {
  const month = (m: number) => 1200 + ((i * 37 + m * 53) % 900) * 10;
  return {
    id: `C-${i + 1}`,
    region,
    city,
    jan: month(1),
    feb: month(2),
    mar: month(3),
    apr: month(4),
    may: month(5),
    jun: month(6),
  };
});

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun'] as const;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

/** Region, city and one column per month. */
export function salesColumns(): StarColumn<CitySales>[] {
  return [
    { field: 'region', header: 'Region', sortable: true },
    { field: 'city', header: 'City', sortable: true },
    ...MONTHS.map((month, i): StarColumn<CitySales> => ({
      field: month,
      header: MONTH_NAMES[i],
      align: 'end',
      width: '6rem',
    })),
  ];
}

/** Location over region and city; quarters inside a Sales group over the months. */
export const SALES_GROUPS: readonly StarColumnGroup[] = [
  { header: 'Location', children: ['region', 'city'] },
  {
    header: 'Sales',
    children: [
      { header: 'Q1', children: ['jan', 'feb', 'mar'] },
      { header: 'Q2', children: ['apr', 'may', 'jun'] },
    ],
  },
];

/** One row of the wide metrics table: an id and 60 metric values. */
export type MetricRow = { readonly id: string } & Readonly<Record<string, number | string>>;

/** 200 rows with 60 metrics each (deterministic). */
export const METRIC_ROWS: readonly MetricRow[] = Array.from({ length: 200 }, (_, row) => {
  const values: Record<string, number | string> = { id: `M-${String(row + 1).padStart(3, '0')}` };
  for (let i = 1; i <= 60; i++) values[`m${i}`] = (row * 31 + i * 17) % 1000;
  return values as MetricRow;
});

/** The id column (pinned) and 60 metric columns of 112 px. */
export function metricColumns(): StarColumn<MetricRow>[] {
  return [
    { field: 'id', header: 'Row', pinned: 'start', width: '6rem' },
    ...Array.from({ length: 60 }, (_, i): StarColumn<MetricRow> => ({
      field: `m${i + 1}`,
      header: `Metric ${i + 1}`,
      width: '112px',
      align: 'end',
    })),
  ];
}
