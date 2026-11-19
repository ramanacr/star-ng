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

/** Waits until the prerendered team calendar is hydrated: an arrow key then moves the focus. */
async function waitForHydration(page: Page, area: Locator): Promise<void> {
  const grid = area.getByRole('grid');
  await expect(async () => {
    await grid.locator('[role="gridcell"][tabindex="0"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(grid.locator('[data-cell="0:1"]')).toBeFocused({ timeout: 1000 });
  }).toPass();
  await page.keyboard.press('ArrowLeft');
}

test.describe('scheduler', () => {
  test('moves and resizes an event with the keyboard and keeps the focus', async ({ page }) => {
    await openPage(page, '/controls/scheduler', 'Scheduler');
    const area = example(page, 'Team calendar');
    const meeting = area.getByRole('button', {
      name: /^Team meeting, 10:00 to 11:00, Tuesday 3 March/,
    });
    const moved = area.getByRole('button', {
      name: /^Team meeting, 10:30 to 11:30, Tuesday 3 March/,
    });
    // Retry until the prerendered page is hydrated and the keys are handled.
    await expect(async () => {
      await meeting.focus();
      await page.keyboard.press('Alt+ArrowDown');
      await expect(moved).toBeFocused({ timeout: 1000 });
    }).toPass();
    await expect(area.locator('.star-scheduler [aria-live="polite"]').last()).toHaveText(
      /Team meeting moved to Tuesday 3 March, 10:30 to 11:30, Room A/,
    );
    await page.keyboard.press('Alt+Shift+ArrowDown');
    await expect(
      area.getByRole('button', { name: /^Team meeting, 10:30 to 12:00, Tuesday 3 March/ }),
    ).toBeFocused();
  });

  test('moves between slots with the arrow keys and adds an event with Enter', async ({ page }) => {
    await openPage(page, '/controls/scheduler', 'Scheduler');
    const area = example(page, 'Team calendar');
    const grid = area.getByRole('grid');
    const first = grid.locator('[role="gridcell"][tabindex="0"]');
    // Retry until the prerendered page is hydrated and the keys are handled.
    await expect(async () => {
      await first.focus();
      await page.keyboard.press('ArrowDown');
      await expect(grid.locator('[data-cell="1:0"]')).toBeFocused({ timeout: 1000 });
    }).toPass();
    await page.keyboard.press('ArrowRight');
    await expect(grid.locator('[data-cell="1:1"]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(area.getByRole('status')).toContainText('Added "New booking"');
  });

  test('drags an event to another day', async ({ page }) => {
    await openPage(page, '/controls/scheduler', 'Scheduler');
    const area = example(page, 'Team calendar');
    const supplier = area.getByRole('button', {
      name: /^Supplier call, 11:00 to 11:30, Thursday 5 March/,
    });
    await supplier.scrollIntoViewIfNeeded();
    const box = (await supplier.boundingBox())!;
    // One day column to the end: Friday.
    await dragTo(page, supplier, box.x + box.width * 1.6 + 8, box.y + 10);
    await expect(
      area.getByRole('button', { name: /^Supplier call, 11:00 to 11:30, Friday 6 March/ }),
    ).toBeVisible();
  });

  test('drags a 2-slot event by one slot and shrinks it from the top edge', async ({ page }) => {
    await openPage(page, '/controls/scheduler', 'Scheduler');
    const area = example(page, 'Team calendar');
    await waitForHydration(page, area);
    const meeting = area.getByRole('button', { name: /^Team meeting, 10:00 to 11:00/ });
    await meeting.scrollIntoViewIfNeeded();
    const slot = (await area.locator('[data-cell="20:1"]').boundingBox())!.height;
    let box = (await meeting.boundingBox())!;
    // Grab the event in its lower half (its second slot) and move it down by one slot.
    const x = box.x + box.width / 2;
    let y = box.y + box.height * 0.75;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + slot, { steps: 8 });
    await page.mouse.up();
    const moved = area.getByRole('button', { name: /^Team meeting, 10:30 to 11:30/ });
    await expect(moved).toBeVisible();

    // Shrink from the top edge by one slot: 11:00 to 11:30.
    box = (await moved.boundingBox())!;
    y = box.y + 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + slot, { steps: 8 });
    await page.mouse.up();
    await expect(area.getByRole('button', { name: /^Team meeting, 11:00 to 11:30/ })).toBeVisible();
  });

  test('opens the list of a full month day', async ({ page }) => {
    await openPage(page, '/controls/scheduler', 'Scheduler');
    const list = page.getByRole('dialog', { name: /18 March/ });
    // Retry until the prerendered page is hydrated and the click opens the list.
    await expect(async () => {
      await example(page, 'Month view').getByRole('button', { name: '+4 more' }).click();
      await expect(list).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(list.getByRole('button')).toHaveCount(6);
    await page.keyboard.press('Escape');
    await expect(list).toBeHidden();
  });

  test('switches to the month view and pages with Page Down', async ({ page }) => {
    await openPage(page, '/controls/scheduler', 'Scheduler');
    const area = example(page, 'Team calendar');
    await area.getByRole('button', { name: 'Month', exact: true }).click();
    await expect(area.getByRole('heading', { level: 2 })).toHaveText('March 2026');
    await area.getByRole('grid').locator('[role="gridcell"][tabindex="0"]').focus();
    await page.keyboard.press('PageDown');
    await expect(area.getByRole('heading', { level: 2 })).toHaveText('April 2026');
  });

  test('keeps the slot height without a global border-box reset', async ({ page }) => {
    await openPage(page, '/controls/scheduler', 'Scheduler');
    await page.addStyleTag({ content: '*, ::before, ::after { box-sizing: content-box; }' });
    const area = example(page, 'Team calendar');
    const slot = area.locator('[data-cell="20:1"]');
    const height = await slot.evaluate((element) =>
      parseFloat(getComputedStyle(element).getPropertyValue('block-size')),
    );
    expect(await slot.evaluate((element) => element.offsetHeight)).toBe(Math.round(height));
  });
});
