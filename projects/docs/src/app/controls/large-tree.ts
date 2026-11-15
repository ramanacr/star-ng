import { StarTreeNode } from '@star-ng/ui/tree';

/**
 * Sample data for the windowed tree examples: 10 sites, each with 10 warehouses, each with
 * 10 aisles, each with 10 orders. That is 11,110 nodes, all of them open. The data is fictional
 * and deterministic (no random values).
 */
export interface LargeTree {
  readonly nodes: readonly StarTreeNode[];
  /** Keys of every branch: the value of `expanded` that opens the whole tree. */
  readonly branchKeys: readonly string[];
  /** Number of nodes in the tree. */
  readonly count: number;
}

const BRANCH_LABELS = ['Site', 'Warehouse', 'Aisle'] as const;
const WIDTH = 10;

export function buildLargeTree(): LargeTree {
  const branchKeys: string[] = [];
  let count = 0;
  // depth 0 to 2 are branches (site, warehouse, aisle); depth 3 are the orders.
  const level = (path: string, depth: number): StarTreeNode[] =>
    Array.from({ length: WIDTH }, (_, i) => {
      const id = path ? `${path}-${i + 1}` : `${i + 1}`;
      count++;
      if (depth === BRANCH_LABELS.length) {
        return { key: `o${id}`, label: `Order ${id}` };
      }
      branchKeys.push(`b${id}`);
      return {
        key: `b${id}`,
        label: `${BRANCH_LABELS[depth]} ${id}`,
        icon: 'ph-bold ph-folder',
        children: level(id, depth + 1),
      };
    });
  const nodes = level('', 0);
  return { nodes, branchKeys, count };
}
