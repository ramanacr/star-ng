import {
  starCountMatches,
  starDocumentLayout,
  starDocumentPageAt,
  starDocumentScale,
  starDocumentWindow,
  starDocumentZoomStep,
  starRotatedSize,
} from './viewer-model';

describe('document viewer model', () => {
  const a4 = { width: 595, height: 842 };

  it('rotates page sizes', () => {
    expect(starRotatedSize(a4, 0)).toEqual(a4);
    expect(starRotatedSize(a4, 90)).toEqual({ width: 842, height: 595 });
    expect(starRotatedSize(a4, 180)).toEqual(a4);
    expect(starRotatedSize(a4, 270)).toEqual({ width: 842, height: 595 });
  });

  it('computes the scale of fit width, fit page and a percentage', () => {
    const view = { width: 640, height: 500 };
    expect(starDocumentScale('fit-width', a4, view, 20)).toBeCloseTo(600 / 595);
    expect(starDocumentScale('fit-page', a4, view, 20)).toBeCloseTo(460 / 842);
    expect(starDocumentScale(1.5, a4, view, 20)).toBe(1.5);
    // Limits: 10 % to 800 %, and a sane value without a measured view.
    expect(starDocumentScale(20, a4, view, 20)).toBe(8);
    expect(starDocumentScale(0.01, a4, view, 20)).toBe(0.1);
    expect(starDocumentScale('fit-width', a4, { width: 0, height: 0 }, 20)).toBe(1);
  });

  it('steps the zoom through the preset percentages', () => {
    expect(starDocumentZoomStep(1, 1)).toBe(1.25);
    expect(starDocumentZoomStep(1, -1)).toBe(0.75);
    expect(starDocumentZoomStep(1.1, 1)).toBe(1.25);
    expect(starDocumentZoomStep(1.1, -1)).toBe(1);
    expect(starDocumentZoomStep(4, 1)).toBe(4);
    expect(starDocumentZoomStep(0.25, -1)).toBe(0.25);
  });

  it('lays out pages one below the other with a gap', () => {
    const layout = starDocumentLayout([100, 200, 50], 10, 16);
    expect(layout).toEqual([16, 126, 336, 396]);
  });

  it('windows the pages in view plus one page on each side', () => {
    const offsets = starDocumentLayout([100, 100, 100, 100, 100, 100], 10, 0);
    // Offsets: 0, 110, 220, 330, 440, 550, 660.
    expect(starDocumentWindow(offsets, 0, 150, 1)).toEqual({ start: 0, end: 3 });
    expect(starDocumentWindow(offsets, 300, 100, 1)).toEqual({ start: 1, end: 5 });
    expect(starDocumentWindow(offsets, 600, 100, 1)).toEqual({ start: 4, end: 6 });
    expect(starDocumentWindow([0], 0, 100, 1)).toEqual({ start: 0, end: 0 });
  });

  it('finds the page at a scroll position', () => {
    const offsets = starDocumentLayout([100, 100, 100], 10, 0);
    expect(starDocumentPageAt(offsets, 0)).toBe(0);
    expect(starDocumentPageAt(offsets, 105)).toBe(0);
    expect(starDocumentPageAt(offsets, 111)).toBe(1);
    expect(starDocumentPageAt(offsets, 9999)).toBe(2);
  });

  it('counts matches without case', () => {
    expect(starCountMatches('Total: total TOTAL', 'total')).toBe(3);
    expect(starCountMatches('aaaa', 'aa')).toBe(2);
    expect(starCountMatches('abc', '')).toBe(0);
  });
});
