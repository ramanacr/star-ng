/**
 * Pure geometry of the chart types: tick scales, stacking, angles and radii, SVG path strings,
 * marker shapes and label truncation. These functions have no DOM access, so unit tests can check
 * them without layout. Coordinates in SVG are y-down, and angles run clockwise from the top.
 *
 * Rule for bad numbers: `NaN`, `null`, `undefined`, `Infinity` and anything that is not a number
 * count as missing. Missing values are 0 in stacks, radar and polar area charts. A scatter point
 * with a missing `x` or `y` is dropped. Values larger than 1e300 in size are clamped.
 */

const LIMIT = 1e300;
const TWO_PI = Math.PI * 2;

/** `value` when it is a finite number (clamped to +-1e300), else `fallback`. */
export function toFinite(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(-LIMIT, Math.min(LIMIT, value));
}

/** Rounds to a number of decimals that hides binary floating-point noise. */
function clean(value: number, step: number): number {
  const decimals = Math.min(100, Math.max(0, 2 - Math.floor(Math.log10(Math.abs(step) || 1))));
  const rounded = +value.toFixed(decimals);
  return rounded === 0 ? 0 : rounded; // no -0
}

// ---------- Scales and ticks ----------

export interface StarChartScale {
  /** First tick, the lower end of the axis. */
  readonly min: number;
  /** Last tick, the upper end of the axis. */
  readonly max: number;
  /** Distance between two ticks. */
  readonly step: number;
  readonly ticks: readonly number[];
}

export interface StarChartScaleOptions {
  /** Make the axis contain 0 (bars, stacks, radar, polar area). Scatter axes leave it off. */
  readonly includeZero?: boolean;
  /** Wanted number of intervals between ticks. The default of 4 gives 5 ticks. */
  readonly intervals?: number;
}

/**
 * Round axis ends and 3 to 6 "nice" ticks (1, 2, 2.5, 5 times a power of ten) that contain the
 * range `min` to `max`. A range of one value gets padding, and all zeros give 0 to 1.
 */
export function niceScale(
  min: number,
  max: number,
  options: StarChartScaleOptions = {},
): StarChartScale {
  let lo = toFinite(min);
  let hi = toFinite(max);
  if (lo > hi) [lo, hi] = [hi, lo];
  if (options.includeZero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (lo === hi) {
    if (lo === 0) {
      hi = 1;
    } else {
      const pad = Math.abs(lo) * 0.1;
      lo -= pad;
      hi += pad;
    }
  }
  const intervals = Math.max(1, Math.round(options.intervals ?? 4));
  const rough = (hi - lo) / intervals;
  if (!(rough > 0) || !Number.isFinite(rough)) return fallbackScale(lo, hi);
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough * (1 - 1e-12))!;
  const first = Math.floor(lo / step + 1e-9) * step;
  const last = Math.ceil(hi / step - 1e-9) * step;
  const count = Math.round((last - first) / step);
  if (!Number.isFinite(count) || count < 1 || count > 24) return fallbackScale(lo, hi);
  const ticks = Array.from({ length: count + 1 }, (_, i) => clean(first + i * step, step));
  return { min: ticks[0], max: ticks[count], step, ticks };
}

/** Fixed ends and a fixed step for a value axis; `null` or a missing value means "from the data". */
export interface StarChartScaleBounds {
  readonly min?: number | null;
  readonly max?: number | null;
  readonly stepSize?: number | null;
}

/** A finite number, or `null`. */
function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * A value axis for `dataMin` to `dataMax` with fixed ends and step where they are given. A
 * given `min` or `max` is an end of the axis as it is; the other end is a round number. With
 * `stepSize` the ticks start at the lower end and go up by that step (at most 50 ticks); the
 * upper end is always a tick. `includeZero` applies only while `min` is not given.
 */
export function boundedScale(
  dataMin: number,
  dataMax: number,
  options: StarChartScaleOptions & StarChartScaleBounds = {},
): StarChartScale {
  const fixedMin = finiteOrNull(options.min);
  const fixedMax = finiteOrNull(options.max);
  const step = finiteOrNull(options.stepSize);
  const wantStep = step !== null && step > 0 ? step : null;
  if (fixedMin === null && fixedMax === null && wantStep === null)
    return niceScale(dataMin, dataMax, options);
  const nice = niceScale(fixedMin ?? dataMin, fixedMax ?? dataMax, {
    ...options,
    includeZero: fixedMin === null && options.includeZero,
  });
  const by = wantStep ?? nice.step;
  let lo = fixedMin ?? (wantStep ? Math.floor(nice.min / by + 1e-9) * by : nice.min);
  let hi = fixedMax ?? (wantStep ? Math.ceil(nice.max / by - 1e-9) * by : nice.max);
  if (!(hi > lo)) hi = lo + (by > 0 ? by : 1);
  lo = clean(lo, by);
  hi = clean(hi, by);
  if (wantStep === null) {
    // Fixed ends: the round ticks between them, and the ends themselves.
    const inner = nice.ticks.filter((t) => t > lo + by * 1e-6 && t < hi - by * 1e-6);
    return { min: lo, max: hi, step: by, ticks: [lo, ...inner, hi] };
  }
  const count = Math.floor((hi - lo) / by + 1e-9);
  if (!(by > 0) || count > 50) return { ...niceScale(lo, hi), min: lo, max: hi };
  const ticks = Array.from({ length: count + 1 }, (_, i) => clean(lo + i * by, by));
  if (hi - ticks[ticks.length - 1] > by * 1e-6) ticks.push(hi);
  return { min: lo, max: hi, step: by, ticks };
}

function fallbackScale(lo: number, hi: number): StarChartScale {
  return { min: lo, max: hi, step: hi - lo, ticks: lo === hi ? [lo] : [lo, hi] };
}

/** Ticks from 0 to a round maximum, for a chart of non-negative values. */
export function niceTicks(max: number): number[] {
  return [...niceScale(0, Math.max(0, toFinite(max)), { includeZero: true }).ticks];
}

/** Position of `value` on a scale, mapped to `from` (at `min`) and `to` (at `max`). */
export function scalePosition(value: number, scale: StarChartScale, from: number, to: number) {
  const span = scale.max - scale.min;
  if (!(span > 0)) return from;
  return from + ((toFinite(value) - scale.min) / span) * (to - from);
}

/** Smallest number of decimals (0 to 10) that shows every tick exactly. */
export function tickDecimals(ticks: readonly number[]): number {
  for (let digits = 0; digits <= 10; digits++) {
    const factor = 10 ** digits;
    if (ticks.every((t) => Math.abs(t * factor - Math.round(t * factor)) < 1e-6)) return digits;
  }
  return 10;
}

// ---------- Stacking ----------

export interface StarChartStackSegment {
  readonly series: number;
  /** The real value of the cell. */
  readonly value: number;
  /** Where the segment starts and ends on the axis (percent of the column in percent mode). */
  readonly start: number;
  readonly end: number;
}

export interface StarChartStackColumn {
  readonly segments: readonly StarChartStackSegment[];
  /** Sum of the positive values. */
  readonly positive: number;
  /** Sum of the negative values (0 or less). */
  readonly negative: number;
  /** Sum of all values: `positive + negative`. */
  readonly total: number;
}

/**
 * Stacks the series of every category. Positive values grow up from 0 and negative values grow
 * down from 0, each in series order, so a negative value never hides a positive one. In percent
 * mode every column is scaled so that the sum of the absolute values is 100: a column of only
 * positive values spans 0 to 100, and a column of mixed signs spans -100 to 100 in total.
 * A column of all zeros has no height.
 */
export function stackColumns(
  series: readonly ArrayLike<unknown>[],
  categories: number,
  percent = false,
): StarChartStackColumn[] {
  return Array.from({ length: Math.max(0, categories) }, (_, i) => {
    const values = series.map((s) => toFinite(s[i]));
    const absolute = values.reduce((sum, v) => sum + Math.abs(v), 0);
    const factor = percent ? (absolute > 0 ? 100 / absolute : 0) : 1;
    let up = 0;
    let down = 0;
    const segments = values.map((value, s): StarChartStackSegment => {
      const size = value * factor;
      if (value >= 0) {
        const start = up;
        up += size;
        return { series: s, value, start, end: up };
      }
      const start = down;
      down += size;
      return { series: s, value, start, end: down };
    });
    const positive = values.filter((v) => v > 0).reduce((a, b) => a + b, 0);
    const negative = values.filter((v) => v < 0).reduce((a, b) => a + b, 0);
    return { segments, positive, negative, total: positive + negative };
  });
}

/** Lowest and highest axis value of the columns, always including 0. */
export function stackExtent(columns: readonly StarChartStackColumn[]): {
  min: number;
  max: number;
} {
  let min = 0;
  let max = 0;
  for (const column of columns) {
    for (const segment of column.segments) {
      min = Math.min(min, segment.start, segment.end);
      max = Math.max(max, segment.start, segment.end);
    }
  }
  return { min, max };
}

// ---------- Angles, radii and paths ----------

/** Number with at most 2 decimals, for path strings. */
function n(value: number): number {
  return +value.toFixed(2);
}

/** A point at `radius` and `angle` (radians, 0 = right, clockwise) around a center. */
export function polarPoint(
  radius: number,
  angle: number,
  cx = 0,
  cy = 0,
): { x: number; y: number } {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

/** Angles of `count` evenly spaced axes, clockwise from the top. */
export function axisAngles(count: number, start = -Math.PI / 2): number[] {
  const total = Math.max(0, Math.floor(count));
  return Array.from({ length: total }, (_, i) => start + (i * TWO_PI) / total);
}

/** Closed polygon path through the points. */
export function polygonPath(points: readonly { x: number; y: number }[]): string {
  if (!points.length) return '';
  return points.map((p, i) => `${i ? 'L' : 'M'}${n(p.x)},${n(p.y)}`).join('') + 'Z';
}

/** Circle of `radius` around the origin, as a path (two arcs). */
export function circlePath(radius: number): string {
  const r = n(Math.max(0, radius));
  return r ? `M${-r},0A${r},${r} 0 1 1 ${r},0A${r},${r} 0 1 1 ${-r},0Z` : '';
}

/** Ring of a radar chart: a polygon through all axes, or a circle when there are fewer than 3. */
export function ringPath(angles: readonly number[], radius: number): string {
  if (!(radius > 0)) return '';
  return angles.length >= 3
    ? polygonPath(angles.map((a) => polarPoint(radius, a)))
    : circlePath(radius);
}

/**
 * Sector (a wedge, or a ring segment when `inner` is more than 0) around the origin, from angle
 * `a0` clockwise to `a1`. Returns '' when it has no area. A sweep of a full turn gives a disc or
 * an annulus.
 */
export function sectorPath(inner: number, outer: number, a0: number, a1: number): string {
  const sweep = a1 - a0;
  const ro = Math.max(0, outer);
  const ri = Math.max(0, Math.min(inner, ro));
  if (!(ro > 0) || !(sweep > 0) || ro === ri) return '';
  if (sweep >= TWO_PI - 1e-6) {
    const disc = `M0,${-n(ro)}A${n(ro)},${n(ro)} 0 1 1 -0.01,${-n(ro)}Z`;
    return ri > 0 ? `${disc}M0,${-n(ri)}A${n(ri)},${n(ri)} 0 1 0 0.01,${-n(ri)}Z` : disc;
  }
  const large = sweep > Math.PI ? 1 : 0;
  const p = (r: number, a: number) => {
    const { x, y } = polarPoint(r, a);
    return `${n(x)},${n(y)}`;
  };
  return ri > 0
    ? `M${p(ro, a0)}A${n(ro)},${n(ro)} 0 ${large} 1 ${p(ro, a1)}L${p(ri, a1)}` +
        `A${n(ri)},${n(ri)} 0 ${large} 0 ${p(ri, a0)}Z`
    : `M0,0L${p(ro, a0)}A${n(ro)},${n(ro)} 0 ${large} 1 ${p(ro, a1)}Z`;
}

/** Radar radius of `value`: 0 at the low end of the scale and `radius` at the high end. */
export function linearRadius(value: number, scale: StarChartScale, radius: number): number {
  const span = scale.max - scale.min;
  if (!(span > 0)) return 0;
  return Math.max(0, Math.min(radius, ((toFinite(value) - scale.min) / span) * radius));
}

/**
 * Polar area radius of `value`. The area of a sector is proportional to the radius squared, so
 * the radius grows with the square root of the value: a value twice as big has twice the area.
 * Negative and missing values give radius 0.
 */
export function areaRadius(value: number, max: number, radius: number): number {
  const v = Math.max(0, toFinite(value));
  if (!(max > 0) || v === 0) return 0;
  return radius * Math.sqrt(Math.min(1, v / max));
}

export interface StarChartPolarSector {
  readonly index: number;
  /** The value of the category, negative and missing values read as 0. */
  readonly value: number;
  readonly radius: number;
  readonly start: number;
  readonly end: number;
  /** Angle of the axis through the middle of the sector. */
  readonly mid: number;
}

/**
 * One sector per category, all with the same angle. Sector `i` is centered on the axis `i`, with
 * the first axis at the top, so a category label can sit on the axis outside the sector.
 */
export function polarSectors(
  values: readonly unknown[],
  max: number,
  radius: number,
): StarChartPolarSector[] {
  const angles = axisAngles(values.length);
  const half = values.length ? Math.PI / values.length : 0;
  return values.map((raw, index) => {
    const value = Math.max(0, toFinite(raw));
    const mid = angles[index];
    return {
      index,
      value,
      radius: areaRadius(value, max, radius),
      start: mid - half,
      end: mid + half,
      mid,
    };
  });
}

// ---------- Labels ----------

/** Cuts a label to `max` characters with an ellipsis. The caller shows the full text as a title. */
export function truncateLabel(label: unknown, max: number): string {
  const chars = Array.from(String(label ?? ''));
  const limit = Math.floor(max);
  if (chars.length <= limit) return chars.join('');
  if (limit < 1) return '';
  return (
    chars
      .slice(0, limit - 1)
      .join('')
      .trimEnd() + '…'
  );
}

/** Text anchor of a label at `angle` around a center: left side ends at the point, right starts. */
export function labelAnchor(angle: number): 'start' | 'middle' | 'end' {
  const cos = Math.cos(angle);
  return cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
}

/** Vertical offset (`dy`) of a label at `angle`: labels above the center rise, below hang. */
export function labelOffset(angle: number): string {
  const sin = Math.sin(angle);
  return sin < -0.3 ? '0' : sin > 0.3 ? '0.9em' : '0.35em';
}

// ---------- Scatter ----------

export interface StarChartCleanPoint {
  readonly x: number;
  readonly y: number;
  /** Position of the point in the series data. */
  readonly index: number;
}

/** Points with a finite `x` and `y`. Others are dropped. The `index` keeps the source position. */
export function cleanPoints(
  points: readonly ({ x: unknown; y: unknown } | null | undefined)[],
): StarChartCleanPoint[] {
  const result: StarChartCleanPoint[] = [];
  points.forEach((point, index) => {
    if (!point) return;
    const { x, y } = point;
    if (
      typeof x === 'number' &&
      Number.isFinite(x) &&
      typeof y === 'number' &&
      Number.isFinite(y)
    ) {
      result.push({ x: toFinite(x), y: toFinite(y), index });
    }
  });
  return result;
}

/** Nice scales for both axes of a scatter chart. Without points both go from 0 to 1. */
export function scatterScales(points: readonly { x: number; y: number }[]): {
  x: StarChartScale;
  y: StarChartScale;
} {
  if (!points.length) return { x: niceScale(0, 1), y: niceScale(0, 1) };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    x: niceScale(Math.min(...xs), Math.max(...xs)),
    y: niceScale(Math.min(...ys), Math.max(...ys)),
  };
}

// ---------- Marker shapes ----------

export const STAR_CHART_MARKERS = 8;

/**
 * Outline of the marker shape of series `index` (circle, square, diamond, triangle, inverted
 * triangle, plus, cross, pentagon), about the area of a circle of `radius`, around (cx, cy).
 * The shape repeats the series color, so series stay apart where two colors are close.
 */
export function markerPath(index: number, cx: number, cy: number, radius: number): string {
  const r = Math.max(0, radius);
  const at = (dx: number, dy: number) => ({ x: cx + dx * r, y: cy + dy * r });
  switch (((Math.floor(index) % STAR_CHART_MARKERS) + STAR_CHART_MARKERS) % STAR_CHART_MARKERS) {
    case 0:
      return `M${n(cx - r)},${n(cy)}A${n(r)},${n(r)} 0 1 0 ${n(cx + r)},${n(cy)}A${n(r)},${n(r)} 0 1 0 ${n(cx - r)},${n(cy)}Z`;
    case 1:
      return polygonPath([at(-0.88, -0.88), at(0.88, -0.88), at(0.88, 0.88), at(-0.88, 0.88)]);
    case 2:
      return polygonPath([at(0, -1.25), at(1.25, 0), at(0, 1.25), at(-1.25, 0)]);
    case 3:
      return polygonPath([at(0, -1.2), at(1.1, 0.85), at(-1.1, 0.85)]);
    case 4:
      return polygonPath([at(0, 1.2), at(1.1, -0.85), at(-1.1, -0.85)]);
    case 5:
      return polygonPath(plus(at, 0));
    case 6:
      return polygonPath(plus(at, Math.PI / 4));
    default:
      return polygonPath(axisAngles(5).map((a) => polarPoint(1.15 * r, a, cx, cy)));
  }
}

/** A filled plus sign with arms of half length 1.2 and half width 0.4, turned by `turn`. */
function plus(at: (dx: number, dy: number) => { x: number; y: number }, turn: number) {
  const a = 1.2;
  const b = 0.4;
  const outline: [number, number][] = [
    [-b, -a],
    [b, -a],
    [b, -b],
    [a, -b],
    [a, b],
    [b, b],
    [b, a],
    [-b, a],
    [-b, b],
    [-a, b],
    [-a, -b],
    [-b, -b],
  ];
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return outline.map(([x, y]) => at(x * cos - y * sin, x * sin + y * cos));
}
