// Pure layout helpers of `star-diagram`. They return moved copies of the nodes; apply them with
// `StarDiagram.applyLayout()` (undoable) or set them as the new nodes.
import type { StarDiagramEdge, StarDiagramNode, StarDiagramPoint } from './diagram-geometry';

/** Options of `starLayoutTree`. */
export interface StarDiagramTreeLayoutOptions {
  /** `'down'`: layers from top to bottom (default). `'right'`: layers from left to right. */
  readonly direction?: 'down' | 'right';
  /** Space between neighbours of one layer (down) or between layers (right). Default 40. */
  readonly gapX?: number;
  /** Space between layers (down) or between neighbours of one layer (right). Default 60. */
  readonly gapY?: number;
  /** Top-left corner of the layout. Default `{ x: 0, y: 0 }`. */
  readonly origin?: StarDiagramPoint;
}

/**
 * Layered tree layout (DevExtreme `autoLayout: 'tree'`, Syncfusion `HierarchicalTree`). Roots are
 * the nodes without incoming edges; each node hangs under the first parent that reaches it, so
 * other edges (a graph that is not a tree) do not change the layout. A parent is centred over
 * its children. Nodes that no root reaches become extra roots.
 */
export function starLayoutTree(
  nodes: readonly StarDiagramNode[],
  edges: readonly StarDiagramEdge[],
  options: StarDiagramTreeLayoutOptions = {},
): StarDiagramNode[] {
  const down = (options.direction ?? 'down') === 'down';
  const gapX = options.gapX ?? 40;
  const gapY = options.gapY ?? 60;
  const origin = options.origin ?? { x: 0, y: 0 };
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const targets = new Map<string, string[]>();
  const incoming = new Set<string>();
  for (const edge of edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to) || edge.from === edge.to) continue;
    targets.set(edge.from, [...(targets.get(edge.from) ?? []), edge.to]);
    incoming.add(edge.to);
  }
  const roots = nodes.filter((n) => !incoming.has(n.id)).map((n) => n.id);
  if (!roots.length && nodes.length) roots.push(nodes[0].id);

  // Spanning tree, breadth first.
  const children = new Map<string, string[]>();
  const depth = new Map<string, number>();
  const order: string[] = [];
  const visit = (root: string) => {
    if (depth.has(root)) return;
    depth.set(root, 0);
    order.push(root);
    const queue = [root];
    while (queue.length) {
      const id = queue.shift()!;
      for (const child of targets.get(id) ?? []) {
        if (depth.has(child)) continue;
        depth.set(child, depth.get(id)! + 1);
        children.set(id, [...(children.get(id) ?? []), child]);
        queue.push(child);
      }
    }
  };
  roots.forEach(visit);
  for (const n of nodes) if (!depth.has(n.id)) visit(n.id);
  const allRoots = order;

  // Breadth: the size across the layers; extent: the size along them.
  const breadth = (n: StarDiagramNode) => (down ? n.width : n.height);
  const extent = (n: StarDiagramNode) => (down ? n.height : n.width);
  const gapBreadth = down ? gapX : gapY;
  const gapLayer = down ? gapY : gapX;

  const layerSize: number[] = [];
  for (const [id, d] of depth) layerSize[d] = Math.max(layerSize[d] ?? 0, extent(byId.get(id)!));
  const layerStart: number[] = [];
  layerSize.forEach((size, d) => {
    layerStart[d] = d === 0 ? 0 : layerStart[d - 1] + layerSize[d - 1] + gapLayer;
  });

  const span = new Map<string, number>();
  const measure = (id: string): number => {
    const kids = children.get(id) ?? [];
    const kidsSpan = kids.reduce((sum, kid, i) => sum + measure(kid) + (i ? gapBreadth : 0), 0);
    const size = Math.max(breadth(byId.get(id)!), kidsSpan);
    span.set(id, size);
    return size;
  };

  const along = new Map<string, number>();
  const place = (id: string, start: number) => {
    const size = span.get(id)!;
    const node = byId.get(id)!;
    along.set(id, start + (size - breadth(node)) / 2);
    const kids = children.get(id) ?? [];
    const kidsSpan = kids.reduce((sum, kid, i) => sum + span.get(kid)! + (i ? gapBreadth : 0), 0);
    let cursor = start + (size - kidsSpan) / 2;
    for (const kid of kids) {
      place(kid, cursor);
      cursor += span.get(kid)! + gapBreadth;
    }
  };
  let cursor = 0;
  for (const root of allRoots) {
    measure(root);
    place(root, cursor);
    cursor += span.get(root)! + gapBreadth;
  }

  return nodes.map((n) => {
    const across = along.get(n.id)!;
    const layer = layerStart[depth.get(n.id)!];
    return down
      ? { ...n, x: origin.x + across, y: origin.y + layer }
      : { ...n, x: origin.x + layer, y: origin.y + across };
  });
}

/** Options of `starLayoutGrid`. */
export interface StarDiagramGridLayoutOptions {
  /** Columns. Default: the square root of the node count, rounded up. */
  readonly columns?: number;
  readonly gapX?: number;
  readonly gapY?: number;
  readonly origin?: StarDiagramPoint;
}

/** Grid layout: the nodes in order, row by row, in cells as large as the largest node. */
export function starLayoutGrid(
  nodes: readonly StarDiagramNode[],
  options: StarDiagramGridLayoutOptions = {},
): StarDiagramNode[] {
  const columns = Math.max(1, options.columns ?? Math.ceil(Math.sqrt(nodes.length)));
  const gapX = options.gapX ?? 40;
  const gapY = options.gapY ?? 40;
  const origin = options.origin ?? { x: 0, y: 0 };
  const cellWidth = Math.max(0, ...nodes.map((n) => n.width));
  const cellHeight = Math.max(0, ...nodes.map((n) => n.height));
  return nodes.map((n, i) => ({
    ...n,
    x: origin.x + (i % columns) * (cellWidth + gapX),
    y: origin.y + Math.floor(i / columns) * (cellHeight + gapY),
  }));
}
