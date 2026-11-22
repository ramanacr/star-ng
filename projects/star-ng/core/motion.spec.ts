import { ɵstarAfterExit, ɵstarCloseDialog, ɵstarLeaveWithClass } from './motion';

/** A fake animation whose `finished` promise the test settles. */
function fakeAnimation(iterations = 1) {
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => (finish = resolve));
  return {
    animation: {
      finished,
      effect: { getComputedTiming: () => ({ iterations }) },
    } as unknown as Animation,
    finish,
  };
}

function elementWith(animations: Animation[]): HTMLElement {
  const element = document.createElement('div');
  (element as unknown as { getAnimations: () => Animation[] }).getAnimations = () => animations;
  return element;
}

describe('ɵstarAfterExit', () => {
  beforeEach(() => document.documentElement.removeAttribute('data-star-motion'));
  afterEach(() => {
    vi.useRealTimers();
    // The specs share one window: leave no reduced-motion setting to the next file.
    document.documentElement.removeAttribute('data-star-motion');
  });

  it('runs at once when the element has no getAnimations (jsdom, server)', () => {
    const done = vi.fn();
    ɵstarAfterExit(document.createElement('div'), done);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('runs at once when no animation runs', () => {
    const done = vi.fn();
    ɵstarAfterExit(elementWith([]), done);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('runs at once under reduced motion, without reading the animations', () => {
    document.documentElement.setAttribute('data-star-motion', 'reduced');
    const { animation } = fakeAnimation();
    const done = vi.fn();
    ɵstarAfterExit(elementWith([animation]), done);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('waits until every finite animation has finished, then runs once', async () => {
    const a = fakeAnimation();
    const b = fakeAnimation();
    const done = vi.fn();
    ɵstarAfterExit(elementWith([a.animation, b.animation]), done);
    a.finish();
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    b.finish();
    await new Promise((resolve) => setTimeout(resolve));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('ignores an endless animation (a spinner in the content)', () => {
    const spinner = fakeAnimation(Infinity);
    const done = vi.fn();
    ɵstarAfterExit(elementWith([spinner.animation]), done);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('runs after the timeout when an animation never ends', () => {
    vi.useFakeTimers();
    const stuck = fakeAnimation();
    const done = vi.fn();
    ɵstarAfterExit(elementWith([stuck.animation]), done, 500);
    vi.advanceTimersByTime(499);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
    stuck.finish();
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe('ɵstarAfterExit cancel', () => {
  afterEach(() => vi.useRealTimers());

  it('clears the timer and does not run done after a cancel', () => {
    vi.useFakeTimers();
    const stuck = fakeAnimation();
    const done = vi.fn();
    const cancel = ɵstarAfterExit(elementWith([stuck.animation]), done, 500);
    expect(vi.getTimerCount()).toBe(1);
    cancel();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(done).not.toHaveBeenCalled();
  });
});

describe('ɵstarLeaveWithClass', () => {
  it('moves the focus out, adds the class and completes when no motion runs', () => {
    const panel = document.createElement('div');
    const item = document.createElement('button');
    panel.append(item);
    document.body.append(panel);
    item.focus();
    expect(document.activeElement).toBe(item);
    const animationComplete = vi.fn();

    ɵstarLeaveWithClass('x--leaving', { blurFocus: true })({ target: panel, animationComplete });

    expect(document.activeElement).toBe(document.body);
    expect(panel.classList).toContain('x--leaving');
    expect(animationComplete).toHaveBeenCalledTimes(1);
    panel.remove();
  });

  it('keeps the focus without blurFocus', () => {
    const panel = document.createElement('div');
    const field = document.createElement('input');
    panel.append(field);
    document.body.append(panel);
    field.focus();
    ɵstarLeaveWithClass('x--leaving')({ target: panel, animationComplete: vi.fn() });
    expect(document.activeElement).toBe(field);
    panel.remove();
  });

  it('ends the leave at once when a new element comes into the same parent', async () => {
    const pane = document.createElement('div');
    const panel = document.createElement('div');
    pane.append(panel);
    document.body.append(pane);
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => (finish = resolve));
    const fade = { finished, effect: { getComputedTiming: () => ({ iterations: 1 }) } };
    (panel as unknown as { getAnimations: () => unknown[] }).getAnimations = () => [fade];
    const animationComplete = vi.fn();

    ɵstarLeaveWithClass('x--leaving')({ target: panel, animationComplete });
    await Promise.resolve();
    expect(animationComplete).not.toHaveBeenCalled();

    pane.append(document.createElement('div')); // the overlay opened again
    await new Promise((resolve) => setTimeout(resolve));
    expect(animationComplete).toHaveBeenCalledTimes(1);
    finish();
    await new Promise((resolve) => setTimeout(resolve));
    expect(animationComplete).toHaveBeenCalledTimes(1);
    pane.remove();
  });

  it('clears the wait timer when the leave ends early', async () => {
    vi.useFakeTimers();
    try {
      const pane = document.createElement('div');
      const panel = document.createElement('div');
      pane.append(panel);
      document.body.append(pane);
      const fade = fakeAnimation();
      (panel as unknown as { getAnimations: () => unknown[] }).getAnimations = () => [
        fade.animation,
      ];
      const animationComplete = vi.fn();
      ɵstarLeaveWithClass('x--leaving')({ target: panel, animationComplete });
      expect(vi.getTimerCount()).toBe(1);
      pane.append(document.createElement('div'));
      await vi.advanceTimersByTimeAsync(0);
      expect(animationComplete).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
      pane.remove();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('ɵstarCloseDialog', () => {
  /** A document whose window has (or has not) CSS `overlay`, and an open dialog in it. */
  function setup(overlay: boolean) {
    const doc = document.implementation.createHTMLDocument('dialogs');
    Object.defineProperty(doc, 'defaultView', {
      value: { CSS: { supports: (property: string) => overlay && property === 'overlay' } },
    });
    const dialog = doc.createElement('dialog');
    dialog.setAttribute('open', '');
    const close = vi.fn(() => dialog.removeAttribute('open'));
    Object.assign(dialog, { close });
    Object.defineProperty(dialog, 'open', { get: () => dialog.hasAttribute('open') });
    doc.body.append(dialog);
    return { doc, dialog, close };
  }

  function fade(dialog: Element) {
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => (finish = resolve));
    // The dialog's own animation: ɵstarCloseDialog waits only for those.
    const effect = { getComputedTiming: () => ({ iterations: 1 }), target: dialog };
    const animation = { finished, effect };
    (dialog as unknown as { getAnimations: () => unknown[] }).getAnimations = () => [animation];
    return finish;
  }

  it('closes at once where the browser has CSS overlay', () => {
    const { dialog, close } = setup(true);
    fade(dialog);
    const closed = vi.fn();
    expect(ɵstarCloseDialog(dialog, closed)).toBeNull();
    expect(close).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(dialog.hasAttribute('data-star-closing')).toBe(false);
  });

  it('without overlay, runs the exit on the open dialog first, then closes once', async () => {
    const { dialog, close } = setup(false);
    const finish = fade(dialog);
    const closed = vi.fn();
    const pending = ɵstarCloseDialog(dialog, closed);
    expect(pending).not.toBeNull();
    expect(dialog.hasAttribute('data-star-closing')).toBe(true);
    expect(close).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();

    finish();
    await new Promise((resolve) => setTimeout(resolve));
    expect(close).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(dialog.hasAttribute('data-star-closing')).toBe(false);
    pending!.finish();
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('finish() ends the exit at once (a re-open) and cancel() drops it (a destroy)', () => {
    const first = setup(false);
    fade(first.dialog);
    const closed = vi.fn();
    ɵstarCloseDialog(first.dialog, closed)!.finish();
    expect(first.close).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(1);

    const second = setup(false);
    fade(second.dialog);
    const dropped = vi.fn();
    ɵstarCloseDialog(second.dialog, dropped)!.cancel();
    expect(second.close).not.toHaveBeenCalled();
    expect(dropped).not.toHaveBeenCalled();
    expect(second.dialog.hasAttribute('data-star-closing')).toBe(false);
  });

  it('closes at once without overlay when nothing runs', () => {
    const { dialog, close } = setup(false);
    const closed = vi.fn();
    expect(ɵstarCloseDialog(dialog, closed)).toBeNull();
    expect(close).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
