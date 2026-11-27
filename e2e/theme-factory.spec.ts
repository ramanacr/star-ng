import { expect, Page, test } from '@playwright/test';
import { collectErrors, example, openPage } from './support';

const PATH = 'guides/theme-factory';
const HEADING = 'Theme factory and glass theme';

async function open(page: Page, theme: 'light' | 'dark', dir: 'ltr' | 'rtl' = 'ltr') {
  await page.addInitScript(
    ([t, d]) => {
      localStorage.setItem('star-theme', t);
      localStorage.setItem('star-direction', d);
    },
    [theme, dir],
  );
  await openPage(page, PATH, HEADING);
}

/** Computed glass styles of the popover in an example. */
async function popover(page: Page, heading: string) {
  return example(page, heading)
    .locator('.docs-glass-stage .star-popover')
    .evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        backdropFilter: style.backdropFilter,
        background: style.backgroundColor,
        angle: style.getPropertyValue('--star-glass-angle').trim(),
      };
    });
}

for (const theme of ['light', 'dark'] as const) {
  test(`glass theme: translucent floating layers in the ${theme} theme`, async ({ page }) => {
    const errors = collectErrors(page);
    await open(page, theme);
    const glass = await popover(page, 'Glass layers');
    expect(glass.backdropFilter).toMatch(/^blur\(\d+px\) contrast\(/);
    expect(glass.background).toMatch(/^rgba\(.*, 0\.\d+\)$/);
    expect(errors).toEqual([]);
  });
}

test('glass theme: the solid variant has no blur and an opaque surface', async ({ page }) => {
  await open(page, 'light');
  const live = example(page, 'Glass layers');
  await live.getByRole('radio', { name: 'solid' }).click();
  await expect(live.locator('.docs-glass-stage')).toHaveAttribute(
    'data-star-theme-variant',
    'solid',
  );
  const glass = await popover(page, 'Glass layers');
  expect(glass.backdropFilter).toBe('none');
  expect(glass.background).toMatch(/^rgb\(/);
});

test('glass theme: the highlight angle is mirrored in right to left', async ({ page }) => {
  await open(page, 'light', 'rtl');
  expect((await popover(page, 'Glass layers')).angle).toBe('225deg');
});

test('glass theme: more contrast turns the layers solid', async ({ page }) => {
  await page.emulateMedia({ contrast: 'more' });
  await open(page, 'dark');
  const glass = await popover(page, 'Glass layers');
  expect(glass.backdropFilter).toBe('none');
  expect(glass.background).toMatch(/^rgb\(/);
});

test('factory playground: inputs regenerate the theme and every check passes', async ({ page }) => {
  await open(page, 'light');
  const live = example(page, 'Factory playground');
  const opacity = live.getByRole('slider', { name: /Opacity/ });
  const rows = live.getByRole('table', { name: 'Contrast check' }).locator('tbody tr');
  await expect(rows).toHaveCount(6);
  await expect(rows.first()).toContainText('0.55');

  await opacity.focus();
  await opacity.press('Home'); // 20%
  await expect(live.getByText('Opacity: 20%')).toBeVisible();
  for (const ratio of await rows.locator('td:last-child').allTextContents()) {
    expect(Number.parseFloat(ratio)).toBeGreaterThanOrEqual(4.5);
  }
  await expect(live.locator('.docs-glass-stage')).toHaveAttribute('style', /--star-glass-bg:/);
});

/** Backdrop filters of the toast and the dock in the refraction example, and the html marker. */
async function refraction(page: Page) {
  const live = example(page, 'Edge refraction');
  const filterOf = (selector: string) =>
    live.locator(selector).evaluate((node) => {
      const style = getComputedStyle(node);
      return style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter');
    });
  return {
    toast: await filterOf('.star-toast'),
    dock: await filterOf('.star-dock__list'),
    marked: await page.evaluate(() =>
      document.documentElement.hasAttribute('data-star-refraction'),
    ),
    defs: await page.locator('svg#star-glass-refraction-defs filter').count(),
  };
}

test('edge refraction: Chromium refracts the edges, other browsers keep the blur @cross-browser', async ({
  page,
  browserName,
}) => {
  const errors = collectErrors(page);
  await open(page, 'light');
  await expect(page.locator('svg#star-glass-refraction-defs')).toHaveCount(1);
  const result = await refraction(page);
  if (browserName === 'chromium') {
    expect(result.marked).toBe(true);
    expect(result.toast).toMatch(/^url\("#star-glass-refraction"\) blur\(\d+px\) contrast\(/);
    expect(result.dock).toMatch(/^url\("#star-glass-refraction"\) blur\(\d+px\) contrast\(/);
  } else {
    // No url() value for a browser that does not render it: the whole chain, blur first, stays.
    expect(result.marked).toBe(false);
    expect(result.toast).toMatch(/^blur\(\d+px\) contrast\(/);
    expect(result.dock).toMatch(/^blur\(\d+px\) contrast\(/);
  }
  expect(errors).toEqual([]);
});

test('edge refraction: one filter pair, only the dock and the toast, mirrored in right to left', async ({
  page,
}) => {
  await open(page, 'dark', 'rtl');
  const result = await refraction(page);
  expect(result.defs).toBe(2);
  expect(result.toast).toMatch(/^url\("#star-glass-refraction-rtl"\) blur\(/);
  expect((await popover(page, 'Glass layers')).backdropFilter).toMatch(/^blur\(/);
});

for (const [name, media] of [
  ['reduced motion', { reducedMotion: 'reduce' }],
  ['more contrast', { contrast: 'more' }],
  ['forced colors', { forcedColors: 'active' }],
] as const) {
  test(`edge refraction: off with ${name}`, async ({ page }) => {
    await page.emulateMedia(media);
    await open(page, 'light');
    const result = await refraction(page);
    expect(result.toast).not.toContain('url(');
    expect(result.dock).not.toContain('url(');
  });
}

test('edge refraction: off in the solid variant', async ({ page }) => {
  await open(page, 'light');
  const live = example(page, 'Glass layers');
  const toast = live.locator('.docs-glass-stage .star-toast');
  await expect
    .poll(() => toast.evaluate((node) => getComputedStyle(node).backdropFilter))
    .toMatch(/^url\(/);
  await live.getByRole('radio', { name: 'solid' }).click();
  await expect
    .poll(() => toast.evaluate((node) => getComputedStyle(node).backdropFilter))
    .not.toContain('url(');
});
