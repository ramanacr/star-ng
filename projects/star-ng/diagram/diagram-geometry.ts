// Pure geometry of `star-diagram`: snap, resize, hit tests, bounds, zoom, keyboard neighbours,
// ports and edge routing. Diagram coordinates are never mirrored for right-to-left pages.

export interface StarDiagramPoint {
  readonly x: number;
  readonly y: number;
}

export interface StarDiagramRect extends StarDiagramPoint {
  readonly width: number;
  readonly height: number;
}

/** Side of a node. */
export type StarDiagramSide = 'top' | 'right' | 'bottom' | 'left';

/** A connection point on a side of a node. `offset` runs from 0 to 1 along the side (default 0.5). */
export interface StarDiagramPort {
  readonly id: string;
  readonly side: StarDiagramSide;
  readonly offset?: number;
}

export type StarDiagramShape = 'rect' | 'rounded' | 'ellipse' | 'diamond';

/** A node of the diagram. Position and size are in diagram units (pixels at zoom 1). */
export interface StarDiagramNode extends StarDiagramRect {
  readonly id: string;
  readonly shape: StarDiagramShape;
  readonly label: string;
  /** Connection points. Default: one in the middle of each side, with the side as id. */
  readonly ports?: readonly StarDiagramPort[];
}

/** A connection between two nodes. */
export interface StarDiagramEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly fromPort?: string;
  readonly toPort?: string;
  readonly label?: string;
  readonly routing: 'straight' | 'orthogonal';
  /** Arrow heads. Default `'end'`. */
  readonly arrow?: 'end' | 'both' | 'none';
}

/** Pan and zoom: a diagram point `p` shows at `p * zoom + (x, y)` in the canvas. */
export interface StarDiagramView {
  readonly zoom: number;
  readonly x: number;
  readonly y: number;
}

/** Resize handle: a side or a corner. */
export type StarDiagramHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type StarDiagramDirection = 'up' | 'down' | 'left' | 'right';

/** The nearest multiple of `grid`; the value itself when there is no grid. */
export function starSnap(value: number, grid: number): number {
  return grid > 0 ? Math.round(value / grid) * grid : value;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * The rectangle after dragging `handle` by `dx`, `dy`. The moving edges snap to the grid; the
 * opposite edges stay. Width and height never go below `min`.
 */
export function starResizeRect(
  rect: StarDiagramRect,
  handle: StarDiagramHandle,
  dx: number,
  dy: number,
  grid: number,
  min = 20,
): StarDiagramRect {
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;
  if (handle.includes('e')) right = Math.max(left + min, starSnap(right + dx, grid));
  if (handle.includes('w')) left = Math.min(right - min, starSnap(left + dx, grid));
  if (handle.includes('s')) bottom = Math.max(top + min, starSnap(bottom + dy, grid));
  if (handle.includes('n')) top = Math.min(bottom - min, starSnap(top + dy, grid));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function contains(rect: StarDiagramRect, point: StarDiagramPoint): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/** The topmost node (the last one drawn) under a point, or `null`. */
export function starNodeAt(
  nodes: readonly StarDiagramNode[],
  point: StarDiagramPoint,
): string | null {
  for (let i = nodes.length - 1; i >= 0; i--) if (contains(nodes[i], point)) return nodes[i].id;
  return null;
}

/** Ids of the nodes completely inside a rectangle (marquee selection). */
export function starNodesInRect(
  nodes: readonly StarDiagramNode[],
  rect: StarDiagramRect,
): string[] {
  const box = starNormaliseRect(rect);
  return nodes
    .filter(
      (n) =>
        n.x >= box.x &&
        n.y >= box.y &&
        n.x + n.width <= box.x + box.width &&
        n.y + n.height <= box.y + box.height,
    )
    .map((n) => n.id);
}

/** A rectangle with a positive width and height (a marquee can be dragged in any direction). */
export function starNormaliseRect(rect: StarDiagramRect): StarDiagramRect {
  const x = Math.min(rect.x, rect.x + rect.width);
  const y = Math.min(rect.y, rect.y + rect.height);
  return { x, y, width: Math.abs(rect.width), height: Math.abs(rect.height) };
}

/** The box around all nodes, or `null` without nodes. */
export function starContentBounds(nodes: readonly StarDiagramRect[]): StarDiagramRect | null {
  if (!nodes.length) return null;
  const left = Math.min(...nodes.map((n) => n.x));
  const top = Math.min(...nodes.map((n) => n.y));
  const right = Math.max(...nodes.map((n) => n.x + n.width));
  const bottom = Math.max(...nodes.map((n) => n.y + n.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** The view that shows `bounds` centred in the viewport with `padding`, zoom within `min`–`max`. */
export function starFitView(
  bounds: StarDiagramRect,
  viewport: { readonly width: number; readonly height: number },
  padding: number,
  min: number,
  max: number,
): StarDiagramView {
  const width = Math.max(1, viewport.width - 2 * padding);
  const height = Math.max(1, viewport.height - 2 * padding);
  const zoom = clamp(
    Math.min(width / Math.max(1, bounds.width), height / Math.max(1, bounds.height)),
    min,
    max,
  );
  return {
    zoom,
    x: (viewport.width - bounds.width * zoom) / 2 - bounds.x * zoom,
    y: (viewport.height - bounds.height * zoom) / 2 - bounds.y * zoom,
  };
}

/** The view after zooming to `zoom` while the canvas point `at` stays where it is. */
export function starZoomAt(
  view: StarDiagramView,
  zoom: number,
  at: StarDiagramPoint,
  min: number,
  max: number,
): StarDiagramView {
  const next = clamp(zoom, min, max);
  const dx = (at.x - view.x) / view.zoom;
  const dy = (at.y - view.y) / view.zoom;
  return { zoom: next, x: at.x - dx * next, y: at.y - dy * next };
}

const center = (n: StarDiagramRect): StarDiagramPoint => ({
  x: n.x + n.width / 2,
  y: n.y + n.height / 2,
});

/**
 * The node that the arrow key `direction` goes to from `fromId`: the nearest centre in that
 * direction, where a sideways offset counts twice.
 */
export function starNearestNode(
  nodes: readonly StarDiagramNode[],
  fromId: string,
  direction: StarDiagramDirection,
): string | null {
  const from = nodes.find((n) => n.id === fromId);
  if (!from) return null;
  const c = center(from);
  let best: string | null = null;
  let bestScore = Infinity;
  for (const n of nodes) {
    if (n.id === fromId) continue;
    const p = center(n);
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const [primary, secondary] =
      direction === 'right'
        ? [dx, dy]
        : direction === 'left'
          ? [-dx, dy]
          : direction === 'down'
            ? [dy, dx]
            : [-dy, dx];
    if (primary <= 0) continue;
    const score = primary + 2 * Math.abs(secondary);
    if (score < bestScore) {
      bestScore = score;
      best = n.id;
    }
  }
  return best;
}

/** The default ports: the middle of each side, named after the side. */
export const STAR_DIAGRAM_DEFAULT_PORTS: readonly StarDiagramPort[] = [
  { id: 'top', side: 'top' },
  { id: 'right', side: 'right' },
  { id: 'bottom', side: 'bottom' },
  { id: 'left', side: 'left' },
];

/** The ports of a node (its own or the defaults). */
export function starPortsOf(node: StarDiagramNode): readonly StarDiagramPort[] {
  return node.ports?.length ? node.ports : STAR_DIAGRAM_DEFAULT_PORTS;
}

/** Position of a port on its node. */
export function starPortPoint(node: StarDiagramRect, port: StarDiagramPort): StarDiagramPoint {
  const t = port.offset ?? 0.5;
  switch (port.side) {
    case 'top':
      return { x: node.x + node.width * t, y: node.y };
    case 'bottom':
      return { x: node.x + node.width * t, y: node.y + node.height };
    case 'left':
      return { x: node.x, y: node.y + node.height * t };
    default:
      return { x: node.x + node.width, y: node.y + node.height * t };
  }
}

/** The side of `node` that faces `toward`. */
export function starFacingSide(node: StarDiagramRect, toward: StarDiagramPoint): StarDiagramSide {
  const c = center(node);
  const dx = (toward.x - c.x) / Math.max(1, node.width);
  const dy = (toward.y - c.y) / Math.max(1, node.height);
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top';
}

/** The point where the line from the centre of a node toward `toward` leaves its shape. */
export function starShapeBorderPoint(
  node: StarDiagramNode,
  toward: StarDiagramPoint,
): StarDiagramPoint {
  const c = center(node);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (!dx && !dy) return c;
  const a = node.width / 2;
  const b = node.height / 2;
  let t: number;
  if (node.shape === 'ellipse') t = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b));
  else if (node.shape === 'diamond') t = 1 / (Math.abs(dx) / a + Math.abs(dy) / b);
  else t = Math.min(dx ? a / Math.abs(dx) : Infinity, dy ? b / Math.abs(dy) : Infinity);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

const STEP: Record<StarDiagramSide, StarDiagramPoint> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

/** True when an axis-aligned polyline passes through the inside of `rect`. */
export function starSegmentsCross(
  points: readonly StarDiagramPoint[],
  rect: StarDiagramRect,
): boolean {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1];
    const q = points[i];
    if (p.y === q.y) {
      if (
        p.y > top &&
        p.y < bottom &&
        Math.max(Math.min(p.x, q.x), left) < Math.min(Math.max(p.x, q.x), right)
      ) {
        return true;
      }
    } else if (p.x === q.x) {
      if (
        p.x > left &&
        p.x < right &&
        Math.max(Math.min(p.y, q.y), top) < Math.min(Math.max(p.y, q.y), bottom)
      ) {
        return true;
      }
    } else {
      // A slanted segment: check its bounding box.
      const box = {
        x: Math.min(p.x, q.x),
        y: Math.min(p.y, q.y),
        width: Math.abs(p.x - q.x),
        height: Math.abs(p.y - q.y),
      };
      if (box.x < right && box.x + box.width > left && box.y < bottom && box.y + box.height > top) {
        return true;
      }
    }
  }
  return false;
}

/** Removes repeated points and the middle point of three in a line. */
function simplify(points: readonly StarDiagramPoint[]): StarDiagramPoint[] {
  const out: StarDiagramPoint[] = [];
  for (const p of points) {
    const last = out.at(-1);
    if (last && last.x === p.x && last.y === p.y) continue;
    const before = out.at(-2);
    if (
      before &&
      last &&
      ((before.x === last.x && last.x === p.x) || (before.y === last.y && last.y === p.y))
    ) {
      out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out;
}

function length(points: readonly StarDiagramPoint[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    sum += Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
  }
  return sum;
}

/**
 * An orthogonal route from `start` (leaving through `startSide`) to `end` (entering through
 * `endSide`). It tries L, Z and U shapes and detours along the edges of the obstacles, and takes
 * the shortest one that crosses no obstacle (bends cost extra). Simple cases only: when every
 * route crosses something, the shortest route wins.
 */
export function starRouteOrthogonal(
  start: StarDiagramPoint,
  startSide: StarDiagramSide,
  end: StarDiagramPoint,
  endSide: StarDiagramSide,
  obstacles: readonly StarDiagramRect[],
  margin = 16,
): StarDiagramPoint[] {
  const a = { x: start.x + STEP[startSide].x * margin, y: start.y + STEP[startSide].y * margin };
  const b = { x: end.x + STEP[endSide].x * margin, y: end.y + STEP[endSide].y * margin };
  const inflated = obstacles.map((r) => ({
    x: r.x - margin / 2,
    y: r.y - margin / 2,
    width: r.width + margin,
    height: r.height + margin,
  }));
  const xs = new Set([(a.x + b.x) / 2]);
  const ys = new Set([(a.y + b.y) / 2]);
  for (const r of obstacles) {
    xs.add(r.x - margin).add(r.x + r.width + margin);
    ys.add(r.y - margin).add(r.y + r.height + margin);
  }
  const middles: StarDiagramPoint[][] = [
    [{ x: b.x, y: a.y }],
    [{ x: a.x, y: b.y }],
    ...[...xs].map((x) => [
      { x, y: a.y },
      { x, y: b.y },
    ]),
    ...[...ys].map((y) => [
      { x: a.x, y },
      { x: b.x, y },
    ]),
  ];
  let best: StarDiagramPoint[] | null = null;
  let bestScore = Infinity;
  let fallback: StarDiagramPoint[] | null = null;
  let fallbackScore = Infinity;
  for (const middle of middles) {
    const inner = simplify([a, ...middle, b]);
    const full = simplify([start, ...inner, end]);
    const score = length(full) + 20 * (full.length - 2);
    if (score < fallbackScore) {
      fallbackScore = score;
      fallback = full;
    }
    if (inflated.some((r) => starSegmentsCross(inner, r))) continue;
    if (score < bestScore) {
      bestScore = score;
      best = full;
    }
  }
  return best ?? fallback ?? [start, end];
}

/** The node and port point at one end of an edge. */
function endpoint(
  node: StarDiagramNode,
  portId: string | undefined,
): { point: StarDiagramPoint; side: StarDiagramSide } | null {
  const port = portId ? starPortsOf(node).find((p) => p.id === portId) : undefined;
  if (!port) return null;
  return { point: starPortPoint(node, port), side: port.side };
}

/**
 * The points of an edge. Without ports, a straight edge runs between the shape borders on the
 * line between the centres, and an orthogonal edge uses the sides that face each other. The
 * other nodes are the obstacles of an orthogonal route.
 */
export function starEdgePoints(
  edge: StarDiagramEdge,
  nodes: readonly StarDiagramNode[],
): StarDiagramPoint[] {
  const from = nodes.find((n) => n.id === edge.from);
  const to = nodes.find((n) => n.id === edge.to);
  if (!from || !to) return [];
  const fromEnd = endpoint(from, edge.fromPort);
  const toEnd = endpoint(to, edge.toPort);
  if (edge.routing === 'straight') {
    const p = fromEnd?.point ?? starShapeBorderPoint(from, toEnd?.point ?? center(to));
    const q = toEnd?.point ?? starShapeBorderPoint(to, fromEnd?.point ?? center(from));
    return [p, q];
  }
  const startSide = fromEnd?.side ?? starFacingSide(from, center(to));
  const endSide = toEnd?.side ?? starFacingSide(to, center(from));
  const start = fromEnd?.point ?? starPortPoint(from, { id: startSide, side: startSide });
  const end = toEnd?.point ?? starPortPoint(to, { id: endSide, side: endSide });
  const obstacles = nodes.filter((n) => n.id !== from.id && n.id !== to.id);
  return starRouteOrthogonal(start, startSide, end, endSide, [...obstacles, from, to]);
}

/** SVG path data of a polyline. */
export function starPathData(points: readonly StarDiagramPoint[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${round(p.x)} ${round(p.y)}`).join(' ');
}

const round = (value: number) => Math.round(value * 100) / 100;

/** The point halfway along a polyline (where its label goes). */
export function starPathMidpoint(points: readonly StarDiagramPoint[]): StarDiagramPoint {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };
  const total = points
    .slice(1)
    .reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);
  let left = total / 2;
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1];
    const q = points[i];
    const part = Math.hypot(q.x - p.x, q.y - p.y);
    if (part >= left) {
      const t = part ? left / part : 0;
      return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
    }
    left -= part;
  }
  return points.at(-1)!;
}

/** SVG path data of a node shape. */
export function starShapePath(node: StarDiagramNode): string {
  const { x, y, width: w, height: h } = node;
  switch (node.shape) {
    case 'diamond':
      return `M${x + w / 2} ${y} L${x + w} ${y + h / 2} L${x + w / 2} ${y + h} L${x} ${y + h / 2} Z`;
    case 'ellipse': {
      const rx = w / 2;
      const ry = h / 2;
      return `M${x} ${y + ry} A${rx} ${ry} 0 1 0 ${x + w} ${y + ry} A${rx} ${ry} 0 1 0 ${x} ${y + ry} Z`;
    }
    case 'rounded': {
      const r = Math.min(12, w / 4, h / 4);
      return `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;
    }
    default:
      return `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
  }
}
