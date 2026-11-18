import {
  SPARK_H,
  SPARK_PAD,
  SPARK_W,
  sparklineArea,
  sparklineBars,
  sparklineExtent,
  sparklineLine,
  sparklinePoints,
  sparklineStats,
  sparklineY,
} from './sparkline-geometry';

describe('sparkline geometry', () => {
  it('finds the extent of the finite values, with zero for bars', () => {
    expect(sparklineExtent([3, 5, 4], 'line')).toEqual([3, 5]);
    expect(sparklineExtent([3, NaN, 9], 'area')).toEqual([3, 9]);
    expect(sparklineExtent([3, 5], 'bar')).toEqual([0, 5]);
    expect(sparklineExtent([-2, -5], 'bar')).toEqual([-5, 0]);
    expect(sparklineExtent([4, -2], 'win-loss')).toEqual([-1, 1]);
    expect(sparklineExtent([], 'line')).toEqual([0, 0]);
    expect(sparklineExtent([3, 5], 'line', 0, 10)).toEqual([0, 10]);
    expect(sparklineExtent([3, 5], 'line', undefined, 4)).toEqual([3, 4]);
  });

  it('places the points from the first to the last column and the low to the high value', () => {
    const points = sparklinePoints([0, 5, 10], [0, 10], false);
    expect(points.map((p) => p?.x)).toEqual([0, SPARK_W / 2, SPARK_W]);
    expect(points[0]?.y).toBe(SPARK_H - SPARK_PAD);
    expect(points[2]?.y).toBe(SPARK_PAD);
    expect(points[1]?.y).toBe(SPARK_H / 2);
  });

  it('mirrors the x axis in right-to-left', () => {
    const points = sparklinePoints([0, 5, 10], [0, 10], true);
    expect(points.map((p) => p?.x)).toEqual([SPARK_W, SPARK_W / 2, 0]);
  });

  it('draws a flat line in the middle when every value is the same', () => {
    const points = sparklinePoints([4, 4], [4, 4], false);
    expect(points.every((p) => p?.y === SPARK_H / 2)).toBe(true);
  });

  it('clamps values outside a fixed range', () => {
    const points = sparklinePoints([-5, 50], [0, 10], false);
    expect(points[0]?.y).toBe(SPARK_H - SPARK_PAD);
    expect(points[1]?.y).toBe(SPARK_PAD);
    expect(sparklineY(50, [0, 10])).toBe(SPARK_PAD);
  });

  it('starts a new segment after a missing value', () => {
    const points = sparklinePoints([1, NaN, 3, 4], [0, 4], false);
    expect(points[1]).toBeNull();
    const path = sparklineLine(points);
    expect(path.match(/M/g)?.length).toBe(2);
    expect(path.startsWith('M 0.00 ')).toBe(true);
    expect(sparklineLine([])).toBe('');
  });

  it('closes each area segment on the zero line', () => {
    const points = sparklinePoints([1, 2, NaN, 3, 4], [0, 4], false);
    const path = sparklineArea(points, [0, 4]);
    expect(path.match(/Z/g)?.length).toBe(2);
    expect(path).toContain(`${SPARK_H - SPARK_PAD}.00`);
  });

  it('places one value in the middle', () => {
    expect(sparklinePoints([7], [7, 7], false)[0]?.x).toBe(SPARK_W / 2);
  });

  it('draws bars from the zero line, and win-loss bars up or down', () => {
    const bars = sparklineBars([5, -5], 'bar', [-5, 5], false);
    expect(bars).toHaveLength(2);
    const mid = SPARK_H / 2;
    expect(bars[0].y + bars[0].height).toBeCloseTo(mid);
    expect(bars[1].y).toBeCloseTo(mid);
    expect(bars[0].negative).toBe(false);
    expect(bars[1].negative).toBe(true);
    expect(bars[0].x).toBeLessThan(bars[1].x);

    const rtl = sparklineBars([5, -5], 'bar', [-5, 5], true);
    expect(rtl[0].x).toBeGreaterThan(rtl[1].x);

    const winLoss = sparklineBars([3, -1, 0], 'win-loss', [-1, 1], false);
    expect(winLoss.map((bar) => bar.negative)).toEqual([false, true, false]);
    expect(winLoss[0].height).toBeCloseTo(winLoss[1].height);
    expect(winLoss[2].height).toBe(0);
  });

  it('summarises first, last, min, max and the trend', () => {
    expect(sparklineStats([4, 2, 9, 6])).toEqual({
      first: 4,
      last: 6,
      min: 2,
      max: 9,
      minIndex: 1,
      maxIndex: 2,
      lastIndex: 3,
      trend: 'up',
    });
    expect(sparklineStats([5, NaN, 1])?.trend).toBe('down');
    expect(sparklineStats([5, 5])?.trend).toBe('flat');
    expect(sparklineStats([NaN])).toBeNull();
  });
});
