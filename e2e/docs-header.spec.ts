import { expect, Page, test } from '@playwright/test';
import { openPage } from './support';

/**
 * The docs header stays at the top of the viewport while the page scrolls: on a long page, at
 * desktop and phone width, in both themes and in both text directions. An anchor target stops
 * below the header, and the side navigation scrolls on its own.
 */

const SIZES = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
] as const;

/** Top and bottom of the header in the viewport, and whether it is the topmost element there. */
async function headerState(page: Page): Promise<{ top: number; bottom: number; onTop: boolean }> {
  return page.locator('.docs-header').evaluate((header) => {
    const box = header.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return { top: box.top, bottom: box.bottom, onTop: !!hit && header.contains(hit) };
  });
}

/** Scrolls the window to `y` (clamped by the browser) and waits for the next frame. */
async function scrollWindow(page: Page, y: number): Promise<number> {
  return page.evaluate(async (target) => {
    window.scrollTo(0, target);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return window.scrollY;
  }, y);
}

test.describe('docs header', () => {
  for (const size of SIZES) {
    for (const theme of ['light', 'dark'] as const) {
      for (const dir of ['ltr', 'rtl'] as const) {
        test(`stays at the top of a long page (${size.name}, ${theme}, ${dir})`, async ({
          page,
        }) => {
          await page.setViewportSize({ width: size.width, height: size.height });
          await page.addInitScript(
            ([name, direction]) => {
              localStorage.setItem('star-theme', name);
              localStorage.setItem('star-direction', direction);
            },
            [theme, dir],
          );
          await openPage(page, '/controls/select', 'Select');
          await expect(page.locator('html')).toHaveAttribute('dir', dir);
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

          const header = page.locator('.docs-header');
          const total = await page.evaluate(
            () => document.scrollingElement!.scrollHeight - window.innerHeight,
          );
          // The page must be long: several screens, so a header that leaves after one screen fails.
          expect(total).toBeGreaterThan(size.height * 3);

          for (const share of [0, 0.25, 0.5, 0.75, 1]) {
            const y = await scrollWindow(page, Math.round(total * share));
            expect(y).toBeCloseTo(Math.round(total * share), -1);
            const state = await headerState(page);
            expect(state.top, `header top at scroll ${y}`).toBe(0);
            expect(state.onTop, `header is the topmost element at scroll ${y}`).toBe(true);
            await expect(header).toBeVisible();
          }
        });
      }
    }
  }

  test('an anchor target stops below the header', async ({ page }) => {
    await openPage(page, '/controls/select', 'Select');
    // A same-page fragment (as an in-page link makes) and a deep link with a fragment.
    await page.evaluate(() => (location.hash = 'api'));
    const api = page.getByRole('heading', { level: 2, name: 'API', exact: true });
    await expect
      .poll(async () => (await api.boundingBox())?.y ?? -1, { message: 'API heading top' })
      .toBeGreaterThan(0);
    const header = await headerState(page);
    expect(header.top).toBe(0);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
    const target = (await api.boundingBox())!;
    expect(target.y).toBeGreaterThanOrEqual(header.bottom);
    expect(target.y).toBeLessThan(header.bottom + 64);

    await page.goto('/controls/select#select-groups');
    const groups = page.locator('#select-groups');
    await expect(groups).toBeVisible();
    await expect
      .poll(async () => (await groups.boundingBox())?.y ?? -1, { message: 'heading top' })
      .toBeGreaterThanOrEqual(header.bottom);
    expect((await groups.boundingBox())!.y).toBeLessThan(header.bottom + 64);
    expect((await headerState(page)).top).toBe(0);
  });

  test('the side navigation scrolls on its own, below the header', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPage(page, '/controls/select', 'Select');
    const nav = page.locator('.docs-nav');

    // The page scrolls: the navigation stays right under the header.
    await scrollWindow(page, 2000);
    const header = await headerState(page);
    expect(header.top).toBe(0);
    expect(Math.round((await nav.boundingBox())!.y)).toBe(Math.round(header.bottom));

    // The navigation scrolls: the page does not move.
    const pageY = await page.evaluate(() => window.scrollY);
    const navScroll = await nav.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      return { top: element.scrollTop, room: element.scrollHeight - element.clientHeight };
    });
    expect(navScroll.room).toBeGreaterThan(0);
    expect(navScroll.top).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageY);

    // One page scroll bar: no element of the shell scrolls the page content on its own.
    const inner = await page.evaluate(() =>
      ['body', 'docs-root', '.docs-body', '.docs-main']
        .map((selector) => document.querySelector(selector)!)
        .filter((element) => element.scrollHeight > element.clientHeight + 1)
        .filter((element) => /(auto|scroll)/.test(getComputedStyle(element).overflowY))
        .map((element) => element.tagName.toLowerCase()),
    );
    expect(inner).toEqual([]);
  });

  test('the skip link moves focus to the content and the header stays', async ({ page }) => {
    await openPage(page, '/controls/select', 'Select');
    await scrollWindow(page, 1500);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
    expect((await headerState(page)).top).toBe(0);
  });
});
