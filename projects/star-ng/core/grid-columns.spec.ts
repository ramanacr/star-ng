import { describe, expect, it } from 'vitest';
import {
  ɵstarAriaSort,
  ɵstarClampColumnWidth,
  ɵstarNextSort,
  ɵstarSameWidths,
  ɵstarSortRank,
  ɵstarSortRules,
  ɵstarStickyOffsets,
  ɵstarUnchangedEdit,
} from './grid-columns';

describe('grid column helpers', () => {
  it('builds the sort rules from the sort inputs', () => {
    expect(ɵstarSortRules(false, [], 'city', -1)).toEqual([{ field: 'city', order: -1 }]);
    expect(ɵstarSortRules(false, [], null, 1)).toEqual([]);
    const meta = [{ field: 'a', order: 1 as const }];
    expect(ɵstarSortRules(true, meta, 'b', 1)).toBe(meta);
  });

  it('toggles and adds sort columns', () => {
    const one = ɵstarNextSort([], 'a', false, false);
    expect(one).toEqual({ meta: [], first: { field: 'a', order: 1 } });
    const flipped = ɵstarNextSort([{ field: 'a', order: 1 }], 'a', false, false);
    expect(flipped.first).toEqual({ field: 'a', order: -1 });
    const added = ɵstarNextSort([{ field: 'a', order: 1 }], 'b', true, true);
    expect(added.meta).toEqual([
      { field: 'a', order: 1 },
      { field: 'b', order: 1 },
    ]);
    expect(added.first).toEqual({ field: 'a', order: 1 });
  });

  it('reports aria-sort and the rank of a multi-column sort', () => {
    const sorts = [
      { field: 'a', order: -1 as const },
      { field: 'b', order: 1 as const },
    ];
    expect(ɵstarAriaSort(true, sorts, 'a')).toBe('descending');
    expect(ɵstarAriaSort(true, sorts, 'b')).toBe('none');
    expect(ɵstarAriaSort(false, sorts, 'a')).toBeNull();
    expect(ɵstarSortRank(sorts, 'b')).toBe(2);
    expect(ɵstarSortRank(sorts.slice(0, 1), 'a')).toBeNull();
  });

  it('clamps widths and compares width maps', () => {
    expect(ɵstarClampColumnWidth(10)).toBe(48);
    expect(ɵstarClampColumnWidth(120.6)).toBe(121);
    expect(ɵstarSameWidths({ a: 10 }, { a: 10.4 })).toBe(true);
    expect(ɵstarSameWidths({ a: 10 }, { a: 11 })).toBe(false);
  });

  it('computes sticky offsets from measured or declared widths', () => {
    const columns = [{ field: 'a' }, { field: 'b' }, { field: 'c' }];
    expect(ɵstarStickyOffsets(columns, { a: 100, b: 50.555 }, () => null)).toEqual([
      '0px',
      '100px',
      '150.56px',
    ]);
    expect(ɵstarStickyOffsets(columns, {}, () => '8rem', 40)).toEqual([
      '40px',
      'calc(40px + 8rem)',
      'calc(40px + 8rem + 8rem)',
    ]);
  });

  it('treats empty text as no change of a missing value', () => {
    expect(ɵstarUnchangedEdit('', undefined)).toBe(true);
    expect(ɵstarUnchangedEdit(Number.NaN, Number.NaN)).toBe(true);
    expect(ɵstarUnchangedEdit('x', 'y')).toBe(false);
  });
});
