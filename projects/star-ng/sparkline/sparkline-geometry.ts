/**
 * Pure geometry of `star-sparkline`. The plot uses a fixed view box of `SPARK_W` × `SPARK_H`
 * units that the SVG stretches to its width and height (`preserveAspectRatio="none"`); lines
 * and markers keep their stroke width with `vector-effect: non-scaling-stroke`.
 */

/** Width of the view box. */
export const SPARK_W = 100;
/** Height of the view box. */
export const SPARK_H = 20;
/** Room above the highest and below the lowest value, so a line stroke is not cut. */
export const SPARK_PAD = 2;

export type StarSparklineType = 'line' | 'area' | 'bar' | 'win-loss';

/** One point of the line; `null` for a missing value (a gap). */
export interface SparklinePoint {
  readonly x: number;
  readonly y: number;
}

/** One bar of a bar or win-loss sparkline. */
export interface SparklineBar {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly negative: boolean;
}

/** First, last, lowest and highest finite value, and the direction from the first to the last. */
export interface SparklineStats {
  readonly first: number;
  readonly last: number;
  readonly min: number;
  readonly max: number;
  readonly minIndex: number;
  readonly maxIndex: number;
  readonly lastIndex: number;
  readonly trend: 'up' | 'down' | 'flat';
}

const fixed = (value: number) => value.toFixed(2);

/**
 * The value range of the plot. `min` and `max` win when they are set; otherwise the range of
 * the finite values. Bars always include zero. Win-loss uses -1 to 1.
 */
export function sparklineExtent(
  data: readonly number[],
  type: StarSparklineType,
  min?: number,
  max?: number,
): [number, number] {
  if (type === 'win-loss') return [-1, 1];
  const finite = data.filter(Number.isFinite);
  let low = finite.length ? Math.min(...finite) : 0;
  let high = finite.length ? Math.max(...finite) : 0;
  if (type === 'bar') {
    low = Math.min(0, low);
    high = Math.max(0, high);
  }
  return [min ?? low, max ?? high];
}

/** The y of a value: the low end at the bottom, the high end at the top, clamped to the range. */
export function sparklineY(value: number, [low, high]: readonly [number, number]): number {
  if (high <= low) return SPARK_H / 2;
  const share = (Math.min(high, Math.max(low, value)) - low) / (high - low);
  return SPARK_H - SPARK_PAD - share * (SPARK_H - 2 * SPARK_PAD);
}

/** The x of the column `index` of `count`, mirrored in right-to-left. One value is centred. */
function columnX(index: number, count: number, rtl: boolean): number {
  const x = count < 2 ? SPARK_W / 2 : (index / (count - 1)) * SPARK_W;
  return rtl ? SPARK_W - x : x;
}

/** The points of a line or area sparkline; a value that is not finite gives `null`. */
export function sparklinePoints(
  data: readonly number[],
  extent: readonly [number, number],
  rtl: boolean,
): (SparklinePoint | null)[] {
  return data.map((value, index) =>
    Number.isFinite(value)
      ? { x: columnX(index, data.length, rtl), y: sparklineY(value, extent) }
      : null,
  );
}

/** Runs of points without a gap. */
function segments(points: readonly (SparklinePoint | null)[]): SparklinePoint[][] {
  const runs: SparklinePoint[][] = [];
  let run: SparklinePoint[] = [];
  for (const point of points) {
    if (point) run.push(point);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs;
}

/** SVG path of the line: one `M` per run of values, so a missing value leaves a gap. */
export function sparklineLine(points: readonly (SparklinePoint | null)[]): string {
  return segments(points)
    .map((run) => run.map((p, i) => `${i ? 'L' : 'M'} ${fixed(p.x)} ${fixed(p.y)}`).join(' '))
    .join(' ');
}

/** SVG path of the area: each run is closed on the zero line (or the nearest end of the range). */
export function sparklineArea(
  points: readonly (SparklinePoint | null)[],
  extent: readonly [number, number],
): string {
  const base = fixed(sparklineY(0, extent));
  return segments(points)
    .map(
      (run) =>
        `M ${fixed(run[0].x)} ${base} ` +
        run.map((p) => `L ${fixed(p.x)} ${fixed(p.y)}`).join(' ') +
        ` L ${fixed(run[run.length - 1].x)} ${base} Z`,
    )
    .join(' ');
}

/**
 * Bars of a bar or win-loss sparkline. A bar grows from the zero line; a win-loss bar goes up
 * for a value above zero, down for one below, and has no height for zero or a missing value.
 */
export function sparklineBars(
  data: readonly number[],
  type: 'bar' | 'win-loss',
  extent: readonly [number, number],
  rtl: boolean,
): SparklineBar[] {
  const slot = SPARK_W / Math.max(1, data.length);
  const width = slot * 0.7;
  const base = sparklineY(0, extent);
  return data.map((raw, index) => {
    const value = Number.isFinite(raw) ? raw : 0;
    const level = type === 'win-loss' ? Math.sign(value) : value;
    const top = sparklineY(level, extent);
    const start = index * slot + (slot - width) / 2;
    return {
      x: rtl ? SPARK_W - start - width : start,
      y: Math.min(top, base),
      width,
      height: Math.abs(base - top),
      negative: value < 0,
    };
  });
}

/** Statistics of the finite values; `null` when there is none. */
export function sparklineStats(data: readonly number[]): SparklineStats | null {
  let first: number | null = null;
  let last = 0;
  let lastIndex = -1;
  let minIndex = -1;
  let maxIndex = -1;
  data.forEach((value, index) => {
    if (!Number.isFinite(value)) return;
    first ??= value;
    last = value;
    lastIndex = index;
    if (minIndex < 0 || value < data[minIndex]) minIndex = index;
    if (maxIndex < 0 || value > data[maxIndex]) maxIndex = index;
  });
  if (first === null) return null;
  return {
    first,
    last,
    min: data[minIndex],
    max: data[maxIndex],
    minIndex,
    maxIndex,
    lastIndex,
    trend: last > first ? 'up' : last < first ? 'down' : 'flat',
  };
}
