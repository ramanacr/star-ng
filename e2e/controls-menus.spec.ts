import { expect, test } from '@playwright/test';
import { example, openPage } from './support';

// Popups of the menus live in the CDK overlay container, outside the example area.
const popup = (page: import('@playwright/test').Page) => page.locator('.cdk-overlay-container');

test.describe('menu', () => {
  test('opens with Enter, moves with arrows, runs an item and returns the focus', async ({
    page,
  }) => {
    await openPage(page, '/controls/menu', 'Menu');
    const live = example(page, 'Popup menu');
    const trigger = live.getByRole('button', { name: 'File' });
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const items = popup(page).getByRole('menuitem');
    await expect(items).toHaveText(['New file', 'Open folder', 'Save', 'Exit']);
    await expect(items.first()).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(popup(page).getByRole('menuitem', { name: 'Open folder' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(popup(page).getByRole('menu')).toHaveCount(0);
    await expect(live.getByRole('status')).toHaveText('Last action: Open folder');
    await expect(trigger).toBeFocused();
  });

  test('opens with Arrow down, wraps around, and closes with Escape', async ({ page }) => {
    await openPage(page, '/controls/menu', 'Menu');
    const live = example(page, 'Popup menu');
    const trigger = live.getByRole('button', { name: 'File' });

    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(popup(page).getByRole('menuitem', { name: 'New file' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(popup(page).getByRole('menuitem', { name: 'Exit' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(popup(page).getByRole('menuitem', { name: 'New file' })).toBeFocused();
    await page.keyboard.press('End');
    await expect(popup(page).getByRole('menuitem', { name: 'Exit' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(popup(page).getByRole('menu')).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
    await expect(live.getByRole('status')).toHaveText('Last action: none');
  });

  test('opens with the mouse and runs an item with a click', async ({ page }) => {
    await openPage(page, '/controls/menu', 'Menu');
    const live = example(page, 'Popup menu');
    await live.getByRole('button', { name: 'File' }).click();
    await popup(page).getByRole('menuitem', { name: 'Save' }).click();
    await expect(live.getByRole('status')).toHaveText('Last action: Save');
  });

  test('shows icons and shortcuts, and keeps a disabled item out of reach', async ({ page }) => {
    await openPage(page, '/controls/menu', 'Menu');
    await example(page, 'Icons and shortcuts').getByRole('button', { name: 'Edit' }).click();
    await expect(popup(page).locator('.star-menu__shortcut')).toHaveText([
      'Ctrl+X',
      'Ctrl+C',
      'Ctrl+V',
    ]);
    await page.keyboard.press('Escape');

    const live = example(page, 'Separators, disabled and danger items');
    await live.getByRole('button', { name: 'Order actions' }).click();
    await expect(popup(page).getByRole('separator')).toHaveCount(1);
    await expect(popup(page).getByRole('menuitem', { name: 'Export' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(popup(page).getByRole('menuitem', { name: 'Delete' })).toHaveClass(
      /star-menu__item--danger/,
    );
  });

  test('opens a nested submenu with Arrow right and closes it with Arrow left', async ({
    page,
  }) => {
    await openPage(page, '/controls/menu', 'Menu');
    const trigger = example(page, 'Nested submenu').getByRole('button', { name: 'View' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    const layout = popup(page).getByRole('menuitem', { name: 'Layout' });
    await expect(layout).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(popup(page).getByRole('menuitem', { name: 'Single column' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(popup(page).getByRole('menuitem', { name: 'Two columns' })).toBeFocused();

    await page.keyboard.press('ArrowLeft');
    await expect(popup(page).getByRole('menuitem', { name: 'Two columns' })).toHaveCount(0);
    await expect(layout).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(popup(page).getByRole('menu')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('an icon-only trigger has an accessible name, and an inline menu is in place', async ({
    page,
  }) => {
    await openPage(page, '/controls/menu', 'Menu');
    const trigger = example(page, 'Icon button trigger').getByRole('button', {
      name: 'Row actions',
    });
    await trigger.focus();
    await page.keyboard.press('Space');
    await expect(popup(page).getByRole('menuitem', { name: 'Save' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();

    const inline = example(page, 'Inline menu').getByRole('menu', { name: 'Inline menu' });
    await expect(inline.getByRole('menuitem')).toHaveCount(3);
  });
});

test.describe('split button', () => {
  test('the main part runs the default action', async ({ page }) => {
    await openPage(page, '/controls/split-button', 'Split button');
    const live = example(page, 'Main action and menu');
    await live.getByRole('button', { name: 'Place order' }).click();
    await expect(live.getByRole('status')).toHaveText('Last action: Place order');
  });

  test('the caret opens the menu with the keyboard and focus returns to it', async ({ page }) => {
    await openPage(page, '/controls/split-button', 'Split button');
    const live = example(page, 'Main action and menu');
    const caret = live.getByRole('button', { name: 'More actions' });

    await caret.focus();
    await page.keyboard.press('Enter');
    await expect(popup(page).getByRole('menuitem')).toHaveText([
      'Place and close order',
      'Schedule for later',
      'Save as draft',
    ]);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Last action: Schedule for later');
    await expect(caret).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(popup(page).getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popup(page).getByRole('menu')).toHaveCount(0);
    await expect(caret).toBeFocused();
  });

  test('a disabled split button disables both parts', async ({ page }) => {
    await openPage(page, '/controls/split-button', 'Split button');
    const live = example(page, 'Disabled');
    await expect(live.getByRole('button', { name: 'Place order' })).toBeDisabled();
    await expect(live.getByRole('button', { name: 'More actions' })).toBeDisabled();
  });
});

test.describe('menubar', () => {
  test('moves between items with arrows, opens a dropdown and closes it with Escape', async ({
    page,
  }) => {
    await openPage(page, '/controls/menubar', 'Menubar');
    const live = example(page, 'File, edit and view');
    const bar = live.getByRole('menubar', { name: 'Main' });
    const file = bar.getByRole('menuitem', { name: 'File' });
    const edit = bar.getByRole('menuitem', { name: 'Edit' });

    // A click and Escape put the focus on the item the way a user does. A bare focus() call
    // leaves the CDK arrow key navigation on its first item, so the first arrow key is lost.
    await file.click();
    await page.keyboard.press('Escape');
    await expect(file).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(edit).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(popup(page).getByRole('menuitem')).toHaveText(['Undo', 'Redo', 'Find']);
    await expect(popup(page).getByRole('menuitem', { name: 'Undo' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Last action: Redo');

    await edit.focus();
    await page.keyboard.press('ArrowDown');
    await expect(popup(page).getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popup(page).getByRole('menu')).toHaveCount(0);
    await expect(edit).toBeFocused();
  });

  test('opens a nested submenu and runs a leaf with a click', async ({ page }) => {
    await openPage(page, '/controls/menubar', 'Menubar');
    const live = example(page, 'File, edit and view');
    await live.getByRole('menuitem', { name: 'File' }).click();
    await popup(page).getByRole('menuitem', { name: 'Export' }).hover();
    await popup(page).getByRole('menuitem', { name: 'As CSV' }).click();
    await expect(live.getByRole('status')).toHaveText('Last action: As CSV');
  });

  test('a top-level item without items is an action, and the end slot is shown', async ({
    page,
  }) => {
    await openPage(page, '/controls/menubar', 'Menubar');
    const live = example(page, 'File, edit and view');
    await live.getByRole('menuitem', { name: 'Help' }).click();
    await expect(live.getByRole('status')).toHaveText('Last action: Help');

    const withEnd = example(page, 'Content at the end');
    await expect(withEnd.getByRole('menubar', { name: 'Main with action' })).toBeVisible();
    await expect(withEnd.getByRole('button', { name: 'New' })).toBeVisible();
  });
});

test.describe('context menu', () => {
  test('opens on right-click, moves with arrows and runs an item', async ({ page }) => {
    await openPage(page, '/controls/context-menu', 'Context menu');
    const live = example(page, 'Right-click area');
    await live.getByLabel('Order row').click({ button: 'right' });
    await expect(popup(page).getByRole('menuitem')).toHaveText(['Open', 'Copy link', 'Delete']);

    // The pointer opens the menu on its first item.
    await expect(popup(page).getByRole('menuitem', { name: 'Open' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(popup(page).getByRole('menuitem', { name: 'Copy link' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Last action: Copy link');
    await expect(popup(page).getByRole('menu')).toHaveCount(0);
  });

  test('closes with Escape', async ({ page }) => {
    await openPage(page, '/controls/context-menu', 'Context menu');
    const live = example(page, 'Right-click area');
    await live.getByLabel('Order row').click({ button: 'right' });
    await expect(popup(page).getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popup(page).getByRole('menu')).toHaveCount(0);
    await expect(live.getByRole('status')).toHaveText('Last action: none');
  });
});

test.describe('mega menu', () => {
  test('opens a panel with a labelled group per column and closes with Escape', async ({
    page,
  }) => {
    await openPage(page, '/controls/mega-menu', 'Mega menu');
    const bar = example(page, 'Panel with columns').getByRole('menubar', { name: 'Catalogue' });
    await bar.getByRole('menuitem', { name: 'Products' }).click();
    const panel = page.locator('.star-mega-menu__panel');
    await expect(panel.getByRole('group', { name: 'Hardware' })).toBeVisible();
    await expect(panel.getByRole('group')).toHaveCount(3);
    await expect(panel.getByRole('menuitem', { name: 'Editor Plus' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
  });

  test('moves with arrows on the bar and in the panel, and runs an item', async ({ page }) => {
    await openPage(page, '/controls/mega-menu', 'Mega menu');
    const live = example(page, 'Panel with columns');
    const bar = live.getByRole('menubar', { name: 'Catalogue' });
    const products = bar.getByRole('menuitem', { name: 'Products' });

    await products.click();
    await page.keyboard.press('Escape');
    await expect(products).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(bar.getByRole('menuitem', { name: 'Orders' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(products).toBeFocused();

    await page.keyboard.press('ArrowDown');
    const panel = page.locator('.star-mega-menu__panel');
    await expect(panel.getByRole('menuitem', { name: 'Laptops' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(panel.getByRole('menuitem', { name: 'Monitors' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Last action: Monitors');
  });
});

test.describe('panel menu', () => {
  test('opens and closes sections with the keyboard', async ({ page }) => {
    await openPage(page, '/controls/panel-menu', 'Panel menu');
    const live = example(page, 'Sections that open in place');
    const menu = live.getByRole('navigation', { name: 'Settings' });
    const account = menu.getByRole('button', { name: 'Account' });

    await expect(account).toHaveAttribute('aria-expanded', 'false');
    await expect(menu.getByRole('button', { name: 'Profile' })).toHaveCount(0);
    await account.focus();
    await page.keyboard.press('Enter');
    await expect(account).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.getByRole('button', { name: 'Profile' })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Password' })).toBeDisabled();
    await expect(live.getByRole('status')).toContainText('Open: 0.');

    await page.keyboard.press('Tab');
    await expect(menu.getByRole('button', { name: 'Profile' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toContainText('Last action: Profile');

    await account.focus();
    await page.keyboard.press('Space');
    await expect(account).toHaveAttribute('aria-expanded', 'false');
    await expect(menu.getByRole('button', { name: 'Profile' })).toHaveCount(0);
  });

  test('opens nested sections and closes the inner ones with the parent', async ({ page }) => {
    await openPage(page, '/controls/panel-menu', 'Panel menu');
    const live = example(page, 'Sections that open in place');
    const menu = live.getByRole('navigation', { name: 'Settings' });
    await menu.getByRole('button', { name: 'Projects' }).click();
    await menu.getByRole('button', { name: 'Templates' }).click();
    await expect(menu.getByRole('button', { name: 'Invoice' })).toBeVisible();
    await expect(live.getByRole('status')).toContainText('Open: 1, 1.0.');

    await menu.getByRole('button', { name: 'Projects' }).click();
    await expect(live.getByRole('status')).toContainText('Open: none.');
  });

  test('single mode keeps one sibling section open', async ({ page }) => {
    await openPage(page, '/controls/panel-menu', 'Panel menu');
    const menu = example(page, 'One section at a time').getByRole('navigation', {
      name: 'Settings, single',
    });
    const account = menu.getByRole('button', { name: 'Account' });
    const projects = menu.getByRole('button', { name: 'Projects' });

    await account.click();
    await expect(menu.getByRole('button', { name: 'Profile' })).toBeVisible();
    await projects.click();
    await expect(projects).toHaveAttribute('aria-expanded', 'true');
    await expect(account).toHaveAttribute('aria-expanded', 'false');
    await menu.getByRole('button', { name: 'Templates' }).click();
    await expect(menu.getByRole('button', { name: 'Invoice' })).toBeVisible();
  });
});
