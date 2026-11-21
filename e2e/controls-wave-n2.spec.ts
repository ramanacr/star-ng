import { expect, Page, test } from '@playwright/test';
import { example, openPage } from './support';

/** The prerendered page is hydrated: no element keeps the `ngh` marker. */
async function hydrated(page: Page): Promise<void> {
  await expect(page.locator('[ngh]')).toHaveCount(0, { timeout: 15_000 });
}

test.describe('wave N2 depth', () => {
  test('tab nav: router links as tabs, arrow keys and the panel name', async ({ page }) => {
    await openPage(page, '/controls/tabs', 'Tabs');
    await hydrated(page);
    const live = example(page, 'Router link tabs');
    const list = live.getByRole('tablist', { name: 'Order views' });
    const summary = list.getByRole('tab', { name: 'Summary' });
    const lines = list.getByRole('tab', { name: 'Lines' });
    await expect(summary).toHaveAttribute('aria-selected', 'true');
    await expect(summary).toHaveAttribute('tabindex', '0');
    await expect(lines).toHaveAttribute('tabindex', '-1');

    await summary.focus();
    await page.keyboard.press('ArrowRight');
    await expect(lines).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(lines).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/view=lines/);
    const panel = live.getByRole('tabpanel', { name: 'Lines' });
    await expect(panel).toHaveText(/Lines: 3 items/);
  });

  test('menu: groups under a heading, start and end outside the menu role', async ({ page }) => {
    await openPage(page, '/controls/menu', 'Menu');
    await hydrated(page);
    const live = example(page, 'Groups, start and end');
    const menu = live.getByRole('menu', { name: 'Workspace menu' });
    await expect(menu.getByRole('group', { name: 'Orders actions' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Import orders' })).toBeVisible();
    await expect(live.getByText('Workspace: Orders')).toBeVisible();
    await expect(menu.getByText('Workspace: Orders')).toHaveCount(0);
    // The menu gives the focus to its first item; the arrow keys go on into the groups.
    await menu.focus();
    await expect(menu.getByRole('menuitem', { name: 'Search' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: 'New order' })).toBeFocused();
  });

  test('chips area: arrow keys, Control+Shift moves, Delete removes', async ({ page }) => {
    await openPage(page, '/controls/chip', 'Chip');
    await hydrated(page);
    const live = example(page, 'Chips area');
    const list = live.getByRole('list', { name: 'Sort order' });
    const status = live.getByRole('status');
    const chip = (name: string) => list.getByRole('button', { name, exact: true });
    await chip('Customer').focus();
    await page.keyboard.press('ArrowRight');
    await expect(chip('Order date')).toBeFocused();
    await page.keyboard.press('Control+Shift+ArrowRight');
    await expect(status).toHaveText('Sort by: Customer, Total, Order date');
    await expect(chip('Order date')).toBeFocused();
    await page.keyboard.press('Delete');
    await expect(status).toHaveText('Sort by: Customer, Total');
    await expect(chip('Total')).toBeFocused();
  });

  test('fluid: the controls of a fluid form fill the line, an opt-out keeps its width', async ({
    page,
  }) => {
    await openPage(page, '/guides/configuration', 'Configuration');
    await hydrated(page);
    const form = example(page, 'Fluid form').locator('form');
    const formWidth = (await form.boundingBox())!.width;
    const width = async (selector: string, index = 0) =>
      (await form.locator(selector).nth(index).boundingBox())!.width;
    for (const selector of ['star-input-number', 'star-select-button', 'star-button']) {
      expect(Math.abs((await width(selector)) - formWidth), selector).toBeLessThan(2);
    }
    expect(Math.abs((await width('star-cascade-select')) - formWidth)).toBeLessThan(2);
    // The second button is under starFluid="false".
    expect(await width('star-button', 1)).toBeLessThan(formWidth / 2);
    // The opt-out also stops the fluid of the cascade select (from fluid or provideStarNg).
    const display = (index: number) =>
      form
        .locator('star-cascade-select')
        .nth(index)
        .evaluate((el) => getComputedStyle(el).display);
    expect(await display(0)).toBe('flex');
    expect(await display(1)).toBe('block');
  });

  test('icon: decorative and named icons', async ({ page }) => {
    await openPage(page, '/controls/icon', 'Icon');
    await hydrated(page);
    const live = example(page, 'Icon with a name');
    await expect(live.getByRole('img', { name: 'Warning' })).toBeVisible();
    await expect(example(page, 'Decorative icons').getByRole('img')).toHaveCount(0);
  });
});
