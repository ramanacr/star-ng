import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarTree, StarTreeNode } from 'star-ng/tree';

// jsdom has no layout and no `Element.scrollTo`. The stub records the requested scroll offsets
// and does not move the window, so the tests do not depend on scroll events.
const scrolls: number[] = [];
beforeAll(() => {
  Element.prototype.scrollTo = function (options?: ScrollToOptions | number) {
    scrolls.push(typeof options === 'object' ? (options.top ?? 0) : 0);
  } as Element['scrollTo'];
});
beforeEach(() => (scrolls.length = 0));

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

function key(target: Element, name: string): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }),
  );
}

function bigTree(groups: number, perGroup: number): StarTreeNode[] {
  return Array.from({ length: groups }, (_, g) => ({
    key: `g${g}`,
    label: `Group ${g}`,
    children: Array.from({ length: perGroup }, (_, i) => ({
      key: `g${g}i${i}`,
      label: `Item ${g}.${i}`,
    })),
  }));
}

@Component({
  imports: [StarTree],
  template: `
    <star-tree
      [nodes]="nodes()"
      [(value)]="checked"
      [(expanded)]="open"
      selectionMode="checkbox"
      virtualScroll
      [virtualItemSize]="34"
      scrollHeight="12rem"
      ariaLabel="Tree"
    />
  `,
})
class WindowedHost {
  readonly nodes = signal(bigTree(20, 500));
  readonly checked = signal<readonly string[]>([]);
  readonly open = signal<readonly string[]>(Array.from({ length: 20 }, (_, g) => `g${g}`));
}

describe('StarTree windowed rendering', () => {
  async function setup() {
    const fixture = TestBed.createComponent(WindowedHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const rows = () => [...el.querySelectorAll<HTMLElement>('[role=treeitem]')];
    return { fixture, el, rows, host: fixture.componentInstance };
  }

  it('renders only a window of the 10,020 open rows', async () => {
    const { rows, el } = await setup();
    expect(rows().length).toBeGreaterThan(0);
    expect(rows().length).toBeLessThan(60);
    expect(el.querySelector('cdk-virtual-scroll-viewport')?.getAttribute('role')).toBe('tree');
    expect(el.querySelector('ul')).toBeNull();
  });

  it('numbers the rows by their place among the siblings, not by the DOM', async () => {
    const { rows } = await setup();
    const [group, item] = rows();
    expect(group.dataset['key']).toBe('g0');
    expect(group.getAttribute('aria-level')).toBe('1');
    expect(group.getAttribute('aria-setsize')).toBe('20');
    expect(group.getAttribute('aria-posinset')).toBe('1');
    expect(item.dataset['key']).toBe('g0i0');
    expect(item.getAttribute('aria-level')).toBe('2');
    expect(item.getAttribute('aria-setsize')).toBe('500');
    expect(item.getAttribute('aria-posinset')).toBe('1');
    expect(rows()[3].getAttribute('aria-posinset')).toBe('3');
  });

  it('gives every row the fixed height', async () => {
    const { rows } = await setup();
    expect(rows().every((row) => row.style.height === '34px')).toBe(true);
  });

  it('checks a parent whose children are not rendered', async () => {
    const { fixture, rows, host } = await setup();
    key(rows()[0], 'Enter');
    await fixture.whenStable();
    expect(host.checked()).toHaveLength(500);
    expect(host.checked()[0]).toBe('g0i0');
    expect(rows()[0].getAttribute('aria-checked')).toBe('true');
    key(rows()[1], 'Enter');
    await fixture.whenStable();
    expect(host.checked()).toHaveLength(499);
    expect(rows()[0].getAttribute('aria-checked')).toBe('mixed');
  });

  it('collapses a branch and keeps the row of the branch active', async () => {
    const { fixture, rows, host, el } = await setup();
    rows()[0].focus();
    key(rows()[0], 'ArrowLeft');
    await fixture.whenStable();
    expect(host.open()).not.toContain('g0');
    expect(rows()[0].dataset['key']).toBe('g0');
    expect(rows()[1].dataset['key']).toBe('g1');
    expect(rows()[0].tabIndex).toBe(0);
    expect(el.querySelector('cdk-virtual-scroll-viewport')?.getAttribute('tabindex')).toBe('-1');
  });

  it('keeps the active row after other rows open and close', async () => {
    const { fixture, rows, host } = await setup();
    rows()[1].focus();
    await fixture.whenStable();
    expect(rows()[1].tabIndex).toBe(0);
    key(rows()[0], 'ArrowLeft'); // closes g0, the row g0i0 goes away
    await fixture.whenStable();
    // The active row g0i0 is not a row any more: the nearest open ancestor takes over.
    expect(rows()[0].dataset['key']).toBe('g0');
    expect(rows()[0].tabIndex).toBe(0);
    host.open.update((keys) => [...keys, 'g0']);
    await fixture.whenStable();
    expect(rows().filter((row) => row.tabIndex === 0)).toHaveLength(1);
  });

  it('gives the Tab stop to the scroll area when the active row is not rendered', async () => {
    const { fixture, rows, el } = await setup();
    const viewport = el.querySelector('cdk-virtual-scroll-viewport')!;
    expect(viewport.getAttribute('tabindex')).toBe('-1');
    key(rows()[0], 'End'); // the last row is far outside the window
    await fixture.whenStable();
    // The row 10,019 is scrolled to (a viewport of 0 px in jsdom: its bottom edge is the offset).
    expect(scrolls).toEqual([10020 * 34]);
    expect(rows().some((row) => row.dataset['key'] === 'g19i499')).toBe(false);
    expect(viewport.getAttribute('tabindex')).toBe('0');
    expect(rows().every((row) => row.tabIndex === -1)).toBe(true);
  });

  it('the keys on the scroll area act on the active row', async () => {
    const { fixture, rows, host, el } = await setup();
    const viewport = el.querySelector('cdk-virtual-scroll-viewport')!;
    key(rows()[0], 'End');
    await fixture.whenStable();
    key(viewport, 'ArrowLeft'); // the active row g19i499 is a leaf: its parent g19 becomes active
    await fixture.whenStable();
    key(viewport, 'ArrowLeft'); // g19 is open: it closes
    await fixture.whenStable();
    expect(host.open()).not.toContain('g19');
  });

  it('a filter with no match shows the empty message in the plain list', async () => {
    const { fixture, el } = await setup();
    const component = fixture.debugElement.children[0].componentInstance as {
      query: { set(v: string): void };
    };
    component.query.set('no such node');
    await fixture.whenStable();
    expect(el.querySelector('cdk-virtual-scroll-viewport')).toBeNull();
    expect(el.querySelector('.star-listbox__empty')).not.toBeNull();
  });
});

@Component({
  imports: [StarTree],
  template: `<star-tree [nodes]="nodes" virtualScroll ariaLabel="Tree" />`,
})
class WindowedNoHeightHost {
  readonly nodes = bigTree(2, 50);
}

describe('StarTree windowing is opt-in', () => {
  it('renders every row in a plain list without scrollHeight', async () => {
    const fixture = TestBed.createComponent(WindowedNoHeightHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('cdk-virtual-scroll-viewport')).toBeNull();
    expect(el.querySelectorAll('ul[role=tree] > li')).toHaveLength(2);
  });
});
