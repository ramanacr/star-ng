/** An item of a list with its `@for` track key (see `ɵstarKeyed`). */
export interface ɵStarKeyed<T> {
  readonly key: unknown;
  readonly item: T;
}

/**
 * `@for` entries for a list whose items can repeat (two equal tags, the same option twice):
 * each item with a key, the item itself on its first occurrence and a key made of the
 * occurrence number and the item on each repeat. `@for (entry of entries(); track entry.key)`
 * then gives every row its own key (no NG0955 warning), and a removed item takes its own row
 * with it. The key lives in the entry, so a row keeps the key it was made with (Angular reads
 * the keys of the old rows from their own items). Exact repeats are not told apart: when the user
 * removes the first of two equal tags, the remaining one takes the key (and the row) of the first,
 * and the row of the repeat key leaves; the value, count and announcement are right. A repeat of
 * an object item is keyed by the index of its first occurrence. Shared by the entry points; not
 * public API.
 */
export function ɵstarKeyed<T>(items: readonly T[]): ɵStarKeyed<T>[] {
  const seen = new Map<unknown, number>();
  return items.map((item) => {
    const count = (seen.get(item) ?? 0) + 1;
    seen.set(item, count);
    if (count === 1) return { key: item, item };
    const of =
      item !== null && (typeof item === 'object' || typeof item === 'function')
        ? `@${items.indexOf(item)}`
        : `${typeof item}:${String(item)}`;
    return { key: `\u0000${count}\u0000${of}`, item };
  });
}

/**
 * `@for` track keys for immutable items that are replaced on each edit (a rule `{ ...rule,
 * value }`): `keyOf` gives each object a number, and `carry` gives a replacement the number of
 * the object it replaces, so the row (and the focus in it) stays. An object that comes from
 * outside gets a new number. Shared by the entry points; not public API.
 */
export class ɵStarItemKeys {
  private readonly keys = new WeakMap<object, number>();
  private next = 0;

  keyOf(item: object): number {
    let key = this.keys.get(item);
    if (key === undefined) {
      key = ++this.next;
      this.keys.set(item, key);
    }
    return key;
  }

  /** Gives `to` the key of `from` (when `from` has one) and returns `to`. */
  carry<T extends object>(from: object, to: T): T {
    const key = this.keys.get(from);
    if (key !== undefined && from !== to) this.keys.set(to, key);
    return to;
  }
}
