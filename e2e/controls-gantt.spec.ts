import { expect, Locator, Page, test } from '@playwright/test';
import { example, openPage } from './support';

/** Drags with the mouse from the centre of `from` by small steps to a point. */
async function dragTo(page: Page, from: Locator, x: number, y: number): Promise<void> {
  await from.scrollIntoViewIfNeeded();
  const box = (await from.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 10));
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.up();
}

test.describe('gantt', () => {
  test('collapses a summary task and moves a task with the keyboard', async ({ page }) => {
    await openPage(page, '/controls/gantt', 'Gantt chart');
    const grid = example(page, 'Product launch plan').getByRole('treegrid', {
      name: 'Launch plan',
    });
    const design = grid.getByRole('row', { name: /^Design, 12 March to 23 March, 40 percent/ });
    await design.click();
    await page.keyboard.press('Alt+ArrowRight');
    await expect(grid.getByRole('row', { name: /^Design, 19 March to 30 March/ })).toBeFocused();
    await page.keyboard.press('Alt+ArrowUp');
    await expect(
      grid.getByRole('row', { name: /^Design, 19 March to 30 March, 50 percent/ }),
    ).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowLeft');
    await expect(grid.getByRole('row', { name: /^Build, / })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(grid.getByRole('row', { name: /^Order service, / })).toHaveCount(0);
  });

  test('drags a bar by days', async ({ page }) => {
    await openPage(page, '/controls/gantt', 'Gantt chart');
    const area = example(page, 'Product launch plan');
    const bar = area.locator('g[data-task-id="design"] .star-gantt__bar-track');
    await bar.scrollIntoViewIfNeeded();
    const box = (await bar.boundingBox())!;
    // 16 pixels a day in the week scale: two days later.
    await dragTo(page, bar, box.x + box.width / 2 + 32, box.y + 10);
    await expect(area.getByRole('row', { name: /^Design, 14 March to 25 March/ })).toHaveCount(1);
  });

  test('renders few rows of 1,000 tasks and keeps the panes in one scroll', async ({ page }) => {
    await openPage(page, '/controls/gantt', 'Gantt chart');
    const area = example(page, '1,000 tasks');
    const grid = area.getByRole('treegrid', { name: 'Order batches' });
    await expect(grid).toHaveAttribute('aria-rowcount', '1001');
    expect(await grid.locator('[role="row"][data-task-id]').count()).toBeLessThan(40);
    const scroller = area.locator('.star-gantt__scroll');
    await scroller.evaluate((element) => (element.scrollTop = 36 * 600));
    await expect(grid.getByRole('row', { name: /^Order batch 571,/ })).toBeVisible();
    const bars = area.locator('g.star-gantt__bar');
    expect(await bars.count()).toBe(await grid.locator('[role="row"][data-task-id]').count());
  });
});
