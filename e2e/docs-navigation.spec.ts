import { expect, Page, test } from '@playwright/test';
import { example, openPage, skipWithoutActiveViewTransition } from './support';

/**
 * Page changes of the docs with motion on: the router cross-fades the pages with a view
 * transition (`withViewTransitions` in `app.config.ts`) and scrolls with
 * `withInMemoryScrolling` (to the top, or to the anchor of the URL).
 *
 * The rule under test: when the new page shows, its scroll position and its layout are final.
 * A target that a user (or a test) measures at that moment does not move when the fade ends.
 * The checks run inside the page: `startViewTransition` is wrapped before the application
 * starts, and each transition records the scroll position and the place of some elements
 * when the new page shows (`ready`: the fade starts) and when the fade ends (`finished`).
 */

/**
 * How long the test holds a press on a booking. The scheduler has no hold threshold (a press only
 * becomes a drag when the pointer leaves the first slot, see `onPointerDown` in
 * `projects/star-ng/scheduler/scheduler.ts`), so the value only has to be a held press, not a click.
 */
const HELD_PRESS_MS = 150;

/** What one transition saw: the URL, the scroll position and the tops of the elements. */
interface Moment {
  url: string;
  scrollY: number;
  tops: (number | null)[];
  transitionActive: boolean;
}

interface TransitionRecord {
  shown: Moment | null;
  ended: Moment | null;
}

declare global {
  interface Window {
    /** One record per view transition, oldest first. */
    __transitions: TransitionRecord[];
    /** CSS selectors of the elements to measure. */
    __targets: string[];
    /** The node name of the target of each `pointerdown`, oldest first. */
    __pressTargets: string[];
  }
}

test.use({ reducedMotion: 'no-preference' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__transitions = [];
    window.__targets = ['h1'];
    window.__pressTargets = [];
    window.addEventListener(
      'pointerdown',
      (event) => window.__pressTargets.push((event.target as Node).nodeName),
      true,
    );
    const start = Document.prototype.startViewTransition;
    if (!start) return;
    const active = () =>
      !!(document as Document & { activeViewTransition?: unknown }).activeViewTransition;
    const moment = (): Moment => ({
      url: location.pathname + location.hash,
      scrollY: Math.round(window.scrollY),
      tops: window.__targets.map((selector) => {
        const element = document.querySelector(selector);
        return element ? Math.round(element.getBoundingClientRect().top) : null;
      }),
      transitionActive: active(),
    });
    Document.prototype.startViewTransition = function (
      this: Document,
      ...args: Parameters<Document['startViewTransition']>
    ) {
      const transition = start.apply(this, args);
      const record: TransitionRecord = { shown: null, ended: null };
      window.__transitions.push(record);
      transition.ready.then(
        () => (record.shown = moment()),
        () => undefined,
      );
      transition.finished.then(
        () => (record.ended = moment()),
        () => undefined,
      );
      return transition;
    } as Document['startViewTransition'];
  });
});

/** Sets the elements that the next transitions measure. */
async function measure(page: Page, selectors: string[]): Promise<void> {
  await page.evaluate((list) => (window.__targets = list), selectors);
}

/** Waits until the transition with this index has ended, and returns its record. */
async function transitionAt(page: Page, index: number): Promise<TransitionRecord> {
  await expect
    .poll(() => page.evaluate((at) => window.__transitions[at]?.ended ?? null, index))
    .not.toBeNull();
  return page.evaluate((at) => window.__transitions[at], index);
}

/** The new page showed with the scroll position and the layout that it has after the fade. */
function expectFinal(record: TransitionRecord, url: string): Moment {
  expect(record.shown, 'the fade ran (motion is on)').not.toBeNull();
  const shown = record.shown!;
  const ended = record.ended!;
  expect(shown.url).toBe(url);
  expect(shown.transitionActive).toBe(true);
  expect(ended.transitionActive).toBe(false);
  expect(ended.url).toBe(url);
  expect(ended.scrollY, 'scroll position after the fade').toBe(shown.scrollY);
  expect(ended.tops, 'element tops after the fade').toEqual(shown.tops);
  return shown;
}

/** Opens the Scheduler page with the link of the navigation. */
async function openSchedulerFromNav(page: Page): Promise<void> {
  await page.locator('#docs-nav').getByRole('link', { name: 'Scheduler', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Scheduler' })).toBeVisible();
}

test.describe('page changes with a view transition @cross-browser', () => {
  // Every test reads `document.activeViewTransition` (the record of each transition, and the
  // press test). Firefox and WebKit may lack it: there the tests skip with that reason.
  test.beforeEach(async ({ page }) => {
    await skipWithoutActiveViewTransition(page);
  });

  test('a nav click shows the new page at the top, with its final layout', async ({ page }) => {
    await openPage(page, '/controls/button', 'Button');
    await page.evaluate(() => window.scrollTo(0, 800));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await measure(page, ['h1', '#main h2', '#main docs-example:last-of-type h2']);

    await openSchedulerFromNav(page);
    const shown = expectFinal(await transitionAt(page, 0), '/controls/scheduler');
    expect(shown.scrollY).toBe(0);
    expect(shown.tops.every((top) => top !== null)).toBe(true);
  });

  test('Back and Forward show the page at the top, with its final layout', async ({ page }) => {
    await openPage(page, '/controls/button', 'Button');
    await openSchedulerFromNav(page);
    await transitionAt(page, 0);
    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    // `scrollPositionRestoration: 'top'`: Back and Forward open the page at the top too.
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: 'Button' })).toBeVisible();
    expect(expectFinal(await transitionAt(page, 1), '/controls/button').scrollY).toBe(0);

    await page.evaluate(() => window.scrollTo(0, 600));
    await page.goForward();
    await expect(page.getByRole('heading', { level: 1, name: 'Scheduler' })).toBeVisible();
    expect(expectFinal(await transitionAt(page, 2), '/controls/scheduler').scrollY).toBe(0);
  });

  test('an anchor link to another page shows the anchor at the top, with its final layout', async ({
    page,
  }) => {
    await openPage(page, '/guides/template-slots', 'Template slots');
    await measure(page, ['#date-picker-range', 'h1']);
    await page.getByRole('link', { name: 'date range picker' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Date picker' })).toBeVisible();
    const shown = expectFinal(
      await transitionAt(page, 0),
      '/controls/date-picker#date-picker-range',
    );
    // The anchor is near the top of the window (below the sticky header).
    const [anchorTop] = shown.tops;
    expect(anchorTop).not.toBeNull();
    expect(anchorTop!).toBeGreaterThanOrEqual(0);
    expect(anchorTop!).toBeLessThan(200);
    expect(shown.scrollY).toBeGreaterThan(0);
  });

  test('a press during the fade ends it, and the next press reaches the page', async ({ page }) => {
    await openPage(page, '/controls/button', 'Button');
    // A long fade (this test only), so that the real presses below land inside it for sure.
    await page.addStyleTag({
      content:
        '::view-transition-group(root), ::view-transition-old(root), ::view-transition-new(root)' +
        ' { animation-duration: 20s !important; }',
    });
    await openSchedulerFromNav(page);
    const active = () =>
      page.evaluate(
        () => !!(document as Document & { activeViewTransition?: unknown }).activeViewTransition,
      );
    expect(await active()).toBe(true);

    const booking = example(page, 'Rooms on a timeline, with the editor').getByRole('button', {
      name: /^Team meeting, /,
    });
    await booking.scrollIntoViewIfNeeded();
    const box = (await booking.boundingBox())!;
    const point = { x: box.x + Math.min(box.width / 2, 20), y: box.y + box.height / 2 };
    const hitsBooking = () =>
      booking.evaluate(
        (element, at) => element.contains(document.elementFromPoint(at.x, at.y)),
        point,
      );
    // During the fade the browser hit-tests to the document element, not to the booking.
    expect(await hitsBooking()).toBe(false);

    // A real press during the fade goes to <html> and ends the fade at once.
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.up();
    expect(await page.evaluate(() => window.__pressTargets.at(-1))).toBe('HTML');
    expect(await active()).toBe(false);
    expect(await hitsBooking()).toBe(true);

    // The next press reaches the page: a held press on the booking opens the editor.
    await page.mouse.down();
    await page.waitForTimeout(HELD_PRESS_MS);
    await page.mouse.up();
    expect(await page.evaluate(() => window.__pressTargets.at(-1))).not.toBe('HTML');
    await expect(page.getByRole('dialog', { name: 'Edit event' })).toBeVisible();
  });
});
