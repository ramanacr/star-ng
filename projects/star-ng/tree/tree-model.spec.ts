import { StarTreeNode } from '@star-ng/ui/tree';
import {
  checkStates,
  flattenVisible,
  navigationTarget,
  parentsOf,
  rowIndexOf,
  scrollOffsetToReveal,
  stillFocusable,
  subtreeKeys,
} from './tree-model';

/** 3 groups x 4 sections x 5 items = 3 + 12 + 60 nodes, built from fictional names. */
function sample(): StarTreeNode[] {
  return Array.from({ length: 3 }, (_, g) => ({
    key: `g${g}`,
    label: `Group ${g}`,
    children: Array.from({ length: 4 }, (_, s) => ({
      key: `g${g}s${s}`,
      label: `Section ${g}.${s}`,
      children: Array.from({ length: 5 }, (_, i) => ({
        key: `g${g}s${s}i${i}`,
        label: `Item ${g}.${s}.${i}`,
      })),
    })),
  }));
}

describe('tree model', () => {
  const nodes = sample();
  const all = new Set(nodes.flatMap((n) => subtreeKeys(n)));

  it('flattens only the rows whose parents are open', () => {
    expect(flattenVisible(nodes, new Set()).map((r) => r.node.key)).toEqual(['g0', 'g1', 'g2']);
    const rows = flattenVisible(nodes, new Set(['g1']));
    expect(rows.map((r) => r.node.key)).toEqual(['g0', 'g1', 'g1s0', 'g1s1', 'g1s2', 'g1s3', 'g2']);
    expect(flattenVisible(nodes, new Set(), true)).toHaveLength(all.size);
  });

  it('numbers the siblings from the data: level, set size and position', () => {
    const rows = flattenVisible(nodes, new Set(['g2', 'g2s3']));
    const row = (k: string) => rows.find((r) => r.node.key === k)!;
    expect(row('g2')).toMatchObject({ level: 1, setSize: 3, position: 3, parentKey: null });
    expect(row('g2s0')).toMatchObject({ level: 2, setSize: 4, position: 1, parentKey: 'g2' });
    expect(row('g2s3')).toMatchObject({ level: 2, setSize: 4, position: 4, parentKey: 'g2' });
    expect(row('g2s3i4')).toMatchObject({ level: 3, setSize: 5, position: 5, parentKey: 'g2s3' });
  });

  it('finds the row index of a key and the parent of a key', () => {
    const rows = flattenVisible(nodes, new Set(['g0']));
    expect(rowIndexOf(rows).get('g0s2')).toBe(3);
    expect(parentsOf(nodes).get('g1s2i4')).toBe('g1s2');
    expect(parentsOf(nodes).get('g1')).toBeNull();
  });

  it('keeps the focus key, else its nearest visible ancestor, else the first row', () => {
    const parents = parentsOf(nodes);
    const open = rowIndexOf(flattenVisible(nodes, new Set(['g0', 'g0s1'])));
    expect(stillFocusable('g0s1i2', open, parents, 'g0')).toBe('g0s1i2');
    const collapsed = rowIndexOf(flattenVisible(nodes, new Set(['g0'])));
    expect(stillFocusable('g0s1i2', collapsed, parents, 'g0')).toBe('g0s1');
    expect(stillFocusable('gone', collapsed, parents, 'g0')).toBe('g0');
    expect(stillFocusable(null, collapsed, parents, 'g0')).toBe('g0');
    expect(stillFocusable(null, collapsed, parents, null)).toBeNull();
  });

  describe('keyboard target', () => {
    const rows = flattenVisible(nodes, new Set(['g0', 'g0s0']));
    // g0, g0s0, g0s0i0..i4, g0s1, g0s2, g0s3, g1, g2
    const target = (k: string, name: string, hasChildren: boolean, expanded: boolean) =>
      navigationTarget(
        rows,
        rows.findIndex((r) => r.node.key === k),
        name,
        { hasChildren, expanded },
      );

    it('moves over all rows with the arrow keys, Home and End', () => {
      expect(target('g0s0', 'ArrowDown', true, true)).toBe('g0s0i0');
      expect(target('g0s0', 'ArrowUp', true, true)).toBe('g0');
      expect(target('g0', 'ArrowUp', true, true)).toBeNull();
      expect(target('g2', 'ArrowDown', true, false)).toBeNull();
      expect(target('g0s0i3', 'Home', false, false)).toBe('g0');
      expect(target('g0s0i3', 'End', false, false)).toBe('g2');
    });

    it('goes to the first child with arrow right and to the parent with arrow left', () => {
      expect(target('g0s0', 'ArrowRight', true, true)).toBe('g0s0i0');
      expect(target('g0s1', 'ArrowRight', true, false)).toBeNull(); // opens instead
      expect(target('g0s0i0', 'ArrowRight', false, false)).toBeNull();
      expect(target('g0s0i4', 'ArrowLeft', false, false)).toBe('g0s0');
      expect(target('g0s1', 'ArrowLeft', true, false)).toBe('g0');
      expect(target('g0s0', 'ArrowLeft', true, true)).toBeNull(); // closes instead
      expect(target('g0', 'ArrowLeft', true, true)).toBeNull();
      expect(target('g1', 'ArrowLeft', true, false)).toBeNull(); // top level: no parent
    });

    it('has no target for other keys', () => {
      expect(target('g0', 'a', true, true)).toBeNull();
    });
  });

  it('computes check states of all nodes in one pass', () => {
    const isLeaf = (k: string) => /i\d$/.test(k);
    const states = checkStates(nodes, new Set(['g0s0i0', 'g0s0i1']), true);
    expect(states.get('g0s0i0')).toBe(true);
    expect(states.get('g0s0i2')).toBe(false);
    expect(states.get('g0s0')).toBe('mixed');
    expect(states.get('g0')).toBe('mixed');
    expect(states.get('g1')).toBe(false);
    const full = checkStates(nodes, new Set(subtreeKeys(nodes[0]).filter(isLeaf)), true);
    expect(full.get('g0s3')).toBe(true);
    expect(full.get('g0')).toBe(true);
    expect(full.get('g1')).toBe(false);
  });

  it('scrolls a row into view with the least movement', () => {
    // 34 px rows, a 340 px viewport scrolled to 680 px: rows 20 to 29 are visible.
    expect(scrollOffsetToReveal(22, 34, 680, 340)).toBeNull();
    expect(scrollOffsetToReveal(29, 34, 680, 340)).toBeNull();
    expect(scrollOffsetToReveal(19, 34, 680, 340)).toBe(646);
    expect(scrollOffsetToReveal(30, 34, 680, 340)).toBe(30 * 34 + 34 - 340);
    expect(scrollOffsetToReveal(0, 34, 0, 340)).toBeNull();
    expect(scrollOffsetToReveal(2, 200, 0, 100)).toBe(500);
  });
});
