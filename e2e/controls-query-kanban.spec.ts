import { expect, Locator, Page, test } from '@playwright/test';
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
    // The page is prerendered: retry until the hydrated builder handles the key.
    await expect(async () => {
      await second.focus();
      await page.keyboard.press('Delete');
      await expect(status).toContainText('Status is one of Open, Overdue (', { timeout: 1000 });
    }).toPass();
    await expect(live.locator('star-query-builder [aria-live]')).toHaveText(
      'Rule 2 removed. Press Control and Z to undo.',
    );
    await page.keyboard.press('Control+z');
    await expect(status).toHaveText(before!);

    // Alt+Arrow up moves the focused rule one place up.
    await live.getByRole('group', { name: 'Rule 2' }).focus();
    await page.keyboard.press('Alt+ArrowUp');
    await expect(status).toContainText('Total greater than or equal to 100 and Status is one of');
    await expect(live.locator('star-query-builder [aria-live]')).toHaveText(
      'Rule 2, position 1 of 2',
    );
    await expect(live.getByRole('group', { name: 'Rule 1' })).toBeFocused();

    // A new text rule filters the table as the user types.
    await live.getByRole('button', { name: 'Add rule' }).first().click();
    await expect(live.getByRole('group', { name: 'Rule 3' })).toBeFocused();
    await live.getByRole('group', { name: 'Rule 3' }).getByRole('textbox').fill('stone');
    await expect(status).toContainText(/Customer contains stone \(\d+ orders\)/);
    const count = Number((await status.textContent())!.match(/\((\d+) orders\)/)![1]);
    const rows = live.locator('star-table tbody tr');
    // Every row that is left belongs to the customer "Ava Stone".
    if (count > 0) await expect(rows.filter({ hasNotText: 'Ava Stone' })).toHaveCount(0);
    else await expect(rows.first()).toContainText('No records found');
  });
});

/** Drags with the mouse in small steps, as the CDK needs. */
async function drag(page: Page, from: Locator, to: Locator): Promise<void> {
  await from.scrollIntoViewIfNeeded();
  const start = (await from.boundingBox())!;
  const x = start.x + start.width / 2;
  const y = start.y + start.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) await page.mouse.move(x + step * 2, y + step * 2);
  const end = (await to.boundingBox())!;
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 20 });
  await page.mouse.up();
}

test.describe('kanban board', () => {
  test('moves a card with the keyboard and announces each step', async ({ page }) => {
    await openPage(page, '/controls/kanban', 'Kanban board');
    const live = example(page, 'Task board');
    const announce = live.locator('[aria-live]');
    const card = live.locator('.star-kanban__card[data-key="T-101"]');
    // The page is prerendered: retry until the hydrated board handles the key.
    await expect(async () => {
      await card.focus();
      await page.keyboard.press('Space');
      await expect(announce).toHaveText('Picked up Draft the order form in To do', {
        timeout: 1000,
      });
    }).toPass();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(announce).toHaveText('Moved to Review, position 1 of 2');
    await page.keyboard.press('Space');
    await expect(announce).toHaveText('Draft the order form dropped in Review, position 1 of 2');
    await expect(live.getByRole('status')).toHaveText(
      'Draft the order form: todo → review, position 1.',
    );
    await expect(live.getByRole('group', { name: 'Review, 2 items, limit 1' })).toBeVisible();
    await expect(live.locator('.star-kanban__column--over')).toHaveCount(1);
    await expect(card).toBeFocused();

    // Escape puts a held card back.
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Escape');
    await expect(announce).toHaveText('Move cancelled. Draft the order form is back in Review');
  });

  test('moves a card with drag and drop', async ({ page }) => {
    await openPage(page, '/controls/kanban', 'Kanban board');
    const live = example(page, 'Task board');
    await drag(
      page,
      live.locator('.star-kanban__card[data-key="T-102"]'),
      live.locator('.star-kanban__card[data-key="T-104"]'),
    );
    await expect(live.getByRole('status')).toContainText('Price list import: todo → doing');
    await expect(
      live.getByRole('group', { name: /^In progress, 3 items/ }).locator('[data-key="T-102"]'),
    ).toBeVisible();
    await expect(live.locator('.star-kanban__column--over')).toHaveCount(1);
  });

  test('a cancelled move keeps the card in its column', async ({ page }) => {
    await openPage(page, '/controls/kanban', 'Kanban board');
    const live = example(page, 'Cancel a move');
    const card = live.locator('.star-kanban__card[data-key="T-107"]');
    await expect(async () => {
      await card.focus();
      await page.keyboard.press('Space');
      await expect(live.locator('[aria-live]')).toHaveText('Picked up Customer search in Done', {
        timeout: 1000,
      });
    }).toPass();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Space');
    await expect(live.getByRole('status')).toHaveText('Customer search is done and stays in Done.');
    await expect(live.locator('[aria-live]')).toHaveText(
      'Move cancelled. Customer search is back in Done',
    );
    await expect(
      live.getByRole('group', { name: /^Done, 2 items/ }).locator('[data-key="T-107"]'),
    ).toBeVisible();
  });
});
