/**
 * Pure geometry of `star-linear-gauge` and `star-radial-gauge`.
 *
 * Linear: a horizontal scale runs in a view box of `LINEAR_LENGTH_BOX` × `LINEAR_CROSS_BOX`
 * units from `LINEAR_START` to `LINEAR_END`; a vertical scale uses the same numbers on the other
 * axis and runs from the bottom. Radial: a view box of `RADIAL_BOX` × `RADIAL_BOX` units with the
 * centre in the middle. Angles are math angles in degrees: 0 points right, 90 points up.
 */

export type StarGaugeOrientation = 'horizontal' | 'vertical';

/** Ticks of the scale: `major` intervals (or a `step` between major ticks) and `minor` parts per interval. */
export interface StarGaugeTicks {
  /** Number of intervals between major ticks. Default 5. Ignored when `step` is set. */
  readonly major?: number;
  /** Value between two major ticks. */
  readonly step?: number;
  /** Number of parts per major interval; 2 puts one minor tick in the middle. Default 2. */
  readonly minor?: number;
}

/** Long side of the linear view box. */
export const LINEAR_LENGTH_BOX = 320;
/** Short side of the linear view box. */
export const LINEAR_CROSS_BOX = 64;
/** Scale start and end on the long side. */
export const LINEAR_START = 16;
export const LINEAR_END = 304;
/** Side of the radial view box. */
export const RADIAL_BOX = 200;
export const RADIAL_CENTER = RADIAL_BOX / 2;

/** At most this many major intervals, so a tiny step cannot draw thousands of ticks. */
const MAX_INTERVALS = 100;

/** Removes floating point noise such as 0.30000000000000004. */
const clean = (value: number) => Number(value.toPrecision(12));

/** Share of `value` between `min` and `max`, clamped to 0..1 (0 when the scale is empty). */
export function gaugeRatio(value: number, min: number, max: number): number {
  if (!(max > min) || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** `value` rounded to a multiple of `step` from `min`, and kept between `min` and `max`. */
export function snapGaugeValue(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  if (!(step > 0)) return clean(clamped);
  const snapped = min + Math.round((clamped - min) / step) * step;
  return clean(Math.min(max, Math.max(min, snapped)));
}

/** Values of the major and minor ticks. */
export function gaugeTicks(
  min: number,
  max: number,
  ticks: StarGaugeTicks,
): { major: number[]; minor: number[] } {
  if (!(max > min)) return { major: [min], minor: [] };
  const span = max - min;
  let step = ticks.step && ticks.step > 0 ? ticks.step : span / Math.max(1, ticks.major ?? 5);
  step = Math.max(step, span / MAX_INTERVALS);
  const major: number[] = [];
  for (let index = 0; ; index++) {
    const value = clean(min + index * step);
    if (value > max + step * 1e-9) break;
    major.push(Math.min(value, max));
  }
  const parts = Math.max(1, Math.min(10, Math.round(ticks.minor ?? 2)));
  const minor: number[] = [];
  for (let index = 0; index < major.length - 1; index++) {
    for (let part = 1; part < parts; part++) {
      minor.push(clean(major[index] + ((major[index + 1] - major[index]) * part) / parts));
    }
  }
  return { major, minor };
}

/** A point of a linear scale: `ratio` along the scale, `offset` across it. */
export function linearPoint(
  ratio: number,
  offset: number,
  orientation: StarGaugeOrientation,
  rtl: boolean,
): { x: number; y: number } {
  const along = ratio * (LINEAR_END - LINEAR_START);
  if (orientation === 'vertical') return { x: offset, y: LINEAR_END - along };
  return { x: rtl ? LINEAR_END - along : LINEAR_START + along, y: offset };
}

/** The angle of `ratio` on an arc from `start` to `end` (degrees). */
export function radialAngle(ratio: number, start: number, end: number): number {
  return clean(start + ratio * (end - start));
}

/** A point at `angle` degrees on a circle (math angle, y up on screen). */
export function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy - radius * Math.sin(radians) };
}

/** SVG arc from `start` to `end` degrees: clockwise on screen when `end` is smaller. */
export function arcPath(
  cx: number,
  cy: number,
  radius: number,
  start: number,
  end: number,
): string {
  let sweep = end - start;
  if (Math.abs(sweep) >= 360) sweep = Math.sign(sweep) * 359.99;
  const from = polar(cx, cy, radius, start);
  const to = polar(cx, cy, radius, start + sweep);
  const large = Math.abs(sweep) > 180 ? 1 : 0;
  const clockwise = sweep < 0 ? 1 : 0;
  return (
    `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} ` +
    `A ${radius} ${radius} 0 ${large} ${clockwise} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`
  );
}

/**
 * The ratio of a pointer at `angle` degrees on an arc from `start` to `end`. In the gap of the
 * arc the nearer end wins.
 */
export function radialRatioAt(angle: number, start: number, end: number): number {
  const sweep = Math.abs(end - start);
  if (sweep === 0) return 0;
  const mod = (value: number) => ((value % 360) + 360) % 360;
  const along = end < start ? mod(start - angle) : mod(angle - start);
  if (along <= sweep) return along / sweep;
  return along - sweep < 360 - along ? 1 : 0;
}
