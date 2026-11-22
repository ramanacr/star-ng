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
    const log: { el: Element; cls: string; animation: string }[] = [];
    (window as unknown as { __leaves: typeof log }).__leaves = log;
    new MutationObserver((records) => {
      for (const record of records) {
        const el = record.target as Element;
        const cls = [...el.classList].find((name) => name.endsWith('--leaving'));
        if (cls && !log.some((entry) => entry.el === el)) {
          log.push({ el, cls, animation: getComputedStyle(el).animationName });
        }
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
}

async function leaves(page: Page): Promise<LeaveEntry[]> {
  return page.evaluate(() =>
    (
      window as unknown as { __leaves: { el: Element; cls: string; animation: string }[] }
    ).__leaves.map(({ el, cls, animation }) => ({ cls, animation, removed: !el.isConnected })),
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

  test.describe(`leave motion, ${motion}`, () => {
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
      await page.evaluate(() => {
        const host = document.querySelector('star-dialog-container')!;
        const state = { connectedAtClose: null as boolean | null, transitions: -1 };
        (window as unknown as { __close: typeof state }).__close = state;
        host.querySelector('dialog')!.addEventListener('close', () => {
          state.connectedAtClose = host.isConnected;
          state.transitions = host.isConnected ? host.getAnimations({ subtree: true }).length : 0;
        });
      });
      await page.keyboard.press('Escape');
      await expect(page.locator('star-dialog-container')).toHaveCount(0);
      const state = await page.evaluate(
        () =>
          (window as unknown as { __close: { connectedAtClose: boolean; transitions: number } })
            .__close,
      );
      if (reduced) {
        // No transition: the service removes the host at once. The native close event then
        // finds it gone, or does not reach a listener at all.
        expect(state.connectedAtClose).not.toBe(true);
      } else {
        expect(state.connectedAtClose).toBe(true);
        expect(state.transitions).toBeGreaterThan(0);
      }
    });
  });
}
