/**
 * Pure geometry of `star-map`: projections, GeoJSON parsing, view maths (fit, zoom around a
 * point, screen and world points), reading order, value classes, bubble sizes and tile ranges.
 * Nothing here touches the DOM.
 *
 * World coordinates: the projected map at zoom 0, in pixels. The Web Mercator world is
 * 256 × 256 (the size of a web map tile); the equirectangular world is 256 × 128. At zoom `z` one
 * world pixel is `2^z` screen pixels.
 */

/** Map projection of `star-map`. */
export type StarMapProjection = 'mercator' | 'equirectangular';

/** A geographic position: longitude, then latitude, in degrees (the GeoJSON order). */
export type StarLonLat = readonly [number, number];

/** A point in world or screen pixels. */
export type StarMapPoint = readonly [number, number];

/** A box in world pixels. */
export interface StarMapBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** A view of the map: the world point in the middle and the zoom level. */
export interface StarMapView {
  readonly center: StarMapPoint;
  readonly zoom: number;
}

/** A size in screen pixels. */
export interface StarMapSize {
  readonly width: number;
  readonly height: number;
}

/** Width of the world at zoom 0, in pixels: the size of a web map tile. */
export const STAR_MAP_TILE_SIZE = 256;
/** The latitude where the Web Mercator world is square. */
export const STAR_MAP_MAX_LATITUDE = 85.0511287798066;

type Position = readonly number[];

/** A GeoJSON geometry that `star-map` draws. */
export type StarGeoJsonGeometry =
  | { readonly type: 'Point'; readonly coordinates: Position }
  | { readonly type: 'MultiPoint'; readonly coordinates: readonly Position[] }
  | { readonly type: 'LineString'; readonly coordinates: readonly Position[] }
  | { readonly type: 'MultiLineString'; readonly coordinates: readonly (readonly Position[])[] }
  | { readonly type: 'Polygon'; readonly coordinates: readonly (readonly Position[])[] }
  | {
      readonly type: 'MultiPolygon';
      readonly coordinates: readonly (readonly (readonly Position[])[])[];
    };

/** A GeoJSON feature. */
export interface StarGeoJsonFeature<P = Record<string, unknown>> {
  readonly type: 'Feature';
  readonly id?: string | number;
  readonly properties: P | null;
  readonly geometry: StarGeoJsonGeometry | null;
}

/** A GeoJSON feature collection. */
export interface StarGeoJsonFeatureCollection<P = Record<string, unknown>> {
  readonly type: 'FeatureCollection';
  readonly features: readonly StarGeoJsonFeature<P>[];
}

/** A feature projected to world pixels. */
export interface StarMapShape<P = Record<string, unknown>> {
  /** Index of the feature in the collection. */
  readonly index: number;
  /** `area`: polygons; `line`: line strings; `point`: points. */
  readonly kind: 'area' | 'line' | 'point';
  /** Polygons: every ring (outer rings and holes); lines: each line; points: one ring per point. */
  readonly rings: readonly (readonly StarMapPoint[])[];
  readonly bounds: StarMapBounds;
  /** A point for the label, the focus order, the tooltip and a marker: in the largest polygon. */
  readonly centroid: StarMapPoint;
  readonly feature: StarGeoJsonFeature<P>;
}

const RADIANS = Math.PI / 180;

/** Projects a longitude and latitude to world pixels (zoom 0). Pure; exported for owners. */
export function starProject(
  position: StarLonLat,
  projection: StarMapProjection = 'mercator',
): StarMapPoint {
  const [lon, lat] = position;
  const x = ((lon + 180) / 360) * STAR_MAP_TILE_SIZE;
  if (projection === 'equirectangular') {
    return [x, ((90 - lat) / 360) * STAR_MAP_TILE_SIZE];
  }
  const clamped = Math.max(-STAR_MAP_MAX_LATITUDE, Math.min(STAR_MAP_MAX_LATITUDE, lat));
  const sin = Math.sin(clamped * RADIANS);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * STAR_MAP_TILE_SIZE;
  return [x, y];
}

/** The longitude and latitude of a world point: the inverse of `starProject`. */
export function starUnproject(
  point: StarMapPoint,
  projection: StarMapProjection = 'mercator',
): StarLonLat {
  const [x, y] = point;
  const lon = (x / STAR_MAP_TILE_SIZE) * 360 - 180;
  if (projection === 'equirectangular') return [lon, 90 - (y / STAR_MAP_TILE_SIZE) * 360];
  const n = Math.PI - (2 * Math.PI * y) / STAR_MAP_TILE_SIZE;
  return [lon, Math.atan(Math.sinh(n)) / RADIANS];
}

const finite = (position: Position | undefined): position is Position =>
  !!position &&
  position.length >= 2 &&
  Number.isFinite(position[0]) &&
  Number.isFinite(position[1]);

function ring(
  positions: readonly Position[] | undefined,
  projection: StarMapProjection,
): StarMapPoint[] {
  if (!Array.isArray(positions)) return [];
  return positions.filter(finite).map((p) => starProject([p[0], p[1]], projection));
}

/** Signed area of a ring (shoelace formula); positive or negative by winding. */
function ringArea(points: readonly StarMapPoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/** Area centroid of a ring; the mean of its points when it has no area. */
function ringCentroid(points: readonly StarMapPoint[]): StarMapPoint {
  const area = ringArea(points);
  if (Math.abs(area) < 1e-12) {
    const x = points.reduce((s, p) => s + p[0], 0) / points.length;
    const y = points.reduce((s, p) => s + p[1], 0) / points.length;
    return [x, y];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const cross = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  return [cx / (6 * area), cy / (6 * area)];
}

/** Bounds of a list of points. */
export function starMapBoundsOf(points: readonly StarMapPoint[]): StarMapBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** The bounds that hold every given bounds; `null` for an empty list. */
export function starMapUnion(list: readonly StarMapBounds[]): StarMapBounds | null {
  if (!list.length) return null;
  return {
    minX: Math.min(...list.map((b) => b.minX)),
    minY: Math.min(...list.map((b) => b.minY)),
    maxX: Math.max(...list.map((b) => b.maxX)),
    maxY: Math.max(...list.map((b) => b.maxY)),
  };
}

/**
 * Projects the features of a GeoJSON feature collection. Polygons keep their holes (inner
 * rings), multi-geometries keep every part, and features without a usable geometry are left out.
 */
export function starMapParse<P>(
  collection: StarGeoJsonFeatureCollection<P> | null | undefined,
  projection: StarMapProjection = 'mercator',
): StarMapShape<P>[] {
  const shapes: StarMapShape<P>[] = [];
  (collection?.features ?? []).forEach((feature, index) => {
    const geometry = feature?.geometry;
    if (!geometry) return;
    let kind: StarMapShape['kind'];
    let rings: StarMapPoint[][] = [];
    /** The outer rings, for the centroid. */
    let outers: StarMapPoint[][] = [];
    switch (geometry.type) {
      case 'Point':
        kind = 'point';
        rings = finite(geometry.coordinates) ? [ring([geometry.coordinates], projection)] : [];
        break;
      case 'MultiPoint':
        kind = 'point';
        rings = (geometry.coordinates ?? []).filter(finite).map((p) => ring([p], projection));
        break;
      case 'LineString':
        kind = 'line';
        rings = [ring(geometry.coordinates, projection)];
        break;
      case 'MultiLineString':
        kind = 'line';
        rings = (geometry.coordinates ?? []).map((line) => ring(line, projection));
        break;
      case 'Polygon':
        kind = 'area';
        rings = (geometry.coordinates ?? []).map((r) => ring(r, projection));
        outers = rings.slice(0, 1);
        break;
      case 'MultiPolygon':
        kind = 'area';
        for (const polygon of geometry.coordinates ?? []) {
          const parts = (polygon ?? []).map((r) => ring(r, projection));
          rings.push(...parts);
          if (parts[0]) outers.push(parts[0]);
        }
        break;
      default:
        return;
    }
    const minimum = kind === 'area' ? 3 : kind === 'line' ? 2 : 1;
    rings = rings.filter((r) => r.length >= minimum);
    outers = outers.filter((r) => r.length >= minimum);
    if (!rings.length) return;
    const bounds = starMapBoundsOf(rings.flat());
    let centroid: StarMapPoint;
    if (kind === 'area' && outers.length) {
      const largest = outers.reduce((best, r) =>
        Math.abs(ringArea(r)) > Math.abs(ringArea(best)) ? r : best,
      );
      centroid = ringCentroid(largest);
    } else if (kind === 'point') {
      centroid = rings[0][0];
    } else {
      // A line: its middle vertex, so the point lies on the line.
      const longest = rings.reduce((best, r) => (r.length > best.length ? r : best));
      centroid = longest[Math.floor((longest.length - 1) / 2)];
      if (longest.length === 2) {
        centroid = [(longest[0][0] + longest[1][0]) / 2, (longest[0][1] + longest[1][1]) / 2];
      }
    }
    shapes.push({ index, kind, rings, bounds, centroid, feature });
  });
  return shapes;
}

const r2 = (value: number) => Math.round(value * 100) / 100;

/** SVG path data of a shape in world pixels. Areas close every ring (fill with `evenodd`). */
export function starMapPath(shape: StarMapShape<unknown>): string {
  if (shape.kind === 'point') return '';
  const close = shape.kind === 'area' ? 'Z' : '';
  return shape.rings
    .map((points) => `M${points.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L')}${close}`)
    .join('');
}

/** The view that shows `bounds` in `viewport`, with `padding` screen pixels on each side. */
export function starMapFit(
  bounds: StarMapBounds,
  viewport: StarMapSize,
  padding: number,
  minZoom: number,
  maxZoom: number,
): StarMapView {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const room = {
    width: Math.max(1, viewport.width - 2 * padding),
    height: Math.max(1, viewport.height - 2 * padding),
  };
  const scales = [
    width > 0 ? room.width / width : Infinity,
    height > 0 ? room.height / height : Infinity,
  ];
  const scale = Math.min(...scales);
  const zoom = Number.isFinite(scale) ? Math.log2(scale) : maxZoom;
  return {
    center: [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2],
    zoom: Math.max(minZoom, Math.min(maxZoom, zoom)),
  };
}

/** Screen point of a world point in a view. */
export function starMapToScreen(
  point: StarMapPoint,
  view: StarMapView,
  viewport: StarMapSize,
): StarMapPoint {
  const k = 2 ** view.zoom;
  return [
    (point[0] - view.center[0]) * k + viewport.width / 2,
    (point[1] - view.center[1]) * k + viewport.height / 2,
  ];
}

/** World point of a screen point in a view. */
export function starMapToWorld(
  point: StarMapPoint,
  view: StarMapView,
  viewport: StarMapSize,
): StarMapPoint {
  const k = 2 ** view.zoom;
  return [
    view.center[0] + (point[0] - viewport.width / 2) / k,
    view.center[1] + (point[1] - viewport.height / 2) / k,
  ];
}

/** The view at `zoom` in which the world point under the screen point `anchor` stays there. */
export function starMapZoomAround(
  view: StarMapView,
  anchor: StarMapPoint,
  zoom: number,
  viewport: StarMapSize,
): StarMapView {
  const world = starMapToWorld(anchor, view, viewport);
  const k = 2 ** zoom;
  return {
    zoom,
    center: [
      world[0] - (anchor[0] - viewport.width / 2) / k,
      world[1] - (anchor[1] - viewport.height / 2) / k,
    ],
  };
}

/**
 * Indexes of `points` in reading order: rows from the top (points whose y differs by less than
 * `tolerance` from the first point of a row share it), each row from the left.
 */
export function starMapReadingOrder(points: readonly StarMapPoint[], tolerance: number): number[] {
  const byY = points
    .map((point, index) => ({ point, index }))
    .sort((a, b) => a.point[1] - b.point[1]);
  const rows: (typeof byY)[] = [];
  for (const entry of byY) {
    const row = rows.at(-1);
    if (row && entry.point[1] - row[0].point[1] < tolerance) row.push(entry);
    else rows.push([entry]);
  }
  return rows.flatMap((row) =>
    row.sort((a, b) => a.point[0] - b.point[0] || a.index - b.index).map((entry) => entry.index),
  );
}

/** Value classes of a choropleth: equal intervals between the smallest and the largest value. */
export interface StarMapClasses {
  /** `count + 1` class limits, from the smallest to the largest value; empty without values. */
  readonly breaks: readonly number[];
  /** The class of a value, from 0; `null` for a missing value. */
  readonly classOf: (value: number | null | undefined) => number | null;
}

/** Equal-interval classes of `values` (missing values are left out). */
export function starMapClasses(
  values: readonly (number | null | undefined)[],
  count: number,
): StarMapClasses {
  const known = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const classes = Math.max(1, Math.round(count));
  if (!known.length) return { breaks: [], classOf: () => null };
  const min = Math.min(...known);
  const max = Math.max(...known);
  const step = (max - min) / classes;
  const breaks = Array.from({ length: classes + 1 }, (_, i) =>
    i === classes ? max : Math.round((min + step * i) * 1e9) / 1e9,
  );
  return {
    breaks,
    classOf: (value) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) return null;
      if (!step) return 0;
      return Math.max(0, Math.min(classes - 1, Math.floor((value - min) / step)));
    },
  };
}

/** Radius of a bubble: the area grows with the value, from `minRadius` to `maxRadius`. */
export function starMapBubbleRadius(
  value: number,
  min: number,
  max: number,
  minRadius: number,
  maxRadius: number,
): number {
  if (max <= min) return maxRadius;
  const share = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return r2(minRadius + (maxRadius - minRadius) * Math.sqrt(share));
}

/** One tile of a tile layer, placed in screen pixels. */
export interface StarMapTile {
  readonly z: number;
  readonly x: number;
  readonly y: number;
  readonly left: number;
  readonly top: number;
  readonly size: number;
}

/**
 * The tiles that cover the viewport, at the tile level nearest to the zoom (Web Mercator only).
 * Only visible tiles are listed, so a tile layer loads lazily.
 */
export function starMapTiles(
  view: StarMapView,
  viewport: StarMapSize,
  maxLevel = 19,
): StarMapTile[] {
  const z = Math.max(0, Math.min(maxLevel, Math.round(view.zoom)));
  const count = 2 ** z;
  const size = STAR_MAP_TILE_SIZE * 2 ** (view.zoom - z);
  const [left, top] = starMapToScreen([0, 0], view, viewport);
  const first = (origin: number) => Math.max(0, Math.floor(-origin / size));
  const last = (origin: number, extent: number) =>
    Math.min(count - 1, Math.ceil((extent - origin) / size) - 1);
  const tiles: StarMapTile[] = [];
  for (let y = first(top); y <= last(top, viewport.height); y++) {
    for (let x = first(left); x <= last(left, viewport.width); x++) {
      tiles.push({ z, x, y, left: r2(left + x * size), top: r2(top + y * size), size: r2(size) });
    }
  }
  return tiles;
}

/** The address of a tile: `{z}`, `{x}` and `{y}` of the template replaced. */
export function starMapTileUrl(template: string, z: number, x: number, y: number): string {
  return template
    .replace(/\{z\}/g, String(z))
    .replace(/\{x\}/g, String(x))
    .replace(/\{y\}/g, String(y));
}
