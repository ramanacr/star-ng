import {
  cellText,
  checkStates,
  filterTree,
  moveColumnOrder,
  nodeMatches,
  orderColumns,
  pageRoots,
  sortTree,
  toggleChecked,
} from './tree-table-data';

interface N {
  readonly key: string;
  readonly label: string;
  readonly data?: Record<string, unknown>;
  readonly children?: readonly N[];
  readonly disabled?: boolean;
  readonly selectable?: boolean;
}

const n = (key: string, data: Record<string, unknown>, children?: N[]): N => ({
  key,
  label: String(data['name'] ?? key),
  data,
  ...(children ? { children } : {}),
});

// Projects with tasks: two levels below the roots.
const TREE: readonly N[] = [
  n('beta', { name: 'Beta', hours: 30 }, [
    n('b2', { name: 'Review', hours: 5 }),
    n('b1', { name: 'Design', hours: 20 }, [n('b1a', { name: 'Sketch', hours: 2 })]),
  ]),
  n('alpha', { name: 'Alpha', hours: 12 }, [n('a1', { name: 'Build', hours: 12 })]),
  n('gamma', { name: 'Gamma', hours: 30 }),
];

const keys = (nodes: readonly N[]): string[] =>
  nodes.flatMap((node) => [node.key, ...keys(node.children ?? [])]);

describe('tree table data', () => {
  describe('sortTree', () => {
    it('sorts the siblings of every level and keeps each child under its parent', () => {
      const sorted = sortTree(TREE, [{ field: 'name', order: 1 }]);
      expect(sorted.map((node) => node.key)).toEqual(['alpha', 'beta', 'gamma']);
      expect(sorted[1].children?.map((node) => node.key)).toEqual(['b1', 'b2']);
      expect(sorted[1].children?.[0].children?.map((node) => node.key)).toEqual(['b1a']);
    });

    it('sorts descending and by a second rule on ties', () => {
      const sorted = sortTree(TREE, [
        { field: 'hours', order: -1 },
        { field: 'name', order: -1 },
      ]);
      expect(sorted.map((node) => node.key)).toEqual(['gamma', 'beta', 'alpha']);
    });

    it('returns the nodes unchanged without a rule and never mutates the input', () => {
      expect(sortTree(TREE, [])).toBe(TREE);
      expect(sortTree(TREE, [{ field: null, order: 1 }])).toBe(TREE);
      const before = keys(TREE);
      sortTree(TREE, [{ field: 'name', order: -1 }]);
      expect(keys(TREE)).toEqual(before);
    });
  });

  describe('filterTree', () => {
    const named = (query: string) => (node: N) => nodeMatches(node, ['name'], query, []);

    it('lenient: a match shows its ancestors and all its descendants', () => {
      const result = filterTree(TREE, named('design'), 'lenient');
      expect(keys(result.nodes)).toEqual(['beta', 'b1', 'b1a']);
      expect([...result.ancestors]).toEqual(['beta']);
      expect([...result.matches]).toEqual(['b1']);
    });

    it('strict: only the matching paths show', () => {
      const result = filterTree(TREE, named('beta'), 'strict');
      expect(keys(result.nodes)).toEqual(['beta']);
      expect(result.nodes[0].children).toEqual([]);
      const lenient = filterTree(TREE, named('beta'), 'lenient');
      expect(keys(lenient.nodes)).toEqual(['beta', 'b2', 'b1', 'b1a']);
    });

    it('strict: a match below a match keeps the path to it open', () => {
      const result = filterTree(TREE, (node) => ['beta', 'b1a'].includes(node.key), 'strict');
      expect(keys(result.nodes)).toEqual(['beta', 'b1', 'b1a']);
      expect([...result.ancestors].sort()).toEqual(['b1', 'beta']);
    });

    it('returns no nodes when nothing matches and keeps the input', () => {
      const before = keys(TREE);
      expect(filterTree(TREE, named('zzz'), 'lenient').nodes).toEqual([]);
      expect(keys(TREE)).toEqual(before);
    });
  });

  describe('nodeMatches', () => {
    const node = n('x', { name: 'Café', hours: 12 });

    it('matches the global query in any column, accent- and case-insensitive', () => {
      expect(nodeMatches(node, ['name', 'hours'], 'cafe', [])).toBe(true);
      expect(nodeMatches(node, ['name', 'hours'], '12', [])).toBe(true);
      expect(nodeMatches(node, ['name', 'hours'], 'tea', [])).toBe(false);
    });

    it('needs every column filter to match', () => {
      expect(nodeMatches(node, ['name', 'hours'], '', [{ field: 'hours', query: '1' }])).toBe(true);
      expect(
        nodeMatches(node, ['name', 'hours'], '', [
          { field: 'hours', query: '1' },
          { field: 'name', query: 'x' },
        ]),
      ).toBe(false);
    });

    it('reads the label for the first column when the data has no value', () => {
      const bare = { key: 'k', label: 'Kickoff' };
      expect(cellText(bare, 'name', true)).toBe('Kickoff');
      expect(cellText(bare, 'hours', false)).toBe('');
      expect(nodeMatches(bare, ['name', 'hours'], 'kick', [])).toBe(true);
    });
  });

  describe('pageRoots', () => {
    const roots = Array.from({ length: 23 }, (_, i) => i);

    it('slices one page of top-level nodes', () => {
      expect(pageRoots(roots, 0, 10)).toEqual(roots.slice(0, 10));
      expect(pageRoots(roots, 20, 10)).toEqual([20, 21, 22]);
    });

    it('shows the last page when first is past the end, and all nodes without a page size', () => {
      expect(pageRoots(roots, 40, 10)).toEqual([20, 21, 22]);
      expect(pageRoots(roots, 0, 0)).toBe(roots);
      expect(pageRoots([], 10, 10)).toEqual([]);
    });
  });

  describe('checkbox selection', () => {
    const both = { up: true, down: true };

    it('checking a parent checks its descendants and every full ancestor', () => {
      const selection = toggleChecked(TREE, 'b1', true, [], both);
      expect(selection.sort()).toEqual(['b1', 'b1a']);
      const all = toggleChecked(TREE, 'b2', true, selection, both);
      expect(all.sort()).toEqual(['b1', 'b1a', 'b2', 'beta']);
    });

    it('unchecking a leaf unchecks its ancestors and keeps the order of the other keys', () => {
      const selection = toggleChecked(TREE, 'b1a', false, ['beta', 'b2', 'b1', 'b1a'], both);
      expect(selection).toEqual(['b2']);
    });

    it('without propagation only the node changes', () => {
      expect(toggleChecked(TREE, 'beta', true, [], { up: false, down: false })).toEqual(['beta']);
      expect(toggleChecked(TREE, 'b1a', true, [], { up: false, down: true })).toEqual(['b1a']);
      expect(toggleChecked(TREE, 'b1a', true, ['b1'], { up: true, down: false }).sort()).toEqual([
        'b1',
        'b1a',
      ]);
      expect(toggleChecked(TREE, 'nope', true, ['a1'], both)).toEqual(['a1']);
    });

    // A project with a disabled task and a task that cannot be selected.
    const LOCKED: readonly N[] = [
      {
        key: 'p',
        label: 'P',
        children: [
          { key: 'p1', label: 'P1' },
          { key: 'p2', label: 'P2', disabled: true },
          {
            key: 'p3',
            label: 'P3',
            selectable: false,
            children: [{ key: 'p3a', label: 'P3a' }],
          },
        ],
      },
    ];

    it('down: locked descendants and their subtrees keep their state', () => {
      expect(toggleChecked(LOCKED, 'p', true, [], both).sort()).toEqual(['p', 'p1']);
      expect(toggleChecked(LOCKED, 'p', false, ['p', 'p1', 'p2', 'p3a'], both).sort()).toEqual([
        'p2',
        'p3a',
      ]);
    });

    it('up: the parent follows its selectable children only', () => {
      expect(toggleChecked(LOCKED, 'p1', true, [], both).sort()).toEqual(['p', 'p1']);
      expect(toggleChecked(LOCKED, 'p1', false, ['p', 'p1', 'p2'], both)).toEqual(['p2']);
    });

    it('up: a parent is checked when all its selectable children are, without its own key', () => {
      const states = checkStates(LOCKED, new Set(['p1']), true);
      expect(states.get('p')).toBe(true);
      expect(states.get('p2')).toBe(false);
      expect(checkStates(TREE, new Set(['b2', 'b1a']), true).get('beta')).toBe(true);
      expect(checkStates(TREE, new Set(['b2', 'b1a']), true).get('b1')).toBe(true);
      expect(checkStates(TREE, new Set(['b2', 'b1a']), false).get('beta')).toBe(false);
    });

    it('derives true, false and mixed states', () => {
      const states = checkStates(TREE, new Set(['b1', 'b1a']), true);
      expect(states.get('b1')).toBe(true);
      expect(states.get('beta')).toBe('mixed');
      expect(states.get('b2')).toBe(false);
      expect(states.get('alpha')).toBe(false);
      expect(checkStates(TREE, new Set(['b1a']), false).get('beta')).toBe(false);
    });
  });

  describe('columns', () => {
    const columns = [
      { field: 'a' },
      { field: 'b' },
      { field: 'name', frozen: true },
      { field: 'c' },
    ] as const;

    it('puts frozen columns first, then the order list, then the rest', () => {
      expect(orderColumns(columns, ['c']).map((c) => c.field)).toEqual(['name', 'c', 'a', 'b']);
    });

    it('moves a column, but never a frozen one or into the frozen columns', () => {
      const ordered = orderColumns(columns, []);
      expect(moveColumnOrder(ordered, 'c', 'a')).toEqual(['name', 'c', 'a', 'b']);
      expect(moveColumnOrder(ordered, 'name', 'a')).toBeNull();
      expect(moveColumnOrder(ordered, 'a', 'name')).toBeNull();
      expect(moveColumnOrder(ordered, 'a', 'a')).toBeNull();
    });
  });
});
