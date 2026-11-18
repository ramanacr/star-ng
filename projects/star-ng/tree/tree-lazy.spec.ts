import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarTree, StarTreeLoadingMode, StarTreeNode, StarTreeNodeEvent } from './tree';

@Component({
  imports: [StarTree],
  template: `
    <star-tree
      [nodes]="nodes()"
      [(expanded)]="open"
      [loadingMode]="mode()"
      ariaLabel="Projects"
      (nodeExpand)="expands.push($event)"
      (nodeCollapse)="collapses.push($event)"
    />
  `,
})
class LazyHost {
  readonly nodes = signal<readonly StarTreeNode[]>([
    { key: 'p1', label: 'Project one', leaf: false },
    { key: 'p2', label: 'Project two' },
  ]);
  readonly open = signal<readonly string[]>([]);
  readonly mode = signal<StarTreeLoadingMode>('row');
  readonly expands: StarTreeNodeEvent[] = [];
  readonly collapses: StarTreeNodeEvent[] = [];

  /** The owner marks the node as loading, then sets its children. */
  load(children: readonly StarTreeNode[] | null): void {
    this.nodes.update((nodes) =>
      nodes.map((node) =>
        node.key !== 'p1'
          ? node
          : children
            ? { ...node, loading: false, children }
            : { ...node, loading: true },
      ),
    );
  }
}

describe('StarTree lazy children', () => {
  async function setup() {
    const fixture = TestBed.createComponent(LazyHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const row = (key: string) => el.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
    const press = async (target: HTMLElement, key: string) => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      await fixture.whenStable();
    };
    return { fixture, host: fixture.componentInstance, el, row, press };
  }

  it('a leaf: false node shows the toggle and is a closed branch', async () => {
    const { row } = await setup();
    expect(row('p1').getAttribute('aria-expanded')).toBe('false');
    expect(row('p1').querySelector('.star-tree__toggle--leaf')).toBeNull();
    expect(row('p2').getAttribute('aria-expanded')).toBeNull();
  });

  it('opening emits nodeExpand, shows a loading row and aria-busy, then the children', async () => {
    const { fixture, host, el, row, press } = await setup();
    await press(row('p1'), 'ArrowRight');
    expect(host.expands.map((e) => e.node.key)).toEqual(['p1']);
    expect(host.open()).toEqual(['p1']);
    host.load(null);
    await fixture.whenStable();
    expect(row('p1').getAttribute('aria-busy')).toBe('true');
    const loading = el.querySelector('.star-tree__loading');
    expect(loading?.textContent).toContain('Loading');
    expect(loading?.getAttribute('role')).toBe('presentation');
    // Arrow right on the open node without children does not move.
    await press(row('p1'), 'ArrowRight');
    host.load([{ key: 'p1a', label: 'Design' }]);
    await fixture.whenStable();
    expect(row('p1').getAttribute('aria-busy')).toBeNull();
    expect(el.querySelector('.star-tree__loading')).toBeNull();
    expect(row('p1a').getAttribute('aria-level')).toBe('2');
    await press(row('p1'), 'ArrowLeft');
    expect(host.collapses.map((e) => e.node.key)).toEqual(['p1']);
  });

  it('loadingMode icon shows a spinner in the toggle instead of a row', async () => {
    const { fixture, host, el, row } = await setup();
    host.mode.set('icon');
    host.open.set(['p1']);
    host.load(null);
    await fixture.whenStable();
    expect(el.querySelector('.star-tree__loading')).toBeNull();
    expect(row('p1').querySelector('.star-tree__toggle .star-spin')).not.toBeNull();
  });

  it('a click on the toggle emits nodeExpand once', async () => {
    const { fixture, host, row } = await setup();
    row('p1').querySelector<HTMLElement>('.star-tree__toggle')!.click();
    await fixture.whenStable();
    expect(host.expands.length).toBe(1);
  });
});
