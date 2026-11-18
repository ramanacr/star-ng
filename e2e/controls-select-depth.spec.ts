import { expect, Page, test } from '@playwright/test';
import { collectErrors, example, openPage } from './support';

// Depth features of the select family: lazy loading, filter options, editable select, custom
// values, cancelable selection, keyboard and panel options, listbox check boxes and drag and drop,
// autocomplete token entry.
const listbox = (page: Page, name: string) => page.getByRole('listbox', { name, exact: true });
const panelSearch = (page: Page) => page.locator('.star-panel__filter').getByRole('searchbox');

test.describe('select depth', () => {
  test('lazy loading shows loading rows, then the loaded page', async ({ page }) => {
    const errors = collectErrors(page);
    await openPage(page, '/controls/select', 'Select');
    const live = example(page, 'Lazy loading');
    await live.getByRole('combobox', { name: 'Order, loaded on demand' }).click();
    const list = listbox(page, 'Order, loaded on demand');
    await expect(list.getByRole('option').first()).toHaveText('Order 00001');
    await expect(list).not.toHaveAttribute('aria-busy', 'true');

    // The filter goes to the fake service: the list shows its result.
    await panelSearch(page).fill('Order 0999');
    await expect(list.getByRole('option').first()).toHaveText('Order 09990');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Order: 9991');
    expect(errors).toEqual([]);
  });

  test('filter fields and match mode find a city by the start of its code', async ({ page }) => {
    await openPage(page, '/controls/select', 'Select');
    const live = example(page, 'Filter fields and match mode');
    await live.getByRole('combobox', { name: 'City by code or name' }).click();
    await panelSearch(page).fill('pu');
    await expect(listbox(page, 'City by code or name').getByRole('option')).toHaveText(['Pune']);
  });

  test('editable select filters while typing and takes custom text', async ({ page }) => {
    await openPage(page, '/controls/select', 'Select');
    const live = example(page, 'Editable');
    const field = live.getByRole('combobox', { name: 'City, editable' });
    await field.fill('Mun');
    await expect(listbox(page, 'City, editable').getByRole('option')).toHaveText(['Munich']);
    await page.keyboard.press('Enter');
    await expect(field).toHaveValue('Munich');
    await expect(live.getByRole('status')).toContainText('Value: MUC');

    await field.fill('Rome');
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toContainText('Value: Rome. Last custom text: Rome');
  });

  test('a cancelled change keeps the old value', async ({ page }) => {
    await openPage(page, '/controls/select', 'Select');
    const live = example(page, 'Cancelable selection');
    await live.getByRole('combobox', { name: 'City, Paris refused' }).click();
    await listbox(page, 'City, Paris refused').getByRole('option', { name: 'Paris' }).click();
    await expect(live.getByRole('status')).toHaveText('City: none. Paris was refused.');
  });

  test('appendTo body puts the panel in the overlay container, self keeps it next to the control', async ({
    page,
  }) => {
    await openPage(page, '/controls/select', 'Select');
    await example(page, 'Panel options')
      .getByRole('combobox', { name: 'City, panel in the body' })
      .click();
    const body = page.locator('.star-panel.orders-panel');
    await expect(body).toBeVisible();
    expect(await body.evaluate((el) => !!el.closest('.cdk-overlay-container'))).toBe(true);
    expect(await body.evaluate((el) => getComputedStyle(el).minWidth)).toBe('352px');
    await page.keyboard.press('Escape');

    await example(page, 'Objects as options').getByRole('combobox', { name: 'Country' }).click();
    const inline = page.locator('.star-panel').filter({ has: listbox(page, 'Country') });
    await expect(inline).toBeVisible();
    expect(await inline.evaluate((el) => !!el.closest('docs-example'))).toBe(true);
  });

  test('selectOnFocus chooses with the arrow keys', async ({ page }) => {
    await openPage(page, '/controls/select', 'Select');
    const live = example(page, 'Keyboard options');
    const select = live.getByRole('combobox', { name: 'City, keys choose' });
    await select.focus();
    await page.keyboard.press('Enter');
    await expect(select).not.toHaveAttribute('aria-activedescendant', /.+/);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(live.getByRole('status')).toHaveText('City: MUC');
    await expect(select).toHaveAttribute('aria-expanded', 'true');
  });
});

test.describe('multi-select and autocomplete custom values', () => {
  test('multi-select adds the filter text with the Add row', async ({ page }) => {
    await openPage(page, '/controls/multi-select', 'Multi-select');
    const live = example(page, 'Custom values');
    await live.getByRole('combobox', { name: 'Order labels' }).click();
    await panelSearch(page).fill('Archive');
    const add = listbox(page, 'Order labels').getByRole('option', { name: 'Add “Archive”' });
    await expect(add).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(add).toHaveClass(/star-listbox__option--active/);
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Labels: Archive');
    await expect(panelSearch(page)).toHaveValue('');
    // The new label is an option now.
    await expect(
      listbox(page, 'Order labels').getByRole('option', { name: 'Archive' }),
    ).toBeVisible();
  });

  test('multiple autocomplete makes chips from separated text', async ({ page }) => {
    await openPage(page, '/controls/autocomplete', 'Autocomplete');
    const live = example(page, 'Token entry');
    const field = live.getByRole('combobox', { name: 'Keywords as tokens' });
    await field.click();
    await field.pressSequentially('forms;signals,custom,');
    await expect(live.getByRole('status')).toHaveText('Keywords: forms, signals, custom');
    await field.pressSequentially('testing');
    await page.keyboard.press('Tab');
    await expect(field).toBeFocused();
    await expect(live.getByRole('status')).toHaveText('Keywords: forms, signals, custom, testing');
  });
});

test.describe('listbox depth', () => {
  test('check boxes and a tri-state Select all', async ({ page }) => {
    await openPage(page, '/controls/listbox', 'Listbox');
    const live = example(page, 'Check boxes and select all');
    const all = live.getByRole('checkbox', { name: 'Select all' });
    await expect(all).toHaveAttribute('aria-checked', 'mixed');
    await all.click();
    await expect(all).toHaveAttribute('aria-checked', 'true');
    await expect(live.getByRole('option', { name: 'Billing' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await live.getByRole('option', { name: 'Support' }).dblclick();
    await expect(live.getByRole('status')).toContainText('Double-clicked: Support');
  });

  test('Alt + Arrow down moves an order, and drag and drop moves it into the other list', async ({
    page,
  }) => {
    await openPage(page, '/controls/listbox', 'Listbox');
    const live = example(page, 'Drag and drop');
    const available = live.getByRole('listbox', { name: 'Available orders' });
    const planned = live.getByRole('listbox', { name: 'Planned orders' });
    // A click makes the first order active (and waits for the page to be interactive).
    await available.getByRole('option', { name: 'Order 1001' }).click();
    await expect(available).toHaveAttribute('aria-activedescendant', /-0$/);
    await page.keyboard.press('Alt+ArrowDown');
    await expect(available.getByRole('option')).toHaveText([
      'Order 1002',
      'Order 1001',
      'Order 1003',
      'Order 1004',
    ]);
    await expect(available).toHaveAttribute('aria-activedescendant', /-1$/);

    const item = available.getByRole('option', { name: 'Order 1003' });
    const from = (await item.boundingBox())!;
    const to = (await planned.getByRole('option').first().boundingBox())!;
    await page.mouse.move(from.x + 20, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 30, from.y + from.height / 2 + 10, { steps: 5 });
    await page.mouse.move(to.x + 20, to.y + to.height / 2, { steps: 15 });
    await page.mouse.up();
    // The CDK sorts by the pointer: the order lands before or after Order 1005.
    await expect(planned.getByRole('option')).toHaveCount(2);
    await expect(planned.getByRole('option', { name: 'Order 1003' })).toBeVisible();
    await expect(available.getByRole('option')).toHaveCount(3);
  });
});
