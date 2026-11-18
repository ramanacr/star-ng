import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarTreeTable, StarTreeTableColumn, StarTreeTableNode } from './tree-table';

// 200 projects with 5 tasks each: 1,200 open rows.
const NODES: StarTreeTableNode[] = Array.from({ length: 200 }, (_, i) => ({
  key: `p${i}`,
  label: `Project ${i}`,
  data: { name: `Project ${i}`, hours: (i * 7) % 50 },
  children: Array.from({ length: 5 }, (_, j) => ({
    key: `p${i}-${j}`,
    label: `Task ${i}.${j}`,
    data: { name: `Task ${i}.${j}`, hours: j },
  })),
}));

@Component({
  imports: [StarTreeTable],
  template: `
    <star-tree-table
      [nodes]="nodes()"
      [columns]="columns()"
      [expanded]="open"
      virtualScroll
      scrollHeight="20rem"
      [virtualItemSize]="40"
      [(sortField)]="sortField"
      [sortOrder]="-1"
      ariaLabel="Projects"
    />
  `,
})
class Host {
  readonly nodes = signal<readonly StarTreeTableNode[]>(NODES);
  readonly columns = signal<readonly StarTreeTableColumn[]>([
    { field: 'name', header: 'Project', sortable: true },
    { field: 'hours', header: 'Hours', sortable: true },
  ]);
  readonly open = NODES.map((node) => node.key);
  readonly sortField = signal<string | null>(null);
}

describe('tree table virtual scroll with the new features', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const table = el.querySelector('table')!;
    const bodyRows = () => [...el.querySelectorAll<HTMLElement>('tbody tr[data-key]')];
    return { fixture, el, host: fixture.componentInstance, table, bodyRows };
  }

  it('renders a window of the sorted rows and keeps aria-rowcount over all rows', async () => {
    const { fixture, host, table, bodyRows } = await setup();
    expect(table.getAttribute('aria-rowcount')).toBe(String(1200 + 1));
    expect(bodyRows().length).toBeLessThan(100);
    host.sortField.set('hours');
    await fixture.whenStable();
    const first = bodyRows()[0];
    // Descending hours: project 7 has hours 49 ((7 * 7) % 50).
    expect(first.dataset['key']).toBe('p7');
    expect(first.getAttribute('aria-rowindex')).toBe('2');
    expect(bodyRows()[1].dataset['key']).toBe('p7-4');
  });

  it('counts the filter row in aria-rowindex and aria-rowcount', async () => {
    const { fixture, host, table, bodyRows } = await setup();
    host.columns.update((columns) => [{ ...columns[0], filter: true }, columns[1]]);
    await fixture.whenStable();
    expect(table.getAttribute('aria-rowcount')).toBe(String(1200 + 2));
    expect(bodyRows()[0].getAttribute('aria-rowindex')).toBe('3');
    expect(table.querySelector('.star-table__filters')!.getAttribute('aria-rowindex')).toBe('2');
  });

  it('counts a loading row in the rows and the row indexes', async () => {
    const { fixture, host, table, bodyRows } = await setup();
    host.nodes.update((nodes) => nodes.map((n, i) => (i === 0 ? { ...n, loading: true } : n)));
    await fixture.whenStable();
    expect(table.getAttribute('aria-rowcount')).toBe(String(1201 + 1));
    const loading = table.querySelector('tr.star-tree-table__loading')!;
    expect(loading.getAttribute('aria-rowindex')).toBe('3');
    expect(bodyRows()[1].getAttribute('aria-rowindex')).toBe('4');
  });
});
