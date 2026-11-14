import {
  areaRadius,
  axisAngles,
  circlePath,
  cleanPoints,
  labelAnchor,
  labelOffset,
  linearRadius,
  markerPath,
  niceScale,
  niceTicks,
  polarPoint,
  polarSectors,
  polygonPath,
  ringPath,
  scalePosition,
  scatterScales,
  sectorPath,
  stackColumns,
  stackExtent,
  STAR_CHART_MARKERS,
  tickDecimals,
  toFinite,
  truncateLabel,
} from './chart-geometry';

const close = (value: number, expected: number, digits = 6) =>
  expect(value).toBeCloseTo(expected, digits);

describe('toFinite', () => {
  it('keeps finite numbers and turns everything else into the fallback', () => {
    expect(toFinite(4.5)).toBe(4.5);
    expect(toFinite(-3)).toBe(-3);
    for (const bad of [NaN, null, undefined, Infinity, -Infinity, '7', {}, []]) {
      expect(toFinite(bad)).toBe(0);
    }
    expect(toFinite(NaN, 9)).toBe(9);
  });

  it('clamps very large values so later sums stay finite', () => {
    expect(toFinite(1e308)).toBe(1e300);
    expect(toFinite(-1e308)).toBe(-1e300);
  });
});

describe('niceScale', () => {
  it('gives round ends and 3 to 6 ticks that contain the range', () => {
    expect(niceScale(0, 210, { includeZero: true }).ticks).toEqual([0, 100, 200, 300]);
    expect(niceScale(0, 190, { includeZero: true }).ticks).toEqual([0, 50, 100, 150, 200]);
    expect(niceScale(0, 100).ticks).toEqual([0, 25, 50, 75, 100]);
    expect(niceScale(0, 10).ticks).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(niceScale(0, 7).ticks).toEqual([0, 2, 4, 6, 8]);
  });

  it('handles all zeros and a range of one value', () => {
    expect(niceScale(0, 0).ticks).toEqual([0, 0.25, 0.5, 0.75, 1]);
    const one = niceScale(5, 5);
    expect(one.min).toBeLessThan(5);
    expect(one.max).toBeGreaterThan(5);
    expect(one.ticks.length).toBeGreaterThanOrEqual(3);
    const zeroIncluded = niceScale(5, 5, { includeZero: true });
    expect(zeroIncluded.min).toBe(0);
    expect(zeroIncluded.max).toBeGreaterThanOrEqual(5);
  });

  it('does not force 0 into the range unless asked', () => {
    const scale = niceScale(1000, 1040);
    expect(scale.min).toBeGreaterThan(900);
    expect(scale.ticks[0]).toBeLessThanOrEqual(1000);
    expect(scale.ticks.at(-1)).toBeGreaterThanOrEqual(1040);
    expect(niceScale(1000, 1040, { includeZero: true }).min).toBe(0);
  });

  it('handles negative ranges and ranges that cross 0', () => {
    const negative = niceScale(-90, -10);
    expect(negative.min).toBeLessThanOrEqual(-90);
    expect(negative.max).toBeGreaterThanOrEqual(-10);
    const cross = niceScale(-30, 100, { includeZero: true });
    expect(cross.ticks).toContain(0);
    expect(cross.min).toBeLessThanOrEqual(-30);
    expect(cross.max).toBeGreaterThanOrEqual(100);
    expect(niceScale(-5, -1, { includeZero: true }).max).toBe(0);
  });

  it('swaps a reversed range', () => {
    expect(niceScale(100, 0).ticks).toEqual(niceScale(0, 100).ticks);
  });

  it('treats NaN, null and Infinity as 0', () => {
    expect(niceScale(NaN, NaN).ticks).toEqual(niceScale(0, 0).ticks);
    expect(niceScale(null as unknown as number, 8).ticks).toEqual(niceScale(0, 8).ticks);
    expect(niceScale(0, Infinity).ticks.every(Number.isFinite)).toBe(true);
  });

  it('works with very large and very small values', () => {
    const big = niceScale(0, 4.2e15, { includeZero: true });
    expect(big.ticks.at(-1)).toBeGreaterThanOrEqual(4.2e15);
    expect(big.ticks.length).toBeLessThanOrEqual(7);
    const huge = niceScale(-1e308, 1e308);
    expect(huge.ticks.every(Number.isFinite)).toBe(true);
    const small = niceScale(0, 0.00042, { includeZero: true });
    expect(small.ticks.at(-1)).toBeCloseTo(0.0006, 10);
    expect(small.ticks[1]).toBeCloseTo(0.0002, 10);
  });

  it('always returns ascending ticks that start at min and end at max', () => {
    for (const [lo, hi] of [
      [0, 1],
      [-7, 3],
      [12, 12.5],
      [0, 99999],
      [-0.3, 0.2],
    ]) {
      const scale = niceScale(lo, hi);
      expect(scale.ticks[0]).toBe(scale.min);
      expect(scale.ticks.at(-1)).toBe(scale.max);
      for (let i = 1; i < scale.ticks.length; i++) {
        expect(scale.ticks[i]).toBeGreaterThan(scale.ticks[i - 1]);
      }
      expect(scale.min).toBeLessThanOrEqual(lo);
      expect(scale.max).toBeGreaterThanOrEqual(hi);
    }
  });
});

describe('niceTicks', () => {
  it('keeps the ticks of a chart of non-negative values', () => {
    expect(niceTicks(0)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(niceTicks(-4)).toEqual(niceTicks(0));
    expect(niceTicks(210)).toEqual([0, 100, 200, 300]);
    expect(niceTicks(190)).toEqual([0, 50, 100, 150, 200]);
  });
});

describe('scalePosition and tickDecimals', () => {
  it('maps a value linearly and survives an empty scale', () => {
    const scale = niceScale(0, 100);
    expect(scalePosition(0, scale, 200, 0)).toBe(200);
    expect(scalePosition(100, scale, 200, 0)).toBe(0);
    expect(scalePosition(50, scale, 200, 0)).toBe(100);
    expect(scalePosition(NaN, scale, 200, 0)).toBe(200);
    expect(scalePosition(5, { min: 1, max: 1, step: 0, ticks: [1] }, 3, 9)).toBe(3);
  });

  it('finds the decimals that show every tick exactly', () => {
    expect(tickDecimals([0, 50, 100])).toBe(0);
    expect(tickDecimals([0, 2.5, 5])).toBe(1);
    expect(tickDecimals([0, 0.25, 0.5])).toBe(2);
    expect(tickDecimals([0, 0.000125])).toBe(6);
    expect(tickDecimals([0])).toBe(0);
  });
});

describe('stackColumns', () => {
  it('stacks series in order from the baseline and sums the column', () => {
    const [jan, feb] = stackColumns(
      [
        [10, 20],
        [5, 0],
        [1, 4],
      ],
      2,
    );
    expect(jan.segments.map((s) => [s.start, s.end])).toEqual([
      [0, 10],
      [10, 15],
      [15, 16],
    ]);
    expect(jan.total).toBe(16);
    expect(feb.segments.map((s) => [s.start, s.end])).toEqual([
      [0, 20],
      [20, 20],
      [20, 24],
    ]);
    expect(stackExtent([jan, feb])).toEqual({ min: 0, max: 24 });
  });

  it('stacks negative values below the baseline, away from the positive stack', () => {
    const [column] = stackColumns([[10], [-4], [5], [-2]], 1);
    expect(column.segments.map((s) => [s.start, s.end])).toEqual([
      [0, 10],
      [0, -4],
      [10, 15],
      [-4, -6],
    ]);
    expect(column.positive).toBe(15);
    expect(column.negative).toBe(-6);
    expect(column.total).toBe(9);
    expect(stackExtent([column])).toEqual({ min: -6, max: 15 });
  });

  it('reads NaN, null and missing cells as 0', () => {
    const [column] = stackColumns([[NaN], [null], [undefined], [7], []], 1);
    expect(column.segments.map((s) => s.value)).toEqual([0, 0, 0, 7, 0]);
    expect(column.total).toBe(7);
    expect(column.segments.every((s) => Number.isFinite(s.end))).toBe(true);
  });

  it('scales every column to 100 in percent mode', () => {
    const [a, b] = stackColumns(
      [
        [30, 0],
        [10, 0],
        [60, 0],
      ],
      2,
      true,
    );
    expect(a.segments.map((s) => [s.start, s.end])).toEqual([
      [0, 30],
      [30, 40],
      [40, 100],
    ]);
    // A column of all zeros has no height.
    expect(b.segments.every((s) => s.start === 0 && s.end === 0)).toBe(true);
    // The real value stays in the segment.
    expect(a.segments[0].value).toBe(30);
  });

  it('scales a column with mixed signs by the sum of its absolute values', () => {
    const [column] = stackColumns([[30], [-10]], 1, true);
    close(column.segments[0].end, 75);
    close(column.segments[1].end, -25);
    expect(stackExtent([column])).toEqual({ min: -25, max: 75 });
  });

  it('handles no series, no categories and one category', () => {
    expect(stackColumns([], 3)).toHaveLength(3);
    expect(stackColumns([[1, 2]], 0)).toEqual([]);
    expect(stackColumns([[1, 2]], -1)).toEqual([]);
    expect(stackColumns([[5]], 1)[0].total).toBe(5);
    expect(stackExtent([])).toEqual({ min: 0, max: 0 });
  });

  it('keeps very large values finite', () => {
    const [column] = stackColumns([[1e308], [1e308]], 1);
    expect(Number.isFinite(column.total)).toBe(true);
  });
});

describe('angles and radii', () => {
  it('spaces axes evenly, clockwise from the top', () => {
    const four = axisAngles(4);
    expect(four).toHaveLength(4);
    close(four[0], -Math.PI / 2);
    close(four[1], 0);
    close(four[2], Math.PI / 2);
    close(four[3], Math.PI);
    expect(axisAngles(0)).toEqual([]);
    expect(axisAngles(-2)).toEqual([]);
    expect(axisAngles(1)).toEqual([-Math.PI / 2]);
  });

  it('converts polar coordinates, with y pointing down', () => {
    const top = polarPoint(10, -Math.PI / 2);
    close(top.x, 0);
    close(top.y, -10);
    const right = polarPoint(10, 0, 5, 7);
    close(right.x, 15);
    close(right.y, 7);
  });

  it('gives a radar radius that is linear in the value', () => {
    const scale = niceScale(0, 100, { includeZero: true });
    expect(linearRadius(0, scale, 80)).toBe(0);
    expect(linearRadius(50, scale, 80)).toBe(40);
    expect(linearRadius(100, scale, 80)).toBe(80);
    expect(linearRadius(500, scale, 80)).toBe(80);
    expect(linearRadius(NaN, scale, 80)).toBe(0);
    expect(linearRadius(5, { min: 0, max: 0, step: 0, ticks: [0] }, 80)).toBe(0);
  });

  it('puts 0 at the center of a radar scale that has negative values', () => {
    const scale = niceScale(-50, 50);
    expect(linearRadius(-50, scale, 80)).toBe(0);
    expect(linearRadius(0, scale, 80)).toBe(40);
  });

  it('gives a polar area radius that makes the area proportional to the value', () => {
    const r1 = areaRadius(25, 100, 100);
    const r2 = areaRadius(100, 100, 100);
    expect(r2).toBe(100);
    close(r1, 50);
    // Area is radius squared: 4 times the value is 4 times the area.
    close((r2 * r2) / (r1 * r1), 4);
  });

  it('gives polar area radius 0 for 0, negative, missing and a zero maximum', () => {
    expect(areaRadius(0, 100, 100)).toBe(0);
    expect(areaRadius(-5, 100, 100)).toBe(0);
    expect(areaRadius(NaN, 100, 100)).toBe(0);
    expect(areaRadius(5, 0, 100)).toBe(0);
    expect(areaRadius(500, 100, 100)).toBe(100);
  });
});

describe('polarSectors', () => {
  it('gives every category the same angle, centered on its axis', () => {
    const sectors = polarSectors([10, 20, 30, 40], 40, 100);
    expect(sectors).toHaveLength(4);
    for (const sector of sectors) {
      close(sector.end - sector.start, Math.PI / 2);
      close((sector.start + sector.end) / 2, sector.mid);
    }
    close(sectors[0].mid, -Math.PI / 2);
    close(sectors[3].end - sectors[0].start, Math.PI * 2);
    close(sectors[3].radius, 100);
  });

  it('reads negative and missing values as 0', () => {
    const sectors = polarSectors([-5, NaN, null, 4], 4, 50);
    expect(sectors.map((s) => s.value)).toEqual([0, 0, 0, 4]);
    expect(sectors.map((s) => s.radius)).toEqual([0, 0, 0, 50]);
  });

  it('handles no category and one category', () => {
    expect(polarSectors([], 10, 50)).toEqual([]);
    const [only] = polarSectors([3], 3, 50);
    close(only.end - only.start, Math.PI * 2);
  });
});

describe('paths', () => {
  it('builds a closed polygon', () => {
    expect(
      polygonPath([
        { x: 0, y: -10 },
        { x: 10.123, y: 5 },
        { x: -10, y: 5 },
      ]),
    ).toBe('M0,-10L10.12,5L-10,5Z');
    expect(polygonPath([])).toBe('');
  });

  it('builds radar rings as polygons, or circles with fewer than 3 axes', () => {
    expect(ringPath(axisAngles(4), 10).match(/L/g)).toHaveLength(3);
    expect(ringPath(axisAngles(2), 10)).toBe(circlePath(10));
    expect(ringPath(axisAngles(1), 10)).toBe(circlePath(10));
    expect(ringPath(axisAngles(5), 0)).toBe('');
    expect(circlePath(0)).toBe('');
  });

  it('builds a sector as a wedge or a ring segment', () => {
    const wedge = sectorPath(0, 10, -Math.PI / 2, 0);
    expect(wedge).toBe('M0,0L0,-10A10,10 0 0 1 10,0Z');
    const ring = sectorPath(5, 10, -Math.PI / 2, 0);
    expect(ring).toBe('M0,-10A10,10 0 0 1 10,0L5,0A5,5 0 0 0 0,-5Z');
    expect(sectorPath(0, 10, 0, Math.PI * 1.5)).toContain(' 1 1 ');
  });

  it('builds a full turn as a disc and gives no path without area', () => {
    expect(sectorPath(0, 10, -Math.PI / 2, (3 * Math.PI) / 2)).toMatch(/^M0,-10A10,10 0 1 1/);
    expect(sectorPath(0, 0, 0, 1)).toBe('');
    expect(sectorPath(0, 10, 1, 1)).toBe('');
    expect(sectorPath(0, 10, 2, 1)).toBe('');
    expect(sectorPath(10, 10, 0, 1)).toBe('');
  });
});

describe('truncateLabel', () => {
  it('keeps short labels and cuts long ones with an ellipsis', () => {
    expect(truncateLabel('Mon', 10)).toBe('Mon');
    expect(truncateLabel('Battery life under load', 10)).toBe('Battery l…');
    expect(truncateLabel('Battery life under load', 10)).toHaveLength(10);
    expect(truncateLabel('exactly ten', 11)).toBe('exactly ten');
  });

  it('removes a space before the ellipsis', () => {
    expect(truncateLabel('Long name', 5)).toBe('Long…');
  });

  it('handles tiny limits, missing labels and characters beyond the BMP', () => {
    expect(truncateLabel('abc', 1)).toBe('…');
    expect(truncateLabel('abc', 0)).toBe('');
    expect(truncateLabel(null, 5)).toBe('');
    expect(truncateLabel('\u{1F600}\u{1F600}\u{1F600}', 2)).toBe('\u{1F600}…');
  });
});

describe('label placement', () => {
  it('anchors labels by the side of the center they are on', () => {
    expect(labelAnchor(0)).toBe('start');
    expect(labelAnchor(Math.PI)).toBe('end');
    expect(labelAnchor(-Math.PI / 2)).toBe('middle');
    expect(labelAnchor(Math.PI / 2)).toBe('middle');
  });

  it('moves labels above the center up and labels below it down', () => {
    expect(labelOffset(-Math.PI / 2)).toBe('0');
    expect(labelOffset(Math.PI / 2)).toBe('0.9em');
    expect(labelOffset(0)).toBe('0.35em');
  });
});

describe('scatter helpers', () => {
  it('drops points with a missing or not finite coordinate and keeps the source index', () => {
    expect(
      cleanPoints([
        { x: 1, y: 2 },
        { x: NaN, y: 3 },
        { x: 4, y: null },
        null,
        undefined,
        { x: Infinity, y: 1 },
        { x: '5', y: 5 },
        { x: -3, y: 0 },
      ]),
    ).toEqual([
      { x: 1, y: 2, index: 0 },
      { x: -3, y: 0, index: 7 },
    ]);
    expect(cleanPoints([])).toEqual([]);
  });

  it('gives each axis its own nice scale', () => {
    const { x, y } = scatterScales([
      { x: 0.8, y: 1200 },
      { x: 3.1, y: 4800 },
    ]);
    expect(x.min).toBeLessThanOrEqual(0.8);
    expect(x.max).toBeGreaterThanOrEqual(3.1);
    expect(y.min).toBeLessThanOrEqual(1200);
    expect(y.max).toBeGreaterThanOrEqual(4800);
    expect(x.step).toBeLessThan(y.step);
  });

  it('handles no point and one point', () => {
    const empty = scatterScales([]);
    expect(empty.x.ticks).toEqual([0, 0.25, 0.5, 0.75, 1]);
    const one = scatterScales([{ x: 12, y: -4 }]);
    expect(one.x.min).toBeLessThan(12);
    expect(one.x.max).toBeGreaterThan(12);
    expect(one.y.min).toBeLessThan(-4);
    expect(one.y.max).toBeGreaterThan(-4);
  });

  it('handles negative and very large coordinates', () => {
    const { x, y } = scatterScales([
      { x: -250, y: 1e12 },
      { x: 250, y: 9e12 },
    ]);
    expect(x.ticks).toContain(0);
    expect(y.max).toBeGreaterThanOrEqual(9e12);
    expect(y.ticks.every(Number.isFinite)).toBe(true);
  });
});

describe('markerPath', () => {
  it('gives 8 different shapes and repeats after that', () => {
    const shapes = Array.from({ length: STAR_CHART_MARKERS }, (_, i) => markerPath(i, 0, 0, 5));
    expect(new Set(shapes).size).toBe(STAR_CHART_MARKERS);
    expect(markerPath(8, 0, 0, 5)).toBe(shapes[0]);
    expect(markerPath(-1, 0, 0, 5)).toBe(shapes[7]);
  });

  it('moves with the center and never produces NaN', () => {
    for (let i = 0; i < STAR_CHART_MARKERS; i++) {
      const path = markerPath(i, 120.5, 40, 5);
      expect(path).not.toContain('NaN');
      expect(path).toMatch(/^M/);
      expect(path).toMatch(/Z$/);
    }
    expect(markerPath(1, 10, 10, 10)).toBe('M1.2,1.2L18.8,1.2L18.8,18.8L1.2,18.8Z');
  });

  it('keeps a zero radius from breaking the path', () => {
    expect(markerPath(3, 5, 5, 0)).not.toContain('NaN');
    expect(markerPath(0, 5, 5, -2)).not.toContain('NaN');
  });
});
