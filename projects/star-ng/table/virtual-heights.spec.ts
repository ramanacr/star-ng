import {
  anchorOf,
  anchorShift,
  buildVirtualLayout,
  HeightTree,
  variableRange,
  VirtualLayoutOptions,
} from './virtual-heights';

interface Order {
  id: number;
  region: string;
}

describe('HeightTree', () => {
  it('sums heights before an item and in total', () => {
    const tree = new HeightTree([10, 20, 30, 40]);
    expect(tree.size).toBe(4);
    expect(tree.total).toBe(100);
    expect([0, 1, 2, 3, 4].map((i) => tree.offsetOf(i))).toEqual([0, 10, 30, 60, 100]);
    expect(tree.get(2)).toBe(30);
  });

  it('changes one height and returns the difference', () => {
    const tree = new HeightTree([10, 20, 30, 40]);
    expect(tree.set(1, 25)).toBe(5);
    expect(tree.get(1)).toBe(25);
    expect(tree.offsetOf(2)).toBe(35);
    expect(tree.total).toBe(105);
    expect(tree.set(1, 25)).toBe(0);
  });

  it('finds the item at a pixel offset, at the edges too', () => {
    const tree = new HeightTree([10, 20, 30, 40]);
    expect(tree.indexAt(-5)).toBe(0);
    expect(tree.indexAt(0)).toBe(0);
    expect(tree.indexAt(9.9)).toBe(0);
    // An offset on a border belongs to the item that starts there.
    expect(tree.indexAt(10)).toBe(1);
    expect(tree.indexAt(29)).toBe(1);
    expect(tree.indexAt(30)).toBe(2);
    expect(tree.indexAt(99)).toBe(3);
    expect(tree.indexAt(1000)).toBe(3);
    expect(new HeightTree([]).indexAt(10)).toBe(-1);
  });

  it('skips items without height when it finds an offset', () => {
    const tree = new HeightTree([10, 0, 0, 10]);
    expect(tree.indexAt(10)).toBe(3);
    expect(tree.indexAt(5)).toBe(0);
  });

  it('stays fast and exact for 100,000 items', () => {
    const count = 100_000;
    const heights = Array.from({ length: count }, (_, i) => 40 + (i % 7));
    const started = performance.now();
    const tree = new HeightTree(heights);
    for (let i = 0; i < count; i += 3) tree.set(i, 50);
    let probe = 0;
    for (let i = 0; i < 20_000; i++) probe += tree.indexAt((i * 997) % tree.total);
    const elapsed = performance.now() - started;
    expect(probe).toBeGreaterThan(0);
    // Generous limit for slow test machines: a linear scan per lookup would take seconds.
    expect(elapsed).toBeLessThan(1500);

    let expected = 0;
    for (let i = 0; i < 54_321; i++) expected += i % 3 === 0 ? 50 : heights[i];
    expect(tree.offsetOf(54_321)).toBe(expected);
    expect(tree.indexAt(expected)).toBe(54_321);
    expect(tree.indexAt(expected - 0.5)).toBe(54_320);
  });
});

describe('variableRange', () => {
  const tree = new HeightTree(Array.from({ length: 100 }, (_, i) => (i % 2 ? 60 : 40)));

  it('renders the items in view plus a buffer, with spacer heights for the rest', () => {
    // Pairs of 100 px: offset 1000 is the start of item 20; 300 px of view reach into item 25.
    const range = variableRange(tree, 1000, 300, 5);
    expect(range.first).toBe(20);
    expect(range).toMatchObject({ start: 15, end: 31 });
    expect(range.before).toBe(tree.offsetOf(15));
    expect(range.after).toBe(tree.total - tree.offsetOf(31));
  });

  it('clamps at the start and at the end', () => {
    expect(variableRange(tree, -50, 300, 5)).toMatchObject({ start: 0, before: 0, first: 0 });
    const end = variableRange(tree, tree.total - 300, 300, 5);
    expect(end.end).toBe(100);
    expect(end.after).toBe(0);
  });

  it('is empty for an empty tree', () => {
    expect(variableRange(new HeightTree([]), 0, 300, 5)).toEqual({
      start: 0,
      end: 0,
      first: 0,
      before: 0,
      after: 0,
    });
  });
});

describe('scroll anchoring', () => {
  it('moves the scroll position by the height changes above the anchor only', () => {
    const changes = [
      { index: 2, from: 40, to: 100 },
      { index: 5, from: 40, to: 30 },
      { index: 9, from: 40, to: 400 },
    ];
    expect(anchorShift(changes, 9)).toBe(50);
    expect(anchorShift(changes, 2)).toBe(0);
    expect(anchorShift(changes, 100)).toBe(410);
  });

  it('finds the anchor item and the pixels of it above the top', () => {
    const tree = new HeightTree([10, 20, 30]);
    expect(anchorOf(tree, 15)).toEqual({ index: 1, inside: 5 });
    expect(anchorOf(tree, 0)).toEqual({ index: 0, inside: 0 });
    expect(anchorOf(new HeightTree([]), 15)).toBeNull();
  });
});

describe('buildVirtualLayout', () => {
  const rows: Order[] = [
    { id: 1, region: 'Europe' },
    { id: 2, region: 'Europe' },
    { id: 3, region: 'Asia' },
    { id: 4, region: 'Asia' },
    { id: 5, region: 'Asia' },
  ];
  const options = (extra: Partial<VirtualLayoutOptions<Order>> = {}) => ({
    groupOf: null,
    isCollapsed: () => false,
    isExpanded: () => false,
    keyOf: (row: Order) => row.id,
    heightOf: () => 48,
    ...extra,
  });

  it('has one item per row without groups, and numbers the body rows', () => {
    const layout = buildVirtualLayout(rows, options({ isExpanded: (row) => row.id === 2 }));
    expect(layout.items.map((item) => item.kind)).toEqual(['row', 'row', 'row', 'row', 'row']);
    // Row 2 has a detail row, so row 3 is the fourth body row.
    expect(layout.items.map((item) => item.aria)).toEqual([0, 1, 3, 4, 5]);
    expect(layout.bodyRows).toBe(6);
    expect(layout.tree.total).toBe(5 * 48);
    expect(layout.indexOfKey.get(4)).toBe(3);
  });

  it('puts a heading before each group and leaves out the rows of a closed group', () => {
    const layout = buildVirtualLayout(
      rows,
      options({
        groupOf: (row) => row.region,
        isCollapsed: (label) => label === 'Europe',
        heightOf: (item) => (item.kind === 'group' ? 30 : 48),
      }),
    );
    expect(
      layout.items.map((item) =>
        item.kind === 'group' ? `${item.label} ${item.count}` : item.key,
      ),
    ).toEqual(['Europe 2', 'Asia 3', 3, 4, 5]);
    expect(layout.items[0]).toMatchObject({ kind: 'group', collapsed: true });
    expect(layout.items.map((item) => item.aria)).toEqual([0, 1, 2, 3, 4]);
    expect(layout.bodyRows).toBe(5);
    // A closed group takes the height of its heading only.
    expect(layout.tree.total).toBe(30 + 30 + 3 * 48);
    // Page indexes stay the indexes in the rows, also after a closed group.
    expect(layout.items[2]).toMatchObject({ kind: 'row', index: 2 });
  });

  it('gives group headings a key that is unique and stable', () => {
    const layout = buildVirtualLayout(rows, options({ groupOf: (row) => row.region }));
    const keys = layout.items.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(layout.indexOfKey.get(layout.items[3].key)).toBe(3);
  });

  it('adds a summary item after each open group with groupFooters', () => {
    const layout = buildVirtualLayout(
      rows,
      options({
        groupOf: (row) => row.region,
        groupFooters: true,
        isCollapsed: (label) => label === 'Europe',
      }),
    );
    expect(layout.items.map((item) => (item.kind === 'row' ? item.key : item.kind))).toEqual([
      'group',
      'group',
      3,
      4,
      5,
      'groupFooter',
    ]);
    expect(layout.items[5]).toMatchObject({ label: 'Asia', aria: 5 });
    expect(layout.bodyRows).toBe(6);
  });
});
