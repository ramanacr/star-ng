import { expect, Locator, Page, test } from '@playwright/test';
import { example, openPage as openDocsPage } from './support';

/**
 * Opens the spreadsheet page and waits until the controls are hydrated. The page is prerendered,
 * so it is visible before the application runs, and a key before hydration is lost.
 */
async function openPage(page: Page): Promise<Locator> {
  await openDocsPage(page, '/controls/spreadsheet', 'Spreadsheet');
  await expect(page.locator('star-spreadsheet[ngh]')).toHaveCount(0, { timeout: 15_000 });
  return example(page, 'Budget').getByRole('grid', { name: 'Budget' });
}

function cell(grid: Locator, address: string): Locator {
  const col = address.charCodeAt(0) - 65;
  const row = Number(address.slice(1)) - 1;
  return grid.locator(`[data-row="${row}"][data-col="${col}"]`);
}

test.describe('spreadsheet', () => {
  test('edits a value and recalculates the totals', async ({ page }) => {
    const grid = await openPage(page);
    const live = example(page, 'Budget');
    await grid.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.cdk-live-announcer-element')).toContainText('B2, €3,200.00');
    await page.keyboard.type('4000');
    await expect(grid.locator('.star-spreadsheet__editor')).toHaveValue('4000');
    await page.keyboard.press('Enter');
    await expect(cell(grid, 'B2')).toHaveText('€4,000.00');
    await expect(cell(grid, 'B6')).toHaveText('€2,334.00');
    await expect(live.getByRole('status')).toHaveText('Active cell B3.');

    // The formula bar shows the formula of the active cell; the reader hears it as words.
    await page.keyboard.press('Control+ArrowDown');
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('.cdk-live-announcer-element')).toContainText('B199, blank');
    await page.keyboard.press('Control+Home');
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await expect(live.getByRole('textbox', { name: /Formula bar/ })).toHaveValue('=SUM(B2:B5)');
    await expect(page.locator('.cdk-live-announcer-element')).toContainText(
      'B6, €2,334.00, formula SUM of B2 to B5',
    );

    // Undo restores the old value.
    await page.keyboard.press('Control+z');
    await expect(cell(grid, 'B6')).toHaveText('€1,534.00');
  });

  test('pastes tab-separated text and fills with the handle', async ({ page }) => {
    const grid = await openPage(page);
    await grid.focus();
    await page.keyboard.press('Control+Home');
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowDown');
    // A paste from Excel or Google Sheets: tab-separated, CRLF lines.
    await grid.evaluate((element) => {
      const data = new DataTransfer();
      data.setData('text/plain', 'Bonus\t500\r\nTax\t=B11*-0.2\r\n');
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });
    await expect(cell(grid, 'A11')).toHaveText('Bonus');
    await expect(cell(grid, 'B12')).toHaveText('-100');

    // Drag the fill handle from B12 down to B14: the relative reference moves.
    await grid.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    const handle = grid.locator('[data-fill]');
    const from = (await handle.boundingBox())!;
    const to = (await cell(grid, 'B14').boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(cell(grid, 'B13')).toHaveText('20');
    await page.keyboard.press('ArrowDown');
    await expect(example(page, 'Budget').getByRole('textbox', { name: /Formula bar/ })).toHaveValue(
      '=B12*-0.2',
    );
  });

  test('switches sheets and reads across them', async ({ page }) => {
    await openPage(page);
    const live = example(page, 'Sheets and cross-sheet formulas');
    const grid = live.getByRole('grid', { name: 'Cost summary' });
    await expect(cell(grid, 'B1')).toHaveText('€1,666.00');
    await live.getByRole('tab', { name: 'Costs' }).click();
    await expect(live.getByRole('tab', { name: 'Costs' })).toHaveAttribute('aria-selected', 'true');
    await expect(cell(grid, 'A2')).toHaveText('Rent');
  });
});
