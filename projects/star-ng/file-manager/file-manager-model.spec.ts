import {
  StarFileItem,
  starCanDrop,
  starFileChildren,
  starFilePath,
  starFileSelection,
  starFolderTree,
  starSearchFiles,
  starSortFiles,
  starUniqueName,
} from './file-manager-model';

const ITEMS: StarFileItem[] = [
  { id: 'docs', name: 'Documents', isFolder: true, parentId: null },
  { id: 'plans', name: 'Plans', isFolder: true, parentId: 'docs' },
  { id: 'q3', name: 'Q3 plan.txt', isFolder: false, parentId: 'plans', size: 300, type: 'Text' },
  { id: 'notes', name: 'notes.txt', isFolder: false, parentId: 'docs', size: 1200, type: 'Text' },
  {
    id: 'budget',
    name: 'Budget.csv',
    isFolder: false,
    parentId: 'docs',
    size: 80,
    type: 'Table',
    modified: '2026-03-01',
  },
  { id: 'archive', name: 'archive', isFolder: true, parentId: 'docs' },
  { id: 'readme', name: 'Readme.txt', isFolder: false, parentId: null, size: 10 },
];

describe('file manager model', () => {
  it('lists the children of a folder and of the root', () => {
    expect(starFileChildren(ITEMS, 'docs').map((i) => i.id)).toEqual([
      'plans',
      'notes',
      'budget',
      'archive',
    ]);
    expect(starFileChildren(ITEMS, null).map((i) => i.id)).toEqual(['docs', 'readme']);
  });

  it('builds the path of a folder', () => {
    expect(starFilePath(ITEMS, 'plans').map((i) => i.id)).toEqual(['docs', 'plans']);
    expect(starFilePath(ITEMS, null)).toEqual([]);
  });

  it('sorts folders first, by name, size, type or date, in both orders', () => {
    const items = starFileChildren(ITEMS, 'docs');
    expect(starSortFiles(items, 'name', 1).map((i) => i.id)).toEqual([
      'archive',
      'plans',
      'budget',
      'notes',
    ]);
    expect(starSortFiles(items, 'name', -1).map((i) => i.id)).toEqual([
      'notes',
      'budget',
      'plans',
      'archive',
    ]);
    expect(starSortFiles(items, 'size', 1).map((i) => i.id)).toEqual([
      'archive',
      'plans',
      'budget',
      'notes',
    ]);
    expect(starSortFiles(items, 'modified', -1)[0].id).toBe('budget');
    expect(
      starSortFiles(items, 'type', 1)
        .slice(2)
        .map((i) => i.id),
    ).toEqual(['budget', 'notes']);
  });

  it('searches the folder and its subfolders, ignoring case', () => {
    expect(starSearchFiles(ITEMS, 'docs', 'PLAN').map((i) => i.id)).toEqual(['plans', 'q3']);
    expect(starSearchFiles(ITEMS, null, 'readme').map((i) => i.id)).toEqual(['readme']);
    expect(starSearchFiles(ITEMS, 'plans', 'notes')).toEqual([]);
  });

  it('builds the folder tree under a root node, with lazy folders when asked', () => {
    const tree = starFolderTree(ITEMS, 'All files');
    expect(tree[0].key).toBe('');
    expect(tree[0].children!.map((n) => n.key)).toEqual(['docs']);
    const docs = tree[0].children![0];
    expect(docs.children!.map((n) => n.label)).toEqual(['archive', 'Plans']);
    expect(docs.children![0].leaf).toBe(true);
    const lazy = starFolderTree(ITEMS, 'All files', (id) => id !== 'archive');
    expect(lazy[0].children![0].children![0].leaf).toBe(false);
  });

  it('selects one, toggles, and selects a range from the anchor', () => {
    const order = ['a', 'b', 'c', 'd'];
    expect(starFileSelection(order, ['a'], 'a', 'c', 'single')).toEqual({
      selected: ['c'],
      anchor: 'c',
    });
    expect(starFileSelection(order, ['a'], 'a', 'c', 'toggle')).toEqual({
      selected: ['a', 'c'],
      anchor: 'c',
    });
    expect(starFileSelection(order, ['a', 'c'], 'a', 'c', 'toggle')).toEqual({
      selected: ['a'],
      anchor: 'c',
    });
    expect(starFileSelection(order, ['d'], 'b', 'd', 'range')).toEqual({
      selected: ['b', 'c', 'd'],
      anchor: 'b',
    });
    expect(starFileSelection(order, [], null, 'c', 'range')).toEqual({
      selected: ['c'],
      anchor: 'c',
    });
  });

  it('refuses a drop of a folder into itself, its subfolders or its own parent', () => {
    expect(starCanDrop(ITEMS, ['plans'], 'archive')).toBe(true);
    expect(starCanDrop(ITEMS, ['docs'], 'plans')).toBe(false);
    expect(starCanDrop(ITEMS, ['plans'], 'plans')).toBe(false);
    expect(starCanDrop(ITEMS, ['notes'], 'docs')).toBe(false);
    expect(starCanDrop(ITEMS, ['notes'], null)).toBe(true);
    expect(starCanDrop(ITEMS, [], 'docs')).toBe(false);
  });

  it('makes a unique name', () => {
    expect(starUniqueName(['Plans'], 'New folder')).toBe('New folder');
    expect(starUniqueName(['New folder', 'New folder (2)'], 'New folder')).toBe('New folder (3)');
  });
});
