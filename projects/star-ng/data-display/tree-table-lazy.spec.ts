import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarTreeTable, StarTreeTableColumn, StarTreeTableNode } from './tree-table';

const COLUMNS: StarTreeTableColumn[] = [
  { field: 'name', header: 'Folder' },
  { field: 'files', header: 'Files' },
];

const ROOTS: StarTreeTableNode[] = [
  { key: 'docs', label: 'Documents', data: { name: 'Documents', files: 12 }, leaf: false },
  { key: 'notes', label: 'Notes', data: { name: 'Notes', files: 3 }, leaf: true },
];

@Component({
  imports: [StarTreeTable],
  template: `
    <star-tree-table
      [nodes]="nodes()"
      [columns]="columns"
      [(expanded)]="open"
      [lazy]="lazy()"
      (nodeExpand)="load($event.node)"
      (nodeCollapse)="collapsed.push($event.node.key)"
      ariaLabel="Folders"
    />
  `,
})
class Host {
  readonly columns = COLUMNS;
  readonly nodes = signal<readonly StarTreeTableNode[]>(ROOTS);
  readonly open = signal<readonly string[]>([]);
  readonly lazy = signal(true);
  readonly requested: string[] = [];
  readonly collapsed: string[] = [];

  /** The owner marks the node as loading; the test finishes the load with `resolve`. */
  load(node: StarTreeTableNode): void {
    this.requested.push(node.key);
    this.nodes.update((nodes) =>
      nodes.map((item) => (item.key === node.key ? { ...item, loading: true } : item)),
    );
  }

  resolve(key: string, children: StarTreeTableNode[]): void {
    this.nodes.update((nodes) =>
      nodes.map((item) => (item.key === key ? { ...item, loading: false, children } : item)),
    );
  }
}

describe('tree table lazy children', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const row = (key: string) => el.querySelector<HTMLElement>(`tbody tr[data-key="${key}"]`);
    const press = async (target: Element, key: string) => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      await fixture.whenStable();
    };
    return { fixture, el, host: fixture.componentInstance, row, press };
  }

  it('a node with leaf false shows an expander without children', async () => {
    const { row } = await setup();
    expect(row('docs')!.getAttribute('aria-expanded')).toBe('false');
    expect(row('docs')!.querySelector('.star-tree-table__toggle')).not.toBeNull();
    expect(row('notes')!.hasAttribute('aria-expanded')).toBe(false);
  });

  it('opening emits nodeExpand, shows a loading row, then the loaded children', async () => {
    const { fixture, el, host, row, press } = await setup();
    await press(row('docs')!, 'ArrowRight');
    expect(host.requested).toEqual(['docs']);
    expect(host.open()).toEqual(['docs']);
    const loading = el.querySelector<HTMLElement>('tbody tr.star-tree-table__loading')!;
    expect(loading.textContent).toContain('Loading');
    expect(loading.getAttribute('aria-level')).toBe('2');
    expect(loading.hasAttribute('tabindex')).toBe(false);
    // The loading row is not a stop for the arrow keys.
    await press(row('docs')!, 'ArrowDown');
    expect(document.activeElement).toBe(row('notes'));

    host.resolve('docs', [
      { key: 'd1', label: 'Invoices', data: { name: 'Invoices', files: 7 } },
      { key: 'd2', label: 'Orders', data: { name: 'Orders', files: 5 } },
    ]);
    await fixture.whenStable();
    expect(el.querySelector('tbody tr.star-tree-table__loading')).toBeNull();
    expect(row('d1')!.getAttribute('aria-level')).toBe('2');
    expect(row('d2')!.getAttribute('aria-posinset')).toBe('2');
  });

  it('closing emits nodeCollapse; a toggle from code emits nothing', async () => {
    const { fixture, host, row, press } = await setup();
    row('docs')!.querySelector<HTMLElement>('.star-tree-table__toggle')!.click();
    await fixture.whenStable();
    await press(row('docs')!, 'ArrowLeft');
    expect(host.collapsed).toEqual(['docs']);
    const table = fixture.debugElement.children[0].componentInstance as StarTreeTable;
    table.toggle('docs', true);
    await fixture.whenStable();
    expect(host.requested).toEqual(['docs']);
    expect(host.open()).toEqual(['docs']);
  });

  it('without lazy, leaf false has no effect', async () => {
    const { fixture, host, row } = await setup();
    host.lazy.set(false);
    await fixture.whenStable();
    expect(row('docs')!.hasAttribute('aria-expanded')).toBe(false);
  });
});
