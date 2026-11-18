import { expect, test } from '@playwright/test';
import { example, openPage } from './support';

test.describe('query builder', () => {
  test('filters the table and edits rules with the keyboard', async ({ page }) => {
    await openPage(page, '/controls/query-builder', 'Query builder');
    const live = example(page, 'Filter a table');
    const status = live.getByRole('status');
    await expect(status).toContainText(
      'Status is one of Open, Overdue and Total greater than or equal to 100',
    );
    const before = await status.textContent();

    // Delete on a focused rule row removes it; Control+Z restores it.
    const second = live.getByRole('group', { name: 'Rule 2' });
    await second.focus();
    await page.keyboard.press('Delete');
    await expect(status).toContainText('Status is one of Open, Overdue (');
    await expect(live.locator('[aria-live]')).toHaveText(
      'Rule 2 removed. Press Control and Z to undo.',
    );
    await page.keyboard.press('Control+z');
    await expect(status).toHaveText(before!);

    // Alt+Arrow up moves the focused rule one place up.
    await live.getByRole('group', { name: 'Rule 2' }).focus();
    await page.keyboard.press('Alt+ArrowUp');
    await expect(status).toContainText('Total greater than or equal to 100 and Status is one of');
    await expect(live.locator('[aria-live]')).toHaveText('Rule 2, position 1 of 2');
    await expect(live.getByRole('group', { name: 'Rule 1' })).toBeFocused();

    // A new text rule filters the table as the user types.
    await live.getByRole('button', { name: 'Add rule' }).first().click();
    await expect(live.getByRole('group', { name: 'Rule 3' })).toBeFocused();
    await live.getByRole('group', { name: 'Rule 3' }).getByRole('textbox').fill('stone');
    await expect(status).toContainText('Customer contains stone');
    const rows = live.locator('star-table tbody tr');
    await expect(rows.first()).toContainText('Ava Stone');
  });
});
