import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarTreeTable } from '@star-ng/ui/data-display';
import { StarTreeNode } from '@star-ng/ui/tree';

// jsdom has no layout. The stubs give the scroll area a height of 250 px and a scroll position
// that the component can set and read, and they record the positions that were set.
const ROW = 50;
const VIEWPORT = 250;
const scrolls: number[] = [];
const positions = new WeakMap<Element, number>();
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
    configurable: true,
    get(this: HTMLElement) {
      return positions.get(this) ?? 0;
    },
    set(this: HTMLElement, value: number) {
      scrolls.push(value);
      positions.set(this, value);
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains('star-table__scroll') ? VIEWPORT : 0;
    },
  });
});
afterAll(() => {
  delete (HTMLElement.prototype as unknown as Record<string, unknown>)['scrollTop'];
  delete (HTMLElement.prototype as unknown as Record<string, unknown>)['clientHeight'];
});
beforeEach(() => (scrolls.length = 0));
afterEach(() => (document.documentElement.dir = ''));

type Row = Record<string, unknown>;

function key(target: Element, name: string): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }),
  );
}

function bigTable(groups: number, perGroup: number): StarTreeNode<Row>[] {
  return Array.from({ length: groups }, (_, g) => ({
    key: `g${g}`,
    label: `Group ${g}`,
    data: { name: `Group ${g}`, n: g },
    children: Array.from({ length: perGroup }, (_, i) => ({
      key: `g${g}i${i}`,
      label: `Item ${g}.${i}`,
      data: { name: `Item ${g}.${i}`, n: i },
    })),
  }));
}

const COLUMNS = [
  { field: 'name', header: 'Name' },
  { field: 'n', header: 'N' },
];

@Component({
  imports: [StarTreeTable],
  template: `
    <star-tree-table
      [nodes]="nodes()"
      [columns]="columns"
      [(expanded)]="open"
      virtualScroll
      [virtualItemSize]="50"
      scrollHeight="16rem"
      ariaLabel="Table"
    />
  `,
})
class WindowedHost {
  readonly columns = COLUMNS;
  readonly nodes = signal(bigTable(20, 500));
  readonly open = signal<readonly string[]>(Array.from({ length: 20 }, (_, g) => `g${g}`));
}

describe('StarTreeTable windowed rendering', () => {
  async function setup() {
    const fixture = TestBed.createComponent(WindowedHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const scroller = el.querySelector<HTMLElement>('.star-table__scroll')!;
    const grid = el.querySelector<HTMLElement>('[role=treegrid]')!;
    const rows = () => [...el.querySelectorAll<HTMLElement>('tbody tr[data-key]')];
    const row = (rowKey: string) => rows().find((r) => r.dataset['key'] === rowKey);
    /** Scrolls like the user: set the position, then the scroll event. */
    const scrollTo = async (top: number) => {
      scroller.scrollTop = top;
      scroller.dispatchEvent(new Event('scroll'));
      await fixture.whenStable();
    };
    return { fixture, el, scroller, grid, rows, row, scrollTo, host: fixture.componentInstance };
  }

  it('renders only a window of the 10,020 open rows in one table', async () => {
    const { rows, el, grid } = await setup();
    expect(rows().length).toBeGreaterThan(0);
    expect(rows().length).toBeLessThan(60);
    expect(el.querySelectorAll('table')).toHaveLength(1);
    expect(grid.tagName).toBe('TABLE');
    expect(el.querySelectorAll('thead tr')).toHaveLength(1);
    // The spacer row after the window stands for the rows that are not rendered.
    expect(el.querySelectorAll('tbody tr.star-table__spacer')).toHaveLength(1);
  });

  it('numbers the rows from the data: row count, row index, level, set size and position', async () => {
    const { rows, grid, el } = await setup();
    expect(grid.getAttribute('aria-rowcount')).toBe('10021');
    expect(el.querySelector('thead tr')!.getAttribute('aria-rowindex')).toBe('1');
    const [group, item] = rows();
    expect(group.dataset['key']).toBe('g0');
    expect(group.getAttribute('aria-rowindex')).toBe('2');
    expect(group.getAttribute('aria-level')).toBe('1');
    expect(group.getAttribute('aria-setsize')).toBe('20');
    expect(group.getAttribute('aria-posinset')).toBe('1');
    expect(group.getAttribute('aria-expanded')).toBe('true');
    expect(item.dataset['key']).toBe('g0i0');
    expect(item.getAttribute('aria-rowindex')).toBe('3');
    expect(item.getAttribute('aria-level')).toBe('2');
    expect(item.getAttribute('aria-setsize')).toBe('500');
    expect(item.getAttribute('aria-posinset')).toBe('1');
    expect(item.hasAttribute('aria-expanded')).toBe(false);
    expect(rows()[3].getAttribute('aria-posinset')).toBe('3');
  });

  it('shows later rows when the area scrolls, with the right numbers', async () => {
    const { rows, row, scrollTo, grid, el } = await setup();
    // Row 5,000 of 10,020 (0-based): group 9 starts at 9 * 501 = 4,509, so g9i490 is index 5,000.
    await scrollTo(5000 * ROW);
    expect(row('g0')).toBeUndefined();
    const first = rows()[0];
    expect(Number(first.getAttribute('aria-rowindex'))).toBeGreaterThan(4980);
    expect(Number(first.getAttribute('aria-rowindex'))).toBeLessThan(5003);
    const target = row('g9i490')!;
    expect(target.getAttribute('aria-rowindex')).toBe('5002');
    expect(target.getAttribute('aria-posinset')).toBe('491');
    expect(grid.getAttribute('aria-rowcount')).toBe('10021');
    expect(rows().length).toBeLessThan(60);
    // Two spacer rows: before and after the window.
    expect(el.querySelectorAll('tbody tr.star-table__spacer')).toHaveLength(2);
    // The rendered rows are consecutive.
    const numbers = rows().map((r) => Number(r.getAttribute('aria-rowindex')));
    numbers.forEach((n, i) => expect(n).toBe(numbers[0] + i));
  });

  it('keeps the height of all rows with the spacer rows', async () => {
    const { el, scrollTo, rows } = await setup();
    const height = () =>
      [...el.querySelectorAll<HTMLElement>('tbody tr.star-table__spacer td')]
        .map((td) => Number.parseFloat(td.style.height))
        .reduce((sum, h) => sum + h, 0) +
      rows().length * ROW;
    expect(height()).toBe(10020 * ROW);
    await scrollTo(3333 * ROW);
    expect(height()).toBe(10020 * ROW);
    await scrollTo(10020 * ROW);
    expect(height()).toBe(10020 * ROW);
  });

  it('gives every row the fixed height through the table', async () => {
    const { el } = await setup();
    const host = el.querySelector<HTMLElement>('star-tree-table')!;
    expect(host.style.getPropertyValue('--star-table-row-height')).toBe('50px');
    expect(host.classList.contains('star-table--virtual')).toBe(true);
    expect(host.classList.contains('star-table--sticky')).toBe(true);
  });

  it('End scrolls to the last row and focuses it; Home goes back', async () => {
    const { fixture, rows, row, el, scroller } = await setup();
    rows()[0].focus();
    key(rows()[0], 'End');
    await fixture.whenStable();
    // The last row ends at the bottom edge of the area (the header is 0 px in jsdom).
    expect(scrolls.at(-1)).toBe(10020 * ROW - VIEWPORT + 0);
    const last = row('g19i499')!;
    expect(last).toBeDefined();
    expect(document.activeElement).toBe(last);
    expect(last.getAttribute('aria-rowindex')).toBe('10021');
    expect(last.tabIndex).toBe(0);
    expect(scroller.getAttribute('tabindex')).toBe('-1');
    expect(el.querySelectorAll('tbody tr.star-table__spacer')).toHaveLength(1);

    key(last, 'Home');
    await fixture.whenStable();
    expect(document.activeElement).toBe(row('g0'));
    expect(scrolls.at(-1)).toBe(0);
  });

  it('Arrow down moves one row, also past the end of the window', async () => {
    const { fixture, rows, row } = await setup();
    rows()[0].focus();
    for (let i = 0; i < 40; i++) {
      key(document.activeElement!, 'ArrowDown');
      await fixture.whenStable();
    }
    expect(document.activeElement).toBe(row('g0i39'));
    expect(row('g0')).toBeUndefined();
    key(document.activeElement!, 'ArrowUp');
    await fixture.whenStable();
    expect(document.activeElement).toBe(row('g0i38'));
  });

  it('Arrow left goes to a parent that is not rendered, then closes it', async () => {
    const { fixture, row, scrollTo, host } = await setup();
    await scrollTo(300 * ROW);
    expect(row('g0')).toBeUndefined();
    const deep = row('g0i299')!;
    deep.focus();
    key(deep, 'ArrowLeft');
    await fixture.whenStable();
    expect(document.activeElement).toBe(row('g0'));
    key(document.activeElement!, 'ArrowLeft');
    await fixture.whenStable();
    expect(host.open()).not.toContain('g0');
    expect(row('g0')!.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(row('g0'));
    expect(row('g1')!.getAttribute('aria-rowindex')).toBe('3');
  });

  it('Arrow right opens a closed branch and does nothing on an open one or a leaf', async () => {
    const { fixture, row, host } = await setup();
    host.open.set(['g1']);
    await fixture.whenStable();
    const closed = row('g0')!;
    closed.focus();
    key(closed, 'ArrowRight');
    await fixture.whenStable();
    expect(host.open()).toEqual(['g1', 'g0']);
    key(row('g0')!, 'ArrowRight');
    await fixture.whenStable();
    expect(host.open()).toEqual(['g1', 'g0']);
    key(row('g0i0')!, 'ArrowRight');
    await fixture.whenStable();
    expect(host.open()).toEqual(['g1', 'g0']);
  });

  it('keeps the active row on the branch when a large branch collapses', async () => {
    const { fixture, rows, row, scrollTo, grid, host } = await setup();
    await scrollTo(501 * ROW); // group 1 at the top
    const branch = row('g1')!;
    branch.focus();
    key(branch, 'ArrowLeft'); // 500 rows go
    await fixture.whenStable();
    expect(host.open()).not.toContain('g1');
    expect(grid.getAttribute('aria-rowcount')).toBe(String(10021 - 500));
    expect(document.activeElement).toBe(row('g1'));
    expect(row('g1')!.tabIndex).toBe(0);
    expect(rows().filter((r) => r.tabIndex === 0)).toHaveLength(1);
    expect(row('g2')!.getAttribute('aria-rowindex')).toBe(String(501 + 2 + 1));
  });

  it('parks the focus on the scroll area when the focused row leaves the window', async () => {
    const { fixture, row, scrollTo, scroller } = await setup();
    const first = row('g0i2')!;
    first.focus();
    await scrollTo(6000 * ROW);
    expect(row('g0i2')).toBeUndefined();
    expect(document.activeElement).toBe(scroller);
    expect(document.activeElement).not.toBe(document.body);
    expect(scroller.getAttribute('tabindex')).toBe('0');
    expect(scroller.getAttribute('role')).toBe('group');

    // The keys on the scroll area act on the active row: Arrow down goes to the next row.
    key(scroller, 'ArrowDown');
    await fixture.whenStable();
    expect(document.activeElement).toBe(row('g0i3'));
    expect(scroller.getAttribute('tabindex')).toBe('-1');
  });

  it('brings the focus back to the row when it renders again', async () => {
    const { row, scrollTo, scroller } = await setup();
    row('g0i2')!.focus();
    await scrollTo(6000 * ROW);
    expect(document.activeElement).toBe(scroller);
    await scrollTo(0);
    expect(document.activeElement).toBe(row('g0i2'));
  });

  it('a Tab into the scroll area focuses the active row', async () => {
    const { fixture, row, scrollTo, scroller } = await setup();
    row('g0i2')!.focus();
    await scrollTo(6000 * ROW);
    (document.activeElement as HTMLElement).blur();
    await fixture.whenStable();
    scroller.focus();
    await fixture.whenStable();
    expect(document.activeElement).toBe(row('g0i2'));
  });

  it('mirrors the arrow keys in right-to-left', async () => {
    document.documentElement.dir = 'rtl';
    const { fixture, row, host } = await setup();
    const first = row('g0')!;
    first.focus();
    key(first, 'ArrowRight'); // closes the open branch in right-to-left
    await fixture.whenStable();
    expect(host.open()).not.toContain('g0');
    key(row('g0')!, 'ArrowLeft'); // opens it
    await fixture.whenStable();
    expect(host.open()).toContain('g0');
    const item = row('g0i1')!;
    item.focus();
    key(item, 'ArrowRight'); // to the parent
    await fixture.whenStable();
    expect(document.activeElement).toBe(row('g0'));
  });

  it('reads new nodes: the count and the window follow the data', async () => {
    const { fixture, host, grid, rows, scrollTo } = await setup();
    await scrollTo(5000 * ROW);
    host.nodes.set(bigTable(2, 10));
    host.open.set(['g0', 'g1']);
    await fixture.whenStable();
    expect(grid.getAttribute('aria-rowcount')).toBe('23');
    // The old scroll position is past the end: the window shows the last rows, no more.
    await scrollTo(1e6);
    const keys = rows().map((r) => r.dataset['key']);
    expect(keys.at(-1)).toBe('g1i9');
    expect(rows().at(-1)!.getAttribute('aria-rowindex')).toBe('23');
    expect(rows().length).toBeLessThan(22);
  });
});

@Component({
  imports: [StarTreeTable],
  template: `
    <star-tree-table
      [nodes]="nodes"
      [columns]="columns"
      [expanded]="open"
      [virtualScroll]="virtual"
      [scrollHeight]="height"
      ariaLabel="Table"
    />
  `,
})
class OptInHost {
  readonly columns = COLUMNS;
  readonly nodes = bigTable(2, 50);
  readonly open = ['g0', 'g1'];
  virtual = true;
  height: string | null = null;
}

describe('StarTreeTable windowing is opt-in', () => {
  async function setup(virtual: boolean, height: string | null) {
    const fixture = TestBed.createComponent(OptInHost);
    fixture.componentInstance.virtual = virtual;
    fixture.componentInstance.height = height;
    await fixture.whenStable();
    return Object.assign(fixture.nativeElement as HTMLElement, { fixture });
  }

  it('renders every row without virtualScroll', async () => {
    const el = await setup(false, '16rem');
    expect(el.querySelectorAll('tbody tr')).toHaveLength(102);
    expect(el.querySelector('table')!.hasAttribute('aria-rowcount')).toBe(false);
    expect(el.querySelectorAll('tr[aria-rowindex]')).toHaveLength(0);
    expect(el.querySelectorAll('tr.star-table__spacer')).toHaveLength(0);
    expect(el.querySelector('.star-table__scroll')!.hasAttribute('role')).toBe(false);
    expect(el.querySelector('.star-table__scroll')!.hasAttribute('tabindex')).toBe(false);
    expect(el.querySelector('star-tree-table')!.classList.contains('star-table--virtual')).toBe(
      false,
    );
  });

  it('renders every row with virtualScroll but without scrollHeight', async () => {
    const el = await setup(true, null);
    expect(el.querySelectorAll('tbody tr')).toHaveLength(102);
    expect(el.querySelector('table')!.hasAttribute('aria-rowcount')).toBe(false);
    expect(el.querySelector('star-tree-table')!.classList.contains('star-table--sticky')).toBe(
      false,
    );
  });

  it('keeps the default rendering free of focus changes: one row has the Tab stop', async () => {
    const el = await setup(false, null);
    const stops = [...el.querySelectorAll<HTMLElement>('tbody tr')].filter((r) => r.tabIndex === 0);
    expect(stops).toHaveLength(1);
    expect(stops[0].dataset['key']).toBe('g0');
  });

  it('moves with Home and End over all rows without windowing', async () => {
    const el = await setup(false, null);
    const rows = () => [...el.querySelectorAll<HTMLElement>('tbody tr')];
    rows()[3].focus();
    key(rows()[3], 'End');
    await el.fixture.whenStable();
    expect(document.activeElement).toBe(rows().at(-1));
    key(document.activeElement!, 'Home');
    await el.fixture.whenStable();
    expect(document.activeElement).toBe(rows()[0]);
  });
});
