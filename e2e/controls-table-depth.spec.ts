import { expect, Page, test } from '@playwright/test';
import { example, openPage as openDocsPage } from './support';

/** Opens a docs page and waits until it is hydrated (no `ngh` marker left). */
async function openPage(page: Page, path: string, heading: string | RegExp): Promise<void> {
  await openDocsPage(page, path, heading);
  await expect(page.locator('[ngh]')).toHaveCount(0, { timeout: 15_000 });
}

/** Text with the white space of a template line wrap made into one space. */
const normal = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();

test.describe('table depth (wave N1)', () => {
  test('custom rows keep cell navigation', async ({ page }) => {
    await openPage(page, '/controls/table-layout', 'Table layout');
    const live = example(page, 'Custom rows');
    const cells = live.locator('tbody[data-star-part="body"] tr').first().locator('td');
    await cells.first().click();
    await expect(cells.first()).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(cells.nth(1)).toBeFocused();
    expect(normal(await live.locator('tfoot').textContent())).toBe('5 orders');
  });

  test('a row pinned from the context menu stays at the top', async ({ page }) => {
    await openPage(page, '/controls/table-layout', 'Table layout');
    const live = example(page, 'Pinned rows');
    const pinned = live.locator('tbody[data-star-part="pinnedTopPanel"] tr');
    await expect(pinned).toHaveCount(1);
    await live.locator('tbody[data-star-part="body"] tr').first().locator('td').nth(1).click({
      button: 'right',
    });
    await page.getByRole('menuitem', { name: 'Pin row to top' }).click();
    await expect(pinned).toHaveCount(2);
    await expect(live.getByRole('status')).toContainText('Top: ORD-1003, ORD-1001');
    await live.locator('.star-table__scroll').evaluate((node) => (node.scrollTop = 400));
    await expect(pinned.first()).toBeInViewport();
  });

  test('the Excel-style filter narrows the values and applies them', async ({ page }) => {
    await openPage(page, '/controls/table-sort-filter', 'Table sorting and filtering');
    const live = example(page, 'Excel-style filter');
    await live.getByRole('button', { name: 'Filter Status' }).click();
    const dialog = page.getByRole('dialog', { name: 'Filter Status' });
    await dialog.getByRole('searchbox', { name: 'Search', exact: true }).fill('pai');
    await expect(dialog.getByRole('checkbox')).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Select all' }).click();
    await dialog.getByRole('button', { name: 'Apply' }).click();
    const statuses = await live.locator('tbody td[data-label="Status"]').allTextContents();
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses.every((text) => text.trim() === 'Paid')).toBe(true);
  });

  test('the advanced filter dialog sets the rules', async ({ page }) => {
    await openPage(page, '/controls/table-sort-filter', 'Table sorting and filtering');
    const live = example(page, 'Advanced filter');
    await live.getByRole('button', { name: 'Advanced filter' }).click();
    const dialog = page.getByRole('dialog', { name: 'Advanced filter' });
    await expect(dialog).toBeVisible();
    // The focus starts inside the query builder, not on a footer button.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const active = document.activeElement;
          return (
            !!active?.closest('star-query-builder') &&
            !active.closest('[data-star-part="advancedButtonsPanel"]')
          );
        }),
      )
      .toBe(true);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Rules: 0');
  });

  test('column selection with click and Shift + click', async ({ page }) => {
    await openPage(page, '/controls/table-selection', 'Table selection');
    const live = example(page, 'Column selection');
    await live.getByRole('button', { name: 'Select column Order' }).click();
    await live
      .getByRole('button', { name: 'Select column Region' })
      .click({ modifiers: ['Shift'] });
    await expect(live.getByRole('status')).toHaveText('Columns: id, customer, region');
    await expect(live.getByRole('button', { name: 'Select column Customer' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('paginator content shows the page', async ({ page }) => {
    await openPage(page, '/controls/table-paging', 'Table paging');
    const live = example(page, 'Paginator content');
    await expect(live.locator('star-paginator')).toContainText('Page 1 of');
    await live.getByRole('button', { name: 'Next page' }).click();
    await expect(live.locator('star-paginator')).toContainText('Page 2 of');
  });

  test('tree table takes the table slots and icon slots', async ({ page }) => {
    await openPage(page, '/controls/tree-table', 'Tree table');
    const live = example(page, 'Table slots');
    await expect(live.getByText('Projects this quarter')).toBeVisible();
    await expect(live.locator('thead')).toContainText('Hours (h)');
    await expect(live.locator('tfoot')).toContainText('projects');
    const toggle = live.locator('[data-star-part="expandButton"]').first();
    await expect(toggle.locator('.ph-plus-square')).toHaveCount(1);
    await toggle.click();
    await expect(toggle.locator('.ph-minus-square')).toHaveCount(1);
  });
});
