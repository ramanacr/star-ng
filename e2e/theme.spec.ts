import { expect, Page, test } from '@playwright/test';
import { lowContrast, openPage } from './support';

/** Blocks every JavaScript file of the application except the external first-paint file. */
async function blockAppScripts(page: Page): Promise<void> {
  await page.route('**/*.js', (route) =>
    new URL(route.request().url()).pathname === '/star-theme-first-paint.js'
      ? route.continue()
      : route.abort(),
  );
}

test.describe('theme', () => {
  test('applies the saved dark theme before the application starts', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('star-theme', 'dark'));
    // Stop the application scripts: only index.html and the external first-paint file run, so
    // the attribute comes from that file.
    await blockAppScripts(page);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('follows the system setting when no theme is saved', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await blockAppScripts(page);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('the theme switch applies and saves the choice', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openPage(page, '/', 'StarNG');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');

    const header = page.locator('.docs-header');
    const button = header.getByRole('button', { name: /^Theme: / });
    await expect(button).toHaveAccessibleName('Theme: System');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await header.getByRole('button', { name: 'Dark', exact: true }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(button).toHaveAccessibleName('Theme: Dark');
    await expect(button).toBeFocused();
    expect(await page.evaluate(() => localStorage.getItem('star-theme'))).toBe('dark');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(header.getByRole('button', { name: 'Theme: Dark' })).toBeVisible();

    // The current choice is marked in the list.
    await header.getByRole('button', { name: 'Theme: Dark' }).click();
    await expect(header.getByRole('button', { name: 'Dark', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // "System" follows the operating system setting again.
    await header.getByRole('button', { name: 'System', exact: true }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('a product can override a token', async ({ page }) => {
    await openPage(page, '/controls/button', 'Button');
    const primary = page.locator('.star-btn--primary').first();
    await page.addStyleTag({ content: ':root { --star-primary-fill: rgb(15, 118, 110); }' });
    await expect(primary).toHaveCSS('background-color', 'rgb(15, 118, 110)');
  });
});

// Pages that show filled controls: text on a fill must reach WCAG AA (4.5:1) in both themes.
const FILLED =
  '.star-btn--primary, .star-btn--success, .star-btn--warning, .star-btn--danger, .star-badge, .star-tag, ' +
  '.star-paginator__page--active, .star-stepper__item--done .star-stepper__number';
const PAGES = [
  '/controls/button',
  '/controls/badge',
  '/controls/tag',
  '/controls/paginator',
  '/controls/stepper',
];

for (const theme of ['light', 'dark'] as const) {
  test(`filled controls have AA contrast in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((name) => localStorage.setItem('star-theme', name), theme);
    let measured = 0;
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const filled = page.locator(FILLED);
      await expect(filled.first()).toBeVisible();
      measured += await filled.count();
      // Colors change with a short transition: poll until every control passes.
      await expect.poll(() => lowContrast(filled), { message: path }).toEqual([]);
    }
    expect(measured).toBeGreaterThan(15);
  });

  test(`page text has AA contrast in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((name) => localStorage.setItem('star-theme', name), theme);
    await page.goto('/controls/field');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    // The page loads lazily: wait for a field before reading its colors.
    await expect(page.locator('.star-field__label').first()).toBeVisible();
    await expect(page.locator('.star-field__error').first()).toBeAttached();
    await expect(page.locator('.star-field__hint').first()).toBeAttached();
    // Label, hint and error text of a field against the surface of the example.
    const colors = await page.evaluate(() => {
      const pick = (selector: string) => {
        const node = document.querySelector(selector);
        return node ? getComputedStyle(node).color : '';
      };
      const live = document.querySelector('.docs-example__live');
      return {
        fill: live ? getComputedStyle(live).backgroundColor : '',
        text: [pick('.star-field__label'), pick('.star-field__hint'), pick('.star-field__error')],
      };
    });
    const luminance = (color: string) => {
      const [red, green, blue] = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map((value) => {
        const share = Number(value) / 255;
        return share <= 0.03928 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const fill = luminance(colors.fill);
    for (const color of colors.text) {
      const text = luminance(color);
      const ratio = (Math.max(text, fill) + 0.05) / (Math.min(text, fill) + 0.05);
      expect(ratio, `${color} on ${colors.fill}`).toBeGreaterThanOrEqual(4.5);
    }
  });
}
