import { expect, Page, test } from '@playwright/test';
import { example, openPage } from './support';

/** The prerendered page is hydrated: no element keeps the `ngh` marker. */
async function hydrated(page: Page): Promise<void> {
  await expect(page.locator('[ngh]')).toHaveCount(0, { timeout: 15_000 });
}

test.describe('wave N2 depth', () => {
  test('tab nav: router links as tabs, arrow keys and the panel name', async ({ page }) => {
    await openPage(page, '/controls/tabs', 'Tabs');
    await hydrated(page);
    const live = example(page, 'Router link tabs');
    const list = live.getByRole('tablist', { name: 'Order views' });
    const summary = list.getByRole('tab', { name: 'Summary' });
    const lines = list.getByRole('tab', { name: 'Lines' });
    await expect(summary).toHaveAttribute('aria-selected', 'true');
    await expect(summary).toHaveAttribute('tabindex', '0');
    await expect(lines).toHaveAttribute('tabindex', '-1');

    await summary.focus();
    await page.keyboard.press('ArrowRight');
    await expect(lines).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(lines).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/view=lines/);
    const panel = live.getByRole('tabpanel', { name: 'Lines' });
    await expect(panel).toHaveText(/Lines: 3 items/);
  });

  test('menu: groups under a heading, start and end outside the menu role', async ({ page }) => {
    await openPage(page, '/controls/menu', 'Menu');
    await hydrated(page);
    const live = example(page, 'Groups, start and end');
    const menu = live.getByRole('menu', { name: 'Workspace menu' });
    await expect(menu.getByRole('group', { name: 'Orders actions' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Import orders' })).toBeVisible();
    await expect(live.getByText('Workspace: Orders')).toBeVisible();
    await expect(menu.getByText('Workspace: Orders')).toHaveCount(0);
    await menu.getByRole('menuitem', { name: 'Search' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: 'New order' })).toBeFocused();
  });
});
