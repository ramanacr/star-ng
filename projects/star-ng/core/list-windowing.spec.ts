import {
  StarLazyRequests,
  starListAriaPosition as ariaPosition,
  starListLayout as buildLayout,
  starListRowRendered as isRowRendered,
  starListKeyboardTarget as keyboardTarget,
  starListHeight as listHeight,
  starListPageSize as pageSize,
  starListRevealOffset as revealOffset,
  starListRevealRows as revealRows,
  starListLazyRange,
  starListTypeaheadIndex as typeaheadIndex,
} from './list-windowing';

interface Order {
  name: string;
  region: string;
}

const ORDERS: Order[] = [
  { name: 'Order 1', region: 'East' },
  { name: 'Order 2', region: 'East' },
  { name: 'Order 3', region: 'West' },
  { name: 'Order 4', region: 'West' },
  { name: 'Order 5', region: 'West' },
];

describe('windowed list: row model', () => {
  it('has one row per option without groups', () => {
    const layout = buildLayout(ORDERS, null, 'lb');
    expect(layout.rows.length).toBe(5);
    expect(layout.rows.every((row) => row.kind === 'option')).toBe(true);
    expect(layout.rowOfOption).toEqual([0, 1, 2, 3, 4]);
  });

  it('puts one heading row before each group and keeps ids of the form used by the default list', () => {
    const layout = buildLayout(ORDERS, (o) => o.region, 'lb');
    expect(
      layout.rows.map((row) => (row.kind === 'group' ? `#${row.label}` : row.option.name)),
    ).toEqual(['#East', 'Order 1', 'Order 2', '#West', 'Order 3', 'Order 4', 'Order 5']);
    expect(layout.rowOfOption).toEqual([1, 2, 4, 5, 6]);
    const east = layout.rows[0];
    const west = layout.rows[3];
    expect(east.kind === 'group' && east.id).toBe('lb-group-0');
    expect(west.kind === 'group' && west.id).toBe('lb-group-2');
    const order4 = layout.rows[5];
    expect(order4.kind === 'option' && order4.groupId).toBe('lb-group-2');
    expect(order4.kind === 'option' && order4.groupRow).toBe(3);
  });

  it('has no rows for no options', () => {
    const layout = buildLayout<Order>([], (o) => o.region, 'lb');
    expect(layout.rows).toEqual([]);
    expect(layout.rowOfOption).toEqual([]);
  });

  it('keeps row keys unique and stable by option index', () => {
    const layout = buildLayout(ORDERS, (o) => o.region, 'lb');
    const keys = layout.rows.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(layout.rows[1].key).toBe('o:0');
  });

  it('handles 10,000 options with 5 groups in one pass', () => {
    const many = Array.from({ length: 10_000 }, (_, i) => ({
      name: `Order ${i + 1}`,
      region: `Region ${Math.floor(i / 2000)}`,
    }));
    const layout = buildLayout(many, (o) => o.region, 'lb');
    expect(layout.rows.length).toBe(10_005);
    expect(layout.rowOfOption[9_999]).toBe(10_004);
  });
});

describe('windowed list: keyboard target', () => {
  it('moves by one and stops at the ends', () => {
    expect(keyboardTarget('ArrowDown', 3, 10, 5)).toBe(4);
    expect(keyboardTarget('ArrowDown', 9, 10, 5)).toBe(9);
    expect(keyboardTarget('ArrowUp', 3, 10, 5)).toBe(2);
    expect(keyboardTarget('ArrowUp', 0, 10, 5)).toBe(0);
  });

  it('starts at the first option from no active option', () => {
    expect(keyboardTarget('ArrowDown', -1, 10, 5)).toBe(0);
    expect(keyboardTarget('ArrowUp', -1, 10, 5)).toBe(0);
  });

  it('goes to the first and the last of all options, not of the rendered ones', () => {
    expect(keyboardTarget('Home', 7_500, 10_000, 5)).toBe(0);
    expect(keyboardTarget('End', 3, 10_000, 5)).toBe(9_999);
  });

  it('moves by a page and limits the result to the list', () => {
    expect(keyboardTarget('PageDown', 10, 10_000, 5)).toBe(15);
    expect(keyboardTarget('PageDown', 9_998, 10_000, 5)).toBe(9_999);
    expect(keyboardTarget('PageUp', 10, 10_000, 5)).toBe(5);
    expect(keyboardTarget('PageUp', 2, 10_000, 5)).toBe(0);
    expect(keyboardTarget('PageDown', -1, 10_000, 5)).toBe(5);
    expect(keyboardTarget('PageUp', -1, 10_000, 5)).toBe(9_994);
  });

  it('returns -1 for an empty list', () => {
    expect(keyboardTarget('End', -1, 0, 5)).toBe(-1);
  });

  it('sizes a page from the viewport and keeps one line of overlap', () => {
    expect(pageSize(256, 40)).toBe(5);
    expect(pageSize(10, 40)).toBe(1);
    expect(pageSize(0, 40)).toBe(1);
  });

  it('finds the first option that starts with the typed text, over all options', () => {
    const labels = Array.from(
      { length: 10_000 },
      (_, i) => `ORD-${String(i + 1).padStart(5, '0')}`,
    );
    const at = (i: number) => labels[i];
    expect(typeaheadIndex(labels.length, at, 'ord-07500')).toBe(7_499);
    expect(typeaheadIndex(labels.length, at, 'ord-10000')).toBe(9_999);
    expect(typeaheadIndex(labels.length, at, 'zz')).toBe(-1);
  });
});

describe('windowed list: scroll offset', () => {
  const size = 40;

  it('does not scroll when the rows are in view', () => {
    expect(revealOffset(3, 3, size, 80, 200)).toBeNull();
  });

  it('scrolls up to the top of a row above the view', () => {
    expect(revealOffset(1, 1, size, 200, 200)).toBe(40);
  });

  it('scrolls down so that a row below the view ends at the bottom edge', () => {
    expect(revealOffset(20, 20, size, 0, 200)).toBe(21 * size - 200);
  });

  it('shows the heading row with the first option of a group', () => {
    const layout = buildLayout(ORDERS, (o) => o.region, 'lb');
    expect(revealRows(layout, 0)).toEqual([0, 1]);
    expect(revealRows(layout, 1)).toEqual([2, 2]);
    expect(revealRows(layout, 2)).toEqual([3, 4]);
    expect(revealOffset(...revealRows(layout, 2), size, 4 * size, 200)).toBe(3 * size);
  });

  it('shows the first option at the top for the first group', () => {
    const layout = buildLayout(ORDERS, (o) => o.region, 'lb');
    expect(revealOffset(...revealRows(layout, 0), size, 100, 200)).toBe(0);
  });

  it('has no group row to show without groups', () => {
    const layout = buildLayout(ORDERS, null, 'lb');
    expect(revealRows(layout, 3)).toEqual([3, 3]);
  });

  it('moves a row below the view by the inset, and keeps the first row at the very top', () => {
    // The scroll container has 6 px of padding above the first row.
    expect(revealOffset(20, 20, size, 0, 200, 6)).toBe(6 + 21 * size - 200);
    expect(revealOffset(5, 5, size, 300, 200, 6)).toBe(6 + 5 * size);
    expect(revealOffset(0, 0, size, 100, 200, 6)).toBe(0);
    expect(revealOffset(3, 3, size, 80, 200, 6)).toBeNull();
    // Row 4 ends at 6 + 5 * 40 = 206, 6 px below the view: the inset counts.
    expect(revealOffset(4, 4, size, 0, 200, 6)).toBe(6 + 5 * size - 200);
  });

  it('computes the list height', () => {
    expect(listHeight('16rem', 10_000, 40)).toBe('min(16rem, 400000px)');
    expect(listHeight('16rem', 0, 40)).toBe('min(16rem, 0px)');
  });

  it('knows whether a row is rendered', () => {
    expect(isRowRendered(5, { start: 5, end: 9 })).toBe(true);
    expect(isRowRendered(9, { start: 5, end: 9 })).toBe(false);
    expect(isRowRendered(4, { start: 5, end: 9 })).toBe(false);
  });
});

describe('windowed list: ARIA values', () => {
  it('gives each option the size of the whole list and its position in it', () => {
    expect(ariaPosition(0, 10_000)).toEqual({ setsize: 10_000, posinset: 1 });
    expect(ariaPosition(9_999, 10_000)).toEqual({ setsize: 10_000, posinset: 10_000 });
  });
});

describe('lazy loading helpers', () => {
  const options = ['a', undefined, 'c', undefined];
  const layout = buildLayout(options, null, 'l');

  it('finds the options of a range and whether one is missing', () => {
    expect(starListLazyRange(layout, { start: 0, end: 1 }, (o) => o === undefined)).toEqual({
      first: 0,
      last: 0,
      missing: false,
    });
    expect(starListLazyRange(layout, { start: 1, end: 4 }, (o) => o === undefined)).toEqual({
      first: 1,
      last: 3,
      missing: true,
    });
    expect(starListLazyRange(layout, { start: 4, end: 9 }, (o) => o === undefined)).toBeNull();
  });

  it('asks once per range, and again for a new filter from index 0', () => {
    const requests = new StarLazyRequests();
    expect(requests.next(null, '', 20)).toEqual({ first: 0, last: 19, filter: '' });
    expect(requests.next(null, '', 20)).toBeNull();
    expect(requests.next({ first: 10, last: 19, missing: true }, '', 20)).toEqual({
      first: 10,
      last: 19,
      filter: '',
    });
    expect(requests.next({ first: 10, last: 19, missing: true }, '', 20)).toBeNull();
    expect(requests.next({ first: 10, last: 19, missing: false }, 'ber', 20)).toEqual({
      first: 0,
      last: 9,
      filter: 'ber',
    });
  });
});
