/**
 * True when motion must be reduced: the operating system asks for it (`prefers-reduced-motion`),
 * or `provideStarNg({ reducedMotion: 'always' })` set `data-star-motion="reduced"` on `<html>`.
 * Controls with motion in script (ripple, carousel autoplay, smooth scroll) check it before they
 * move. Without a document (server) it is false. PrimeNG: none; Material: none (CDK has no helper).
 */
export function starPrefersReducedMotion(doc: Document | null | undefined): boolean {
  if (!doc) return false;
  if (doc.documentElement?.getAttribute('data-star-motion') === 'reduced') return true;
  return doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

/**
 * Runs `done` when the exit motion of `element` and its subtree has ended: the CSS transitions
 * and animations that run now (an `allow-discrete` close transition of a `<dialog>`, for
 * example). A service that removes an element it created calls it after the close, so the exit
 * shows before the element leaves the DOM. `done` runs at once when nothing runs, under reduced
 * motion, where the browser has no `getAnimations` (jsdom, server), and for an endless animation
 * (a spinner in the content) it does not wait. `timeout` (ms) is the fallback for an animation
 * that never ends (a hidden tab); it is the cap Angular uses for `animate.leave`. Shared by the
 * entry points; not public API.
 */
export function ɵstarAfterExit(element: Element, done: () => void, timeout = 4000): void {
  const doc = element.ownerDocument;
  const running =
    typeof element.getAnimations === 'function' && !starPrefersReducedMotion(doc)
      ? element
          .getAnimations({ subtree: true })
          .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
      : [];
  if (!running.length) {
    done();
    return;
  }
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    clearTimeout(timer);
    done();
  };
  const timer = setTimeout(end, timeout);
  void Promise.allSettled(running.map((animation) => animation.finished)).then(end);
}

/** Options of `ɵstarLeaveWithClass`. */
export interface ɵStarLeaveOptions {
  /**
   * Move the focus out of the leaving element first (to the page body), so code that returns the
   * focus "when it has nowhere else to be" (a context menu that closed) sees that at once, and the
   * focus is not lost later when the element goes. For menus.
   */
  readonly blurFocus?: boolean;
}

/**
 * An `animate.leave` function (`(animate.leave)="leave($event)"`) for an overlay panel: it adds
 * `className` and ends the leave when its motion has ended (`ɵstarAfterExit`, so at once under
 * reduced motion). When a new element comes into the same parent while the panel leaves (the
 * overlay opens again within the fade and the CDK attaches the new panel to the same pane), the
 * old panel goes at once: never two panels, two positions or two sets of ids. Shared by the entry
 * points; not public API.
 */
export function ɵstarLeaveWithClass(
  className: string,
  options: ɵStarLeaveOptions = {},
): (event: { target: Element; animationComplete: () => void }) => void {
  return ({ target, animationComplete }) => {
    if (options.blurFocus) {
      const active = target.ownerDocument.activeElement;
      if (active instanceof HTMLElement && target.contains(active)) active.blur();
    }
    target.classList.add(className);
    let ended = false;
    let watch: MutationObserver | null = null;
    const end = () => {
      if (ended) return;
      ended = true;
      watch?.disconnect();
      animationComplete();
    };
    const parent = target.parentNode;
    if (parent && typeof MutationObserver !== 'undefined') {
      watch = new MutationObserver((records) => {
        const added = records.some((record) =>
          [...record.addedNodes].some((node) => node !== target && node.nodeType === 1),
        );
        if (added) end();
      });
      watch.observe(parent, { childList: true });
    }
    ɵstarAfterExit(target, end);
  };
}
