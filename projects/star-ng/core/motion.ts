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
 * that never ends (a hidden tab); it is the cap Angular uses for `animate.leave`. Returns a
 * function that cancels the wait (it clears the timer and `done` does not run). Shared by the
 * entry points; not public API.
 */
export function ɵstarAfterExit(element: Element, done: () => void, timeout = 4000): () => void {
  const doc = element.ownerDocument;
  const running =
    typeof element.getAnimations === 'function' && !starPrefersReducedMotion(doc)
      ? element
          .getAnimations({ subtree: true })
          .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
      : [];
  if (!running.length) {
    done();
    return () => undefined;
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
  return () => {
    ended = true;
    clearTimeout(timer);
  };
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
    const wait: { cancel?: () => void } = {};
    const end = () => {
      if (ended) return;
      ended = true;
      watch?.disconnect();
      wait.cancel?.();
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
    wait.cancel = ɵstarAfterExit(target, end);
  };
}

/** Per document: the browser keeps a closing modal `<dialog>` in the top layer (CSS `overlay`). */
const overlaySupport = new WeakMap<Document, boolean>();

/**
 * True when the browser can show the exit transition of a `<dialog>` after `close()`: it supports
 * the CSS `overlay` property, which keeps a closing modal dialog in the top layer (Chromium).
 * Firefox and WebKit have no `overlay`: a closed dialog goes at once. Without `CSS.supports`
 * (server, jsdom) it is true, so nothing changes there. Read once per document. Shared by the
 * entry points; not public API.
 */
export function ɵstarDialogExitAfterClose(doc: Document): boolean {
  let known = overlaySupport.get(doc);
  if (known === undefined) {
    const css = doc.defaultView?.CSS;
    known = typeof css?.supports === 'function' ? css.supports('overlay', 'auto') : true;
    overlaySupport.set(doc, known);
  }
  return known;
}

/** A close of `ɵstarCloseDialog` that waits for the exit motion. */
export interface ɵStarDialogClose {
  /** Ends the motion now: closes the dialog and runs `closed` (a re-open during the exit). */
  finish(): void;
  /** Drops the close: the dialog stays as it is and `closed` does not run (a destroy). */
  cancel(): void;
}

/**
 * Closes a native `<dialog>` and then runs `closed`. Where the browser can show the exit after
 * `close()` (`ɵstarDialogExitAfterClose`), it closes at once and the CSS `allow-discrete`
 * transition runs. Elsewhere (Firefox, WebKit) it first sets `data-star-closing` on the open
 * dialog, so the control CSS moves it to its closed look while it is still shown, waits for those
 * animations (`ɵstarAfterExit`: at once under reduced motion or when nothing runs, 4 s at most),
 * and then closes. Returns the pending close, or `null` when it closed at once. Shared by the
 * entry points; not public API.
 */
export function ɵstarCloseDialog(
  dialog: HTMLDialogElement,
  closed: () => void,
): ɵStarDialogClose | null {
  const doc = dialog.ownerDocument;
  const close = () => {
    dialog.removeAttribute('data-star-closing');
    if (dialog.open) dialog.close();
    closed();
  };
  if (!dialog.open || ɵstarDialogExitAfterClose(doc) || starPrefersReducedMotion(doc)) {
    close();
    return null;
  }
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    close();
  };
  dialog.setAttribute('data-star-closing', '');
  ɵstarAfterExit(dialog, end);
  // Nothing ran (no motion): it closed at once.
  if (done) return null;
  return {
    finish: end,
    cancel: () => {
      if (done) return;
      done = true;
      dialog.removeAttribute('data-star-closing');
    },
  };
}
