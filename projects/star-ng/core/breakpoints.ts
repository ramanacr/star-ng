import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, DOCUMENT, inject, PLATFORM_ID, Signal, signal } from '@angular/core';

/**
 * Width of the browser window in CSS pixels, updated on resize. `null` on the server, so a
 * prerendered page uses the default layout. Call it in an injection context.
 */
export function starViewportWidth(): Signal<number | null> {
  const width = signal<number | null>(null);
  const view = inject(DOCUMENT).defaultView;
  if (!view || !isPlatformBrowser(inject(PLATFORM_ID))) return width.asReadonly();
  const update = () => width.set(view.innerWidth);
  update();
  view.addEventListener('resize', update, { passive: true });
  inject(DestroyRef).onDestroy(() => view.removeEventListener('resize', update));
  return width.asReadonly();
}

/** A breakpoint key in pixels: `'640px'`, `'40rem'` or `'40em'` (16px each), or a plain number. */
function breakpointPixels(key: string): number {
  const value = Number.parseFloat(key);
  return /r?em\s*$/.test(key) ? value * 16 : value;
}

/**
 * Value of a PrimeNG-style `breakpoints` map (`{ '<max-width>': value }`) for a window width:
 * the value of the smallest max-width that is not below the width. `undefined` when no key
 * matches or the width is unknown (server).
 *
 * `starBreakpointValue({ '960px': '75vw', '640px': '100vw' }, 700)` returns `'75vw'`.
 */
export function starBreakpointValue<T>(
  breakpoints: Readonly<Record<string, T>> | null | undefined,
  width: number | null,
): T | undefined {
  if (!breakpoints || width === null) return undefined;
  let best: { max: number; value: T } | undefined;
  for (const [key, value] of Object.entries(breakpoints)) {
    const max = breakpointPixels(key);
    if (Number.isNaN(max) || width > max) continue;
    if (!best || max < best.max) best = { max, value };
  }
  return best?.value;
}
