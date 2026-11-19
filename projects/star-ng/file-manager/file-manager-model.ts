// Pure rules of `star-file-manager`: children, paths, sort, search, the folder tree, selection
// and drop checks. The component never changes the items: these functions only read them.
import type { StarTreeNode } from '@star-ng/ui/tree';

/** One file or folder. `parentId: null` puts it in the top folder. */
export interface StarFileItem {
  readonly id: string;
  readonly name: string;
  readonly isFolder: boolean;
  readonly parentId: string | null;
  /** Size in bytes (files). */
  readonly size?: number;
  /** Last change: a `Date`, a time in milliseconds or an ISO date text. */
  readonly modified?: Date | number | string;
  /** Type text, for example `PDF document`. Folders show the `fileFolderType` text. */
  readonly type?: string;
  /** Phosphor icon class. Default: a folder or a file icon. */
  readonly icon?: string;
}

/** Sort field of the file manager. */
export type StarFileSortField = 'name' | 'size' | 'modified' | 'type';

/** How a click or key changes the selection. */
export type StarFileSelectMode = 'single' | 'toggle' | 'range';

/** The items directly in a folder (`null`: the top folder), in their given order. */
export function starFileChildren(
  items: readonly StarFileItem[],
  folderId: string | null,
): StarFileItem[] {
  return items.filter((item) => item.parentId === folderId);
}

/** The folders from the top down to `folderId`, both ends included. Empty for the top folder. */
export function starFilePath(
  items: readonly StarFileItem[],
  folderId: string | null,
): StarFileItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const path: StarFileItem[] = [];
  const seen = new Set<string>();
  for (let id = folderId; id !== null && !seen.has(id);) {
    seen.add(id);
    const item = byId.get(id);
    if (!item) break;
    path.unshift(item);
    id = item.parentId;
  }
  return path;
}

function time(value: StarFileItem['modified']): number {
  if (value === undefined) return Number.NEGATIVE_INFINITY;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/**
 * Sorted copy. Folders come before files in ascending order and after them in descending order,
 * as in a desktop file manager. Equal values keep the name order.
 */
export function starSortFiles(
  items: readonly StarFileItem[],
  field: StarFileSortField,
  order: 1 | -1,
): StarFileItem[] {
  const value = (item: StarFileItem): number | string => {
    switch (field) {
      case 'size':
        return item.isFolder ? -1 : (item.size ?? 0);
      case 'modified':
        return time(item.modified);
      case 'type':
        return item.type ?? '';
      default:
        return item.name;
    }
  };
  return [...items].sort((a, b) => {
    const rank = Number(a.isFolder ? 0 : 1) - Number(b.isFolder ? 0 : 1);
    if (rank) return rank * order;
    const x = value(a);
    const y = value(b);
    const by =
      typeof x === 'number' && typeof y === 'number'
        ? x === y
          ? 0
          : x < y
            ? -1
            : 1
        : collator.compare(String(x), String(y));
    return (by || collator.compare(a.name, b.name)) * order;
  });
}

/** Items in `folderId` and its subfolders whose name contains `query` (case and accents ignored). */
export function starSearchFiles(
  items: readonly StarFileItem[],
  folderId: string | null,
  query: string,
): StarFileItem[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return starFileChildren(items, folderId);
  const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase();
  const target = plain(needle);
  const found: StarFileItem[] = [];
  const visit = (parent: string | null, seen: Set<string>) => {
    for (const item of starFileChildren(items, parent)) {
      if (plain(item.name).includes(target)) found.push(item);
      if (item.isFolder && !seen.has(item.id)) visit(item.id, new Set(seen).add(item.id));
    }
  };
  visit(folderId, new Set(folderId === null ? [] : [folderId]));
  return found;
}

/**
 * The folder tree for `star-tree`: one top node (key `''`) with the folders below, sorted by
 * name. A folder whose children are not `loaded` yet gets `leaf: false`, so the tree shows its
 * toggle and asks for the children (lazy loading).
 */
export function starFolderTree(
  items: readonly StarFileItem[],
  rootLabel: string,
  loaded: (folderId: string) => boolean = () => true,
): StarTreeNode<StarFileItem | null>[] {
  const build = (parent: string | null, seen: Set<string>): StarTreeNode<StarFileItem | null>[] =>
    starSortFiles(
      starFileChildren(items, parent).filter((item) => item.isFolder),
      'name',
      1,
    ).map((folder) => {
      const children = seen.has(folder.id) ? [] : build(folder.id, new Set(seen).add(folder.id));
      return {
        key: folder.id,
        label: folder.name,
        icon: folder.icon ?? 'ph-bold ph-folder',
        data: folder,
        children,
        leaf: loaded(folder.id) ? children.length === 0 : false,
      };
    });
  return [
    {
      key: '',
      label: rootLabel,
      icon: 'ph-bold ph-hard-drives',
      data: null,
      children: build(null, new Set()),
      leaf: false,
    },
  ];
}

/**
 * The selection after a click or key on `target`. `single` selects only the target, `toggle`
 * adds or removes it (Control), `range` selects from the anchor to the target (Shift; the anchor
 * stays). `order` is the visible order of the ids.
 */
export function starFileSelection(
  order: readonly string[],
  selected: readonly string[],
  anchor: string | null,
  target: string,
  mode: StarFileSelectMode,
): { selected: string[]; anchor: string } {
  if (mode === 'toggle') {
    const next = selected.includes(target)
      ? selected.filter((id) => id !== target)
      : [...selected, target];
    return { selected: next, anchor: target };
  }
  const from = anchor === null ? -1 : order.indexOf(anchor);
  const to = order.indexOf(target);
  if (mode === 'range' && from >= 0 && to >= 0) {
    const [start, end] = from <= to ? [from, to] : [to, from];
    return { selected: order.slice(start, end + 1), anchor: anchor! };
  }
  return { selected: [target], anchor: target };
}

/**
 * Whether `ids` can move or copy into `targetId` (`null`: the top folder). No folder goes into
 * itself or a subfolder, and a drop where every item already is does nothing.
 */
export function starCanDrop(
  items: readonly StarFileItem[],
  ids: readonly string[],
  targetId: string | null,
): boolean {
  if (!ids.length) return false;
  const path = new Set(starFilePath(items, targetId).map((item) => item.id));
  if (ids.some((id) => path.has(id))) return false;
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids.some((id) => byId.get(id)?.parentId !== targetId);
}

/** `base`, or `base (2)`, `base (3)` … the first one that is not in `names`. */
export function starUniqueName(names: readonly string[], base: string): string {
  const taken = new Set(names.map((name) => name.toLocaleLowerCase()));
  if (!taken.has(base.toLocaleLowerCase())) return base;
  for (let n = 2; ; n++) {
    const name = `${base} (${n})`;
    if (!taken.has(name.toLocaleLowerCase())) return name;
  }
}
