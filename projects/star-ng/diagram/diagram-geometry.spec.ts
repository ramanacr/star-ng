import {
  StarDiagramEdge,
  StarDiagramNode,
  starContentBounds,
  starEdgePoints,
  starFitView,
  starNearestNode,
  starNodeAt,
  starNodesInRect,
  starPathMidpoint,
  starPortPoint,
  starResizeRect,
  starRouteOrthogonal,
  starSegmentsCross,
  starSnap,
  starZoomAt,
} from './diagram-geometry';
import { StarDiagramHistory, starApplyPatches, starInvertPatches } from './diagram-history';
import { starLayoutGrid, starLayoutTree } from './diagram-layout';

const node = (id: string, x: number, y: number, width = 100, height = 40): StarDiagramNode => ({
  id,
  x,
  y,
  width,
  height,
  shape: 'rect',
  label: id,
});

describe('diagram geometry', () => {
  it('snaps to the grid, and not without one', () => {
    expect(starSnap(23, 20)).toBe(20);
    expect(starSnap(31, 20)).toBe(40);
    expect(starSnap(-11, 20)).toBe(-20);
    expect(starSnap(23, 0)).toBe(23);
  });

  it('resizes from every handle, snaps the moving edges and keeps a minimum size', () => {
    const rect = { x: 100, y: 100, width: 100, height: 60 };
    expect(starResizeRect(rect, 'se', 33, 18, 20)).toEqual({
      x: 100,
      y: 100,
      width: 140,
      height: 80,
    });
    expect(starResizeRect(rect, 'nw', -21, -38, 20)).toEqual({
      x: 80,
      y: 60,
      width: 120,
      height: 100,
    });
    expect(starResizeRect(rect, 'e', -500, 0, 0)).toEqual({
      x: 100,
      y: 100,
      width: 20,
      height: 60,
    });
    expect(starResizeRect(rect, 'n', 0, 500, 0, 30)).toEqual({
      x: 100,
      y: 130,
      width: 100,
      height: 30,
    });
  });

  it('finds the topmost node at a point and the nodes inside a marquee', () => {
    const nodes = [node('a', 0, 0), node('b', 50, 20), node('c', 300, 300)];
    expect(starNodeAt(nodes, { x: 60, y: 30 })).toBe('b');
    expect(starNodeAt(nodes, { x: 5, y: 5 })).toBe('a');
    expect(starNodeAt(nodes, { x: 250, y: 5 })).toBeNull();
    expect(starNodesInRect(nodes, { x: -10, y: -10, width: 200, height: 100 })).toEqual(['a', 'b']);
  });

  it('computes the bounds, fits the view and zooms about a point', () => {
    const nodes = [node('a', 100, 100), node('b', 300, 200)];
    expect(starContentBounds(nodes)).toEqual({ x: 100, y: 100, width: 300, height: 140 });
    expect(starContentBounds([])).toBeNull();
    const view = starFitView(
      { x: 100, y: 100, width: 300, height: 140 },
      { width: 640, height: 320 },
      20,
      0.25,
      2,
    );
    expect(view.zoom).toBeCloseTo(2);
    expect(view.x).toBeCloseTo((640 - 600) / 2 - 200);
    const zoomed = starZoomAt({ zoom: 1, x: 0, y: 0 }, 2, { x: 100, y: 50 }, 0.25, 4);
    expect(zoomed).toEqual({ zoom: 2, x: -100, y: -50 });
    // The point under the pointer stays in place.
    expect((100 - zoomed.x) / zoomed.zoom).toBe(100);
    expect(starZoomAt({ zoom: 1, x: 0, y: 0 }, 9, { x: 0, y: 0 }, 0.25, 4).zoom).toBe(4);
  });

  it('finds the nearest node in a direction', () => {
    const nodes = [node('a', 0, 0), node('b', 200, 10), node('c', 200, 300), node('d', 0, 200)];
    expect(starNearestNode(nodes, 'a', 'right')).toBe('b');
    expect(starNearestNode(nodes, 'a', 'down')).toBe('d');
    expect(starNearestNode(nodes, 'a', 'left')).toBeNull();
    expect(starNearestNode(nodes, 'c', 'up')).toBe('b');
  });

  it('places ports on the sides of a node', () => {
    const box = node('a', 0, 0, 100, 40);
    expect(starPortPoint(box, { id: 'r', side: 'right' })).toEqual({ x: 100, y: 20 });
    expect(starPortPoint(box, { id: 't', side: 'top', offset: 0.25 })).toEqual({ x: 25, y: 0 });
  });

  it('routes orthogonal edges around a node in the way', () => {
    const points = starRouteOrthogonal({ x: 100, y: 20 }, 'right', { x: 400, y: 20 }, 'left', [
      { x: 200, y: 0, width: 100, height: 40 },
    ]);
    // Every segment is horizontal or vertical.
    for (let i = 1; i < points.length; i++) {
      expect(points[i].x === points[i - 1].x || points[i].y === points[i - 1].y).toBe(true);
    }
    expect(points[0]).toEqual({ x: 100, y: 20 });
    expect(points.at(-1)).toEqual({ x: 400, y: 20 });
    // No segment crosses the node in the middle.
    expect(starSegmentsCross(points, { x: 200, y: 0, width: 100, height: 40 })).toBe(false);
    // A free line stays straight.
    expect(starRouteOrthogonal({ x: 100, y: 20 }, 'right', { x: 400, y: 20 }, 'left', [])).toEqual([
      { x: 100, y: 20 },
      { x: 400, y: 20 },
    ]);
  });

  it('gives straight and orthogonal edge points from node sides', () => {
    const nodes = [node('a', 0, 0), node('b', 300, 200)];
    const straight = starEdgePoints({ id: 'e', from: 'a', to: 'b', routing: 'straight' }, nodes);
    expect(straight.length).toBe(2);
    expect(straight[0].x).toBeGreaterThanOrEqual(0);
    expect(straight[0].x).toBeLessThanOrEqual(100);
    const ortho = starEdgePoints(
      { id: 'e', from: 'a', to: 'b', fromPort: 'right', toPort: 'left', routing: 'orthogonal' },
      nodes,
    );
    expect(ortho[0]).toEqual({ x: 100, y: 20 });
    expect(ortho.at(-1)).toEqual({ x: 300, y: 220 });
    expect(
      starPathMidpoint([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ]),
    ).toEqual({ x: 100, y: 0 });
  });
});

describe('diagram layouts', () => {
  const nodes = [node('root', 0, 0), node('left', 0, 0), node('right', 0, 0), node('leaf', 0, 0)];
  const edges = [
    { id: '1', from: 'root', to: 'left', routing: 'orthogonal' as const },
    { id: '2', from: 'root', to: 'right', routing: 'orthogonal' as const },
    { id: '3', from: 'left', to: 'leaf', routing: 'orthogonal' as const },
  ];

  it('lays out a tree top down with the parent centred over its children', () => {
    const laid = new Map(
      starLayoutTree(nodes, edges, { gapX: 20, gapY: 40 }).map((n) => [n.id, n]),
    );
    expect(laid.get('root')!.y).toBe(0);
    expect(laid.get('left')!.y).toBe(80);
    expect(laid.get('leaf')!.y).toBe(160);
    expect(laid.get('left')!.x).toBe(0);
    expect(laid.get('right')!.x).toBe(120);
    expect(laid.get('root')!.x).toBe(60);
  });

  it('lays out a tree left to right', () => {
    const laid = new Map(
      starLayoutTree(nodes, edges, { direction: 'right', gapX: 40, gapY: 20 }).map((n) => [
        n.id,
        n,
      ]),
    );
    expect(laid.get('root')!.x).toBe(0);
    expect(laid.get('left')!.x).toBe(140);
    expect(laid.get('leaf')!.x).toBe(280);
    expect(laid.get('right')!.y).toBe(60);
  });

  it('lays out a grid', () => {
    const laid = starLayoutGrid(nodes, { columns: 2, gapX: 10, gapY: 10, origin: { x: 5, y: 5 } });
    expect(laid.map((n) => [n.x, n.y])).toEqual([
      [5, 5],
      [115, 5],
      [5, 55],
      [115, 55],
    ]);
  });
});

describe('diagram history', () => {
  const a = node('a', 0, 0);

  it('applies and inverts patches', () => {
    const patches = [
      { type: 'update' as const, id: 'a', before: { x: 0 }, after: { x: 40 } },
      { type: 'add' as const, item: node('b', 1, 1) },
    ];
    const next = starApplyPatches([a], patches);
    expect(next.map((n) => [n.id, n.x])).toEqual([
      ['a', 40],
      ['b', 1],
    ]);
    expect(starApplyPatches(next, starInvertPatches(patches))).toEqual([a]);
  });

  it('undoes and redoes transactions', () => {
    const history = new StarDiagramHistory<StarDiagramNode, StarDiagramEdge>();
    expect(history.canUndo()).toBe(false);
    const tx = {
      nodes: [{ type: 'update' as const, id: 'a', before: { x: 0 }, after: { x: 20 } }],
      edges: [],
    };
    history.push(tx);
    expect(history.canUndo()).toBe(true);
    expect(history.peekUndo()).toBe(tx);
    history.commitUndo();
    expect(history.canUndo()).toBe(false);
    expect(history.peekRedo()).toBe(tx);
    history.commitRedo();
    expect(history.canUndo()).toBe(true);
    history.commitUndo();
    history.push(tx);
    expect(history.canRedo()).toBe(false);
  });
});
