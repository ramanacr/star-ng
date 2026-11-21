import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarIconTemplate, StarLoadingTemplate } from '@star-ng/ui/core';
import {
  StarCellTemplate,
  StarFooterRowTemplate,
  StarHeaderCellTemplate,
  StarPaginatorEndTemplate,
  StarPaginatorStartTemplate,
  StarRowTemplate,
  StarTableCell,
} from '@star-ng/ui/table';
import { StarTreeTable, StarTreeTableColumn, StarTreeTableNode } from './tree-table';

const NODES: StarTreeTableNode[] = [
  {
    key: 'eng',
    label: 'Engineering',
    data: { name: 'Engineering', staff: 42, cost: 900 },
    children: [
      { key: 'web', label: 'Web', data: { name: 'Web', staff: 14, cost: 300 } },
      { key: 'ops', label: 'Ops', data: { name: 'Ops', staff: 6, cost: 100 } },
    ],
  },
  { key: 'fin', label: 'Finance', data: { name: 'Finance', staff: 9, cost: 200 } },
];

const COLUMNS: StarTreeTableColumn[] = [
  { field: 'name', header: 'Department', sortable: true },
  { field: 'staff', header: 'Staff', sortable: true },
  { field: 'cost', header: 'Cost' },
];

@Component({
  imports: [
    StarTreeTable,
    StarCellTemplate,
    StarHeaderCellTemplate,
    StarFooterRowTemplate,
    StarIconTemplate,
    StarLoadingTemplate,
    StarPaginatorStartTemplate,
    StarPaginatorEndTemplate,
  ],
  template: `
    <star-tree-table
      [nodes]="nodes"
      [columns]="columns"
      [(expanded)]="open"
      ariaLabel="Units"
      selectionMode="checkbox"
      [(selection)]="selection"
      filter
      [loading]="loading()"
      paginator
      [rows]="5"
      [sortField]="sortField()"
    >
      <h3 starTableCaption class="own-caption">Caption</h3>
      <ng-template starHeaderCell="staff" let-column
        ><b class="own-head">{{ column.header }}!</b></ng-template
      >
      <ng-template starCell="cost" [starCellOf]="nodes" let-node let-value="value"
        ><i class="own-cell">{{ node.key }}={{ value }}</i></ng-template
      >
      <ng-template starFooterRow let-columns let-rows="rows">
        <td class="own-foot" [attr.colspan]="columns.length">{{ rows.length }} units</td>
      </ng-template>
      <ng-template starIcon="toggle" let-open
        ><b class="own-toggle">{{ open ? '-' : '+' }}</b></ng-template
      >
      <ng-template starIcon="check" let-on
        ><b class="own-check">{{ on ? 'y' : 'p' }}</b></ng-template
      >
      <ng-template starIcon="sort" let-asc
        ><b class="own-sort">{{ asc === undefined ? 'n' : asc ? 'a' : 'd' }}</b></ng-template
      >
      <ng-template starIcon="filter"><b class="own-filter">f</b></ng-template>
      <ng-template starLoading><b class="own-loading">Wait</b></ng-template>
      <ng-template starPaginatorStart let-state
        ><b class="own-start">{{ state.page + 1 }}</b></ng-template
      >
      <ng-template starPaginatorEnd><b class="own-end">end</b></ng-template>
      <p starTableSummary class="own-summary">Summary</p>
    </star-tree-table>
  `,
})
class Host {
  readonly nodes = NODES;
  readonly columns = COLUMNS;
  readonly open = signal<readonly string[]>([]);
  readonly selection = signal<readonly string[]>([]);
  readonly loading = signal(false);
  readonly sortField = signal<string | null>(null);
}

@Component({
  imports: [StarTreeTable, StarRowTemplate, StarTableCell],
  template: `
    <star-tree-table
      [nodes]="nodes"
      [columns]="columns"
      [expanded]="['eng']"
      ariaLabel="Rows"
      cellNavigation
    >
      <ng-template starRow [starRowOf]="nodes" let-node let-columns="columns">
        @for (column of columns; track column.field) {
          <td [starTableCell]="column.field" [starTableCellRow]="node" class="own-row-cell">
            {{ node.key }}/{{ column.field }}
          </td>
        }
      </ng-template>
    </star-tree-table>
  `,
})
class RowHost {
  readonly nodes = NODES;
  readonly columns = COLUMNS;
}

const text = (root: Element, selector: string) =>
  Array.from(root.querySelectorAll(selector)).map((node) => node.textContent?.trim());

describe('StarTreeTable slots (N1)', () => {
  it('fills the header cell, cell, footer row, caption and summary slots', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.own-caption')).not.toBeNull();
    expect(root.querySelector('.own-summary')).not.toBeNull();
    expect(text(root, 'th .own-head')).toEqual(['Staff!']);
    // The header slot goes inside the sort button.
    expect(root.querySelector('th[data-field="staff"] button .own-head')).not.toBeNull();
    expect(text(root, '.own-cell')).toEqual(['eng=900', 'fin=200']);
    const foot = root.querySelector('tfoot td.own-foot');
    expect(foot?.textContent?.trim()).toBe('2 units');
    expect(foot?.getAttribute('colspan')).toBe('3');
  });

  it('replaces the toggle, check box, sort and filter icons', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(text(root, '.own-toggle')).toEqual(['+']);
    expect(text(root, '.own-filter')).toEqual(['f']);
    expect(text(root, '.own-sort')).toEqual(['n', 'n']);
    expect(root.querySelector('.own-check')).toBeNull();
    fixture.componentInstance.open.set(['eng']);
    fixture.componentInstance.selection.set(['web']);
    fixture.componentInstance.sortField.set('staff');
    await fixture.whenStable();
    expect(text(root, '.own-toggle')).toEqual(['-']);
    // Engineering is partly checked, Web is checked.
    expect(text(root, '.own-check')).toEqual(['p', 'y']);
    expect(text(root, '.own-sort')).toEqual(['n', 'a']);
    const wrapper = root.querySelector('.own-toggle')!.parentElement!;
    expect(wrapper.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the loading slot while loading', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.loading.set(true);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(text(root, 'tbody .own-loading')).toEqual(['Wait']);
    expect(root.querySelector('tbody tr[data-key]')).toBeNull();
    expect(root.querySelector('table')?.getAttribute('aria-busy')).toBe('true');
  });

  it('puts the paginator slots into the paginator', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const pager = (fixture.nativeElement as HTMLElement).querySelector('star-paginator')!;
    expect(pager.querySelector('.own-start')?.textContent).toBe('1');
    expect(pager.querySelector('.own-end')?.textContent).toBe('end');
  });

  it('starRow draws the cells after the first column; the tree cell stays', async () => {
    const fixture = TestBed.createComponent(RowHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const rows = root.querySelectorAll('tbody tr[data-key]');
    expect(rows.length).toBe(4);
    expect(rows[1].querySelector('td')?.textContent?.trim()).toBe('Web');
    expect(text(rows[1], 'td.own-row-cell')).toEqual(['web/staff', 'web/cost']);
    const cells = rows[0].querySelectorAll<HTMLElement>('td');
    expect(cells[1].getAttribute('data-col')).toBe('1');
    expect(cells[2].getAttribute('data-col')).toBe('2');
    expect(cells[1].getAttribute('tabindex')).toBe('-1');
  });
});

@Component({
  imports: [StarTreeTable, StarFooterRowTemplate],
  template: `
    <star-tree-table
      [nodes]="nodes"
      [columns]="columns"
      ariaLabel="Windowed"
      virtualScroll
      scrollHeight="200px"
    >
      <ng-template starFooterRow let-columns
        ><td [attr.colspan]="columns.length">Total</td></ng-template
      >
    </star-tree-table>
  `,
})
class WindowedFooterHost {
  readonly nodes = NODES;
  readonly columns = COLUMNS;
}

describe('StarTreeTable footer row with windowed rows (review minor 19)', () => {
  it('the footer row has the last aria-rowindex and aria-rowcount counts it', async () => {
    const fixture = TestBed.createComponent(WindowedFooterHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const count = root.querySelector('table')!.getAttribute('aria-rowcount');
    // Header row, two top-level rows, footer row.
    expect(count).toBe('4');
    expect(root.querySelector('tfoot tr')!.getAttribute('aria-rowindex')).toBe('4');
  });
});
