/**
 * Scroll helpers of `star-tabs` with `scrollable`. They read the DOM only when they are called,
 * so they are safe on the server (no call there) and in tests (no layout: every size is 0).
 */
import { starPrefersReducedMotion } from '@star-ng/ui/core';

/** Which ends of a scroll container have hidden content. */
export interface StarTabsOverflow {
  /** Content is hidden before the start (left in left-to-right, right in right-to-left, top). */
  readonly start: boolean;
  /** Content is hidden after the end. */
  readonly end: boolean;
}

export const STAR_TABS_NO_OVERFLOW: StarTabsOverflow = { start: false, end: false };

/** The overflow of `list` along its axis. A right-to-left list has a negative `scrollLeft`. */
export function starTabsOverflow(list: HTMLElement, vertical: boolean): StarTabsOverflow {
  const position = Math.abs(vertical ? list.scrollTop : list.scrollLeft);
  const size = vertical ? list.clientHeight : list.clientWidth;
  const total = vertical ? list.scrollHeight : list.scrollWidth;
  if (total <= size + 1) return STAR_TABS_NO_OVERFLOW;
  return { start: position > 1, end: position + size < total - 1 };
}

/** `true` when the user asks for less motion, or when the browser cannot say. */
function reducedMotion(list: HTMLElement): boolean {
  const view = list.ownerDocument.defaultView;
  return !view?.matchMedia || starPrefersReducedMotion(list.ownerDocument);
}

/** Scrolls `list` by `delta` pixels (physical: positive is right or down). */
export function starTabsScrollBy(list: HTMLElement, delta: number, vertical: boolean): void {
  if (!delta) return;
  if (!reducedMotion(list) && typeof list.scrollBy === 'function') {
    list.scrollBy(
      vertical ? { top: delta, behavior: 'smooth' } : { left: delta, behavior: 'smooth' },
    );
    return;
  }
  if (vertical) list.scrollTop += delta;
  else list.scrollLeft += delta;
}

/**
 * Scrolls `list` by most of its visible size: `step` 1 toward the end, -1 toward the start. In
 * right-to-left the end of a horizontal list is on the left.
 */
export function starTabsScrollPage(
  list: HTMLElement,
  step: 1 | -1,
  vertical: boolean,
  rtl: boolean,
): void {
  const size = vertical ? list.clientHeight : list.clientWidth;
  const amount = Math.max(40, Math.round(size * 0.8)) * step;
  starTabsScrollBy(list, !vertical && rtl ? -amount : amount, vertical);
}

/** Scrolls `list` the least amount that shows the whole of `item` (no page scroll). */
export function starTabsReveal(list: HTMLElement, item: HTMLElement, vertical: boolean): void {
  const outer = list.getBoundingClientRect();
  const inner = item.getBoundingClientRect();
  const [low, high, itemLow, itemHigh] = vertical
    ? [outer.top, outer.bottom, inner.top, inner.bottom]
    : [outer.left, outer.right, inner.left, inner.right];
  let delta = 0;
  if (itemLow < low) delta = itemLow - low;
  else if (itemHigh > high) delta = Math.min(itemHigh - high, itemLow - low);
  if (!delta) return;
  if (vertical) list.scrollTop += delta;
  else list.scrollLeft += delta;
}
