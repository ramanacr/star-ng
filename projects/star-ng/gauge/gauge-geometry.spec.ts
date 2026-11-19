import {
  arcPath,
  gaugeRatio,
  gaugeTicks,
  LINEAR_END,
  LINEAR_START,
  linearPoint,
  polar,
  radialAngle,
  radialRatioAt,
  snapGaugeValue,
} from './gauge-geometry';

describe('gauge geometry', () => {
  it('maps a value to a ratio, clamped to the scale', () => {
    expect(gaugeRatio(50, 0, 200)).toBe(0.25);
    expect(gaugeRatio(-5, 0, 10)).toBe(0);
    expect(gaugeRatio(50, 0, 10)).toBe(1);
    expect(gaugeRatio(3, 3, 3)).toBe(0);
  });

  it('snaps a value to the step and the scale', () => {
    expect(snapGaugeValue(23, 0, 100, 5)).toBe(25);
    expect(snapGaugeValue(0.30000000000000004, 0, 1, 0.1)).toBe(0.3);
    expect(snapGaugeValue(140, 0, 100, 1)).toBe(100);
    expect(snapGaugeValue(-3, 0, 100, 1)).toBe(0);
    expect(snapGaugeValue(7, 2, 12, 5)).toBe(7);
  });

  it('makes major ticks from a count and minor ticks between them', () => {
    const ticks = gaugeTicks(0, 100, { major: 4, minor: 2 });
    expect(ticks.major).toEqual([0, 25, 50, 75, 100]);
    expect(ticks.minor).toEqual([12.5, 37.5, 62.5, 87.5]);
  });

  it('makes major ticks from a step', () => {
    const ticks = gaugeTicks(0, 1, { step: 0.2, minor: 1 });
    expect(ticks.major).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(ticks.minor).toEqual([]);
    expect(gaugeTicks(0, 10, { step: 4 }).major).toEqual([0, 4, 8]);
  });

  it('caps the number of ticks', () => {
    expect(gaugeTicks(0, 1e6, { step: 1 }).major.length).toBeLessThanOrEqual(101);
    expect(gaugeTicks(5, 5, {}).major).toEqual([5]);
  });

  it('places a linear ratio along the scale, mirrored in right-to-left', () => {
    expect(linearPoint(0, 10, 'horizontal', false)).toEqual({ x: LINEAR_START, y: 10 });
    expect(linearPoint(1, 10, 'horizontal', false)).toEqual({ x: LINEAR_END, y: 10 });
    expect(linearPoint(0, 10, 'horizontal', true)).toEqual({ x: LINEAR_END, y: 10 });
    expect(linearPoint(0, 10, 'vertical', true)).toEqual({ x: 10, y: LINEAR_END });
    expect(linearPoint(1, 10, 'vertical', false)).toEqual({ x: 10, y: LINEAR_START });
  });

  it('turns a ratio into an angle between the start and the end angle', () => {
    expect(radialAngle(0, 225, -45)).toBe(225);
    expect(radialAngle(0.5, 225, -45)).toBe(90);
    expect(radialAngle(1, 225, -45)).toBe(-45);
  });

  it('places a point on a circle in math angles (y up)', () => {
    const top = polar(100, 100, 50, 90);
    expect(top.x).toBeCloseTo(100);
    expect(top.y).toBeCloseTo(50);
    const right = polar(100, 100, 50, 0);
    expect(right.x).toBeCloseTo(150);
    expect(right.y).toBeCloseTo(100);
  });

  it('draws a clockwise arc with the large-arc flag for more than half a turn', () => {
    expect(arcPath(100, 100, 50, 225, -45)).toBe('M 64.64 135.36 A 50 50 0 1 1 135.36 135.36');
    expect(arcPath(100, 100, 50, 180, 90)).toBe('M 50.00 100.00 A 50 50 0 0 1 100.00 50.00');
    expect(arcPath(100, 100, 50, 0, 90)).toBe('M 150.00 100.00 A 50 50 0 0 0 100.00 50.00');
  });

  it('finds the ratio at a pointer angle and snaps the gap to the nearer end', () => {
    expect(radialRatioAt(90, 225, -45)).toBeCloseTo(0.5);
    expect(radialRatioAt(225, 225, -45)).toBeCloseTo(0);
    expect(radialRatioAt(-45, 225, -45)).toBeCloseTo(1);
    expect(radialRatioAt(-80, 225, -45)).toBe(1);
    expect(radialRatioAt(-100, 225, -45)).toBe(0);
    expect(radialRatioAt(0, 180, 0)).toBeCloseTo(1);
  });
});
