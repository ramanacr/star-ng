import { expect, Locator, Page, test } from '@playwright/test';
import { example, expectFocusLeftMenu, openPage as openDocsPage } from './support';

/**
 * Opens the Table interaction page and waits until it is hydrated: the page is prerendered, and a
 * key before hydration is lost. A hydrated component loses its `ngh` attribute.
 */
async function openPage(page: Page): Promise<void> {
  await openDocsPage(page, '/controls/table-interaction', 'Table interaction');
  await expect(page.locator('[ngh]')).toHaveCount(0, { timeout: 15_000 });
}

/** The body cell of a row (by its first cell text) and a column field. */
const cell = (grid: Locator, sku: string, field: string) =>
  grid.locator(`tbody tr[data-row="${sku}"] td[data-field="${field}"]`);

test.describe('table interaction', () => {
  test('moves between cells with the keys and edits with F2', async ({ page }) => {
    await openPage(page);
    const live = example(page, 'Cell navigation');
    const grid = live.getByRole('grid', { name: 'Stock with cell navigation' });
    // One tab stop: the first cell.
    await expect(grid.locator('tbody [tabindex="0"]')).toHaveCount(1);
    await cell(grid, 'SKU-101', 'sku').click();
    await expect(cell(grid, 'SKU-101', 'sku')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(cell(grid, 'SKU-101', 'item')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(cell(grid, 'SKU-102', 'item')).toBeFocused();
    await page.keyboard.press('End');
    const reorder = cell(grid, 'SKU-102', 'reorderAt').getByRole('button');
    await expect(reorder).toBeFocused();
    await expect(live.getByRole('status')).toHaveText('Active cell: SKU-102, reorderAt');
    await page.keyboard.press('Control+End');
    await expect(cell(grid, 'SKU-108', 'reorderAt').getByRole('button')).toBeFocused();
    await page.keyboard.press('Control+Home');
    await expect(cell(grid, 'SKU-101', 'sku')).toBeFocused();

    // F2 edits the bin; Escape goes back to the cell.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    const bin = cell(grid, 'SKU-101', 'bin');
    await expect(bin.getByRole('button')).toBeFocused();
    await page.keyboard.press('F2');
    const editor = grid.getByRole('textbox', { name: 'Edit Bin' });
    await expect(editor).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(bin.getByRole('button')).toBeFocused();
    await page.keyboard.press('Enter');
    await editor.fill('B-7');
    await page.keyboard.press('Enter');
    await expect(bin).toContainText('B-7');
    await expect(bin.getByRole('button')).toBeFocused();
  });

  test('mirrors Left and Right in right-to-left', async ({ page }) => {
    await openPage(page);
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    const grid = example(page, 'Cell navigation').getByRole('grid');
    await cell(grid, 'SKU-101', 'item').click();
    await page.keyboard.press('ArrowLeft');
    await expect(cell(grid, 'SKU-101', 'warehouse')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(cell(grid, 'SKU-101', 'item')).toBeFocused();
  });

  test('selects a range with Shift + Arrow keys and copies it', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openPage(page);
    const live = example(page, 'Cell and range selection');
    const grid = live.getByRole('grid', { name: 'Stock with range selection' });
    await expect(grid).toHaveAttribute('aria-multiselectable', 'true');
    await cell(grid, 'SKU-101', 'item').click();
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowRight');
    await expect(live.getByRole('status')).toHaveText('Selected: 4 cells');
    await expect(grid.locator('td[aria-selected="true"]')).toHaveCount(4);
    await page.keyboard.press('Control+c');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toBe('Cable kit\tLisbon\r\nKeyboard\tOslo');
  });

  test('opens the context menu with Shift+F10 and gives the focus back @cross-browser', async ({
    page,
  }) => {
    await openPage(page);
    const live = example(page, 'Context menu');
    const grid = live.getByRole('grid', { name: 'Orders with a context menu' });
    const target = cell(grid, 'ORD-1002', 'customer');
    await target.click();
    await page.keyboard.press('Shift+F10');
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem')).toHaveText([
      'Copy',
      'Copy with headers',
      'Sort ascending',
      'Sort descending',
      'Open order',
      'Cancel order',
    ]);
    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(target).toBeFocused();

    await target.click({ button: 'right' });
    await menu.getByRole('menuitem', { name: 'Open order' }).click();
    await expect(live.getByRole('status')).toHaveText(
      'Last choice: Open order on ORD-1002, Customer',
    );
    await expect(target).toBeFocused();
  });

  test('the context menu closes on a click outside and the focus leaves it @cross-browser', async ({
    page,
  }) => {
    await openPage(page);
    const live = example(page, 'Context menu');
    const grid = live.getByRole('grid', { name: 'Orders with a context menu' });
    await cell(grid, 'ORD-1002', 'customer').click();
    await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menu').getByRole('menuitem').first()).toBeFocused();

    await page.getByRole('heading', { level: 1, name: 'Table interaction' }).click();
    await expectFocusLeftMenu(page);
  });

  test('pastes tab-separated text into editable cells', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openPage(page);
    const live = example(page, 'Copy and paste');
    const grid = live.getByRole('grid', { name: 'Stock with copy and paste' });
    await page.evaluate(() => navigator.clipboard.writeText('C-3\t12\nZZ\t14\n'));
    await cell(grid, 'SKU-101', 'bin').getByRole('button').focus();
    await page.keyboard.press('Control+v');
    await expect(live.getByRole('status')).toHaveText('Last paste: 4 cells from SKU-101');
    await expect(cell(grid, 'SKU-101', 'bin')).toContainText('C-3');
    await expect(cell(grid, 'SKU-101', 'onHand')).toContainText('12');
    // "ZZ" fails the bin pattern: that cell stays.
    await expect(cell(grid, 'SKU-102', 'bin')).not.toContainText('ZZ');
    await expect(cell(grid, 'SKU-102', 'onHand')).toContainText('14');
  });

  test('highlights search matches and steps to the next page', async ({ page }) => {
    await openPage(page);
    const live = example(page, 'Search highlight');
    const grid = live.getByRole('table', { name: 'Stock with search' });
    await live.getByRole('searchbox', { name: 'Find in stock' }).fill('prague');
    await expect(live.getByRole('status')).toHaveText('Matches: 10, active: none');
    await expect(grid.locator('mark')).toHaveCount(2);
    await live.getByRole('searchbox', { name: 'Find in stock' }).press('Enter');
    await expect(live.getByRole('status')).toHaveText('Matches: 10, active: 1');
    await expect(grid.locator('mark.star-table__mark--active')).toHaveText('Prague');
    for (let i = 0; i < 2; i++)
      await live.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(live.getByRole('status')).toHaveText('Matches: 10, active: 3');
    await expect(grid.locator('mark.star-table__mark--active')).toBeVisible();
    await expect(grid.locator('tbody tr').first()).toContainText('SKU-109');
    await live.getByRole('button', { name: 'Clear' }).click();
    await expect(grid.locator('mark')).toHaveCount(0);
  });

  test('focuses and scrolls cells of a virtual table from code', async ({ page }) => {
    await openPage(page);
    const live = example(page, 'Keyboard and scroll methods');
    const grid = live.getByRole('grid', { name: 'Stock with the scroll API' });
    await live.getByRole('button', { name: 'Focus SKU-130 on hand' }).click();
    await expect(cell(grid, 'SKU-130', 'onHand')).toBeFocused();
    await expect(cell(grid, 'SKU-130', 'onHand')).toBeInViewport();
    await expect(live.getByRole('status')).toHaveText('Active cell: SKU-130, onHand');
    await live.getByRole('button', { name: 'Go to the first cell' }).click();
    await expect(cell(grid, 'SKU-101', 'sku')).toBeFocused();
    await live.getByRole('button', { name: 'Scroll to row 36' }).click();
    await expect(grid.locator('tbody tr[data-row="SKU-136"]')).toBeInViewport();
  });
});
