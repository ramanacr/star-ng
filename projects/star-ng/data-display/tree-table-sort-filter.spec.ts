import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarEmptyTemplate } from '@star-ng/ui/core';
import type { StarSortState } from '@star-ng/ui/table';
import { StarTreeTable, StarTreeTableColumn, StarTreeTableNode } from './tree-table';

// Projects with tasks.
const NODES: StarTreeTableNode[] = [
  {
    key: 'beta',
    label: 'Beta',
    data: { name: 'Beta', hours: 30, owner: 'Kim' },
    children: [
      { key: 'b2', label: 'Review', data: { name: 'Review', hours: 5, owner: 'Lee' } },
      {
        key: 'b1',
        label: 'Design',
        data: { name: 'Design', hours: 20, owner: 'Kim' },
        children: [
          { key: 'b1a', label: 'Sketch', data: { name: 'Sketch', hours: 2, owner: 'Ana' } },
        ],
      },
    ],
  },
  {
    key: 'alpha',
    label: 'Alpha',
    data: { name: 'Alpha', hours: 12, owner: 'Ana' },
    children: [{ key: 'a1', label: 'Build', data: { name: 'Build', hours: 12, owner: 'Lee' } }],
  },
  { key: 'gamma', label: 'Gamma', data: { name: 'Gamma', hours: 30, owner: 'Lee' } },
];

const COLUMNS: StarTreeTableColumn[] = [
  { field: 'name', header: 'Project', sortable: true, filter: true },
  { field: 'hours', header: 'Hours', sortable: true },
  { field: 'owner', header: 'Owner', filter: true },
];

@Component({
  imports: [StarTreeTable, StarEmptyTemplate],
  template: `
    <star-tree-table
      [nodes]="nodes()"
      [columns]="columns"
      [(expanded)]="open"
      [(sortField)]="sortField"
      [(sortOrder)]="sortOrder"
      [(sortMeta)]="sortMeta"
      [multiSort]="multi()"
      [filter]="search()"
      [(globalFilter)]="query"
      [(filters)]="filters"
      [filterMode]="mode()"
      [paginator]="paged()"
      [(first)]="first"
      [rows]="2"
      ariaLabel="Projects"
    >
      @if (customEmpty()) {
        <ng-template starEmpty let-text
          ><b class="none">No match for {{ text }}</b></ng-template
        >
      }
    </star-tree-table>
  `,
})
class Host {
  readonly nodes = signal<readonly StarTreeTableNode[]>(NODES);
  readonly columns = COLUMNS;
  readonly open = signal<readonly string[]>(['beta', 'b1', 'alpha']);
  readonly sortField = signal<string | null>(null);
  readonly sortOrder = signal<1 | -1>(1);
  readonly sortMeta = signal<readonly StarSortState[]>([]);
  readonly multi = signal(false);
  readonly search = signal(false);
  readonly query = signal('');
  readonly filters = signal<Readonly<Record<string, string>>>({});
  readonly mode = signal<'lenient' | 'strict'>('lenient');
  readonly paged = signal(false);
  readonly first = signal(0);
  readonly customEmpty = signal(false);
}

async function setup() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const host = fixture.componentInstance;
  const keys = () =>
    [...el.querySelectorAll<HTMLElement>('tbody tr[data-key]')].map((row) => row.dataset['key']);
  const header = (name: string) =>
    [...el.querySelectorAll<HTMLElement>('thead th')].find((th) => th.textContent?.includes(name))!;
  const stable = () => fixture.whenStable();
  return { fixture, el, host, keys, header, stable };
}

describe('tree table sorting', () => {
  it('sorts siblings within their parent and keeps the hierarchy', async () => {
    const { host, keys, header, stable } = await setup();
    expect(keys()).toEqual(['beta', 'b2', 'b1', 'b1a', 'alpha', 'a1', 'gamma']);
    header('Project').querySelector('button')!.click();
    await stable();
    expect(keys()).toEqual(['alpha', 'a1', 'beta', 'b1', 'b1a', 'b2', 'gamma']);
    expect(host.sortField()).toBe('name');
    expect(host.sortOrder()).toBe(1);
    expect(header('Project').getAttribute('aria-sort')).toBe('ascending');
    expect(header('Hours').getAttribute('aria-sort')).toBe('none');
    expect(header('Owner').hasAttribute('aria-sort')).toBe(false);

    header('Project').querySelector('button')!.click();
    await stable();
    expect(keys()).toEqual(['gamma', 'beta', 'b2', 'b1', 'b1a', 'alpha', 'a1']);
    expect(header('Project').getAttribute('aria-sort')).toBe('descending');
  });

  it('follows sortField and sortOrder set from outside, without changing the nodes', async () => {
    const { host, keys, stable } = await setup();
    host.sortField.set('hours');
    host.sortOrder.set(-1);
    await stable();
    expect(keys()).toEqual(['beta', 'b1', 'b1a', 'b2', 'gamma', 'alpha', 'a1']);
    expect(NODES.map((node) => node.key)).toEqual(['beta', 'alpha', 'gamma']);
  });

  it('adds a sort column with Shift + click in multiSort mode', async () => {
    const { host, el, keys, header, stable } = await setup();
    host.multi.set(true);
    await stable();
    header('Hours').querySelector('button')!.click();
    await stable();
    header('Project')
      .querySelector('button')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    await stable();
    expect(host.sortMeta()).toEqual([
      { field: 'hours', order: 1 },
      { field: 'name', order: 1 },
    ]);
    // Alpha (12) first; Beta and Gamma tie on 30 and sort by name.
    expect(keys().filter((k) => ['alpha', 'beta', 'gamma'].includes(k!))).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
    // The headers show the rank in column order: Project is the second sort, Hours the first.
    expect(
      [...el.querySelectorAll('.star-table__sort-rank')].map((n) => n.textContent?.trim()),
    ).toEqual(['2', '1']);
    expect(header('Hours').getAttribute('aria-sort')).toBe('ascending');
    expect(header('Project').getAttribute('aria-sort')).toBe('none');
  });
});

describe('tree table filtering', () => {
  it('lenient: a match shows its ancestors open and keeps its descendants', async () => {
    const { host, keys, stable } = await setup();
    host.open.set([]);
    host.query.set('design');
    await stable();
    // Beta shows open for the match; Design keeps its child, closed as the user left it.
    expect(keys()).toEqual(['beta', 'b1']);
    host.open.set(['b1']);
    await stable();
    expect(keys()).toEqual(['beta', 'b1', 'b1a']);
  });

  it('strict: only the matching paths show', async () => {
    const { host, keys, stable } = await setup();
    host.mode.set('strict');
    host.query.set('beta');
    await stable();
    expect(keys()).toEqual(['beta']);
    host.mode.set('lenient');
    await stable();
    expect(keys()).toEqual(['beta', 'b2', 'b1', 'b1a']);
  });

  it('combines the column filters, with a filter row and labelled inputs', async () => {
    const { el, host, keys, stable } = await setup();
    const inputs = [...el.querySelectorAll<HTMLInputElement>('thead .star-table__filters input')];
    expect(inputs.map((input) => input.getAttribute('aria-label'))).toEqual([
      'Filter by Project',
      'Filter by Owner',
    ]);
    inputs[1].value = 'lee';
    inputs[1].dispatchEvent(new Event('input'));
    await stable();
    expect(host.filters()).toEqual({ owner: 'lee' });
    expect(keys()).toEqual(['beta', 'b2', 'alpha', 'a1', 'gamma']);
    inputs[0].value = 'build';
    inputs[0].dispatchEvent(new Event('input'));
    await stable();
    expect(keys()).toEqual(['alpha', 'a1']);
  });

  it('the search field sets globalFilter, and a closed match ancestor stays closed', async () => {
    const { el, host, keys, stable } = await setup();
    host.search.set(true);
    host.open.set([]);
    await stable();
    const search = el.querySelector<HTMLInputElement>('.star-tree-table__search input')!;
    expect(search.getAttribute('aria-label')).toBe('Search');
    search.value = 'sketch';
    search.dispatchEvent(new Event('input'));
    await stable();
    expect(host.query()).toBe('sketch');
    expect(keys()).toEqual(['beta', 'b1', 'b1a']);
    expect(el.querySelector('tr[data-key="beta"]')!.getAttribute('aria-expanded')).toBe('true');
    el.querySelector<HTMLElement>('tr[data-key="beta"] .star-tree-table__toggle')!.click();
    await stable();
    expect(keys()).toEqual(['beta']);
    expect(host.open()).toEqual([]);
  });

  it('shows the no-results row, or the starEmpty slot with the query', async () => {
    const { el, host, stable } = await setup();
    host.query.set('zzz');
    await stable();
    expect(el.querySelector('.star-table__empty')!.textContent).toContain('No results found');
    host.customEmpty.set(true);
    await stable();
    expect(el.querySelector('.none')!.textContent).toBe('No match for zzz');
  });
});

describe('tree table paging', () => {
  it('pages over the top-level rows and keeps children on the page of their parent', async () => {
    const { el, host, keys, stable } = await setup();
    host.paged.set(true);
    await stable();
    expect(keys()).toEqual(['beta', 'b2', 'b1', 'b1a', 'alpha', 'a1']);
    expect(el.querySelector('star-paginator')).not.toBeNull();
    const beta = el.querySelector('tr[data-key="beta"]')!;
    expect(beta.getAttribute('aria-setsize')).toBe('3');
    host.first.set(2);
    await stable();
    expect(keys()).toEqual(['gamma']);
    const gamma = el.querySelector('tr[data-key="gamma"]')!;
    expect(gamma.getAttribute('aria-posinset')).toBe('3');
    expect(gamma.getAttribute('aria-setsize')).toBe('3');
  });

  it('goes back to the first page when the sort or a filter changes', async () => {
    const { host, header, stable } = await setup();
    host.paged.set(true);
    host.first.set(2);
    await stable();
    header('Project').querySelector('button')!.click();
    await stable();
    expect(host.first()).toBe(0);
  });
});
