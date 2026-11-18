import { orderColumns, pinPlacements, pinSideOf, sameWidths, StarPinnable } from './table-pinning';

const COLUMNS: (StarPinnable & { width?: string })[] = [
  { field: 'region' },
  { field: 'id', frozen: true, width: '80px' },
  { field: 'total', pinned: 'end', width: '120px' },
  { field: 'units', width: '90px' },
  { field: 'margin', pinned: 'end', width: '100px' },
  { field: 'code', pinned: 'start', width: '60px' },
];

describe('table pinning helpers', () => {
  it('reads the side from the runtime pins, then pinned, then frozen', () => {
    expect(pinSideOf({ field: 'a' }, {})).toBeNull();
    expect(pinSideOf({ field: 'a', frozen: true }, {})).toBe('start');
    expect(pinSideOf({ field: 'a', pinned: 'end', frozen: true }, {})).toBe('end');
    expect(pinSideOf({ field: 'a', pinned: 'end' }, { a: null })).toBeNull();
    expect(pinSideOf({ field: 'a' }, { a: 'end' })).toBe('end');
  });

  it('orders start pins first and end pins last, each part in the column order', () => {
    const side = (column: StarPinnable) => pinSideOf(column, {});
    expect(orderColumns(COLUMNS, [], side).map((c) => c.field)).toEqual([
      'id',
      'code',
      'region',
      'units',
      'total',
      'margin',
    ]);
    expect(orderColumns(COLUMNS, ['margin', 'units', 'code'], side).map((c) => c.field)).toEqual([
      'code',
      'id',
      'units',
      'region',
      'margin',
      'total',
    ]);
  });

  it('offsets each pinned column by the pinned widths between it and its edge', () => {
    const side = (column: StarPinnable) => pinSideOf(column, {});
    const ordered = orderColumns(COLUMNS, [], side);
    const measured = { id: 80, code: 60, total: 120, margin: 100, region: 200, units: 90 };
    const placements = pinPlacements(ordered, side, measured, (c) => c.width ?? null, {
      start: 48,
      end: 72,
    });
    expect(placements.get('id')).toEqual({ side: 'start', offset: '48px', edge: false });
    expect(placements.get('code')).toEqual({ side: 'start', offset: '128px', edge: true });
    expect(placements.has('region')).toBe(false);
    // End pins count from the inline end: the last column touches the edge.
    expect(placements.get('margin')).toEqual({ side: 'end', offset: '72px', edge: false });
    expect(placements.get('total')).toEqual({ side: 'end', offset: '172px', edge: true });
  });

  it('uses the declared widths before the first measure, and the resized width', () => {
    const side = (column: StarPinnable) => pinSideOf(column, {});
    const ordered = orderColumns(COLUMNS, [], side);
    const resized: Record<string, string> = { id: '96px' };
    const placements = pinPlacements(
      ordered,
      side,
      {},
      (c) => resized[c.field] ?? (c as { width?: string }).width ?? null,
    );
    expect(placements.get('id')?.offset).toBe('0px');
    expect(placements.get('code')?.offset).toBe('calc(96px)');
    expect(placements.get('margin')?.offset).toBe('0px');
    expect(placements.get('total')?.offset).toBe('calc(100px)');
    const withBase = pinPlacements(ordered, side, {}, () => null, { start: 40, end: 0 });
    expect(withBase.get('code')?.offset).toBe('calc(40px + 0px)');
  });

  it('follows runtime pins: an unpinned column leaves its side', () => {
    const pins = { id: null, units: 'end' } as const;
    const side = (column: StarPinnable) => pinSideOf(column, pins);
    const ordered = orderColumns(COLUMNS, [], side);
    expect(ordered.map((c) => c.field)).toEqual([
      'code',
      'region',
      'id',
      'total',
      'units',
      'margin',
    ]);
    const placements = pinPlacements(ordered, side, {}, () => null);
    expect(placements.get('code')).toEqual({ side: 'start', offset: '0px', edge: true });
    expect(placements.get('total')?.edge).toBe(true);
    expect(placements.get('margin')?.edge).toBe(false);
  });

  it('compares width maps within half a pixel', () => {
    expect(sameWidths({ a: 10 }, { a: 10.4 })).toBe(true);
    expect(sameWidths({ a: 10 }, { a: 11 })).toBe(false);
    expect(sameWidths({ a: 10 }, { a: 10, b: 1 })).toBe(false);
  });
});
