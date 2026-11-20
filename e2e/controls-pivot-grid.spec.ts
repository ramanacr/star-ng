import { expect, Locator, Page, test } from '@playwright/test';
import { example, openPage as openDocsPage } from './support';

/**
 * Opens the pivot grid page and waits until the controls are hydrated. The page is prerendered,
 * so it is visible before the application runs, and a key before hydration is lost.
 */
async function openPage(page: Page): Promise<void> {
  await openDocsPage(page, '/controls/pivot-grid', 'Pivot grid');
  await expect(page.locator('star-pivot-grid[ngh]')).toHaveCount(0, { timeout: 15_000 });
}

function salesGrid(page: Page): Locator {
  return example(page, 'Sales by region, product and quarter').getByRole('grid', {
    name: 'Sales by region and quarter',
  });
}

test.describe('pivot grid', () => {
  test('moves with the keyboard, expands a member and drills down', async ({ page }) => {
    await openPage(page);
    const grid = salesGrid(page);
    const live = example(page, 'Sales by region, product and quarter');
    await expect(grid.getByRole('rowheader', { name: 'North' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const south = grid.getByRole('rowheader', { name: 'South' });
    await expect(south).toHaveAttribute('aria-expanded', 'false');

    await grid.locator('[tabindex="0"]').focus();
    await expect(grid.getByRole('rowheader', { name: 'North' })).toBeFocused();
    // Down past North's products to South, then Alt+Right expands it.
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
    await expect(south).toBeFocused();
    await page.keyboard.press('Alt+ArrowRight');
    await expect(south).toHaveAttribute('aria-expanded', 'true');
    await expect(south).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('South, Chair, 2025, 1: 3 records.');

    // The column headers take the focus too: Control+Home goes to the corner.
    await page.keyboard.press('Control+Home');
    await expect(grid.getByRole('columnheader', { name: 'Region / Product' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(grid.getByRole('columnheader', { name: '2025', exact: true })).toBeFocused();
  });

  test('moves a field with the configurator menu and filters members', async ({ page }) => {
    await openPage(page);
    const live = example(page, 'Configurator');
    const grid = live.getByRole('grid', { name: 'Sales by product' });
    await expect(grid.getByRole('rowheader', { name: 'Lamp' })).toBeVisible();

    await live.getByRole('button', { name: 'Move Region' }).click();
    await page.getByRole('menuitem', { name: 'Move to Columns' }).click();
    await expect(live.locator('[data-pivot-area="columns"]')).toContainText('Region');
    await expect(grid.getByRole('columnheader', { name: 'North' }).first()).toBeVisible();
    await expect(page.locator('.cdk-live-announcer-element')).toContainText(
      'Region moved to Columns',
    );

    await live.getByRole('button', { name: 'Filter Product' }).click();
    const dialog = page.getByRole('dialog', { name: 'Filter Product' });
    await dialog.getByRole('searchbox').fill('lam');
    await dialog.getByRole('checkbox', { name: 'Lamp' }).uncheck();
    await expect(grid.getByRole('rowheader', { name: 'Lamp' })).toHaveCount(0);
    await expect(live.getByRole('button', { name: 'Filter Product, active' })).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('writes the visible pivot as CSV', async ({ page }) => {
    await openPage(page);
    const live = example(page, 'Totals, member order and CSV');
    await live.getByRole('button', { name: 'Show CSV' }).click();
    await expect(live.locator('pre')).toContainText('Product,East,North,South');
  });
});
