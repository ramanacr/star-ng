import { ɵStarItemKeys, ɵstarKeyed } from './track-keys';

const ɵstarRepeatKeys = (items: readonly unknown[]) => ɵstarKeyed(items).map((entry) => entry.key);

describe('ɵstarKeyed', () => {
  it('keys a list without repeats by the items', () => {
    expect(ɵstarRepeatKeys(['a', 'b', 1])).toEqual(['a', 'b', 1]);
  });

  it('gives every repeat its own key, the same for the same occurrence', () => {
    const keys = ɵstarRepeatKeys(['a', 'b', 'a', 'a']);
    expect(new Set(keys).size).toBe(4);
    expect(keys[0]).toBe('a');
    // Removing the first "a" keeps the key of the "b" row, and the 2nd "a" key stays.
    expect(ɵstarRepeatKeys(['b', 'a', 'a'])).toEqual([keys[1], keys[0], keys[2]]);
  });

  it('keeps 1 and "1" apart and keys a repeated object', () => {
    const option = { id: 1 };
    const keys = ɵstarRepeatKeys([1, '1', 1, option, option]);
    expect(new Set(keys).size).toBe(5);
    expect(keys[3]).toBe(option);
  });
});

describe('ɵStarItemKeys', () => {
  it('gives a replacement the key of the object it replaces', () => {
    const keys = new ɵStarItemKeys();
    const rule = { value: 1 };
    const other = { value: 2 };
    const key = keys.keyOf(rule);
    expect(keys.keyOf(other)).not.toBe(key);
    const next = keys.carry(rule, { ...rule, value: 3 });
    expect(keys.keyOf(next)).toBe(key);
    expect(keys.keyOf(rule)).toBe(key);
  });
});
