import { ɵstarAfterExit } from './motion';

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
  afterEach(() => vi.useRealTimers());

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
