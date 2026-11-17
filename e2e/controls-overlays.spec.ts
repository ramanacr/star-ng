import { expect, Locator, Page, test } from '@playwright/test';
import { collectErrors, example, openPage } from './support';

/**
 * Presses Tab `times` times. A modal dialog traps the focus: it may pass through the browser
 * interface (then the active element is the body), but it never lands on the page behind. At
 * least one press per element of the area must end on an element inside the area.
 */
async function tabStaysInside(page: Page, area: Locator, times: number): Promise<void> {
  let inside = 0;
  for (let index = 0; index < times; index++) {
    await page.keyboard.press('Tab');
    const state = await area.evaluate((el) => {
      const active = document.activeElement;
      return { inside: el.contains(active), body: active === document.body || active === null };
    });
    expect(state.inside || state.body, `Tab press ${index + 1}`).toBe(true);
    if (state.inside) inside++;
  }
  expect(inside).toBeGreaterThanOrEqual(Math.floor(times / 2));
}

/** A click on the backdrop of a modal dialog: the top left corner is outside every dialog here. */
const clickBackdrop = (page: Page) => page.mouse.click(4, 4);

test.describe('dialog', () => {
  test('opens, puts the focus inside, traps Tab, closes with Escape and returns the focus', async ({
    page,
  }) => {
    await openPage(page, '/controls/dialog', 'Dialog');
    const trigger = example(page, 'Header and footer').getByRole('button', { name: 'Edit order' });
    const dialog = page.getByRole('dialog', { name: 'Edit order ORD-1042' });
    await expect(dialog).toBeHidden();

    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    // The browser starts on the first focusable element: the close button of the header.
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    expect(await dialog.evaluate((el) => el.matches(':modal'))).toBe(true);

    // The dialog has five focusable elements. Eight presses go once around and further.
    await tabStaysInside(page, dialog, 8);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('closes with the close button and with the footer buttons', async ({ page }) => {
    await openPage(page, '/controls/dialog', 'Dialog');
    const live = example(page, 'Header and footer');
    const dialog = page.getByRole('dialog', { name: 'Edit order ORD-1042' });

    await live.getByRole('button', { name: 'Edit order' }).click();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toBeHidden();

    await live.getByRole('button', { name: 'Edit order' }).click();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    await live.getByRole('button', { name: 'Edit order' }).click();
    await expect(dialog.getByText('Last saved at 10:42')).toBeVisible();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    await expect(live.getByRole('button', { name: 'Edit order' })).toBeFocused();
  });

  test('a click on the backdrop does not close a dialog without dismissableMask', async ({
    page,
  }) => {
    await openPage(page, '/controls/dialog', 'Dialog');
    await example(page, 'Header and footer').getByRole('button', { name: 'Edit order' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit order ORD-1042' });
    await expect(dialog).toBeVisible();

    await clickBackdrop(page);
    // Give a wrong close time to show itself.
    await page.waitForTimeout(400);
    await expect(dialog).toBeVisible();
  });

  test('has the sizes sm, md, lg, xl and full', async ({ page }) => {
    await openPage(page, '/controls/dialog', 'Dialog');
    const live = example(page, 'Sizes');
    const viewport = page.viewportSize()!;
    const expected: Record<string, number> = {
      sm: 416,
      md: 512,
      lg: 768,
      xl: 1024,
      // The width is 100vw minus 2rem, and the browser style limits it to 100% minus 6px and 2em.
      full: viewport.width - 34,
    };
    for (const [size, width] of Object.entries(expected)) {
      await live.getByRole('button', { name: `Open ${size}`, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: `Size ${size}` });
      await expect(dialog).toBeVisible();
      await expect
        .poll(async () => Math.round((await dialog.boundingBox())!.width), { message: size })
        .toBeCloseTo(width, -1);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    }
  });

  test('a click on the backdrop closes a dialog with dismissableMask', async ({ page }) => {
    await openPage(page, '/controls/dialog', 'Dialog');
    const live = example(page, 'Close rules');
    const trigger = live.getByRole('button', { name: 'Backdrop click' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Closes on a backdrop click' });
    await expect(dialog).toBeVisible();

    // A click inside the dialog does not close it.
    await dialog.getByText('Click outside this window to close it.').click();
    await expect(dialog).toBeVisible();

    await clickBackdrop(page);
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('a locked dialog has no close button and ignores Escape and the backdrop', async ({
    page,
  }) => {
    await openPage(page, '/controls/dialog', 'Dialog');
    const live = example(page, 'Close rules');
    await live.getByRole('button', { name: 'Locked' }).click();
    const dialog = page.getByRole('dialog', { name: 'Locked dialog' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);

    await page.keyboard.press('Escape');
    await clickBackdrop(page);
    await page.waitForTimeout(400);
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(dialog).toBeHidden();
  });

  test('a non-modal dialog does not block the page', async ({ page }) => {
    await openPage(page, '/controls/dialog', 'Dialog');
    const live = example(page, 'Close rules');
    await live.getByRole('button', { name: 'Non-modal' }).click();
    const dialog = page.getByRole('dialog', { name: 'Non-modal dialog' });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((el) => el.matches(':modal'))).toBe(false);

    // The page behind is still usable: the navigation search takes text.
    const search = page.getByRole('searchbox', { name: 'Search pages' });
    await search.fill('toast');
    await expect(search).toHaveValue('toast');
    await dialog.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(dialog).toBeHidden();
  });

  test('puts the focus on the marked element and returns it to the trigger', async ({ page }) => {
    await openPage(page, '/controls/dialog', 'Dialog');
    const live = example(page, 'Initial focus');

    const first = live.getByRole('button', { name: 'First focusable' });
    await first.click();
    let dialog = page.getByRole('dialog', { name: 'Default focus' });
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(first).toBeFocused();

    const marked = live.getByRole('button', { name: 'Marked field' });
    await marked.click();
    dialog = page.getByRole('dialog', { name: 'Marked focus' });
    await expect(dialog.getByRole('textbox', { name: 'Reference' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(marked).toBeFocused();
  });

  test('the dialog service passes data in and the result out', async ({ page }) => {
    await openPage(page, '/controls/dialog', 'Dialog');
    const live = example(page, 'Dialog from code');
    const trigger = live.getByRole('button', { name: 'Edit note' });
    const dialog = page.getByRole('dialog', { name: 'Edit note' });
    await expect(live.getByRole('status')).toHaveText('Note: Call the customer before delivery.');

    // The data goes in: the field has the note and the hint has the order id. The marked
    // field has the focus.
    await trigger.click();
    const note = dialog.getByRole('textbox', { name: 'Internal note' });
    await expect(note).toHaveValue('Call the customer before delivery.');
    await expect(dialog.getByText('Order ORD-1042')).toBeVisible();
    await expect(note).toBeFocused();

    // Escape gives no result: the note stays.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(live.getByRole('status')).toHaveText('Note: Call the customer before delivery.');

    // Save is off for an empty note.
    await trigger.click();
    await note.fill('  ');
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();

    // Save gives the new text out.
    await note.fill('Ring the bell twice.');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Note: Ring the bell twice.');

    // Cancel gives no result.
    await trigger.click();
    await note.fill('Another text');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Note: Ring the bell twice.');
  });

  test('the dialog service dialog traps Tab', async ({ page }) => {
    await openPage(page, '/controls/dialog', 'Dialog');
    await example(page, 'Dialog from code').getByRole('button', { name: 'Edit note' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit note' });
    await expect(dialog).toBeVisible();
    await tabStaysInside(page, dialog, 6);
  });
});

test.describe('popups inside a modal dialog', () => {
  const openOrderDialog = async (page: Page) => {
    await openPage(page, '/controls/dialog', 'Dialog');
    await example(page, 'Menus and selects inside a modal')
      .getByRole('button', { name: 'Open order dialog' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Order ORD-1042' });
    await expect(dialog).toBeVisible();
    return dialog;
  };

  test('a menu with a submenu and a cascade select open above the modal', async ({ page }) => {
    const dialog = await openOrderDialog(page);

    // A click needs the item to be the top element at its position: it fails when the
    // popup is behind the modal.
    await dialog.getByRole('button', { name: 'More actions' }).click();
    // Hover opens a submenu (a click on an open parent closes it again).
    await page.getByRole('menuitem', { name: 'Move to' }).hover();
    await page.getByRole('menuitem', { name: 'South queue' }).click();
    await expect(dialog.getByText('Last action: South queue')).toBeVisible();

    await dialog.getByRole('button', { name: 'Dialog city' }).click();
    await page.getByRole('menuitem', { name: 'India' }).hover();
    await page.getByRole('menuitem', { name: 'Telangana' }).hover();
    await page.getByRole('menuitem', { name: 'Hyderabad' }).click();
    await expect(dialog.getByRole('button', { name: 'Dialog city' })).toHaveText(
      'India / Telangana / Hyderabad',
    );
    await expect(dialog).toBeVisible();
  });

  test('a right-click menu opens above the modal and takes a click', async ({ page }) => {
    const dialog = await openOrderDialog(page);

    await dialog.getByText('Last action: none').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Assign to me' }).click();
    await expect(dialog.getByText('Last action: Assign to me')).toBeVisible();

    // The menu is inside the dialog, so the keyboard reaches it too.
    await dialog.getByText('Last action: Assign to me').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Move to' }).hover();
    await page.getByRole('menuitem', { name: 'North queue' }).click();
    await expect(dialog.getByText('Last action: North queue')).toBeVisible();
  });

  test('the menu takes keys inside the modal and Escape closes only the menu', async ({ page }) => {
    const dialog = await openOrderDialog(page);
    const trigger = dialog.getByRole('button', { name: 'More actions' });

    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Assign to me' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Move to' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(trigger).toBeFocused();
    // The dialog is still open after the first Escape.
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});

test.describe('confirm', () => {
  test('asks before a delete, starts on the safe choice and resolves false on Escape', async ({
    page,
  }) => {
    await openPage(page, '/controls/confirm', 'Confirm');
    const live = example(page, 'Confirm dialog');
    const trigger = live.getByRole('button', { name: 'Delete order' });
    await trigger.click();

    // One element only has the role: the host element must not repeat it.
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toHaveCount(1);
    await expect(confirm).toBeVisible();
    await expect(confirm).toHaveAccessibleName('Delete order ORD-1042?');
    await expect(confirm).toContainText('You cannot undo this.');
    await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await tabStaysInside(page, confirm, 4);

    await page.keyboard.press('Escape');
    await expect(confirm).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Result: kept');
    await expect(trigger).toBeFocused();
  });

  test('resolves true on accept and false on reject', async ({ page }) => {
    await openPage(page, '/controls/confirm', 'Confirm');
    const live = example(page, 'Confirm dialog');
    const confirm = page.getByRole('alertdialog');

    await live.getByRole('button', { name: 'Delete order' }).click();
    await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(confirm).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Result: deleted');

    await live.getByRole('button', { name: 'Delete order' }).click();
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Result: kept');

    // The close button of the header rejects too.
    await live.getByRole('button', { name: 'Delete order' }).click();
    await confirm.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(confirm).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Result: kept');
  });

  test('defaultFocus, labels and acknowledge-only change the buttons', async ({ page }) => {
    await openPage(page, '/controls/confirm', 'Confirm');
    const live = example(page, 'Focus, labels and acknowledge-only');
    const confirm = page.getByRole('alertdialog');

    await live.getByRole('button', { name: 'Publish price list' }).click();
    await expect(confirm.getByRole('button', { name: 'Publish' })).toBeFocused();
    await expect(confirm.getByRole('button', { name: 'Not yet' })).toBeVisible();
    await confirm.getByRole('button', { name: 'Not yet' }).click();
    await expect(confirm).toBeHidden();
    await expect(example(page, 'Confirm dialog').getByRole('status')).toHaveText(
      'Result: not published',
    );

    await live.getByRole('button', { name: 'Show notice' }).click();
    await expect(confirm).toContainText('The portal is read-only');
    await expect(confirm.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
    await confirm.getByRole('button', { name: 'Got it' }).focus();
    await page.keyboard.press('Enter');
    await expect(confirm).toBeHidden();
  });

  test('a confirm popup opens next to the button, takes the focus and resolves', async ({
    page,
  }) => {
    await openPage(page, '/controls/confirm', 'Confirm');
    const live = example(page, 'Confirm popup');
    const trigger = live.getByRole('button', { name: 'Archive' });
    const popup = page.locator('.star-popover');

    await trigger.click();
    await expect(popup).toBeVisible();
    // A popup, not a dialog: the confirm dialog stays closed.
    await expect(page.locator('star-confirm-host dialog')).toBeHidden();
    await expect(popup).toContainText('You can restore it from the archive.');
    await expect(popup.getByRole('button', { name: 'Cancel' })).toBeFocused();
    const box = (await popup.boundingBox())!;
    const anchor = (await trigger.boundingBox())!;
    expect(Math.abs(box.y - (anchor.y + anchor.height))).toBeLessThan(24);

    await popup.getByRole('button', { name: 'Archive' }).click();
    await expect(popup).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Archive result: archived');
  });

  test('a confirm popup rejects on Escape and on a click outside', async ({ page }) => {
    await openPage(page, '/controls/confirm', 'Confirm');
    const live = example(page, 'Confirm popup');
    const trigger = live.getByRole('button', { name: 'Archive' });
    const popup = page.locator('.star-popover');

    await trigger.click();
    await expect(popup).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Archive result: kept');
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(popup).toBeVisible();
    await page.getByRole('heading', { level: 1, name: 'Confirm' }).click();
    await expect(popup).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Archive result: kept');
  });

  test('a danger popup on a row is named by its message, traps Tab and returns the focus', async ({
    page,
  }) => {
    await openPage(page, '/controls/confirm', 'Confirm');
    const live = example(page, 'Delete from a row');
    const trigger = live.getByRole('button', { name: 'Delete INV-2042' });
    const popup = page.getByRole('alertdialog', { name: 'Delete invoice INV-2042?' });

    await trigger.click();
    await expect(popup).toBeVisible();
    await expect(popup).toHaveAttribute('aria-modal', 'false');
    await expect(popup.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await expect(popup.getByRole('button', { name: 'Delete' })).toHaveClass(/star-btn--danger/);
    await page.keyboard.press('Tab');
    await expect(popup.getByRole('button', { name: 'Delete' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(popup.getByRole('button', { name: 'Cancel' })).toBeFocused();

    await popup.getByRole('button', { name: 'Cancel' }).click();
    await expect(popup).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(live.getByRole('status')).toHaveText('Invoice result: INV-2042 kept');

    await trigger.click();
    await popup.getByRole('button', { name: 'Delete' }).click();
    await expect(popup).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Invoice result: INV-2042 deleted');
    await expect(trigger).toHaveCount(0);
  });
});

test.describe('bottom sheet', () => {
  test('opens a component at the bottom edge, traps Tab, resolves and returns the focus', async ({
    page,
  }) => {
    await openPage(page, '/controls/bottom-sheet', 'Bottom sheet');
    const live = example(page, 'Sheet from a component');
    const trigger = live.getByRole('button', { name: 'Export invoice' });
    const sheet = page.getByRole('dialog', { name: 'Export invoice INV-2041' });

    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'PDF' })).toBeFocused();
    const box = (await sheet.boundingBox())!;
    const viewport = page.viewportSize()!;
    // Wait for the slide-up transition, then the sheet touches the bottom edge.
    await expect
      .poll(async () => {
        const current = (await sheet.boundingBox())!;
        return Math.round(current.y + current.height);
      })
      .toBe(viewport.height);
    expect(box.width).toBeLessThanOrEqual(640 + 1);
    await tabStaysInside(page, sheet, 5);

    await sheet.getByRole('button', { name: 'CSV' }).click();
    await expect(sheet).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Export format: CSV');
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Export format: cancelled');
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(sheet).toBeVisible();
    await page.mouse.click(4, 4);
    await expect(sheet).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Export format: cancelled');
  });

  test('an action sheet resolves with the chosen action and skips disabled ones', async ({
    page,
  }) => {
    await openPage(page, '/controls/bottom-sheet', 'Bottom sheet');
    const live = example(page, 'Action sheet');
    const sheet = page.getByRole('dialog', { name: 'Order ORD-1042 actions' });

    await live.getByRole('button', { name: 'Order actions' }).click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('listitem')).toHaveCount(4);
    await expect(sheet.getByRole('button', { name: 'Print label' })).toBeDisabled();
    await expect(sheet.getByRole('button', { name: 'Share order' })).toBeFocused();
    await sheet.getByRole('button', { name: 'Cancel order' }).click();
    await expect(sheet).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Action: cancel');

    await live.getByRole('button', { name: 'Order actions' }).click();
    await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Action: none');
  });

  test('a template sheet stays open on a backdrop click and closes on Escape', async ({ page }) => {
    await openPage(page, '/controls/bottom-sheet', 'Bottom sheet');
    const live = example(page, 'Template and options');
    const sheet = page.getByRole('dialog', { name: 'Projects' });

    await live.getByRole('button', { name: 'Pick a project' }).click();
    await expect(sheet).toBeVisible();
    await page.mouse.click(4, 4);
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'North depot' }).click();
    await expect(sheet).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Project: North depot');

    await live.getByRole('button', { name: 'Pick a project' }).click();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Project: none');
  });
});

test.describe('drawer', () => {
  test('opens, puts the focus inside, traps Tab, closes with Escape and returns the focus', async ({
    page,
  }) => {
    await openPage(page, '/controls/drawer', 'Drawer');
    const trigger = example(page, 'Details drawer').getByRole('button', { name: 'Open details' });
    const drawer = page.getByRole('dialog', { name: 'Order ORD-1042' });
    await expect(drawer).toBeHidden();

    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveClass(/star-drawer--right/);
    await expect(drawer.getByLabel('Close', { exact: true })).toBeFocused();
    await tabStaysInside(page, drawer, 6);

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('closes with the footer button, and a backdrop click closes it with dismissableMask', async ({
    page,
  }) => {
    await openPage(page, '/controls/drawer', 'Drawer');
    const trigger = example(page, 'Details drawer').getByRole('button', { name: 'Open details' });
    const drawer = page.getByRole('dialog', { name: 'Order ORD-1042' });

    await trigger.click();
    await expect(drawer).toBeVisible();
    // A click inside the drawer does not close it.
    await drawer.getByText('Orchard Supply, 12 items, ships on Friday.').click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole('button', { name: 'Close', exact: true }).last().click();
    await expect(drawer).toBeHidden();

    await trigger.click();
    await expect(drawer).toBeVisible();
    await clickBackdrop(page);
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('is pinned to the edge of its position and has the given size', async ({ page }) => {
    await openPage(page, '/controls/drawer', 'Drawer');
    const live = example(page, 'Position and size');
    const view = page.viewportSize()!;

    for (const position of ['left', 'right', 'top', 'bottom'] as const) {
      await live.getByRole('button', { name: position, exact: true }).click();
      const drawer = page.getByRole('dialog', { name: `Drawer at the ${position}` });
      await expect(drawer).toBeVisible();
      await expect(drawer).toHaveClass(new RegExp(`star-drawer--${position}`));
      // The slide-in transition ends at the final position.
      await expect
        .poll(
          async () => {
            const box = (await drawer.boundingBox())!;
            return {
              left: Math.round(box.x),
              right: Math.round(box.x + box.width),
              top: Math.round(box.y),
              bottom: Math.round(box.y + box.height),
              width: Math.round(box.width),
              height: Math.round(box.height),
            };
          },
          { message: position },
        )
        .toMatchObject(
          {
            left: { left: 0, width: 352, height: view.height },
            right: { right: view.width, width: 352, height: view.height },
            top: { top: 0, width: view.width, height: 224 },
            bottom: { bottom: view.height, width: view.width, height: 224 },
          }[position],
        );
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
    }
  });
});

test.describe('popover', () => {
  test('opens on the button, moves the focus in and returns it on Escape', async ({ page }) => {
    await openPage(page, '/controls/popover', 'Popover');
    const live = example(page, 'Details popover');
    const anchor = live.getByRole('button', { name: 'Details' });
    const popover = page.getByRole('dialog', { name: 'Order details' });
    await expect(anchor).not.toHaveAttribute('aria-expanded', 'true');

    await anchor.focus();
    await page.keyboard.press('Enter');
    await expect(popover).toBeVisible();
    await expect(anchor).toHaveAttribute('aria-expanded', 'true');
    await expect(anchor).toHaveAttribute('aria-controls', (await popover.getAttribute('id'))!);
    await expect(popover.getByRole('button', { name: 'Close' })).toBeFocused();
    // The panel is below the anchor.
    const panel = (await popover.boundingBox())!;
    const box = (await anchor.boundingBox())!;
    expect(panel.y).toBeGreaterThanOrEqual(box.y + box.height);

    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();
    await expect(anchor).toHaveAttribute('aria-expanded', 'false');
    await expect(anchor).toBeFocused();
  });

  test('closes with its own button, with a click on the anchor and with a click outside', async ({
    page,
  }) => {
    await openPage(page, '/controls/popover', 'Popover');
    const anchor = example(page, 'Details popover').getByRole('button', { name: 'Details' });
    const popover = page.getByRole('dialog', { name: 'Order details' });

    await anchor.click();
    await expect(popover).toBeVisible();
    await popover.getByRole('button', { name: 'Close' }).click();
    await expect(popover).toBeHidden();
    await expect(anchor).toBeFocused();

    // A second click on the anchor closes it again.
    await anchor.click();
    await expect(popover).toBeVisible();
    await anchor.click();
    await expect(popover).toBeHidden();

    await anchor.click();
    await expect(popover).toBeVisible();
    await page.getByRole('heading', { level: 1, name: 'Popover' }).click();
    await expect(popover).toBeHidden();
    await expect(anchor).toHaveAttribute('aria-expanded', 'false');
  });

  test('puts the focus on the first field and reports shown and hidden', async ({ page }) => {
    await openPage(page, '/controls/popover', 'Popover');
    const live = example(page, 'Field in a popover');
    const popover = page.getByRole('dialog', { name: 'Rename order' });
    await expect(live.getByRole('status')).toHaveText('Popover: closed');

    await live.getByRole('button', { name: 'Rename order' }).click();
    await expect(popover).toBeVisible();
    await expect(popover.getByRole('textbox', { name: 'Order name' })).toBeFocused();
    await expect(live.getByRole('status')).toHaveText('Popover: open');

    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();
    await expect(live.getByRole('status')).toHaveText('Popover: closed');
    await expect(live.getByRole('button', { name: 'Rename order' })).toBeFocused();
  });

  test('stays open on a click outside with dismissable off and keeps the focus', async ({
    page,
  }) => {
    await openPage(page, '/controls/popover', 'Popover');
    const anchor = example(page, 'Keep it open').getByRole('button', { name: 'Toggle tip' });
    const popover = page.getByRole('dialog', { name: 'Tip' });

    await anchor.click();
    await expect(popover).toBeVisible();
    // focusOnShow is off: the focus stays on the button.
    await expect(anchor).toBeFocused();

    await page.getByRole('heading', { level: 1, name: 'Popover' }).click();
    await page.waitForTimeout(300);
    await expect(popover).toBeVisible();

    await anchor.click();
    await expect(popover).toBeHidden();
  });
});

test.describe('tooltip', () => {
  const tooltip = (page: Page) => page.getByRole('tooltip');

  test('shows on hover, links the element with aria-describedby and hides on leave', async ({
    page,
  }) => {
    await openPage(page, '/controls/tooltip', 'Tooltip');
    const host = example(page, 'Positions').locator('star-button', { hasText: 'Top' });
    await expect(tooltip(page)).toHaveCount(0);
    await expect(host).not.toHaveAttribute('aria-describedby', /.+/);

    await host.hover();
    await expect(tooltip(page)).toHaveText('Shown on hover and focus');
    const id = await tooltip(page).getAttribute('id');
    expect(id).toBeTruthy();
    await expect(host).toHaveAttribute('aria-describedby', id!);

    await page.mouse.move(0, 0);
    await expect(tooltip(page)).toHaveCount(0);
    await expect(host).not.toHaveAttribute('aria-describedby', /.+/);
  });

  test('shows on keyboard focus and hides on Escape while the focus stays', async ({ page }) => {
    await openPage(page, '/controls/tooltip', 'Tooltip');
    const button = example(page, 'Icon button').getByRole('button', { name: 'Export orders' });

    await button.focus();
    await expect(tooltip(page)).toHaveText('Export orders to CSV');
    await page.keyboard.press('Escape');
    await expect(tooltip(page)).toHaveCount(0);
    await expect(button).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(tooltip(page)).toHaveText('Export orders to CSV');
    await page.keyboard.press('Tab');
    await expect(tooltip(page)).toHaveCount(0);
  });

  test('is placed on the side of starTooltipPosition', async ({ page }) => {
    await openPage(page, '/controls/tooltip', 'Tooltip');
    const live = example(page, 'Positions');
    const place = async (name: string) => {
      const button = live.getByRole('button', { name, exact: true });
      await button.hover();
      await expect(tooltip(page)).toBeVisible();
      const panel = (await tooltip(page).boundingBox())!;
      const anchor = (await button.boundingBox())!;
      await page.mouse.move(0, 0);
      await expect(tooltip(page)).toHaveCount(0);
      return { panel, anchor };
    };

    const top = await place('Top');
    expect(top.panel.y + top.panel.height).toBeLessThanOrEqual(top.anchor.y);
    const bottom = await place('Bottom');
    expect(bottom.panel.y).toBeGreaterThanOrEqual(bottom.anchor.y + bottom.anchor.height);
    const left = await place('Left');
    expect(left.panel.x + left.panel.width).toBeLessThanOrEqual(left.anchor.x);
    const right = await place('Right');
    expect(right.panel.x).toBeGreaterThanOrEqual(right.anchor.x + right.anchor.width);
  });

  test('a disabled tooltip never shows, and a show delay of 0 shows at once', async ({ page }) => {
    await openPage(page, '/controls/tooltip', 'Tooltip');
    const live = example(page, 'Delay and disabled');

    await live.getByRole('button', { name: 'Disabled tooltip' }).hover();
    await page.waitForTimeout(700);
    await expect(tooltip(page)).toHaveCount(0);
    await page.mouse.move(0, 0);

    await live.getByRole('button', { name: 'No delay' }).hover();
    await expect(tooltip(page)).toHaveText('Appears at once');
  });
});

test.describe('toast', () => {
  const stack = (page: Page) => page.getByRole('region', { name: 'Notifications' });

  test('shows a success message as a status with a summary and a detail', async ({ page }) => {
    await openPage(page, '/controls/toast', 'Toast');
    const live = example(page, 'Severities');
    await expect(stack(page)).toBeHidden();

    await live.getByRole('button', { name: 'Success' }).click();
    const message = stack(page).getByRole('status');
    await expect(message).toBeVisible();
    await expect(message).toContainText('Order sent');
    await expect(message).toContainText('The customer gets it by email.');
    await message.getByRole('button', { name: 'Close' }).click();
    await expect(message).toHaveCount(0);
    await expect(stack(page)).toBeHidden();
  });

  test('shows an error message as an alert and the other severities as status', async ({
    page,
  }) => {
    await openPage(page, '/controls/toast', 'Toast');
    const live = example(page, 'Severities');

    await live.getByRole('button', { name: 'Error' }).click();
    const alert = stack(page).getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Sync failed');

    await live.getByRole('button', { name: 'Info' }).click();
    await live.getByRole('button', { name: 'Warn' }).click();
    await expect(stack(page).getByRole('status')).toHaveCount(2);
    await expect(stack(page).getByRole('alert')).toHaveCount(1);

    await alert.getByRole('button', { name: 'Close' }).click();
    await expect(alert).toHaveCount(0);
    await expect(stack(page).getByRole('status')).toHaveCount(2);
  });

  test('closes a timed message by itself, and a sticky message stays', async ({ page }) => {
    await openPage(page, '/controls/toast', 'Toast');
    const live = example(page, 'Sticky and timed messages');

    await live.getByRole('button', { name: 'Sticky message' }).click();
    await live.getByRole('button', { name: 'Two second message' }).click();
    const quick = stack(page).getByRole('status').filter({ hasText: 'Quick note' });
    const sticky = stack(page).getByRole('status').filter({ hasText: 'Stock is low' });
    await expect(quick).toBeVisible();
    await expect(sticky).toBeVisible();

    await expect(quick).toHaveCount(0, { timeout: 6000 });
    await expect(sticky).toBeVisible();

    await live.getByRole('button', { name: 'Clear all' }).click();
    await expect(sticky).toHaveCount(0);
  });

  test('pauses the close timer while the pointer is on the message', async ({ page }) => {
    await openPage(page, '/controls/toast', 'Toast');
    const live = example(page, 'Sticky and timed messages');

    await live.getByRole('button', { name: 'Two second message' }).click();
    const quick = stack(page).getByRole('status').filter({ hasText: 'Quick note' });
    await expect(quick).toBeVisible();
    await quick.hover();
    // The life is 2 seconds: after 3.5 seconds a running timer has removed the message.
    await page.waitForTimeout(3500);
    await expect(quick).toBeVisible();

    await page.mouse.move(0, 0);
    await expect(quick).toHaveCount(0, { timeout: 6000 });
  });

  test('ignores an identical message while the first one is visible', async ({ page }) => {
    await openPage(page, '/controls/toast', 'Toast');
    await example(page, 'Duplicate messages').getByRole('button', { name: 'Save twice' }).click();
    await expect(stack(page).getByRole('status').filter({ hasText: 'Saved' })).toHaveCount(1);
  });

  test('removes a message with Enter on its close button', async ({ page }) => {
    await openPage(page, '/controls/toast', 'Toast');
    const live = example(page, 'Sticky and timed messages');
    await live.getByRole('button', { name: 'Sticky message' }).click();
    const sticky = stack(page).getByRole('status').filter({ hasText: 'Stock is low' });
    await expect(sticky).toBeVisible();

    // The stack is last in the page: focus the close button directly, then use the keyboard.
    await sticky.getByRole('button', { name: 'Close' }).focus();
    await page.keyboard.press('Enter');
    await expect(sticky).toHaveCount(0);
  });
});

test.describe('overlay pages', () => {
  for (const [path, heading] of [
    ['dialog', 'Dialog'],
    ['confirm', 'Confirm'],
    ['drawer', 'Drawer'],
    ['bottom-sheet', 'Bottom sheet'],
    ['popover', 'Popover'],
    ['tooltip', 'Tooltip'],
    ['toast', 'Toast'],
  ] as const) {
    test(`${path} page opens without console errors and lists its API`, async ({ page }) => {
      const errors = collectErrors(page);
      await openPage(page, `/controls/${path}`, heading);
      await expect(page.getByRole('heading', { level: 2, name: 'API' })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});
