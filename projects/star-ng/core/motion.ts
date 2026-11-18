/**
 * True when motion must be reduced: the operating system asks for it (`prefers-reduced-motion`),
 * or `provideStarNg({ reducedMotion: 'always' })` set `data-star-motion="reduced"` on `<html>`.
 * Controls with motion in script (ripple, carousel autoplay, smooth scroll) check it before they
 * move. Without a document (server) it is false.
 */
export function starPrefersReducedMotion(doc: Document | null | undefined): boolean {
  if (!doc) return false;
  if (doc.documentElement?.getAttribute('data-star-motion') === 'reduced') return true;
  return doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}
