import { expect, Page, test } from '@playwright/test';
import { collectErrors, example, openPage as openDocsPage } from './support';

/**
 * Ribbon, file manager and diagram. The pages are prerendered: a key or a click before hydration
 * is lost, so each test waits until the controls lose their `ngh` attribute.
 */
async function openPage(page: Page, path: string, heading: string, tag: string): Promise<void> {
  await openDocsPage(page, path, heading);
  await expect(page.locator(`${tag}[ngh]`)).toHaveCount(0, { timeout: 15_000 });
}

test.describe('ribbon', () => {
  test('selects tabs, runs commands and uses KeyTips', async ({ page }) => {
    const errors = collectErrors(page);
    await openPage(page, '/controls/ribbon', 'Ribbon', 'star-ribbon');
    const live = example(page, 'Document editor');
    const output = live.getByRole('status');

    await live.getByRole('button', { name: 'Cut' }).click();
    await expect(output).toHaveText('Last command: cut');

    // Alt (or F10), then H for Home, then B for Bold.
    await live.getByRole('tab', { name: 'Home' }).focus();
    await page.keyboard.press('F10');
    await expect(live.locator('.star-ribbon__keytip', { hasText: 'H' })).toBeVisible();
    await page.keyboard.press('h');
    await page.keyboard.press('b');
    await expect(output).toHaveText('Last command: bold (true)');
    await expect(live.getByRole('button', { name: 'Bold' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(live.locator('.star-ribbon__keytip')).toHaveCount(0);

    // The tab list follows the arrow keys.
    await live.getByRole('tab', { name: 'Home' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(live.getByRole('tab', { name: 'Insert' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(live.getByRole('toolbar', { name: 'Tables' })).toBeVisible();

    // Each group is a toolbar with one tab stop.
    await live.getByRole('tab', { name: 'Home' }).click();
    await live.getByRole('button', { name: 'Paste', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(live.getByRole('button', { name: 'More Paste options' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Paste text only' })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(output).toHaveText('Last command: paste (paste-text)');
    expect(errors).toEqual([]);
  });

  test('collapses groups when the ribbon is narrow', async ({ page }) => {
    await openPage(page, '/controls/ribbon', 'Ribbon', 'star-ribbon');
    const live = example(page, 'Narrow ribbon');
    const collapsed = live.locator('.star-ribbon-group--collapsed');
    await expect(collapsed.first()).toBeVisible();
    const overflow = collapsed.first().locator('.star-ribbon-group__overflow');
    await overflow.click();
    await expect(overflow).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    await expect(overflow).toHaveAttribute('aria-expanded', 'false');
    await expect(overflow).toBeFocused();
  });

  test('minimised ribbon shows the panel on a tab click', async ({ page }) => {
    await openPage(page, '/controls/ribbon', 'Ribbon', 'star-ribbon');
    const live = example(page, 'Minimised ribbon');
    const panel = live.getByRole('tabpanel');
    await expect(panel).toBeHidden();
    await live.getByRole('tab', { name: 'Review' }).click();
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });
});

test.describe('file manager', () => {
  test('opens folders, selects, renames and moves with the keyboard', async ({ page }) => {
    const errors = collectErrors(page);
    await openPage(page, '/controls/file-manager', 'File manager', 'star-file-manager');
    const live = example(page, 'Project folder');
    const output = live.getByRole('status');
    const table = live.getByRole('grid').or(live.getByRole('table')).first();

    // Folders come first.
    await expect(table.getByRole('row').nth(1)).toContainText('Archive');

    // F2 renames the focused row.
    const notes = table.getByRole('row', { name: /Meeting notes\.txt/ });
    await notes.click();
    await page.keyboard.press('F2');
    const field = live.getByRole('textbox', { name: 'Rename' });
    await field.fill('Minutes.txt');
    await page.keyboard.press('Enter');
    await expect(output).toHaveText('Renamed Meeting notes.txt to Minutes.txt');

    // Control+X, open Design, Control+V.
    await table.getByRole('row', { name: /Minutes\.txt/ }).click();
    await page.keyboard.press('Control+x');
    await table.getByRole('row', { name: /Design/ }).dblclick();
    await expect(live.locator('.star-breadcrumb [aria-current="page"]')).toContainText('Design');
    await table.getByRole('row', { name: /Order form\.png/ }).click();
    await page.keyboard.press('Control+v');
    await expect(output).toHaveText('Moved 1 item(s)');
    await expect(table.getByRole('row', { name: /Minutes\.txt/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('deletes after a confirmation and drags a file onto a folder', async ({ page }) => {
    await openPage(page, '/controls/file-manager', 'File manager', 'star-file-manager');
    const live = example(page, 'Project folder');
    const output = live.getByRole('status');
    const table = live.getByRole('grid').or(live.getByRole('table')).first();

    await table.getByRole('row', { name: /Budget\.csv/ }).click();
    await page.keyboard.press('Delete');
    const dialog = page.getByRole('alertdialog', { name: 'Delete' });
    await expect(dialog).toContainText('Delete 1 item?');
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await expect(output).toHaveText('Deleted 1 item(s)');

    const plan = live.locator('[data-file-name="plan"]');
    const design = live.locator('[data-file-name="design"]');
    await plan.dragTo(design);
    await expect(output).toHaveText('Moved 1 item(s)');
  });

  test('large icons move the focus with the arrow keys', async ({ page }) => {
    await openPage(page, '/controls/file-manager', 'File manager', 'star-file-manager');
    const live = example(page, 'Large icons and a provider');
    await live.getByRole('option', { name: /Project Atlas/ }).dblclick();
    const first = live.getByRole('option').first();
    await expect(first).toContainText('Archive');
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(live.getByRole('option').nth(1)).toBeFocused();
    await expect(live.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
  });
});
