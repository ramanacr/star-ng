import { expect, Page, test } from '@playwright/test';
import { DOCS_NAV } from '../../projects/docs/src/app/nav';
import { VISUAL_SKIP_MESSAGE, visualRunAllowed } from './guard';

/**
 * One screenshot of the `main` area of every docs page, in the light and in the dark theme.
 *
 * What makes a page stable (all of it is done here, never in the library):
 * - The clock is fixed, so "today" in the date examples is always the same day.
 * - `Math.random` is replaced by a seeded generator, so generated data is the same.
 * - The theme comes from the saved choice, which the first-paint script reads before the
 *   application starts. `reducedMotion` is on, and `toHaveScreenshot` stops CSS animations.
 * - The test waits for fonts, images and the page height to settle.
 * - Elements that still change between runs are masked (see `MASKS`).
 */

/** The pages: the home page and every page of the navigation. */
const PAGES = [
  { slug: 'home', path: '/' },
  ...DOCS_NAV.flatMap((group) =>
    group.items.map((item) => ({ slug: item.path.replaceAll('/', '-'), path: `/${item.path}` })),
  ),
];

/**
 * Taller pages are cut in slices of this height, one image per slice. Chromium cannot draw
 * images beyond 16384 px, and a smaller image gives a diff that is easier to look at.
 */
const SLICE_HEIGHT = 4000;

/** Elements to cover with a flat box, per page slug: they change between runs. */
const MASKS: Record<string, string[]> = {};

/** A seeded random generator (mulberry32), installed before the page scripts run. */
function seedRandom(): void {
  let state = 0x2f6e2b1;
  Math.random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Waits until fonts, images and the height of the page have stopped changing. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            }),
      ),
    );
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const height = () => document.documentElement.scrollHeight;
    let last = -1;
    for (let stable = 0; stable < 3;) {
      await frame();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const now = height();
      stable = now === last ? stable + 1 : 0;
      last = now;
    }
  });
}

test.describe('docs pages', () => {
  test.skip(!visualRunAllowed(), VISUAL_SKIP_MESSAGE);

  for (const theme of ['light', 'dark'] as const) {
    test.describe(theme, () => {
      test.use({ colorScheme: theme });

      for (const { slug, path } of PAGES) {
        test(slug, async ({ page }) => {
          test.slow();
          await page.clock.setFixedTime(new Date('2026-06-15T10:00:00Z'));
          await page.addInitScript(seedRandom);
          await page.addInitScript((value) => localStorage.setItem('star-theme', value), theme);

          await page.goto(path);
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await settle(page);
          await page.mouse.move(0, 0);

          const main = page.locator('main#main');
          const box = (await main.boundingBox())!;
          const top = await page.evaluate(() => window.scrollY);
          const masks = (MASKS[slug] ?? []).map((selector) => page.locator(selector));
          const slices = Math.max(1, Math.ceil(box.height / SLICE_HEIGHT));
          for (let index = 0; index < slices; index++) {
            const y = box.y + top + index * SLICE_HEIGHT;
            await expect
              .soft(page)
              .toHaveScreenshot(
                [theme, slices === 1 ? `${slug}.png` : `${slug}-${index + 1}.png`],
                {
                  fullPage: true,
                  clip: {
                    x: box.x,
                    y,
                    width: box.width,
                    height: Math.min(SLICE_HEIGHT, box.y + top + box.height - y),
                  },
                  mask: masks,
                  // The sticky header must not cover the top of a slice.
                  style: '.docs-header { position: static !important; }',
                },
              );
          }
        });
      }
    });
  }
});
