import { expect, Locator, Page, test } from '@playwright/test';
import { example, openPage } from './support';

/** Number of grid columns in force of a tile layout. */
function columnCount(layout: Locator): Promise<number> {
  return layout
    .locator('.star-tile-layout__grid')
    .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length);
}

/** Drags with the mouse in small steps, as the CDK needs. */
async function drag(page: Page, from: Locator, to: Locator): Promise<void> {
  await from.scrollIntoViewIfNeeded();
  const start = (await from.boundingBox())!;
  const x = start.x + start.width / 2;
  const y = start.y + start.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  // Past the start threshold first, then over the target.
  for (let step = 1; step <= 10; step++) await page.mouse.move(x - step * 4, y - step * 3);
  const end = (await to.boundingBox())!;
  await page.mouse.move(end.x + 12, end.y + end.height / 2, { steps: 15 });
  await page.mouse.up();
}

test.describe('tile layout', () => {
  test('moves and resizes a tile with the keyboard and announces it', async ({ page }) => {
    await openPage(page, '/controls/tile-layout', 'Tile layout');
    const live = example(page, 'Reorder and resize');
    const status = live.getByRole('status');
    const orders = live.getByRole('group', { name: 'Orders' });

    await orders.focus();
    await page.keyboard.press('Control+ArrowRight');
    await expect(status).toContainText('Order: revenue, orders, visits, tickets.');
    await expect(orders).toBeFocused();
    await expect(live.locator('[aria-live]')).toHaveText('Orders, position 2 of 4');

    await page.keyboard.press('Control+Shift+ArrowDown');
    await expect(status).toContainText('orders: 2 × 2.');
    await expect(live.locator('[aria-live]')).toHaveText('Orders: 2 columns, 2 rows');
    const box = (await orders.boundingBox())!;
    const revenue = (await live.getByRole('group', { name: 'Revenue' }).boundingBox())!;
    expect(box.height).toBeGreaterThan(revenue.height * 1.5);
  });

  test('reorders with drag and drop', async ({ page }) => {
    await openPage(page, '/controls/tile-layout', 'Tile layout');
    const live = example(page, 'Reorder and resize');
    await drag(
      page,
      live.getByRole('group', { name: 'Visits' }),
      live.getByRole('group', { name: 'Orders' }),
    );
    await expect(live.getByRole('status')).toContainText(
      'Order: visits, orders, revenue, tickets.',
    );
  });

  test('takes the breakpoint columns from the width of the layout', async ({ page }) => {
    await openPage(page, '/controls/tile-layout', 'Tile layout');
    const layout = example(page, 'Responsive columns').locator('star-tile-layout');
    const width = await layout.evaluate((element) => element.getBoundingClientRect().width / 16);
    expect(await columnCount(layout)).toBe(width < 36 ? 1 : width < 48 ? 2 : 4);
    await page.setViewportSize({ width: 420, height: 800 });
    await expect.poll(() => columnCount(layout)).toBe(1);
  });
});

test.describe('command palette', () => {
  test('opens with Control+K, filters, and runs the active command with Enter', async ({
    page,
  }) => {
    await openPage(page, '/controls/command-palette', 'Command palette');
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('Control+k');
    const field = page.getByRole('combobox', { name: 'Command palette' });
    await expect(field).toBeFocused();
    await field.fill('csv');
    const active = page.locator(`[id="${await field.getAttribute('aria-activedescendant')}"]`);
    await expect(active).toHaveText(/Export orders/);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeHidden();
    await expect(example(page, 'Commands in groups').getByRole('status')).toHaveText(
      'Last command: Export orders',
    );

    // The command is listed under Recent at the next opening.
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('group', { name: 'Recent' }).getByRole('option')).toHaveText([
      /Export orders/,
    ]);
    await page.keyboard.press('Control+k');
    await expect(field).toBeHidden();
  });

  test('moves with the arrow keys, skips a disabled command, and gives the focus back on Escape', async ({
    page,
  }) => {
    await openPage(page, '/controls/command-palette', 'Command palette');
    const opener = example(page, 'Commands in groups').getByRole('button', {
      name: 'Open command palette',
    });
    await opener.click();
    const field = page.getByRole('combobox', { name: 'Command palette' });
    await expect(field).toBeFocused();
    await field.fill('orders');
    const activeText = async () =>
      page.locator(`[id="${await field.getAttribute('aria-activedescendant')}"]`).innerText();
    expect(await activeText()).toContain('Export orders');
    await page.keyboard.press('ArrowDown');
    // Archive orders is disabled: the active option wraps to the first one.
    expect(await activeText()).toContain('Export orders');
    await expect(page.getByRole('option', { name: 'Archive orders' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await page.keyboard.press('Escape');
    await expect(field).toBeHidden();
    await expect(opener).toBeFocused();
  });
});

test.describe('app sidebar', () => {
  test('moves with the arrow keys and opens a group with Arrow right', async ({ page }) => {
    await openPage(page, '/controls/app-sidebar', 'App sidebar');
    const nav = page.getByRole('navigation', { name: 'Workspace' });
    // The current page keeps the tab stop.
    await expect(nav.getByRole('link', { name: 'This page' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.getByRole('link', { name: 'This page' })).toHaveAttribute('tabindex', '0');

    await nav.getByRole('button', { name: 'Dashboard' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(nav.getByRole('button', { name: /^Orders/ })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    const reports = nav.getByRole('button', { name: 'Reports' });
    await expect(reports).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(reports).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(nav.getByRole('button', { name: 'Monthly' })).toBeFocused();
    await page.keyboard.press('Enter');
    // A button item is the current one with aria-current="true" ("page" is for links).
    await expect(nav.getByRole('button', { name: 'Monthly' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await page.keyboard.press('ArrowLeft');
    await expect(reports).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(reports).toHaveAttribute('aria-expanded', 'false');
  });

  test('collapses to icons with the labels as tooltips', async ({ page }) => {
    await openPage(page, '/controls/app-sidebar', 'App sidebar');
    const sidebar = example(page, 'Sections, badges and nested items').locator('star-app-sidebar');
    const wide = (await sidebar.boundingBox())!.width;
    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(sidebar).toHaveClass(/star-app-sidebar--collapsed/);
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeLessThan(wide / 2);
    await sidebar.getByRole('button', { name: 'Dashboard' }).hover();
    await expect(page.getByRole('tooltip')).toHaveText('Dashboard');
  });

  test('opens in a drawer in overlay mode and closes after a choice', async ({ page }) => {
    await openPage(page, '/controls/app-sidebar', 'App sidebar');
    const live = example(page, 'Overlay mode');
    await live.getByRole('button', { name: 'Menu' }).click();
    const drawer = page.getByRole('dialog', { name: 'Shop' });
    await expect(drawer).toBeVisible();
    await drawer.getByRole('button', { name: 'Customers' }).click();
    await expect(drawer).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Page: Customers');
  });
});

test.describe('window', () => {
  test('moves with Alt and the arrow keys and with the pointer, and stays open on Escape', async ({
    page,
  }) => {
    await openPage(page, '/controls/window', 'Window');
    const live = example(page, 'Windows in the page');
    await live.getByRole('button', { name: 'Open notes' }).click();
    const notes = page.getByRole('dialog', { name: 'Notes' });
    await expect(notes).toBeVisible();
    const titlebar = notes.locator('.star-window__titlebar');
    await titlebar.focus();
    const before = (await notes.boundingBox())!;
    await page.keyboard.press('Alt+ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    // The models are whole pixels: allow two pixels of rounding.
    const near = async (
      read: (box: { x: number; y: number; height: number }) => number,
      to: number,
    ) =>
      expect
        .poll(async () => Math.abs(read((await notes.boundingBox())!) - to))
        .toBeLessThanOrEqual(2);
    await near((box) => box.x, before.x + 16);
    await near((box) => box.height, before.height + 16);

    const start = (await titlebar.boundingBox())!;
    await page.mouse.move(start.x + 40, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + 80, start.y + start.height / 2 + 30, { steps: 5 });
    await page.mouse.up();
    await near((box) => box.y, before.y + 30);

    // A non-modal window: the page stays usable and Escape does not close it.
    await page.keyboard.press('Escape');
    await expect(notes).toBeVisible();
    await expect(live.getByRole('status')).toContainText('Notes: normal');
  });

  test('shows a select panel opened in a window above the window', async ({ page }) => {
    await openPage(page, '/controls/window', 'Window');
    await example(page, 'Windows in the page').getByRole('button', { name: 'Open notes' }).click();
    const notes = page.getByRole('dialog', { name: 'Notes' });
    await notes.getByRole('combobox', { name: 'Priority' }).click();
    const option = page.getByRole('option', { name: 'High' });
    await expect(option).toBeVisible();
    // The window must not cover the panel: the option is the element at its own center.
    const box = (await option.boundingBox())!;
    const onTop = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest('[role=option]')?.textContent?.trim(),
      [box.x + box.width / 2, box.y + box.height / 2],
    );
    expect(onTop).toBe('High');
    await option.click();
    await expect(notes.getByRole('combobox', { name: 'Priority' })).toContainText('High');
    // The window stays below the CDK overlay container.
    expect(
      await notes.evaluate((element) => Number(getComputedStyle(element).zIndex)),
    ).toBeLessThan(1000);
  });

  test('stays below a select panel with a low overlay zIndexBase', async ({ page }) => {
    await openPage(page, '/controls/window', 'Window');
    // What provideStarNg({ overlay: { zIndexBase: 500 } }) writes on <html>.
    await page.evaluate(() =>
      document.documentElement.style.setProperty('--star-z-index-base', '500'),
    );
    await example(page, 'Windows in the page').getByRole('button', { name: 'Open notes' }).click();
    const notes = page.getByRole('dialog', { name: 'Notes' });
    expect(
      await notes.evaluate((element) => Number(getComputedStyle(element).zIndex)),
    ).toBeLessThan(500);
    await notes.getByRole('combobox', { name: 'Priority' }).click();
    const option = page.getByRole('option', { name: 'High' });
    await expect(option).toBeVisible();
    const box = (await option.boundingBox())!;
    const onTop = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest('[role=option]')?.textContent?.trim(),
      [box.x + box.width / 2, box.y + box.height / 2],
    );
    expect(onTop).toBe('High');
  });

  test('stays above the app bar layer with a very low overlay zIndexBase', async ({ page }) => {
    await openPage(page, '/controls/window', 'Window');
    await page.evaluate(() =>
      document.documentElement.style.setProperty('--star-z-index-base', '50'),
    );
    await example(page, 'Windows in the page').getByRole('button', { name: 'Open notes' }).click();
    const notes = page.getByRole('dialog', { name: 'Notes' });
    await expect(notes).toBeVisible();
    // base 50 gives min(49, -50 + order); the floor keeps the window above the app bar (20).
    expect(await notes.evaluate((element) => Number(getComputedStyle(element).zIndex))).toBe(21);
  });

  test('stacks windows, maximizes and closes', async ({ page }) => {
    await openPage(page, '/controls/window', 'Window');
    const live = example(page, 'Windows in the page');
    await live.getByRole('button', { name: 'Open notes' }).click();
    await live.getByRole('button', { name: 'Open order summary' }).click();
    const notes = page.getByRole('dialog', { name: 'Notes' });
    const summary = page.getByRole('dialog', { name: 'Order summary' });
    const z = (dialog: Locator) =>
      dialog.evaluate((element) => Number(getComputedStyle(element).zIndex));
    expect(await z(summary)).toBeGreaterThan(await z(notes));
    await notes.locator('.star-window__titlebar').click({ position: { x: 12, y: 8 } });
    expect(await z(notes)).toBeGreaterThan(await z(summary));

    await notes.getByRole('button', { name: 'Maximize' }).click();
    const viewport = page.viewportSize()!;
    await expect
      .poll(async () => (await notes.boundingBox())!.width)
      .toBeCloseTo(viewport.width, -1);
    await expect(live.getByRole('status')).toContainText('Notes: maximized');
    await notes.getByRole('button', { name: 'Restore' }).click();
    await expect(live.getByRole('status')).toContainText('Notes: normal');

    // Escape closes the summary (closeOnEscape).
    await summary.locator('.star-window__titlebar').focus();
    await page.keyboard.press('Escape');
    await expect(summary).toBeHidden();
    await notes.getByRole('button', { name: 'Close' }).click();
    await expect(notes).toBeHidden();
  });

  test('opens a window from code and returns its result', async ({ page }) => {
    await openPage(page, '/controls/window', 'Window');
    const live = example(page, 'Open from code');
    await live.getByRole('button', { name: 'Open order window' }).click();
    const order = page.getByRole('dialog', { name: 'Order 1001' });
    await expect(order).toContainText('Order 1001 ships from Porto.');
    await order.getByRole('button', { name: 'Mark as checked' }).click();
    await expect(order).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Result: Marked as checked');
  });
});
