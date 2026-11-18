import { Directive, input } from '@angular/core';
import { StarSlot } from '@star-ng/ui/core';

/**
 * Column groups of `star-table`: header cells that span the columns of a group, in extra header
 * rows above the column headers (multi-row headers). PrimeNG `rowspan` / `colspan` header groups
 * (`p-columnGroup`), Ignite UI `igx-column-group` (multi-column headers), AG Grid
 * `ColGroupDef` (`children`).
 */
export interface StarColumnGroup {
  /** Text of the group header cell. */
  readonly header: string;
  /** Column `field`s and nested groups, in display order. */
  readonly children: readonly (string | StarColumnGroup)[];
}

/** Groups of each column `field`, from the outermost to the innermost. */
export type StarGroupPaths = ReadonlyMap<string, readonly StarColumnGroup[]>;

/** Walks the group tree: the path of groups above each field. */
export function groupPaths(groups: readonly StarColumnGroup[]): StarGroupPaths {
  const paths = new Map<string, readonly StarColumnGroup[]>();
  const walk = (group: StarColumnGroup, above: readonly StarColumnGroup[]) => {
    const path = [...above, group];
    for (const child of group.children) {
      if (typeof child === 'string') {
        if (!paths.has(child)) paths.set(child, path);
      } else {
        walk(child, path);
      }
    }
  };
  for (const group of groups) walk(group, []);
  return paths;
}

const NO_PATH: readonly StarColumnGroup[] = [];

/**
 * Keeps the columns of each group next to each other: a group takes the place of its first
 * column, and its columns follow in their relative order (nested groups too). Columns outside
 * groups keep their place.
 */
export function clusterColumns<C extends { readonly field: string }>(
  columns: readonly C[],
  paths: StarGroupPaths,
  level = 0,
): C[] {
  if (!paths.size) return [...columns];
  const units: { readonly group: StarColumnGroup | null; readonly members: C[] }[] = [];
  const byGroup = new Map<StarColumnGroup, C[]>();
  for (const column of columns) {
    const group = (paths.get(column.field) ?? NO_PATH)[level];
    if (!group) {
      units.push({ group: null, members: [column] });
      continue;
    }
    let members = byGroup.get(group);
    if (!members) {
      members = [];
      byGroup.set(group, members);
      units.push({ group, members });
    }
    members.push(column);
  }
  return units.flatMap((unit) =>
    unit.group ? clusterColumns(unit.members, paths, level + 1) : unit.members,
  );
}

/** The innermost group of a column, or `null`. */
export function parentGroupOf(field: string, paths: StarGroupPaths): StarColumnGroup | null {
  const path = paths.get(field);
  return path?.length ? path[path.length - 1] : null;
}

/** One cell of a header row: a group header, or the header of a column. */
export type StarHeaderCell<C> =
  | {
      readonly kind: 'group';
      readonly key: string;
      readonly group: StarColumnGroup;
      /** The rendered columns below the group cell, in display order. */
      readonly columns: readonly C[];
      readonly level: number;
    }
  | {
      readonly kind: 'column';
      readonly key: string;
      readonly column: C;
      /** Header rows that the column cell spans: down to the last header row. */
      readonly rowspan: number;
    };

/**
 * Header rows of the columns (rendered, in display order): one row per group level, then the
 * row of the columns. A column outside groups (or in fewer levels than the deepest) starts in the
 * first row without a group above it and spans down to the last row. A group cell spans its
 * rendered columns; a hidden column shrinks it, and a group without rendered columns has no cell.
 * Without groups there is one row with all columns.
 */
export function headerRows<C extends { readonly field: string }>(
  columns: readonly C[],
  paths: StarGroupPaths,
): StarHeaderCell<C>[][] {
  const pathOf = (column: C) => paths.get(column.field) ?? NO_PATH;
  const depth = columns.reduce((max, column) => Math.max(max, pathOf(column).length), 0);
  const rows: StarHeaderCell<C>[][] = Array.from({ length: depth + 1 }, () => []);
  columns.forEach((column, index) => {
    const path = pathOf(column);
    for (let level = 0; level < path.length; level++) {
      const row = rows[level];
      const last = row[row.length - 1];
      const previous = columns[index - 1];
      if (
        last?.kind === 'group' &&
        last.group === path[level] &&
        last.columns[last.columns.length - 1] === previous
      ) {
        (last.columns as C[]).push(column);
      } else {
        row.push({
          kind: 'group',
          key: `g${level}:${column.field}`,
          group: path[level],
          columns: [column],
          level,
        });
      }
    }
    rows[path.length].push({
      kind: 'column',
      key: column.field,
      column,
      rowspan: depth + 1 - path.length,
    });
  });
  return rows;
}

/** Header cell ids by cell key, and the `headers` text of each column (its group and column cells). */
export interface StarHeaderAssociations {
  readonly cells: ReadonlyMap<string, string>;
  readonly headers: ReadonlyMap<string, string>;
}

/**
 * Ids for the header cells of `rows` (prefix plus row and position) and, for each column field,
 * the ids of the header cells above it: the `headers` attribute of its body cells. A screen reader
 * then reads the group and the column of a cell.
 */
export function headerAssociations<C extends { readonly field: string }>(
  rows: readonly (readonly StarHeaderCell<C>[])[],
  prefix: string,
): StarHeaderAssociations {
  const cells = new Map<string, string>();
  const above = new Map<string, string[]>();
  rows.forEach((row, rowIndex) =>
    row.forEach((cell, index) => {
      const id = `${prefix}-h${rowIndex}-${index}`;
      cells.set(cell.key, id);
      for (const column of cell.kind === 'group' ? cell.columns : [cell.column]) {
        const ids = above.get(column.field) ?? [];
        ids.push(id);
        above.set(column.field, ids);
      }
    }),
  );
  const headers = new Map([...above].map(([field, ids]) => [field, ids.join(' ')]));
  return { cells, headers };
}

/** Context of the column group header slot. */
export interface StarColumnGroupHeaderContext {
  /** The group. */
  readonly $implicit: StarColumnGroup;
  /** Number of rendered columns below the group cell. */
  readonly span: number;
}

/**
 * Replaces the label of a column group header cell in `star-table`:
 * `<ng-template starColumnGroupHeader let-group>…</ng-template>` for all groups, or
 * `starColumnGroupHeader="Q1"` for the group with that `header`. PrimeNG header group template,
 * Ignite UI `igxHeader` of a column group.
 */
@Directive({
  selector: 'ng-template[starColumnGroupHeader]',
  providers: [{ provide: StarSlot, useExisting: StarColumnGroupHeaderTemplate }],
})
export class StarColumnGroupHeaderTemplate extends StarSlot<StarColumnGroupHeaderContext> {
  readonly name = 'columnGroupHeader';
  /** `header` of the group, or empty for every group. */
  readonly starColumnGroupHeader = input('');

  override slotKey(): string {
    return this.starColumnGroupHeader();
  }

  static ngTemplateContextGuard(
    _dir: StarColumnGroupHeaderTemplate,
    _ctx: unknown,
  ): _ctx is StarColumnGroupHeaderContext {
    return true;
  }
}
