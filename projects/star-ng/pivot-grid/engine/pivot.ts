import { aggregateCell } from './aggregate';
import {
  AxisLevel,
  axisLevels,
  compareMembers,
  memberKey,
  readField,
  starPivotPathKey,
} from './members';
import type {
  StarPivotColumn,
  StarPivotConfig,
  StarPivotHeader,
  StarPivotOptions,
  StarPivotResult,
  StarPivotRow,
  StarPivotValue,
} from './types';

/** A member of an axis tree, with the indexes of its records. */
interface Node {
  readonly id: number;
  readonly raw: unknown;
  readonly label: string;
  /** -1 for the root. */
  readonly level: number;
  readonly path: readonly unknown[];
  readonly labels: readonly string[];
  readonly pathKey: string;
  readonly children: Map<string, Node>;
  ordered: Node[];
  readonly records: number[];
}

function makeNode(id: number, parent: Node | null, raw: unknown, label: string): Node {
  const path = parent ? [...parent.path, raw] : [];
  return {
    id,
    raw,
    label,
    level: parent ? parent.level + 1 : -1,
    path,
    labels: parent ? [...parent.labels, label] : [],
    pathKey: starPivotPathKey(path),
    children: new Map(),
    ordered: [],
    records: [],
  };
}

/** The tree of one axis and, per record, the chain of its nodes from the root. */
interface Axis<T> {
  readonly root: Node;
  readonly levels: readonly AxisLevel<T>[];
  readonly chains: Node[][];
  readonly size: number;
}

function buildAxis<T>(
  data: readonly T[],
  indexes: readonly number[],
  levels: readonly AxisLevel<T>[],
): Axis<T> {
  let size = 0;
  const root = makeNode(size++, null, null, '');
  const chains: Node[][] = [];
  for (const index of indexes) {
    const record = data[index];
    let node = root;
    root.records.push(index);
    const chain = [root];
    for (const level of levels) {
      const member = level.member(record);
      let child = node.children.get(member.key);
      if (!child) {
        child = makeNode(size++, node, member.raw, level.labelOf(member.raw));
        node.children.set(member.key, child);
      }
      child.records.push(index);
      chain.push(child);
      node = child;
    }
    chains[index] = chain;
  }
  return { root, levels, chains, size };
}

/** Orders the children of every node: by label, or by the grand total of a value. */
function sortAxis<T>(
  axis: Axis<T>,
  data: readonly T[],
  values: readonly StarPivotValue<T>[],
  locale: string | undefined,
): void {
  const visit = (node: Node): void => {
    const children = [...node.children.values()];
    if (children.length) {
      const level = axis.levels[node.level + 1];
      const sort = level.dimension.sort ?? {};
      const sign = sort.order === 'desc' ? -1 : 1;
      const value = sort.by === 'value' ? values[sort.value ?? 0] : undefined;
      if (value) {
        const totals = new Map<Node, number | null>();
        for (const child of children) {
          const total = aggregateCell(value, data, child.records);
          totals.set(child, typeof total === 'number' && !Number.isNaN(total) ? total : null);
        }
        children.sort((a, b) => {
          if (a.raw === null || b.raw === null) return compareMembers(a, b, locale);
          const left = totals.get(a)!;
          const right = totals.get(b)!;
          // A member without a numeric total comes last, in both orders (as a blank member).
          if (left === null || right === null) {
            return left === right ? compareMembers(a, b, locale) : left === null ? 1 : -1;
          }
          const diff = left - right;
          return diff ? sign * diff : compareMembers(a, b, locale);
        });
      } else {
        children.sort((a, b) =>
          a.raw === null || b.raw === null
            ? compareMembers(a, b, locale)
            : sign * compareMembers(a, b, locale),
        );
      }
    }
    node.ordered = children;
    for (const child of children) visit(child);
  };
  visit(axis.root);
}

/** Records after the member filters, as indexes. */
function filteredIndexes<T>(data: readonly T[], config: StarPivotConfig<T>): number[] {
  const filters = (config.filters ?? [])
    .filter((filter) => filter.include || filter.exclude?.length)
    .map((filter) => ({
      field: filter.field,
      read: filter.value ?? findReader(config, filter.field),
      include: filter.include ? new Set(filter.include.map(memberKey)) : null,
      exclude: new Set((filter.exclude ?? []).map(memberKey)),
    }));
  const indexes: number[] = [];
  for (let index = 0; index < data.length; index++) {
    const record = data[index];
    let pass = true;
    for (const filter of filters) {
      const key = memberKey(filter.read(record));
      if ((filter.include && !filter.include.has(key)) || filter.exclude.has(key)) {
        pass = false;
        break;
      }
    }
    if (pass) indexes.push(index);
  }
  return indexes;
}

/** The reader of a field: the `value` accessor of a dimension with that field, else the field. */
function findReader<T>(config: StarPivotConfig<T>, field: string): (record: T) => unknown {
  const source = [...config.rows, ...config.columns, ...config.values].find(
    (item) => item.field === field && item.value,
  );
  return source?.value ?? ((record: T) => readField(record, field));
}

/**
 * Computes a pivot table from flat records: the row members, the leaf columns with their header
 * rows, and the cell values. Pure: no DOM, no `eval`. Ignite UI `IgxPivotGrid` pipes, Kendo
 * `PivotGrid` local data, DevExtreme `PivotGridDataSource`, Syncfusion pivot engine.
 */
export function starPivot<T>(
  data: readonly T[],
  config: StarPivotConfig<T>,
  options: StarPivotOptions = {},
): StarPivotResult<T> {
  const locale = options.locale;
  const values = config.values;
  const indexes = filteredIndexes(data, config);
  const levelOptions = { ...options, timeZone: config.timeZone };
  const rowAxis = buildAxis(data, indexes, axisLevels(config.rows, levelOptions));
  const columnAxis = buildAxis(data, indexes, axisLevels(config.columns, levelOptions));
  sortAxis(rowAxis, data, values, locale);
  sortAxis(columnAxis, data, values, locale);

  // Records per (row node, column node).
  const cellRecords = new Map<number, number[]>();
  const width = columnAxis.size;
  for (const index of indexes) {
    const columnChain = columnAxis.chains[index];
    for (const rowNode of rowAxis.chains[index]) {
      const base = rowNode.id * width;
      for (const columnNode of columnChain) {
        const key = base + columnNode.id;
        const list = cellRecords.get(key);
        if (list) list.push(index);
        else cellRecords.set(key, [index]);
      }
    }
  }

  const rows = flattenRows(rowAxis, config);
  const { columns, headers } = flattenColumns(columnAxis, config);

  const cells = rows.map(({ node, row }) =>
    columns.map(({ node: columnNode, column }) => {
      if (!row.hasValues || column.valueIndex < 0) return null;
      const list = cellRecords.get(node.id * width + columnNode.id) ?? [];
      return aggregateCell(values[column.valueIndex], data, list);
    }),
  );

  return {
    rows: rows.map((entry) => entry.row),
    columns: columns.map((entry) => entry.column),
    headerRows: headers,
    rowLevels: rowAxis.levels.map(({ field, label, part }) => ({ field, label, part })),
    columnLevels: columnAxis.levels.map(({ field, label, part }) => ({ field, label, part })),
    cells,
    recordCount: indexes.length,
    values,
    records(row: number, column: number): readonly T[] {
      const rowNode = rows[row]?.node;
      const columnNode = columns[column]?.node;
      if (!rowNode || !columnNode) return [];
      return (cellRecords.get(rowNode.id * width + columnNode.id) ?? []).map(
        (index) => data[index],
      );
    },
  };
}

function flattenRows<T>(
  axis: Axis<T>,
  config: StarPivotConfig<T>,
): { node: Node; row: StarPivotRow }[] {
  const depth = axis.levels.length;
  const collapsed = new Set(config.collapsedRows ?? []);
  const subtotals = config.rowSubtotals ?? true;
  const rows: { node: Node; row: StarPivotRow }[] = [];
  const visit = (node: Node): void => {
    for (const child of node.ordered) {
      const leaf = child.level === depth - 1;
      const closed = !leaf && collapsed.has(child.pathKey);
      rows.push({
        node: child,
        row: {
          key: child.pathKey,
          path: child.path,
          labels: child.labels,
          label: child.label,
          level: child.level,
          kind: 'member',
          expandable: !leaf,
          expanded: !leaf && !closed,
          hasValues: leaf || closed || subtotals,
        },
      });
      if (!leaf && !closed) visit(child);
    }
  };
  visit(axis.root);
  if (!depth || !rows.length || (config.rowGrandTotals ?? true)) {
    rows.push({ node: axis.root, row: totalRow() });
  }
  return rows;
}

function totalRow(): StarPivotRow {
  return {
    key: starPivotPathKey([]),
    path: [],
    labels: [],
    label: '',
    level: 0,
    kind: 'total',
    expandable: false,
    expanded: false,
    hasValues: true,
  };
}

function flattenColumns<T>(
  axis: Axis<T>,
  config: StarPivotConfig<T>,
): { columns: { node: Node; column: StarPivotColumn }[]; headers: StarPivotHeader[][] } {
  const depth = axis.levels.length;
  const values = config.values;
  const valueCount = Math.max(1, values.length);
  const valueRow = values.length > 1 || depth === 0;
  const collapsed = new Set(config.collapsedColumns ?? []);
  const subtotals = config.columnSubtotals ?? true;
  const columns: { node: Node; column: StarPivotColumn }[] = [];
  const cells: StarPivotHeader[] = [];

  const addValues = (node: Node, kind: StarPivotColumn['kind']): void => {
    for (let valueIndex = 0; valueIndex < valueCount; valueIndex++) {
      columns.push({
        node,
        column: {
          key: `${kind}:${node.pathKey}:${valueIndex}`,
          path: node.path,
          labels: node.labels,
          label: node.label,
          level: Math.max(0, node.level),
          kind,
          valueIndex: values.length ? valueIndex : -1,
        },
      });
    }
  };
  const header = (
    node: Node,
    kind: StarPivotHeader['kind'],
    column: number,
    colSpan: number,
    rowSpan: number,
    expandable = false,
    expanded = false,
  ): void => {
    cells.push({
      key: `${kind}:${node.pathKey}`,
      path: node.path,
      label: kind === 'total' ? '' : node.label,
      kind,
      row: Math.max(0, node.level),
      column,
      rowSpan,
      colSpan,
      level: Math.max(0, node.level),
      expandable,
      expanded,
      valueIndex: -1,
    });
  };

  const visit = (node: Node): void => {
    for (const child of node.ordered) {
      const start = columns.length;
      const leaf = child.level === depth - 1;
      const closed = !leaf && collapsed.has(child.pathKey);
      const down = depth - child.level;
      if (leaf || closed) {
        addValues(child, 'member');
        header(child, 'member', start, valueCount, down, !leaf, false);
        continue;
      }
      visit(child);
      header(child, 'member', start, columns.length - start, 1, true, true);
      if (subtotals) {
        const subStart = columns.length;
        addValues(child, 'subtotal');
        header(child, 'subtotal', subStart, valueCount, down);
      }
    }
  };
  visit(axis.root);
  if (!depth || !columns.length || (config.columnGrandTotals ?? true)) {
    const start = columns.length;
    addValues(axis.root, 'total');
    if (depth) header(axis.root, 'total', start, valueCount, depth);
  }

  if (valueRow) {
    columns.forEach(({ column }, index) => {
      const value = values[column.valueIndex];
      cells.push({
        key: `value:${column.key}`,
        path: column.path,
        label: value ? (value.label ?? value.field) : '',
        kind: 'value',
        row: depth,
        column: index,
        rowSpan: 1,
        colSpan: 1,
        level: depth,
        expandable: false,
        expanded: false,
        valueIndex: column.valueIndex,
      });
    });
  }

  const rowCount = depth + (valueRow ? 1 : 0);
  const headers: StarPivotHeader[][] = Array.from({ length: rowCount }, () => []);
  for (const cell of cells) headers[cell.row].push(cell);
  for (const row of headers) row.sort((a, b) => a.column - b.column);
  return { columns, headers };
}
