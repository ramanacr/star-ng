import type { StarTreeNode, StarTreeNodeDropEvent } from '@star-ng/ui/tree';

/** Fictional departments for the tree examples. */
export const DEPARTMENTS: readonly StarTreeNode<{ lead: string }>[] = [
  {
    key: 'eng',
    label: 'Engineering',
    icon: 'ph-bold ph-folder',
    data: { lead: 'Asha' },
    children: [
      { key: 'web', label: 'Web platform', data: { lead: 'Ben' } },
      { key: 'mobile', label: 'Mobile', data: { lead: 'Chen' } },
      { key: 'ops', label: 'Operations', data: { lead: 'Dara' } },
    ],
  },
  {
    key: 'fin',
    label: 'Finance',
    icon: 'ph-bold ph-folder',
    data: { lead: 'Eli' },
    children: [
      { key: 'payroll', label: 'Payroll', data: { lead: 'Femi' } },
      { key: 'audit', label: 'Audit (locked)', data: { lead: 'Gil' }, disabled: true },
      { key: 'tax', label: 'Tax', data: { lead: 'Hana' }, selectable: false },
    ],
  },
  { key: 'people', label: 'People', icon: 'ph-bold ph-folder', data: { lead: 'Ivo' } },
];

/** Removes a node by key and returns it with the rest of the tree. */
function takeNode<T>(
  nodes: readonly StarTreeNode<T>[],
  key: string,
): { rest: StarTreeNode<T>[]; taken: StarTreeNode<T> | null } {
  let taken: StarTreeNode<T> | null = null;
  const walk = (list: readonly StarTreeNode<T>[]): StarTreeNode<T>[] =>
    list.flatMap((node) => {
      if (node.key === key) {
        taken = node;
        return [];
      }
      return node.children ? [{ ...node, children: walk(node.children) }] : [node];
    });
  return { rest: walk(nodes), taken };
}

/** Puts a node before, after or inside the node with the key `target`. */
function placeNode<T>(
  nodes: readonly StarTreeNode<T>[],
  node: StarTreeNode<T>,
  target: string,
  position: StarTreeNodeDropEvent['position'],
): StarTreeNode<T>[] {
  return nodes.flatMap((current) => {
    if (current.key === target) {
      if (position === 'before') return [node, current];
      if (position === 'after') return [current, node];
      return [{ ...current, children: [...(current.children ?? []), node] }];
    }
    return current.children
      ? [{ ...current, children: placeNode(current.children, node, target, position) }]
      : [current];
  });
}

/** Moves the dragged node as `nodeDrop` describes. The tree never does it itself. */
export function moveNode<T>(
  nodes: readonly StarTreeNode<T>[],
  event: StarTreeNodeDropEvent,
): StarTreeNode<T>[] {
  const { rest, taken } = takeNode(nodes, event.dragNode.key);
  return taken ? placeNode(rest, taken, event.dropNode.key, event.position) : [...nodes];
}

/** Top-level projects whose teams load on demand (`leaf: false`). */
export const LAZY_PROJECTS: readonly StarTreeNode[] = [
  { key: 'atlas', label: 'Project Atlas', icon: 'ph-bold ph-folder', leaf: false },
  { key: 'beacon', label: 'Project Beacon', icon: 'ph-bold ph-folder', leaf: false },
  { key: 'comet', label: 'Project Comet', icon: 'ph-bold ph-folder', leaf: false },
];

/** A fake request: the teams of a project after a short wait. No network. */
export function loadTeams(project: string, signal: AbortSignal): Promise<StarTreeNode[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        resolve(
          ['Design', 'Build', 'Review'].map((team) => ({
            key: `${project}-${team.toLowerCase()}`,
            label: team,
          })),
        ),
      800,
    );
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}
