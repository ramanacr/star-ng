import { expect, Page, test } from '@playwright/test';
import { example, openPage } from './support';

// The tree table features on the docs page: sort, filter, paging, selection, lazy children,
// columns, cell edit and the context menu.

async function open(page: Page, heading: string) {
  await openPage(page, '/controls/tree-table', 'Tree table');
  const live = example(page, heading);
  await live.scrollIntoViewIfNeeded();
  const grid = live.getByRole('treegrid');
  const row = (key: string) => grid.locator(`tbody tr[data-key="${key}"]`);
  const keys = () =>
    grid
      .locator('tbody tr[data-key]')
      .evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset['key']));
  return { live, grid, row, keys };
}

test.describe('tree table features', () => {
  test('sorts within each parent, filters and pages over the top-level rows', async ({ page }) => {
    const { live, grid, row, keys } = await open(page, 'Sort, filter and page');
    // Five projects per page; Website relaunch is open.
    await expect(grid.locator('tbody tr[data-key]')).toHaveCount(5 + 3);
    await grid.getByRole('button', { name: 'Hours' }).click();
    await expect(grid.getByRole('columnheader', { name: 'Hours' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    // The smallest projects come first, and the tasks of a project stay below it.
    expect((await keys()).slice(0, 2)).toEqual(['archive', 'survey']);
    await live.getByRole('searchbox', { name: 'Search' }).fill('images');
    await expect(row('website')).toHaveAttribute('aria-expanded', 'true');
    expect(await keys()).toEqual(['website', 'website-content', 'website-images']);
    await live.getByRole('searchbox', { name: 'Search' }).fill('');
    await live.getByRole('button', { name: 'Page 2' }).click();
    await expect(row('archive')).toHaveCount(0);
    await expect(grid.locator('tbody tr[aria-level="1"]')).toHaveCount(3);
    await expect(row('app')).toHaveAttribute('aria-posinset', '8');
  });

  test('checks a branch with the mouse and the keyboard and shows mixed parents', async ({
    page,
  }) => {
    const { live, grid, row } = await open(page, 'Checkbox selection');
    const status = live.getByRole('status');
    await expect(grid.getByRole('checkbox', { name: 'Order portal' })).toHaveAttribute(
      'aria-checked',
      'mixed',
    );
    await grid.getByRole('checkbox', { name: 'Content' }).click();
    await expect(grid.getByRole('checkbox', { name: 'Images' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(grid.getByRole('checkbox', { name: 'Website relaunch' })).toHaveAttribute(
      'aria-checked',
      'mixed',
    );
    await row('shop-invoices').focus();
    await page.keyboard.press('Space');
    await expect(grid.getByRole('checkbox', { name: 'Order portal' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(status).toContainText('shop');
  });

  test('loads lazy children with a loading row', async ({ page }) => {
    const { live, row } = await open(page, 'Lazy children');
    await row('invoices').focus();
    await page.keyboard.press('ArrowRight');
    await expect(live.locator('tr.star-tree-table__loading')).toBeVisible();
    await expect(row('invoices/2025')).toBeVisible();
    await expect(live.locator('tr.star-tree-table__loading')).toHaveCount(0);
    await expect(row('invoices/2025')).toHaveAttribute('aria-level', '2');
    await expect(row('invoices')).toBeFocused();
  });

  test('moves and resizes columns with the keyboard', async ({ page }) => {
    const { live, grid } = await open(page, 'Columns: freeze, resize and reorder');
    const headers = grid.getByRole('columnheader');
    await expect(headers).toHaveText([/Project/, /Owner/, /Hours/]);
    await grid.getByRole('button', { name: 'Move Hours earlier' }).click();
    await expect(headers).toHaveText([/Project/, /Hours/, /Owner/]);
    await expect(live.getByRole('status')).toHaveText('Order: name, hours, owner');
    // The frozen column cannot move: its neighbour cannot move before it.
    await expect(grid.getByRole('button', { name: 'Move Hours earlier' })).toBeDisabled();
    const handle = grid.getByRole('separator', { name: 'Resize Owner' });
    const before = Number(await handle.getAttribute('aria-valuenow'));
    await handle.focus();
    await page.keyboard.press('ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow', String(before + 16));
  });

  test('edits a cell with the keyboard and stores the value', async ({ page }) => {
    const { live, row } = await open(page, 'Cell edit');
    await row('website').focus();
    await page.keyboard.press('ArrowRight'); // into the row: the first cell
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight'); // the Hours cell
    await page.keyboard.press('F2');
    const editor = live.getByRole('spinbutton', { name: 'Edit Hours' });
    await expect(editor).toBeFocused();
    await editor.fill('125');
    await page.keyboard.press('Enter');
    await expect(row('website').locator('td').nth(2)).toHaveText('125');
    await expect(live.getByRole('status')).toHaveText(
      'Last edit: Website relaunch, hours: 120 to 125',
    );
    await expect(row('website').locator('td').nth(2)).toBeFocused();
    await page.keyboard.press('Enter');
    // The editor takes the focus after the next render; Escape before that reaches the cell.
    await expect(editor).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(live.getByRole('spinbutton')).toHaveCount(0);
  });

  test('opens the row context menu with Shift+F10 and with a right click', async ({ page }) => {
    const { live, row } = await open(page, 'Context menu');
    await row('shop').focus();
    await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menuitem', { name: 'Open' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Archive' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Last action: Archive: Order portal');
    await expect(row('shop')).toBeFocused();
    await row('website-design').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Open' }).click();
    await expect(live.getByRole('status')).toHaveText('Last action: Open: Page design');
  });
});
