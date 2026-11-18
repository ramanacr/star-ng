import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarColumn, StarTable } from './table';
import {
  clusterColumns,
  groupPaths,
  headerAssociations,
  headerRows,
  parentGroupOf,
  StarColumnGroup,
  StarColumnGroupHeaderTemplate,
} from './table-column-groups';
import { StarColumnPins } from './table-pinning';

const Q1: StarColumnGroup = { header: 'Q1', children: ['jan', 'feb'] };
const GROUPS: StarColumnGroup[] = [
  { header: 'Sales', children: [Q1, { header: 'Q2', children: ['apr', 'may'] }] },
  { header: 'Stock', children: ['units'] },
];
const field = (name: string) => ({ field: name });

describe('column group helpers', () => {
  it('finds the groups above each field', () => {
    const paths = groupPaths(GROUPS);
    expect(paths.get('jan')?.map((group) => group.header)).toEqual(['Sales', 'Q1']);
    expect(paths.get('units')?.map((group) => group.header)).toEqual(['Stock']);
    expect(paths.has('region')).toBe(false);
    expect(parentGroupOf('feb', paths)).toBe(Q1);
    expect(parentGroupOf('region', paths)).toBeNull();
  });

  it('keeps the columns of a group together, at the place of its first column', () => {
    const paths = groupPaths(GROUPS);
    const order = ['jan', 'region', 'apr', 'units', 'feb', 'may'].map(field);
    expect(clusterColumns(order, paths).map((column) => column.field)).toEqual([
      'jan',
      'feb',
      'apr',
      'may',
      'region',
      'units',
    ]);
  });

  it('builds header rows with spans for nested groups and ungrouped columns', () => {
    const paths = groupPaths(GROUPS);
    const rows = headerRows(['region', 'jan', 'feb', 'apr', 'may', 'units'].map(field), paths);
    expect(rows.length).toBe(3);
    const describe = (row: (typeof rows)[number]) =>
      row.map((cell) =>
        cell.kind === 'group'
          ? `${cell.group.header}:${cell.columns.length}`
          : `${cell.column.field}/${cell.rowspan}`,
      );
    expect(describe(rows[0])).toEqual(['region/3', 'Sales:4', 'Stock:1']);
    expect(describe(rows[1])).toEqual(['Q1:2', 'Q2:2', 'units/2']);
    expect(describe(rows[2])).toEqual(['jan/1', 'feb/1', 'apr/1', 'may/1']);
  });

  it('shrinks a group for hidden columns and drops a group without columns', () => {
    const paths = groupPaths(GROUPS);
    const rows = headerRows(['region', 'jan', 'units'].map(field), paths);
    const groups = rows.flat().filter((cell) => cell.kind === 'group');
    expect(groups.map((cell) => `${cell.group.header}:${cell.columns.length}`)).toEqual([
      'Sales:1',
      'Stock:1',
      'Q1:1',
    ]);
    expect(headerRows(['region', 'units'].map(field), groupPaths([Q1])).length).toBe(1);
  });

  it('splits a group whose columns are not next to each other', () => {
    const rows = headerRows(['jan', 'region', 'feb'].map(field), groupPaths([Q1]));
    expect(rows[0].filter((cell) => cell.kind === 'group').length).toBe(2);
  });

  it('gives each body column the ids of the header cells above it', () => {
    const rows = headerRows(['region', 'jan', 'feb'].map(field), groupPaths([Q1]));
    const { cells, headers } = headerAssociations(rows, 't');
    expect(cells.get('region')).toBe('t-h0-0');
    expect(headers.get('region')).toBe('t-h0-0');
    expect(headers.get('jan')).toBe('t-h0-1 t-h1-0');
    expect(headers.get('feb')).toBe('t-h0-1 t-h1-1');
  });
});

interface Sale {
  id: number;
  region: string;
  jan: number;
  feb: number;
  apr: number;
  may: number;
  units: number;
}

@Component({
  imports: [StarTable, StarColumnGroupHeaderTemplate],
  template: `<star-table
    [value]="rows"
    [columns]="columns"
    [columnGroups]="groups"
    dataKey="id"
    selectionMode="multiple"
    reorderableColumns
    [(hiddenColumns)]="hidden"
    [(pinnedColumns)]="pins"
  >
    <ng-template starColumnGroupHeader="Q2" let-group let-span="span">
      <em>{{ group.header }} ({{ span }})</em>
    </ng-template>
  </star-table>`,
})
class GroupHost {
  readonly table = viewChild.required<StarTable<Sale>>(StarTable);
  readonly rows: Sale[] = [{ id: 1, region: 'North', jan: 1, feb: 2, apr: 3, may: 4, units: 5 }];
  readonly columns: StarColumn<Sale>[] = ['region', 'jan', 'feb', 'apr', 'may', 'units'].map(
    (name) => ({ field: name, header: name.toUpperCase() }),
  );
  readonly groups = GROUPS;
  readonly hidden = signal<readonly string[]>([]);
  readonly pins = signal<StarColumnPins>({});
}

describe('StarTable column groups', () => {
  async function setup() {
    const fixture = TestBed.createComponent(GroupHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const row = (index: number) =>
      [
        ...el
          .querySelectorAll<HTMLElement>('thead tr')
          [index].querySelectorAll<HTMLTableCellElement>('th:not(.star-table__select)'),
      ].map(
        (th) =>
          `${th.textContent?.trim()}${th.colSpan > 1 ? `:${th.colSpan}` : ''}${th.rowSpan > 1 ? `/${th.rowSpan}` : ''}`,
      );
    return { fixture, el, host: fixture.componentInstance, row };
  }

  it('renders group header rows with colspan, rowspan and colgroup scope', async () => {
    const { el, row } = await setup();
    expect(el.querySelectorAll('thead tr').length).toBe(3);
    expect(row(0)).toEqual(['REGION/3', 'Sales:4', 'Stock']);
    expect(el.querySelector<HTMLTableCellElement>('th.star-table__select')!.rowSpan).toBe(3);
    expect(row(1)).toEqual(['Q1:2', 'Q2 (2):2', 'UNITS/2']);
    expect(row(2)).toEqual(['JAN', 'FEB', 'APR', 'MAY']);
    const sales = el.querySelector<HTMLElement>('th.star-table__column-group')!;
    expect(sales.getAttribute('scope')).toBe('colgroup');
    // A body cell names its group headers and its column header.
    const jan = el.querySelectorAll<HTMLElement>('tbody td')[2];
    const ids = jan.getAttribute('headers')!.split(' ');
    expect(ids.map((id) => el.querySelector(`#${CSS.escape(id)}`)?.textContent?.trim())).toEqual([
      'Sales',
      'Q1',
      'JAN',
    ]);
  });

  it('shrinks a group when a column hides', async () => {
    const { fixture, host, row } = await setup();
    host.hidden.set(['feb', 'apr', 'may']);
    await fixture.whenStable();
    expect(row(0)).toEqual(['REGION/3', 'Sales', 'Stock']);
    expect(row(1)).toEqual(['Q1', 'UNITS/2']);
  });

  it('moves a column only inside its group', async () => {
    const { fixture, host, row } = await setup();
    host.table().moveColumn('jan', 'apr');
    host.table().moveColumn('jan', 'region');
    await fixture.whenStable();
    expect(row(2)).toEqual(['JAN', 'FEB', 'APR', 'MAY']);
    host.table().moveColumn('feb', 'jan');
    await fixture.whenStable();
    expect(row(2)).toEqual(['FEB', 'JAN', 'APR', 'MAY']);
  });

  it('pins a group when all its columns are pinned', async () => {
    const { fixture, host, el } = await setup();
    host.pins.set({ jan: 'start' });
    await fixture.whenStable();
    const groupCells = () => [
      ...el.querySelectorAll<HTMLTableCellElement>('th.star-table__column-group'),
    ];
    // Q1 is split: its pinned part sticks, the rest does not.
    expect(
      groupCells().filter((th) => th.classList.contains('star-table__cell--frozen')).length,
    ).toBe(2);
    host.pins.set({ jan: 'start', feb: 'start' });
    await fixture.whenStable();
    const q1 = groupCells().find((th) => th.textContent?.trim() === 'Q1')!;
    expect(q1.classList).toContain('star-table__cell--frozen');
    expect(q1.colSpan).toBe(2);
  });
});
