import { expect, Page, test } from '@playwright/test';
import { example, openPage as openDocsPage } from './support';

/**
 * Opens the hierarchical grid page and waits until the controls are hydrated. The page is
 * prerendered, so it is visible before the application runs, and a key before hydration is lost.
 */
async function openPage(page: Page): Promise<void> {
  await openDocsPage(page, '/controls/hierarchical-grid', 'Hierarchical grid');
  await expect(page.locator('star-hierarchical-grid[ngh]')).toHaveCount(0, { timeout: 15_000 });
}

test.describe('hierarchical grid', () => {
  test('expands with the keyboard, loads lines and returns to the parent row', async ({ page }) => {
    await openPage(page);
    const live = example(page, 'Customers, orders and order lines');
    const root = live.getByRole('grid', { name: 'Customers', exact: true });
    const second = root.locator(':scope > tbody > tr.star-table__row').nth(1);
    const toggle = second.locator('.star-table__expander button');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const name = second.locator('td[data-field="name"]');
    await name.click();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(name).toBeFocused();
    const orders = live.getByRole('grid', { name: 'Orders of Customer 02' });
    await expect(orders).toBeVisible();

    // Arrow Down goes into the child grid, Alt+Arrow Down opens an order: its lines load.
    await page.keyboard.press('ArrowDown');
    await expect(orders.locator('tbody [tabindex="0"]')).toBeFocused();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(live.getByRole('status').filter({ hasText: /opened \(level 2\)/ })).toBeVisible();
    await expect(live.getByRole('grid', { name: /^Order lines of ORD-101/ })).toBeVisible();

    // Control+Arrow Up goes back to the customer row.
    await page.keyboard.press('Control+ArrowUp');
    await expect(second.locator('[tabindex="0"]')).toBeFocused();
    await page.keyboard.press('Alt+ArrowUp');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('keeps a canceled row closed and retries a failed load', async ({ page }) => {
    await openPage(page);
    const live = example(page, 'Cancel an expand and load errors');
    const root = live.getByRole('grid', { name: 'Customers with errors' });
    const rows = root.locator(':scope > tbody > tr.star-table__row');
    await rows.nth(2).getByRole('button', { name: 'Expand row' }).click();
    await expect(rows.nth(2).getByRole('button', { name: 'Expand row' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await rows.nth(0).getByRole('button', { name: 'Expand row' }).click();
    const orders = live.getByRole('grid', { name: 'Orders of Customer 01' });
    await orders.getByRole('button', { name: 'Expand row' }).first().click();
    await expect(live.getByRole('alert')).toContainText('The rows could not be loaded.');
    await live.getByRole('button', { name: 'Retry' }).click();
    await expect(live.getByRole('grid', { name: /^Order lines of ORD-/ })).toBeVisible();
  });
});
