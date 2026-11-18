/**
 * Event of `dropped` on `star-listbox` with `dragdrop`: an option was dragged (or moved with Alt +
 * Arrow keys) to a new place. `from` and `to` are the `dropListData` of the two lists (the listbox
 * itself without it). `previousIndex` and `index` are indexes in the `options` arrays, ready for
 * `moveItemInArray` (same list) or `transferArrayItem` (other list) of `@angular/cdk/drag-drop`.
 * PrimeNG `p-listbox` `dragdrop` with `onDrop`.
 */
export interface StarListboxDropEvent<T = unknown> {
  readonly item: T;
  readonly from: unknown;
  readonly to: unknown;
  readonly previousIndex: number;
  readonly index: number;
}

/**
 * Index in `options` for a drop at `position` among the shown options `visible` (filtered or
 * grouped). In the same list the item takes the place of the shown option at that position; in
 * another list it goes before it, or after the last shown option.
 */
export function starListboxDropIndex<T>(
  options: readonly T[],
  visible: readonly T[],
  position: number,
  sameList: boolean,
): number {
  if (!visible.length) return sameList ? 0 : options.length;
  if (sameList)
    return options.indexOf(visible[Math.min(Math.max(position, 0), visible.length - 1)]);
  if (position < visible.length) return options.indexOf(visible[Math.max(position, 0)]);
  return options.indexOf(visible[visible.length - 1]) + 1;
}
