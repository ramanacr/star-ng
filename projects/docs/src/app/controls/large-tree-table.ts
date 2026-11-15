import { StarTreeNode } from '@star-ng/ui/tree';

/**
 * Sample data for the windowed tree table example: 10 sites, each with 10 warehouses, each with
 * 10 aisles, each with 10 bins. That is 11,110 rows, all of them open. The data is fictional and
 * deterministic (no random values).
 */
export type StockRow = Record<string, unknown>;

export interface LargeTreeTable {
  readonly nodes: readonly StarTreeNode<StockRow>[];
  /** Keys of every branch: the value of `expanded` that opens the whole table. */
  readonly branchKeys: readonly string[];
  /** Number of rows when every branch is open. */
  readonly count: number;
}

const BRANCH_LABELS = ['Site', 'Warehouse', 'Aisle'] as const;
const WIDTH = 10;

export function buildLargeTreeTable(): LargeTreeTable {
  const branchKeys: string[] = [];
  let count = 0;
  // depth 0 to 2 are branches (site, warehouse, aisle); depth 3 are the bins.
  const level = (path: string, depth: number): StarTreeNode<StockRow>[] =>
    Array.from({ length: WIDTH }, (_, i) => {
      const id = path ? `${path}-${i + 1}` : `${i + 1}`;
      count++;
      const units = ((i + 1) * 37 + depth * 11) % 100;
      if (depth === BRANCH_LABELS.length) {
        const name = `Bin ${id}`;
        return { key: `o${id}`, label: name, data: { name, kind: 'Bin', units } };
      }
      const name = `${BRANCH_LABELS[depth]} ${id}`;
      branchKeys.push(`b${id}`);
      return {
        key: `b${id}`,
        label: name,
        data: {
          name,
          kind: BRANCH_LABELS[depth],
          units: units * 10 ** (BRANCH_LABELS.length - depth),
        },
        children: level(id, depth + 1),
      };
    });
  const nodes = level('', 0);
  return { nodes, branchKeys, count };
}
