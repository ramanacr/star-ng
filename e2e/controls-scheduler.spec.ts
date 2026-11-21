import { expect, Locator, Page, test } from '@playwright/test';
import { collectErrors, example, openPage } from './support';

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

    // Shrink from the top edge by one slot: 11:00 to 11:30. The longer Design review now takes the
    // first column, so the event is measured again.
    box = (await moved.boundingBox())!;
    const x2 = box.x + box.width / 2;
    y = box.y + 2;
    await page.mouse.move(x2, y);
    await page.mouse.down();
    await page.mouse.move(x2, y + slot, { steps: 8 });
    await page.mouse.up();
    await expect(area.getByRole('button', { name: /^Team meeting, 11:00 to 11:30/ })).toBeVisible();
  });

  test('selects an event on a held click, and opens the edit editor', async ({ page }) => {
    await openPage(page, '/controls/scheduler', 'Scheduler');
    // Team calendar: a held click selects the event; no event is added.
    const area = example(page, 'Team calendar');
    await waitForHydration(page, area);
    const meeting = area.getByRole('button', { name: /^Team meeting, 10:00 to 11:00/ });
    await meeting.scrollIntoViewIfNeeded();
    let box = (await meeting.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await expect(area.getByRole('status')).toHaveText('Selected Team meeting');

    // Timeline with the editor: a held click opens the edit editor, not the create editor.
    const rooms = example(page, 'Rooms on a timeline, with the editor');
    const booking = rooms.getByRole('button', { name: /^Team meeting, / });
    await booking.scrollIntoViewIfNeeded();
    box = (await booking.boundingBox())!;
    await page.mouse.move(box.x + Math.min(box.width / 2, 20), box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    const dialog = page.getByRole('dialog', { name: 'Edit event' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'New event' })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
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
    // The day headers keep their height, and the sticky all-day row sits right under them.
    const head = area.locator('.star-scheduler__grid--time .star-scheduler__head').nth(1);
    const headHeight = await head.evaluate((element) =>
      parseFloat(getComputedStyle(element).getPropertyValue('block-size')),
    );
    expect(await head.evaluate((element) => element.offsetHeight)).toBe(Math.round(headHeight));
    const allDayTop = await area
      .locator('.star-scheduler__cell--all-day')
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).insetBlockStart));
    expect(allDayTop).toBe(Math.round(headHeight));
    // An event of two slots is exactly two slots tall (minus its 2px gap).
    const meeting = area.getByRole('button', { name: /^Team meeting, 10:00 to 11:00/ });
    expect(await meeting.evaluate((element) => element.offsetHeight)).toBe(
      Math.round(height) * 2 - 2,
    );
  });

  test('the editor saves at once, also when the page changes during the close', async ({
    page,
  }) => {
    // NG0953 is a console warning: an output emitted after its component was destroyed.
    const errors = collectErrors(page);
    page.on('console', (message) => {
      if (message.text().includes('NG0953')) errors.push(message.text());
    });
    await openPage(page, '/controls/button', 'Button');
    await page.locator('#docs-nav').getByRole('link', { name: 'Scheduler', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Scheduler' })).toBeVisible();
    const rooms = example(page, 'Rooms on a timeline, with the editor');
    const editor = page.getByRole('dialog', { name: 'Edit event' });
    /** A held click on a booking opens the edit editor. */
    const edit = async (name: RegExp) => {
      const booking = rooms.getByRole('button', { name });
      await booking.scrollIntoViewIfNeeded();
      const box = (await booking.boundingBox())!;
      await page.mouse.move(box.x + Math.min(box.width / 2, 20), box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(150);
      await page.mouse.up();
      await expect(editor).toBeVisible();
    };

    // Save: the page applies editorSave, the editor closes.
    await edit(/^Team meeting, /);
    await editor.getByRole('textbox', { name: 'Title' }).fill('Team sync');
    await editor.getByRole('button', { name: 'Save' }).click();
    await expect(editor).toBeHidden();
    await expect(rooms.getByRole('button', { name: /^Team sync, / })).toBeVisible();

    // Save and a route change in the same task: the scheduler is destroyed while the editor
    // closes. The save was emitted when Save was pressed; nothing emits after the destroy.
    await edit(/^Team sync, /);
    await editor.getByRole('textbox', { name: 'Title' }).fill('Team sync 2');
    await editor.evaluate((dialog) => {
      const save = [...dialog.querySelectorAll('button')].find(
        (button) => button.textContent?.trim() === 'Save',
      )!;
      save.click();
      history.back();
    });
    await expect(page.getByRole('heading', { level: 1, name: 'Button' })).toBeVisible();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(editor).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
