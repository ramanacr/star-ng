/**
 * Row pinning of `star-table`: rows kept at the top or the bottom of the body. Ignite UI
 * `pinRow` / `unpinRow`, AG Grid `pinnedTopRowData` / `pinnedBottomRowData`.
 */

/** Edge of the body where a pinned row stays. */
export type StarRowPinSide = 'top' | 'bottom';

/**
 * Pinned rows by edge: row keys (`dataKey` value, else the row object), in display order.
 * `pinnedRows` model of `star-table`.
 */
export interface StarRowPins {
  readonly top?: readonly unknown[];
  readonly bottom?: readonly unknown[];
}

/** `rowPin` output: the row and its new edge, `null` when it was unpinned. */
export interface StarRowPinEvent<T> {
  readonly row: T;
  readonly side: StarRowPinSide | null;
}

/** Edge of a row key in `pins`, or `null`. */
export function rowPinSide(pins: StarRowPins, key: unknown): StarRowPinSide | null {
  if (pins.top?.some((item) => Object.is(item, key))) return 'top';
  if (pins.bottom?.some((item) => Object.is(item, key))) return 'bottom';
  return null;
}

/** `pins` with `key` moved to `side` (at its end), or removed when `side` is `null`. */
export function withRowPin(
  pins: StarRowPins,
  key: unknown,
  side: StarRowPinSide | null,
): StarRowPins {
  const top = (pins.top ?? []).filter((item) => !Object.is(item, key));
  const bottom = (pins.bottom ?? []).filter((item) => !Object.is(item, key));
  if (side === 'top') top.push(key);
  if (side === 'bottom') bottom.push(key);
  return { top, bottom };
}

/**
 * Splits rows into the pinned top rows, the other rows and the pinned bottom rows. The pinned
 * parts follow the key order of `pins`; a key with no row is left out.
 */
export function splitPinnedRows<T>(
  rows: readonly T[],
  pins: StarRowPins,
  keyOf: (row: T) => unknown,
): { readonly top: readonly T[]; readonly rest: readonly T[]; readonly bottom: readonly T[] } {
  const topKeys = pins.top ?? [];
  const bottomKeys = pins.bottom ?? [];
  if (!topKeys.length && !bottomKeys.length) return { top: [], rest: rows, bottom: [] };
  const byKey = new Map<unknown, T>();
  const rest: T[] = [];
  for (const row of rows) {
    const key = keyOf(row);
    if (rowPinSide(pins, key)) byKey.set(key, row);
    else rest.push(row);
  }
  const pick = (keys: readonly unknown[]) =>
    keys.flatMap((key) => (byKey.has(key) ? [byKey.get(key) as T] : []));
  return { top: pick(topKeys), rest, bottom: pick(bottomKeys) };
}

/**
 * Column selection (`selectionMode="column"`): the new selection after a click on the header of
 * `field`. A plain click selects only that column, Ctrl / Cmd toggles it, Shift selects the
 * columns from the anchor to it (in display order).
 */
export function nextColumnSelection(
  current: readonly string[],
  fields: readonly string[],
  field: string,
  anchor: string | null,
  keys: { readonly shift: boolean; readonly toggle: boolean },
): readonly string[] {
  if (keys.shift && anchor !== null && fields.includes(anchor)) {
    const from = fields.indexOf(anchor);
    const to = fields.indexOf(field);
    const [start, end] = from <= to ? [from, to] : [to, from];
    return fields.slice(start, end + 1);
  }
  if (keys.toggle) {
    return current.includes(field)
      ? current.filter((item) => item !== field)
      : fields.filter((item) => item === field || current.includes(item));
  }
  return [field];
}
