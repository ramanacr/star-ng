import { expect, test } from '@playwright/test';
import { collectErrors, example, openPage } from './support';

test.describe('docs application', () => {
  test('opens the home page with the grouped navigation', async ({ page }) => {
    await openPage(page, '/', 'StarNG');
    const nav = page.getByRole('navigation', { name: 'Pages' });
    await expect(nav.getByRole('heading', { name: 'Guides' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Button', exact: true })).toBeVisible();
  });

  test('filters the navigation with the search field', async ({ page }) => {
    await openPage(page, '/', 'StarNG');
    const nav = page.getByRole('navigation', { name: 'Pages' });
    await nav.getByRole('searchbox', { name: 'Search pages' }).fill('switch');
    await expect(nav.getByRole('link')).toHaveText(['Toggle switch', 'Theme switch']);

    // Keywords match too: "wcag" is a keyword of the accessibility guide.
    await nav.getByRole('searchbox').fill('wcag');
    await expect(nav.getByRole('link')).toHaveText(['Accessibility']);

    await nav.getByRole('searchbox').fill('no-such-page');
    await expect(nav.getByRole('status')).toContainText('No page matches');
  });

  test('opens every page of the navigation without an error', async ({ page }) => {
    test.slow();
    const errors = collectErrors(page);
    await openPage(page, '/', 'StarNG');
    const links = page.getByRole('navigation', { name: 'Pages' }).getByRole('link');
    const count = await links.count();
    expect(count).toBeGreaterThan(10);

    for (let index = 0; index < count; index++) {
      const link = links.nth(index);
      const label = (await link.innerText()).trim();
      await link.click();
      await expect(link).toHaveAttribute('aria-current', 'page');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page).toHaveTitle(`${label} · StarNG`);
    }
    expect(errors).toEqual([]);
  });

  test('every control page has live examples, their source and an API table', async ({ page }) => {
    test.slow();
    await openPage(page, '/', 'StarNG');
    const paths = await page
      .getByRole('navigation', { name: 'Pages' })
      .locator('a[href^="/controls/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    expect(paths.length).toBeGreaterThan(5);

    for (const path of paths) {
      await page.goto(path);
      await expect(page.locator('docs-example').first(), path).toBeVisible();
      // Every example has source text.
      const sources = await page
        .locator('docs-example .docs-example__source code')
        .evaluateAll((blocks) => blocks.map((block) => block.textContent?.trim() ?? ''));
      expect(sources.length, path).toBeGreaterThan(0);
      expect(
        sources.every((source) => source.length > 0),
        path,
      ).toBe(true);
      // The API section has at least one table with rows.
      await expect(page.getByRole('heading', { level: 2, name: 'API' }), path).toBeVisible();
      expect(await page.locator('docs-api table tbody tr').count(), path).toBeGreaterThan(0);
    }
  });

  test('shows the source of an example and it matches the live markup', async ({ page }) => {
    await openPage(page, '/controls/button', 'Button');
    const block = page.locator('docs-example').filter({
      has: page.getByRole('heading', { level: 2, name: 'Sizes', exact: true }),
    });
    await block.getByText('Source', { exact: true }).click();
    await expect(block.locator('pre').first()).toContainText('<star-button size="sm">Small');
    await expect(example(page, 'Sizes').getByRole('button', { name: 'Small' })).toBeVisible();
  });

  test('navigation opens from the menu button on a small screen', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    await openPage(page, '/', 'StarNG');
    const nav = page.getByRole('navigation', { name: 'Pages' });
    await expect(nav).toBeHidden();
    await page.getByRole('button', { name: 'Navigation' }).click();
    await nav.getByRole('link', { name: 'Checkbox' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Checkbox' })).toBeVisible();
    await expect(nav).toBeHidden();
  });

  test('the navigation drawer keeps the focus and closes with Escape', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });
    await openPage(page, '/controls/table', 'Table');
    const nav = page.getByRole('navigation', { name: 'Pages' });
    const menu = page.getByRole('button', { name: 'Navigation' });
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    // The search field takes the focus, and the page behind the drawer is inert.
    await expect(nav.getByRole('searchbox', { name: 'Search pages' })).toBeFocused();
    await expect(page.locator('#main')).toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
    await expect(menu).toBeFocused();
    await expect(page.locator('#main')).not.toHaveAttribute('inert');
    // A click on the dimmed page closes the drawer too.
    await menu.click();
    await page.locator('.docs-backdrop').click({ position: { x: 460, y: 400 } });
    await expect(nav).toBeHidden();
  });

  test('slash moves the focus to the search, and Enter opens the first match', async ({ page }) => {
    await openPage(page, '/controls/button', 'Button');
    const search = page
      .getByRole('navigation', { name: 'Pages' })
      .getByRole('searchbox', { name: 'Search pages' });
    await page.locator('#main').focus();
    await page.keyboard.press('/');
    await expect(search).toBeFocused();
    await search.fill('tree table');
    await expect(page.locator('.docs-nav__status')).toHaveText('1 page matches.');
    await search.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Tree table' })).toBeVisible();
  });

  test('an example heading has a link to the example', async ({ page }) => {
    await openPage(page, '/controls/button', 'Button');
    await page.getByRole('link', { name: 'Link to Sizes' }).click();
    await expect(page).toHaveURL(/\/controls\/button#button-sizes$/);
  });
});
