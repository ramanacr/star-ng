import { StarTreeTableNode } from '@star-ng/ui/data-display';

/**
 * Sample data for the tree table examples: fictional projects with their tasks, and folders whose
 * children load later. The data is deterministic (no random values) and needs no network.
 */

const task = (key: string, name: string, owner: string, hours: number): StarTreeTableNode => ({
  key,
  label: name,
  data: { name, owner, hours },
});

/** Eight projects, each with tasks; some tasks have subtasks. */
export const PROJECTS: readonly StarTreeTableNode[] = [
  {
    key: 'website',
    label: 'Website relaunch',
    data: { name: 'Website relaunch', owner: 'Kim', hours: 120 },
    children: [
      task('website-design', 'Page design', 'Ana', 40),
      {
        key: 'website-content',
        label: 'Content',
        data: { name: 'Content', owner: 'Lee', hours: 50 },
        children: [
          task('website-texts', 'Texts', 'Lee', 30),
          task('website-images', 'Images', 'Ana', 20),
        ],
      },
      task('website-launch', 'Launch', 'Kim', 30),
    ],
  },
  {
    key: 'shop',
    label: 'Order portal',
    data: { name: 'Order portal', owner: 'Lee', hours: 96 },
    children: [task('shop-cart', 'Cart', 'Max', 56), task('shop-invoices', 'Invoices', 'Lee', 40)],
  },
  {
    key: 'app',
    label: 'Field app',
    data: { name: 'Field app', owner: 'Ana', hours: 210 },
    children: [
      task('app-offline', 'Offline mode', 'Max', 90),
      task('app-maps', 'Maps', 'Ana', 70),
      task('app-tests', 'Tests', 'Kim', 50),
    ],
  },
  {
    key: 'office',
    label: 'Office move',
    data: { name: 'Office move', owner: 'Max', hours: 64 },
    children: [
      task('office-plan', 'Floor plan', 'Max', 24),
      task('office-it', 'Network', 'Lee', 40),
    ],
  },
  {
    key: 'report',
    label: 'Annual report',
    data: { name: 'Annual report', owner: 'Kim', hours: 48 },
    children: [
      task('report-figures', 'Figures', 'Kim', 28),
      task('report-print', 'Print', 'Ana', 20),
    ],
  },
  {
    key: 'training',
    label: 'Staff training',
    data: { name: 'Staff training', owner: 'Ana', hours: 36 },
    children: [
      task('training-slides', 'Slides', 'Ana', 16),
      task('training-days', 'Sessions', 'Max', 20),
    ],
  },
  {
    key: 'archive',
    label: 'Archive cleanup',
    data: { name: 'Archive cleanup', owner: 'Lee', hours: 20 },
  },
  {
    key: 'survey',
    label: 'Customer survey',
    data: { name: 'Customer survey', owner: 'Max', hours: 30 },
    children: [
      task('survey-form', 'Form', 'Max', 12),
      task('survey-results', 'Results', 'Kim', 18),
    ],
  },
];

/** Top-level folders of the lazy example. `leaf: false`: the children load when a folder opens. */
export const FOLDERS: readonly StarTreeTableNode[] = [
  { key: 'invoices', label: 'Invoices', data: { name: 'Invoices', files: 24 }, leaf: false },
  { key: 'orders', label: 'Orders', data: { name: 'Orders', files: 18 }, leaf: false },
  { key: 'readme', label: 'Read me', data: { name: 'Read me', files: 1 }, leaf: true },
];

/**
 * Fake server call: the children of a folder after a short delay. The years are subfolders that
 * load lazily too; the months are leaves.
 */
export function loadFolderChildren(key: string): Promise<StarTreeTableNode[]> {
  const depth = key.split('/').length;
  const children: StarTreeTableNode[] =
    depth === 1
      ? ['2025', '2026'].map((year) => ({
          key: `${key}/${year}`,
          label: year,
          data: { name: year, files: 12 },
          leaf: false,
        }))
      : ['January', 'February', 'March'].map((month) => ({
          key: `${key}/${month}`,
          label: month,
          data: { name: month, files: 4 },
          leaf: true,
        }));
  return new Promise((resolve) => setTimeout(() => resolve(children), 600));
}

/** Copy of the nodes with the node `key` changed by `change` (the nodes stay immutable). */
export function updateNode(
  nodes: readonly StarTreeTableNode[],
  key: string,
  change: (node: StarTreeTableNode) => StarTreeTableNode,
): StarTreeTableNode[] {
  return nodes.map((node) => {
    if (node.key === key) return change(node);
    return node.children ? { ...node, children: updateNode(node.children, key, change) } : node;
  });
}
