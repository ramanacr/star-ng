import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, DOCUMENT, effect, inject, PLATFORM_ID, Signal, signal } from '@angular/core';

/**
 * Width of the browser window in CSS pixels, updated on resize. `null` on the server, so a
 * prerendered page uses the default layout. Call it in an injection context.
 *
 * With `when`, the resize listener exists only while `when()` is true (for example while a
 * `breakpoints` input is set), and the width is `null` otherwise. Without it, the listener starts
 * at once.
 */
export function starViewportWidth(when?: () => boolean): Signal<number | null> {
  const width = signal<number | null>(null);
  const view = inject(DOCUMENT).defaultView;
  if (!view || !isPlatformBrowser(inject(PLATFORM_ID))) return width.asReadonly();
  const update = () => width.set(view.innerWidth);
  let listening = false;
  const start = () => {
    if (listening) return;
    listening = true;
    update();
    view.addEventListener('resize', update, { passive: true });
  };
  const stop = () => {
    if (!listening) return;
    listening = false;
    view.removeEventListener('resize', update);
    width.set(null);
  };
  if (when) effect(() => (when() ? start() : stop()));
  else start();
  inject(DestroyRef).onDestroy(stop);
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
