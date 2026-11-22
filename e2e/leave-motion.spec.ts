import { expect, Page, test } from '@playwright/test';
import { example } from './support';

/**
 * Leave motion (Angular `animate.leave`) and the close transition of the service-opened
 * overlays. The checks read the computed `animation-name` of an element when it gets its leave
 * class, so they do not depend on timing: with motion it is the leave keyframes, under reduced
 * motion it is `none` and Angular removes the element at once.
 */

interface LeaveEntry {
  readonly cls: string;
  readonly animation: string;
  readonly removed: boolean;
  /** True when the element was still in the document as it got the leave class. */
  readonly connected: boolean;
}

/** Opens a page and waits until every hydration marker is gone. */
async function open(page: Page, path: string, reduced: boolean): Promise<void> {
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto(path);
  await expect(page.locator('[ngh]')).toHaveCount(0, { timeout: 15_000 });
}

/** Records each element that gets a `--leaving` class, its animation then, and its removal. */
async function recordLeaves(page: Page): Promise<void> {
  await page.evaluate(() => {
    const log: { el: Element; cls: string; animation: string; connected: boolean }[] = [];
    (window as unknown as { __leaves: typeof log }).__leaves = log;
    new MutationObserver((records) => {
      for (const record of records) {
        const el = record.target as Element;
        const cls = [...el.classList].find((name) => name.endsWith('--leaving'));
        if (cls && !log.some((entry) => entry.el === el)) {
          log.push({
            el,
            cls,
            animation: getComputedStyle(el).animationName,
            connected: el.isConnected,
          });
        }
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
}

async function leaves(page: Page): Promise<LeaveEntry[]> {
  return page.evaluate(() =>
    (
      window as unknown as {
        __leaves: { el: Element; cls: string; animation: string; connected: boolean }[];
      }
    ).__leaves.map(({ el, cls, animation, connected }) => ({
      cls,
      animation,
      connected,
      removed: !el.isConnected,
    })),
  );
}

/** Waits until the recorded element with `cls` is gone, then returns its entry. */
async function left(page: Page, cls: string): Promise<LeaveEntry> {
  await expect
    .poll(async () => (await leaves(page)).find((entry) => entry.cls === cls)?.removed ?? false)
    .toBe(true);
  return (await leaves(page)).find((entry) => entry.cls === cls)!;
}

for (const reduced of [false, true]) {
  const motion = reduced ? 'reduced motion' : 'motion';

  test.describe(`leave motion, ${motion} @cross-browser`, () => {
    test('a select panel leaves with its keyframes, then the overlay goes', async ({ page }) => {
      await open(page, '/controls/select', reduced);
      const live = example(page, 'Objects as options');
      await live.getByRole('combobox', { name: 'Country' }).click();
      await expect(page.getByRole('listbox', { name: 'Country', exact: true })).toBeVisible();
      await recordLeaves(page);
      await page.keyboard.press('Escape');
      const entry = await left(page, 'star-panel--leaving');
      expect(entry.animation).toBe(reduced ? 'none' : 'star-panel-out');
      await expect(page.getByRole('listbox', { name: 'Country', exact: true })).toHaveCount(0);
      await expect(live.getByRole('combobox', { name: 'Country' })).toBeFocused();
    });

    test('a popup menu leaves with its keyframes', async ({ page }) => {
      await open(page, '/controls/menu', reduced);
      await example(page, 'Popup menu').getByRole('button', { name: 'File' }).click();
      await expect(page.locator('.cdk-overlay-pane').getByRole('menu')).toBeVisible();
      await recordLeaves(page);
      await page.keyboard.press('Escape');
      const entry = await left(page, 'star-menu-frame--leaving');
      expect(entry.animation).toBe(reduced ? 'none' : 'star-panel-out');
      await expect(page.locator('.cdk-overlay-pane').getByRole('menu')).toHaveCount(0);
    });

    test('a closed toast leaves with its keyframes and the stack stays open until then', async ({
      page,
    }) => {
      await open(page, '/controls/toast', reduced);
      await example(page, 'Sticky and timed messages')
        .getByRole('button', { name: 'Sticky message' })
        .click();
      const toast = page.locator('.star-toast');
      await expect(toast).toHaveCount(1);
      await page.evaluate(() => {
        const stack = document.querySelector('.star-toast')!.closest('.star-toast-stack')!;
        const state = { openWhileLeaving: true };
        (window as unknown as { __stack: typeof state }).__stack = state;
        new MutationObserver(() => {
          // While a toast is still in the stack, the stack must be open (in the top layer).
          if (stack.querySelector('.star-toast') && !stack.matches(':popover-open')) {
            state.openWhileLeaving = false;
          }
        }).observe(stack, { subtree: true, childList: true, attributes: true });
      });
      await recordLeaves(page);
      await toast.getByRole('button', { name: 'Close' }).click();
      const entry = await left(page, 'star-toast--leaving');
      expect(entry.animation).toBe(reduced ? 'none' : 'star-toast-out');
      await expect(toast).toHaveCount(0);
      expect(
        await page.evaluate(
          () => (window as unknown as { __stack: { openWhileLeaving: boolean } }).__stack,
        ),
      ).toEqual({ openWhileLeaving: true });
    });

    test('a removed tag leaves with its keyframes', async ({ page }) => {
      await open(page, '/controls/input-tags', reduced);
      const live = example(page, 'Basic');
      const status = live.locator('.docs-output');
      await expect(status).toHaveText('urgent, billing');
      await recordLeaves(page);
      await live.getByRole('button', { name: 'Remove urgent' }).click();
      const entry = await left(page, 'star-chip--leaving');
      expect(entry.animation).toBe(reduced ? 'none' : 'star-chip-out');
      await expect(status).toHaveText('billing');
      await expect(live.getByRole('listitem')).toHaveCount(1);
    });

    test('a dialog opened by the service keeps its close transition', async ({ page }) => {
      await open(page, '/controls/dialog', reduced);
      await page.getByRole('button', { name: 'Edit note' }).click();
      const dialog = page.getByRole('dialog', { name: 'Edit note' });
      await expect(dialog).toBeVisible();
      // The contract of the service: the container stays in the DOM while the close motion
      // that starts at `dialog.close()` runs, and goes when it has ended; with no close motion
      // it goes at once. The wrapper reads the running animations right after `close()`, the
      // same moment the service reads them. Whether a closing modal dialog can animate depends
      // on the browser: without the CSS `overlay` property (Firefox, WebKit) the dialog leaves
      // the top layer at once and no close transition starts.
      await page.evaluate(() => {
        const host = document.querySelector('star-dialog-container')!;
        const dialog = host.querySelector('dialog')!;
        const state = {
          overlaySupported: CSS.supports('overlay', 'auto'),
          runningAfterClose: -1,
          connectedAtClose: null as boolean | null,
          connectedAfterMotion: null as boolean | null,
        };
        (window as unknown as { __close: typeof state }).__close = state;
        const close = dialog.close;
        dialog.close = function (this: HTMLDialogElement, ...args: [string?]) {
          close.apply(this, args);
          const running = host
            .getAnimations({ subtree: true })
            .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
          state.runningAfterClose = running.length;
          void Promise.allSettled(running.map((animation) => animation.finished)).then(() => {
            // The service removes the container in the same turn as the last animation ends.
            state.connectedAfterMotion = host.isConnected;
          });
        };
        dialog.addEventListener('close', () => (state.connectedAtClose = host.isConnected));
      });
      await page.keyboard.press('Escape');
      await expect(page.locator('star-dialog-container')).toHaveCount(0);
      const state = await page.evaluate(
        () =>
          (
            window as unknown as {
              __close: {
                overlaySupported: boolean;
                runningAfterClose: number;
                connectedAtClose: boolean | null;
                connectedAfterMotion: boolean | null;
              };
            }
          ).__close,
      );
      expect(state.runningAfterClose).toBeGreaterThanOrEqual(0);
      // What the browser runs: under reduced motion nothing; where a modal dialog can animate
      // out of the top layer (`overlay`), the close transition.
      if (reduced) expect(state.runningAfterClose).toBe(0);
      else if (state.overlaySupported) expect(state.runningAfterClose).toBeGreaterThan(0);
      if (state.runningAfterClose > 0) {
        // The close motion runs: the container is still there when the native close event
        // fires, and until the last close animation has ended.
        expect(state.connectedAtClose).toBe(true);
        expect(state.connectedAfterMotion).toBe(true);
      } else {
        // No close motion: the service removes the container at once, before the close event.
        expect(state.connectedAtClose).not.toBe(true);
      }
    });
  });
}

/**
 * Enter motion under the system setting (`prefers-reduced-motion`), with no
 * `data-star-motion`: the reduced-motion rules must win over the control rules whatever the order
 * of the partials. The computed `animation-name` and `transition-duration` do not depend on timing.
 */
for (const reduced of [false, true]) {
  test(`enter motion of overlays, toasts and dialogs, ${reduced ? 'reduced motion' : 'motion'} @cross-browser`, async ({
    page,
  }) => {
    const motion = async (selector: string) =>
      page.evaluate((s) => {
        const el = document.querySelector(s)!;
        const style = getComputedStyle(el);
        return { animation: style.animationName, transition: style.transitionDuration };
      }, selector);
    const none = (value: { animation: string; transition: string }) =>
      value.animation === 'none' && value.transition.split(',').every((t) => parseFloat(t) === 0);

    await open(page, '/controls/select', reduced);
    await example(page, 'Objects as options').getByRole('combobox', { name: 'Country' }).click();
    await expect(page.getByRole('listbox', { name: 'Country', exact: true })).toBeVisible();
    const panel = await motion('.cdk-overlay-pane .star-panel');
    expect(reduced ? none(panel) : panel.animation === 'star-panel-in').toBe(true);

    await open(page, '/controls/menu', reduced);
    await example(page, 'Popup menu').getByRole('button', { name: 'File' }).click();
    await expect(page.locator('.cdk-overlay-pane').getByRole('menu')).toBeVisible();
    const menu = await motion('.cdk-overlay-pane .star-menu');
    expect(reduced ? none(menu) : menu.animation === 'star-panel-in').toBe(true);

    await open(page, '/controls/popover', reduced);
    await example(page, 'Details popover').getByRole('button', { name: 'Details' }).click();
    await expect(page.getByRole('dialog', { name: 'Order details' })).toBeVisible();
    const popover = await motion('.cdk-overlay-pane .star-popover');
    expect(reduced ? none(popover) : popover.animation === 'star-panel-in').toBe(true);

    await open(page, '/controls/tooltip', reduced);
    await example(page, 'Positions').getByRole('button', { name: 'Top', exact: true }).hover();
    await expect(page.getByRole('tooltip')).toBeVisible();
    const tooltip = await motion('.star-tooltip');
    expect(reduced ? none(tooltip) : tooltip.animation === 'star-panel-in').toBe(true);

    await open(page, '/controls/toast', reduced);
    await example(page, 'Sticky and timed messages')
      .getByRole('button', { name: 'Sticky message' })
      .click();
    await expect(page.locator('.star-toast')).toHaveCount(1);
    const toast = await motion('.star-toast');
    expect(reduced ? none(toast) : toast.animation === 'star-toast-in').toBe(true);

    await open(page, '/controls/dialog', reduced);
    await page.getByRole('button', { name: 'Edit order' }).click();
    await expect(page.getByRole('dialog', { name: 'Edit order' })).toBeVisible();
    const dialog = await motion('dialog.star-dialog[open]');
    expect(reduced ? none(dialog) : !none(dialog)).toBe(true);
  });
}

/**
 * Dropdown and mention panels fade out: the element is still there when the leave starts and is
 * gone after it. Motion stays on (the fade is the thing under test), and the hydration markers
 * are gone before the first click.
 */
test.describe('leave motion of the dropdown and mention panels @cross-browser', () => {
  test('the dropdown panel fades out, then goes', async ({ page }) => {
    await open(page, '/controls/dropdown', false);
    await example(page, 'Choose from a list').getByRole('button', { name: 'Export as' }).click();
    await expect(page.getByRole('listbox', { name: 'Export format' })).toBeVisible();
    await recordLeaves(page);
    await page.keyboard.press('Escape');
    const entry = await left(page, 'star-panel--leaving');
    expect(entry.connected).toBe(true);
    expect(entry.animation).toBe('star-panel-out');
    await expect(page.getByRole('listbox', { name: 'Export format' })).toHaveCount(0);
  });

  test('the mention panel fades out, then goes', async ({ page }) => {
    await open(page, '/controls/mention', false);
    const field = example(page, 'Mention people').getByRole('textbox', { name: 'Comment' });
    await field.click();
    await field.pressSequentially('@');
    await expect(page.getByRole('listbox')).toBeVisible();
    await recordLeaves(page);
    await page.evaluate(() => {
      const watch = new MutationObserver(() => {
        const host = document.querySelector('star-mention-panel.star-mention-panel--leaving');
        if (host?.firstElementChild) {
          (window as unknown as { __inner: string }).__inner = getComputedStyle(
            host.firstElementChild,
          ).animationName;
          watch.disconnect();
        }
      });
      watch.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
    await page.keyboard.press('Escape');
    const entry = await left(page, 'star-mention-panel--leaving');
    expect(entry.connected).toBe(true);
    // The host gets the class; the panel inside it runs the keyframes.
    expect(await page.evaluate(() => (window as unknown as { __inner: string }).__inner)).toBe(
      'star-panel-out',
    );
    await expect(page.locator('star-mention-panel')).toHaveCount(0);
  });

  test('opening the dropdown again during the fade shows one panel', async ({ page }) => {
    await open(page, '/controls/dropdown', false);
    const trigger = example(page, 'Choose from a list').getByRole('button', { name: 'Export as' });
    await trigger.click();
    await expect(page.getByRole('listbox', { name: 'Export format' })).toBeVisible();
    // As soon as the old panel gets its leave class, open the overlay again (same task).
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Export as'),
      )!;
      const log: { reopened: boolean } = { reopened: false };
      (window as unknown as { __reopen: typeof log }).__reopen = log;
      const watch = new MutationObserver(() => {
        if (!log.reopened && document.querySelector('.star-panel--leaving')) {
          log.reopened = true;
          watch.disconnect();
          button.click();
        }
      });
      watch.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    });
    await page.keyboard.press('Escape');
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { __reopen: { reopened: boolean } }).__reopen),
      )
      .toEqual({ reopened: true });
    const panels = page.locator('.star-dropdown');
    await expect(panels).toHaveCount(1);
    await expect(page.locator('.star-panel--leaving')).toHaveCount(0);
    const ids = await page.evaluate(() => {
      const all = [...document.querySelectorAll('[id]')].map((el) => el.id);
      return all.filter((id, i) => all.indexOf(id) !== i);
    });
    expect(ids).toEqual([]);
    await expect(page.getByRole('listbox', { name: 'Export format' })).toHaveCount(1);
  });
});
