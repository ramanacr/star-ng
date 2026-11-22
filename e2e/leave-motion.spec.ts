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

/** Native dialogs whose close motion the tests check: template drawer and two services. */
const CLOSE_CASES = [
  {
    name: 'a dialog opened by the service',
    path: '/controls/dialog',
    button: 'Edit note',
    dialog: 'star-dialog-container dialog',
    host: 'star-dialog-container',
  },
  {
    name: 'a bottom sheet',
    path: '/controls/bottom-sheet',
    button: 'Export invoice',
    dialog: 'star-bottom-sheet-container dialog',
    host: 'star-bottom-sheet-container',
  },
  {
    name: 'a drawer',
    path: '/controls/drawer',
    button: 'Open details',
    dialog: 'dialog.star-drawer[open]',
    host: null,
  },
] as const;

interface CloseState {
  readonly overlaySupported: boolean;
  readonly motion: 'none' | 'after-close' | 'before-close';
  readonly running: number;
  readonly connectedAtClose: boolean | null;
  readonly motionEnd: number;
  readonly closedAt: number;
  readonly removedAt: number;
}

/**
 * Watches the close of a native dialog. The contract: the close motion runs in every browser,
 * and what waits for it (the native close() where the browser has no CSS `overlay`, the removal
 * of a service container in every browser) comes when it has ended. Where the browser keeps a
 * closing modal dialog in the top layer (`overlay`, Chromium) the motion is the transition after
 * `dialog.close()`; elsewhere (Firefox, WebKit) it runs before close(), while the dialog has
 * `data-star-closing`. The page reads the running animations of the dialog itself (its backdrop
 * included) at the start of the motion, whichever form comes first, the same moment the library
 * reads them, and the times of the motion end, the close and the removal.
 */
async function watchClose(page: Page, dialogSelector: string, hostSelector: string | null) {
  await page.evaluate(
    ([dialogSel, hostSel]) => {
      const dialog = document.querySelector<HTMLDialogElement>(dialogSel)!;
      const host = hostSel ? document.querySelector(hostSel)! : null;
      const state = {
        overlaySupported: CSS.supports('overlay', 'auto'),
        motion: 'none',
        running: -1,
        connectedAtClose: null as boolean | null,
        motionEnd: -1,
        closedAt: -1,
        removedAt: -1,
      };
      (window as unknown as { __close: typeof state }).__close = state;
      const record = (motion: 'after-close' | 'before-close') => {
        if (state.running >= 0) return;
        const running = dialog
          .getAnimations({ subtree: true })
          .filter((animation) => (animation.effect as KeyframeEffect | null)?.target === dialog)
          .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
        state.running = running.length;
        if (running.length) state.motion = motion;
        const left = running.map((animation) => {
          const timing = animation.effect!.getComputedTiming();
          return Number(timing.endTime) - Number(timing.localTime ?? 0);
        });
        state.motionEnd = performance.now() + Math.max(0, ...left);
      };
      if (host) {
        new MutationObserver(() => {
          if (!host.isConnected && state.removedAt < 0) state.removedAt = performance.now();
        }).observe(document.body, { childList: true });
      }
      new MutationObserver(() => {
        if (dialog.hasAttribute('data-star-closing')) record('before-close');
        if (!dialog.hasAttribute('open') && state.closedAt < 0) state.closedAt = performance.now();
      }).observe(dialog, { attributes: true, attributeFilter: ['data-star-closing', 'open'] });
      const close = dialog.close;
      dialog.close = function (this: HTMLDialogElement, ...args: [string?]) {
        close.apply(this, args);
        if (state.closedAt < 0) state.closedAt = performance.now();
        record('after-close');
      };
      dialog.addEventListener('close', () => {
        if (host) state.connectedAtClose = host.isConnected;
      });
    },
    [dialogSelector, hostSelector] as const,
  );
}

async function closeState(page: Page): Promise<CloseState> {
  return page.evaluate(() => (window as unknown as { __close: CloseState }).__close);
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

    for (const control of CLOSE_CASES) {
      test(`${control.name} keeps its close motion`, async ({ page }) => {
        await open(page, control.path, reduced);
        await page.getByRole('button', { name: control.button }).first().click();
        await expect(page.locator(control.dialog)).toBeVisible();
        // Close from the settled open state: an Escape during the enter motion has nothing (or
        // a shortened reversal) to show.
        await page.waitForFunction(
          (selector) => document.querySelector(selector)?.getAnimations().length === 0,
          control.dialog,
        );
        await watchClose(page, control.dialog, control.host);
        await page.keyboard.press('Escape');
        if (control.host) await expect(page.locator(control.host)).toHaveCount(0);
        else await expect(page.locator(control.dialog)).toBeHidden();
        const state = await closeState(page);
        if (reduced) {
          // No motion: the dialog closes at once (a service container goes before the close event).
          expect(state.running).toBe(0);
          if (control.host) expect(state.connectedAtClose).not.toBe(true);
          return;
        }
        // The close motion runs in every browser, in the form the browser can show.
        expect(state.running).toBeGreaterThan(0);
        expect(state.motion).toBe(state.overlaySupported ? 'after-close' : 'before-close');
        // What waits for the motion comes when it has ended (one frame of slack for the clock of
        // the animation), and well before the 4 s fallback: the removal of a service container
        // in every browser, and the native close() without `overlay`.
        if (control.host) {
          expect(state.removedAt).toBeGreaterThanOrEqual(state.motionEnd - 17);
          expect(state.removedAt - state.motionEnd).toBeLessThan(1000);
        }
        if (!state.overlaySupported) {
          expect(state.closedAt).toBeGreaterThanOrEqual(state.motionEnd - 17);
          expect(state.closedAt - state.motionEnd).toBeLessThan(1000);
        }
        // With `overlay` the motion runs after close(): a container outlives the close event.
        if (state.overlaySupported && control.host) expect(state.connectedAtClose).toBe(true);
      });
    }
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
