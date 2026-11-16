import { expect, Page, test } from '@playwright/test';
import { collectErrors, example, openPage } from './support';

// Panels of select, multi-select, autocomplete and tree select are popovers placed by the CDK
// overlay, so they are found from the page and not from the example area.
const listbox = (page: Page, name: string) => page.getByRole('listbox', { name, exact: true });
// The search field in the filter row of an open panel (the docs navigation has a search field too).
const panelSearch = (page: Page) => page.locator('.star-panel__filter').getByRole('searchbox');

test.describe('select', () => {
  test('opens with Enter, jumps by typing, chooses with Enter and returns the focus', async ({
    page,
  }) => {
    await openPage(page, '/controls/select', 'Select');
    const live = example(page, 'Objects as options');
    const select = live.getByRole('combobox', { name: 'Country' });
    await expect(select).toHaveAttribute('aria-expanded', 'false');

    await select.focus();
    await page.keyboard.press('Enter');
    await expect(select).toHaveAttribute('aria-expanded', 'true');
    await expect(listbox(page, 'Country').getByRole('option')).toHaveCount(6);
    await expect(listbox(page, 'Country').getByRole('option', { name: 'Germany' })).toHaveClass(
      /star-listbox__option--active/,
    );

    // Type-ahead moves the active option and does not choose it.
    await page.keyboard.press('F');
    await expect(listbox(page, 'Country').getByRole('option', { name: 'France' })).toHaveClass(
      /star-listbox__option--active/,
    );
    await expect(live.getByRole('status')).toHaveText('Country: none');

    await page.keyboard.press('Enter');
    await expect(listbox(page, 'Country')).toHaveCount(0);
    await expect(select).toHaveAttribute('aria-expanded', 'false');
    await expect(select).toContainText('France');
    await expect(live.getByRole('status')).toHaveText('Country: FR');
    await expect(select).toBeFocused();
  });

  test('closes with Escape without a change and keeps the focus on the select', async ({
    page,
  }) => {
    await openPage(page, '/controls/select', 'Select');
    const live = example(page, 'Objects as options');
    const select = live.getByRole('combobox', { name: 'Country' });

    await select.focus();
    await page.keyboard.press('ArrowDown');
    await expect(select).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(listbox(page, 'Country')).toHaveCount(0);
    await expect(select).toHaveAttribute('aria-expanded', 'false');
    await expect(select).toBeFocused();
    await expect(live.getByRole('status')).toHaveText('Country: none');
  });

  test('chooses an option with a click', async ({ page }) => {
    await openPage(page, '/controls/select', 'Select');
    const live = example(page, 'Objects as options');
    await live.getByRole('combobox', { name: 'Country' }).click();
    await listbox(page, 'Country').getByRole('option', { name: 'India' }).click();
    await expect(live.getByRole('status')).toHaveText('Country: IN');
  });

  test('filters while typing, chooses with Enter and clears with the clear button', async ({
    page,
  }) => {
    await openPage(page, '/controls/select', 'Select');
    const live = example(page, 'Filter and clear button');
    const select = live.getByRole('combobox', { name: 'Country with filter' });

    await select.focus();
    await page.keyboard.press('Enter');
    const search = panelSearch(page);
    await expect(search).toBeFocused();
    await page.keyboard.type('an');
    await expect(listbox(page, 'Country with filter').getByRole('option')).toHaveText([
      'Germany',
      'France',
      'Japan',
      'Canada',
    ]);
    await page.keyboard.type('a');
    await expect(listbox(page, 'Country with filter').getByRole('option')).toHaveText(['Canada']);

    await page.keyboard.press('Enter');
    await expect(select).toContainText('Canada');
    await expect(live.getByRole('status')).toHaveText('Filtered: CA');
    await expect(select).toBeFocused();

    await live.getByRole('button', { name: 'Clear' }).click();
    await expect(live.getByRole('status')).toHaveText('Filtered: none');
    await expect(select).toBeFocused();
  });

  test('shows group headings and skips disabled options with the arrow keys', async ({ page }) => {
    await openPage(page, '/controls/select', 'Select');
    await example(page, 'Groups').getByRole('combobox').click();
    await expect(listbox(page, 'Country by region').locator('.star-listbox__group')).toHaveText([
      'Europe',
      'Asia',
      'Americas',
    ]);
    await page.keyboard.press('Escape');

    const select = example(page, 'Disabled options').getByRole('combobox', { name: 'Office' });
    await select.focus();
    await page.keyboard.press('ArrowDown');
    const list = listbox(page, 'Office');
    await expect(list.getByRole('option', { name: 'Japan' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(list.getByRole('option', { name: 'Brazil' })).toHaveClass(
      /star-listbox__option--active/,
    );
    await list.getByRole('option', { name: 'Japan' }).click({ force: true });
    await expect(select).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Enter');
    await expect(select).toContainText('Brazil');
  });

  test('draws options with a template', async ({ page }) => {
    await openPage(page, '/controls/select', 'Select');
    await example(page, 'Option template').getByRole('combobox').click();
    await expect(
      listbox(page, 'Country with template').getByRole('option', { name: /Germany\s+Europe/ }),
    ).toBeVisible();
  });

  test('renders a window of 5,000 options and reaches the last one with End', async ({ page }) => {
    await openPage(page, '/controls/select', 'Select');
    const select = example(page, 'Virtual scroll').getByRole('combobox', { name: 'Order' });
    await select.click();
    const options = listbox(page, 'Order').getByRole('option');
    await expect(options.first()).toBeVisible();
    expect(await options.count()).toBeLessThan(40);

    await page.keyboard.press('End');
    await expect(page.getByRole('option', { name: 'Order 05000' })).toBeVisible();
    expect(await options.count()).toBeLessThan(40);
    await page.keyboard.press('Enter');
    await expect(select).toContainText('Order 05000');
  });

  test('disabled and read-only selects do not open', async ({ page }) => {
    await openPage(page, '/controls/select', 'Select');
    const live = example(page, 'Sizes and states');
    await live.getByRole('combobox', { name: 'Disabled' }).click({ force: true });
    await live.getByRole('combobox', { name: 'Read-only' }).click();
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(live.getByRole('combobox', { name: 'Read-only' })).toContainText('EMEA');
  });

  test('shows the Signal Forms error after the user leaves the select and clears it', async ({
    page,
  }) => {
    await openPage(page, '/controls/select', 'Select');
    const live = example(page, 'Signal Forms');
    const select = live.getByRole('combobox', { name: 'Office country' });

    await expect(live.getByRole('alert')).toHaveCount(0);
    await expect(live.getByRole('status')).toHaveText('Valid: false');
    await select.focus();
    await page.keyboard.press('Tab');
    await expect(live.getByRole('alert')).toHaveText('Select a country.');
    await expect(select).toHaveAttribute('aria-invalid', 'true');

    await select.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(select).toContainText('Germany');
    await expect(live.getByRole('alert')).toHaveCount(0);
    await expect(live.getByRole('status')).toHaveText('Valid: true');
  });
});

test.describe('multi-select', () => {
  test('toggles options with Space, keeps the panel open and closes with Escape', async ({
    page,
  }) => {
    await openPage(page, '/controls/multi-select', 'Multi-select');
    const live = example(page, 'Basic');
    const select = live.getByRole('combobox', { name: 'Departments' });

    await select.focus();
    await page.keyboard.press('Enter');
    await expect(select).toHaveAttribute('aria-expanded', 'true');
    await expect(listbox(page, 'Departments')).toHaveAttribute('aria-multiselectable', 'true');

    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await expect(select).toHaveAttribute('aria-expanded', 'true');
    await expect(live.getByRole('status')).toHaveText('Chosen: fin, hr');
    await expect(select).toContainText('Finance, People');
    await expect(
      listbox(page, 'Departments').getByRole('option', { name: 'Finance' }),
    ).toHaveAttribute('aria-selected', 'true');

    // Space on a chosen option takes it away again.
    await page.keyboard.press('Space');
    await expect(live.getByRole('status')).toHaveText('Chosen: fin');

    await page.keyboard.press('Escape');
    await expect(listbox(page, 'Departments')).toHaveCount(0);
    await expect(select).toBeFocused();
    await expect(live.getByRole('status')).toHaveText('Chosen: fin');
  });

  test('select all chooses every option and the trigger shows a count', async ({ page }) => {
    await openPage(page, '/controls/multi-select', 'Multi-select');
    const live = example(page, 'Basic');
    const select = live.getByRole('combobox', { name: 'Departments' });
    await select.click();
    const all = page.getByRole('checkbox', { name: 'Select all' });
    await expect(all).toHaveAttribute('aria-checked', 'false');
    await all.click();
    await expect(live.getByRole('status')).toHaveText('Chosen: fin, hr, eng, ops, mkt');
    await expect(all).toHaveAttribute('aria-checked', 'true');
    await expect(select).toContainText('5 items selected');
    await all.click();
    await expect(live.getByRole('status')).toHaveText('Chosen: none');
  });

  test('filters, toggles with Enter, shows chips and removes one', async ({ page }) => {
    await openPage(page, '/controls/multi-select', 'Multi-select');
    const live = example(page, 'Chips, filter and clear button');
    const select = live.getByRole('combobox', { name: 'Departments as chips' });
    await expect(select.locator('.star-chip')).toHaveText(['Engineering', 'Operations']);

    await select.focus();
    await page.keyboard.press('Enter');
    await expect(panelSearch(page)).toBeFocused();
    await page.keyboard.type('fin');
    await expect(listbox(page, 'Departments as chips').getByRole('option')).toHaveText(['Finance']);
    await page.keyboard.press('Enter');
    await expect(select.locator('.star-chip')).toHaveText(['Finance', 'Engineering', 'Operations']);
    await page.keyboard.press('Escape');
    await expect(select).toBeFocused();

    await live.getByRole('button', { name: 'Remove Operations' }).click();
    await expect(select.locator('.star-chip')).toHaveText(['Finance', 'Engineering']);
    await live.getByRole('button', { name: 'Clear' }).click();
    await expect(select).toContainText('Select departments');
  });

  test('shows groups, skips disabled options and stops at the selection limit', async ({
    page,
  }) => {
    await openPage(page, '/controls/multi-select', 'Multi-select');
    await example(page, 'Groups and disabled options')
      .getByRole('combobox', { name: 'Departments by site' })
      .click();
    await expect(listbox(page, 'Departments by site').locator('.star-listbox__group')).toHaveText([
      'Berlin',
      'Pune',
      'Lisbon',
    ]);
    await expect(
      listbox(page, 'Departments by site').getByRole('option', { name: 'Marketing' }),
    ).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');

    const limited = example(page, 'Selection limit').getByRole('combobox', {
      name: 'Limited departments',
    });
    await limited.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('checkbox', { name: 'Select all' })).toHaveCount(0);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowDown');
    }
    await expect(limited).toContainText('Finance, People');
    await expect(limited).not.toContainText('Engineering');
  });

  test('shows the Signal Forms error until two options are chosen', async ({ page }) => {
    await openPage(page, '/controls/multi-select', 'Multi-select');
    const live = example(page, 'Signal Forms');
    const select = live.getByRole('combobox', { name: 'Teams' });

    await select.focus();
    await page.keyboard.press('Tab');
    await expect(live.getByRole('alert')).toHaveText('Select at least two departments.');
    await select.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await page.keyboard.press('Escape');
    await expect(live.getByRole('alert')).toHaveCount(0);
    await expect(live.getByRole('status')).toHaveText('Valid: true');
  });
});

test.describe('cascade select', () => {
  test('chooses a city with the keyboard, shows the value and returns the focus', async ({
    page,
  }) => {
    await openPage(page, '/controls/cascade-select', 'Cascade select');
    const live = example(page, 'Country, state and city');
    const city = live.getByRole('button', { name: 'City' });
    await city.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Germany' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('menuitem', { name: 'Bavaria' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('menuitem', { name: 'Munich' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Value: DE-NUE');
    await expect(city).toHaveText('Nuremberg');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(city).toBeFocused();
  });

  test('closes a submenu with Arrow left and the menu with Escape', async ({ page }) => {
    await openPage(page, '/controls/cascade-select', 'Cascade select');
    const live = example(page, 'Country, state and city');
    const city = live.getByRole('button', { name: 'City' });
    await city.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('menuitem', { name: 'Bavaria' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('menuitem', { name: 'Germany' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(city).toBeFocused();
    await expect(live.getByRole('status')).toHaveText('Value: none');
  });

  test('shows the whole path and clears with the clear button', async ({ page }) => {
    await openPage(page, '/controls/cascade-select', 'Cascade select');
    const live = example(page, 'Whole path and clear button');
    const city = live.getByRole('button', { name: 'City with path' });
    await city.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(city).toHaveText('Germany / Bavaria / Munich');
    await live.getByRole('button', { name: 'Clear' }).click();
    await expect(city).toHaveText('Choose a city');
  });

  test('chooses a city with the mouse and shows a Signal Forms error before', async ({ page }) => {
    await openPage(page, '/controls/cascade-select', 'Cascade select');
    const live = example(page, 'Signal Forms');
    const city = live.getByRole('button', { name: 'Office city' });
    await city.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expect(live.getByRole('alert')).toHaveText('Choose a city.');
    await city.click();
    await page.getByRole('menuitem', { name: 'India' }).hover();
    await page.getByRole('menuitem', { name: 'Maharashtra' }).hover();
    await page.getByRole('menuitem', { name: 'Pune' }).click();
    await expect(city).toHaveText('India / Maharashtra / Pune');
    await expect(live.getByRole('status')).toHaveText('Valid: true');
  });
});

test.describe('listbox', () => {
  test('chooses with the arrow keys and typeahead, and keeps one tab stop', async ({ page }) => {
    await openPage(page, '/controls/listbox', 'Listbox');
    const live = example(page, 'Single choice');
    const list = live.getByRole('listbox', { name: 'Queue' });
    await expect(list).toHaveAttribute('tabindex', '0');

    await list.focus();
    await page.keyboard.press('ArrowDown');
    await expect(live.getByRole('status')).toHaveText('Queue: billing');
    await expect(list.getByRole('option', { name: 'Billing' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(list).toHaveAttribute('aria-activedescendant', /star-listbox-.*-1$/);
    await page.keyboard.press('s');
    await expect(live.getByRole('status')).toHaveText('Queue: support');
    await page.keyboard.press('End');
    await expect(live.getByRole('status')).toHaveText('Queue: partners');
    await page.keyboard.press('Home');
    await expect(live.getByRole('status')).toHaveText('Queue: intake');
    await expect(list).toBeFocused();
  });

  test('chooses with a click', async ({ page }) => {
    await openPage(page, '/controls/listbox', 'Listbox');
    const live = example(page, 'Single choice');
    await live.getByRole('option', { name: 'Support' }).click();
    await expect(live.getByRole('status')).toHaveText('Queue: support');
  });

  test('multiple: filters, toggles with Enter and Space', async ({ page }) => {
    await openPage(page, '/controls/listbox', 'Listbox');
    const live = example(page, 'Multiple with filter');
    await expect(live.getByRole('status')).toHaveText('Queues: billing');
    const list = live.getByRole('listbox', { name: 'Queues' });
    await expect(list).toHaveAttribute('aria-multiselectable', 'true');

    await live.getByRole('searchbox', { name: 'Search' }).fill('sup');
    await expect(list.getByRole('option')).toHaveText(['Support']);
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Queues: billing, support');

    await live.getByRole('searchbox', { name: 'Search' }).fill('');
    await list.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('Space');
    await expect(live.getByRole('status')).toHaveText('Queues: billing, support, intake');
    await page.keyboard.press('Space');
    await expect(live.getByRole('status')).toHaveText('Queues: billing, support');
  });

  test('shows groups and does not choose a disabled option', async ({ page }) => {
    await openPage(page, '/controls/listbox', 'Listbox');
    const list = example(page, 'Groups and disabled options').getByRole('listbox', {
      name: 'Queue by site',
    });
    await expect(list.locator('.star-listbox__group')).toHaveText(['Berlin', 'Pune', 'Lisbon']);
    const returns = list.getByRole('option', { name: 'Returns' });
    await expect(returns).toHaveAttribute('aria-disabled', 'true');
    await returns.click({ force: true });
    await expect(returns).toHaveAttribute('aria-selected', 'false');
  });

  test('a disabled listbox is out of the tab order', async ({ page }) => {
    await openPage(page, '/controls/listbox', 'Listbox');
    const list = example(page, 'Disabled').getByRole('listbox', { name: 'Disabled queue' });
    await expect(list).toHaveAttribute('tabindex', '-1');
    await expect(list).toHaveAttribute('aria-disabled', 'true');
  });

  test('Signal Forms: shows the error after leaving the list, clears when one is chosen', async ({
    page,
  }) => {
    await openPage(page, '/controls/listbox', 'Listbox');
    const live = example(page, 'Signal Forms');
    const list = live.getByRole('listbox', { name: 'Notify queues' });
    await list.focus();
    await page.keyboard.press('Tab');
    await expect(live.getByRole('alert')).toHaveText('Select at least one queue.');
    await list.focus();
    await page.keyboard.press('Space');
    await expect(live.getByRole('alert')).toHaveCount(0);
    await expect(live.getByRole('status')).toHaveText('Valid: true');
  });
});

test.describe('autocomplete', () => {
  test('filters while typing, marks the match, chooses with Enter and keeps the focus', async ({
    page,
  }) => {
    await openPage(page, '/controls/autocomplete', 'Autocomplete');
    const live = example(page, 'Local options');
    const input = live.getByRole('combobox', { name: 'City' });
    await expect(input).toHaveAttribute('aria-expanded', 'false');

    await input.focus();
    await page.keyboard.type('mu');
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    const list = listbox(page, 'City');
    await expect(list.getByRole('option')).toHaveText(['Mumbai', 'Munich']);
    await expect(list.locator('mark')).toHaveText(['Mu', 'Mu']);

    await page.keyboard.press('ArrowDown');
    await expect(list.getByRole('option', { name: 'Mumbai' })).toHaveClass(
      /star-listbox__option--active/,
    );
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('Munich');
    await expect(live.getByRole('status')).toHaveText('City: Munich');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(input).toBeFocused();
  });

  test('closes with Escape and resets unmatched text when the field loses focus', async ({
    page,
  }) => {
    await openPage(page, '/controls/autocomplete', 'Autocomplete');
    const live = example(page, 'Local options');
    const input = live.getByRole('combobox', { name: 'City' });
    await input.focus();
    await page.keyboard.type('ber');
    await expect(listbox(page, 'City').getByRole('option')).toHaveText(['Berlin', 'Bern']);
    await page.keyboard.press('Escape');
    await expect(listbox(page, 'City')).toHaveCount(0);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('ber');

    await page.keyboard.press('Tab');
    await expect(input).toHaveValue('');
    await expect(live.getByRole('status')).toHaveText('City: none');
  });

  test('takes an exact label when the field loses focus', async ({ page }) => {
    await openPage(page, '/controls/autocomplete', 'Autocomplete');
    const live = example(page, 'Local options');
    const input = live.getByRole('combobox', { name: 'City' });
    await input.focus();
    await page.keyboard.type('pune');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await expect(input).toHaveValue('Pune');
    await expect(live.getByRole('status')).toHaveText('City: Pune');
  });

  test('autoHighlight picks the first result with Enter, and the dropdown lists all', async ({
    page,
  }) => {
    await openPage(page, '/controls/autocomplete', 'Autocomplete');
    const live = example(page, 'Dropdown button and first result');
    const input = live.getByRole('combobox', { name: 'City with dropdown' });
    await input.focus();
    await page.keyboard.type('ma');
    await expect(listbox(page, 'City with dropdown').getByRole('option')).toHaveText(['Madrid']);
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('Madrid');

    await live.getByRole('button', { name: 'Clear' }).click();
    await expect(input).toHaveValue('');
    await live.getByRole('button', { name: 'Show options' }).click();
    await expect(listbox(page, 'City with dropdown').getByRole('option')).toHaveCount(8);
    await page.keyboard.press('Escape');
    await expect(listbox(page, 'City with dropdown')).toHaveCount(0);
  });

  test('shows groups and an option template', async ({ page }) => {
    await openPage(page, '/controls/autocomplete', 'Autocomplete');
    const input = example(page, 'Objects, groups and template').getByRole('combobox', {
      name: 'Person',
    });
    await input.focus();
    await page.keyboard.type('ma');
    const list = listbox(page, 'Person');
    await expect(list.locator('.star-listbox__group')).toHaveText(['Finance', 'Engineering']);
    await expect(list.getByRole('option', { name: /Maria Lopez\s+Finance/ })).toBeVisible();
  });

  test('async suggestions: waits for the server, then chooses with the keyboard', async ({
    page,
  }) => {
    await openPage(page, '/controls/autocomplete', 'Autocomplete');
    const live = example(page, 'Async suggestions');
    const input = live.getByRole('combobox', { name: 'Colleague' });
    await input.focus();

    // One letter is under minQueryLength: no list.
    await page.keyboard.type('m');
    await expect(listbox(page, 'Colleague')).toHaveCount(0);

    await page.keyboard.type('a');
    await expect(listbox(page, 'Colleague').getByRole('option')).toHaveText([
      'Maria Lopez',
      'Mateo Rossi',
      'Marek Novak',
    ]);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('Mateo Rossi');
    await expect(live.getByRole('status')).toHaveText('Colleague: p2');
    await expect(input).toBeFocused();
  });

  test('multiple: Enter adds a chip, Backspace removes the last chip', async ({ page }) => {
    await openPage(page, '/controls/autocomplete', 'Autocomplete');
    const live = example(page, 'Multiple');
    const input = live.getByRole('combobox', { name: 'Keywords' });
    await input.focus();
    await page.keyboard.type('for');
    await page.keyboard.press('Enter');
    await expect(live.locator('.star-chip')).toHaveText(['forms']);
    await expect(live.getByRole('status')).toHaveText('Keywords: forms');

    await page.keyboard.type('sig');
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Keywords: forms, signals');

    await page.keyboard.press('Backspace');
    await expect(live.getByRole('status')).toHaveText('Keywords: forms');
    await live.getByRole('button', { name: 'Remove forms' }).click();
    await expect(live.getByRole('status')).toHaveText('Keywords: none');
  });

  test('Signal Forms: shows the error after leaving the field, then accepts a choice', async ({
    page,
  }) => {
    await openPage(page, '/controls/autocomplete', 'Autocomplete');
    const live = example(page, 'Signal Forms');
    const input = live.getByRole('combobox', { name: 'Assignee' });
    await input.focus();
    await page.keyboard.press('Tab');
    await expect(live.getByRole('alert')).toHaveText('Choose an assignee.');

    await input.focus();
    await page.keyboard.type('sv');
    await expect(page.getByRole('option', { name: 'Sven Berg' })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('Sven Berg');
    await expect(live.getByRole('alert')).toHaveCount(0);
    await expect(live.getByRole('status')).toHaveText('Valid: true');
  });
});

test.describe('tree', () => {
  test('moves with the arrow keys, opens and closes branches, jumps with Home and End', async ({
    page,
  }) => {
    await openPage(page, '/controls/tree', 'Tree');
    const tree = example(page, 'Expand and collapse').getByRole('tree', { name: 'Folders' });
    const row = (key: string) => tree.locator(`[data-key="${key}"]`);
    const keys = async () =>
      tree
        .getByRole('treeitem')
        .evaluateAll((items) => items.map((i) => (i as HTMLElement).dataset['key']));

    await expect(row('docs')).toHaveAttribute('aria-expanded', 'true');
    expect(await keys()).toEqual(['docs', 'invoices', 'contracts', 'archive', 'media', 'notes']);
    await row('docs').focus();
    await page.keyboard.press('ArrowDown');
    await expect(row('invoices')).toBeFocused();
    await expect(row('invoices')).toHaveAttribute('aria-level', '2');

    // Arrow left on a leaf goes to the parent, and on an open branch it closes the branch.
    await page.keyboard.press('ArrowLeft');
    await expect(row('docs')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(row('docs')).toHaveAttribute('aria-expanded', 'false');
    expect(await keys()).toEqual(['docs', 'media', 'notes']);

    await page.keyboard.press('ArrowRight');
    await expect(row('docs')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(row('invoices')).toBeFocused();

    await page.keyboard.press('End');
    await expect(row('notes')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(row('docs')).toBeFocused();

    // An asterisk opens every branch of the level.
    await page.keyboard.press('*');
    await expect(row('media')).toHaveAttribute('aria-expanded', 'true');
    expect(await keys()).toContain('video');
  });

  test('a click on a branch without a selection mode opens and closes it', async ({ page }) => {
    await openPage(page, '/controls/tree', 'Tree');
    const tree = example(page, 'Expand and collapse').getByRole('tree', { name: 'Folders' });
    const media = tree.locator('[data-key="media"]');
    await expect(media).toHaveAttribute('aria-expanded', 'false');
    await media.click();
    await expect(media).toHaveAttribute('aria-expanded', 'true');
    await media.click();
    await expect(media).toHaveAttribute('aria-expanded', 'false');
  });

  test('single selection: Enter selects, a disabled node does not', async ({ page }) => {
    await openPage(page, '/controls/tree', 'Tree');
    const live = example(page, 'Single selection');
    const tree = live.getByRole('tree', { name: 'Folder' });
    const row = (key: string) => tree.locator(`[data-key="${key}"]`);

    await row('notes').focus();
    await page.keyboard.press('Enter');
    await expect(live.getByText('Selected: notes')).toBeVisible();
    await expect(live.getByText('Last node: Notes')).toBeVisible();
    await expect(row('notes')).toHaveAttribute('aria-selected', 'true');

    await row('archive').focus();
    await expect(row('archive')).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Enter');
    await expect(live.getByText('Selected: notes')).toBeVisible();

    await row('invoices').click();
    await expect(live.getByText('Selected: invoices')).toBeVisible();
  });

  test('multiple selection toggles each node', async ({ page }) => {
    await openPage(page, '/controls/tree', 'Tree');
    const tree = example(page, 'Multiple selection').getByRole('tree', {
      name: 'Folders to back up',
    });
    await tree.locator('[data-key="photos"]').click();
    await tree.locator('[data-key="notes"]').click();
    await expect(tree.locator('[aria-selected="true"]')).toHaveCount(2);
    await tree.locator('[data-key="photos"]').click();
    await expect(tree.locator('[aria-selected="true"]')).toHaveCount(1);
  });

  test('checkbox selection: leaves, mixed parents and filter', async ({ page }) => {
    await openPage(page, '/controls/tree', 'Tree');
    const live = example(page, 'Checkbox selection and filter');
    const tree = live.getByRole('tree', { name: 'Folders to sync' });
    const row = (key: string) => tree.locator(`[data-key="${key}"]`);

    await row('photos').focus();
    await page.keyboard.press('Space');
    await expect(live.getByText('Leaves: photos', { exact: true })).toBeVisible();
    await expect(row('photos')).toHaveAttribute('aria-checked', 'true');
    await expect(row('media')).toHaveAttribute('aria-checked', 'mixed');

    await row('media').focus();
    await page.keyboard.press('Enter');
    await expect(live.getByText('Leaves: photos, raw, edits')).toBeVisible();
    await expect(row('media')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Enter');
    await expect(live.getByText('Leaves: none')).toBeVisible();
    await expect(row('media')).toHaveAttribute('aria-checked', 'false');

    await live.getByRole('searchbox', { name: 'Search' }).fill('raw');
    await expect(tree.getByRole('treeitem')).toHaveCount(3);
    await expect(row('raw')).toBeVisible();
    await live.getByRole('searchbox', { name: 'Search' }).fill('zzz');
    await expect(tree.getByRole('treeitem')).toHaveCount(0);
    await expect(tree.getByText('No results found')).toBeVisible();
  });

  test('Signal Forms: shows the error until a folder is checked', async ({ page }) => {
    await openPage(page, '/controls/tree', 'Tree');
    const live = example(page, 'Signal Forms');
    const tree = live.getByRole('tree', { name: 'Folders to share' });
    await expect(live.getByRole('status')).toHaveText('Valid: false');
    await tree.locator('[data-key="notes"]').click();
    await expect(live.getByRole('status')).toHaveText('Valid: true');
  });
});

test.describe('tree select', () => {
  test('opens with Enter into the tree, chooses with Enter and returns the focus', async ({
    page,
  }) => {
    await openPage(page, '/controls/tree-select', 'Tree select');
    const live = example(page, 'Single node');
    const field = live.getByRole('button', { name: 'Department' });
    await expect(field).toHaveAttribute('aria-expanded', 'false');

    await field.focus();
    await page.keyboard.press('Enter');
    await expect(field).toHaveAttribute('aria-expanded', 'true');
    const tree = page.getByRole('tree', { name: 'Department' });
    await expect(tree.locator('[data-key="eng"]')).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(tree.locator('[data-key="web"]')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await expect(tree.locator('[data-key="web"]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tree')).toHaveCount(0);
    await expect(field).toContainText('Web');
    await expect(live.getByRole('status')).toHaveText('Department: web');
    await expect(field).toBeFocused();
  });

  test('closes with Escape without a change and returns the focus', async ({ page }) => {
    await openPage(page, '/controls/tree-select', 'Tree select');
    const live = example(page, 'Single node');
    const field = live.getByRole('button', { name: 'Department' });
    await field.focus();
    await page.keyboard.press('ArrowDown');
    await expect(field).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tree')).toHaveCount(0);
    await expect(field).toHaveAttribute('aria-expanded', 'false');
    await expect(field).toBeFocused();
    await expect(live.getByRole('status')).toHaveText('Department: none');
  });

  test('clears with the clear button', async ({ page }) => {
    await openPage(page, '/controls/tree-select', 'Tree select');
    const live = example(page, 'Single node');
    await live.getByRole('button', { name: 'Department' }).click();
    await page.getByRole('tree', { name: 'Department' }).locator('[data-key="fin"]').click();
    await expect(live.getByRole('status')).toHaveText('Department: fin');
    await live.getByRole('button', { name: 'Clear' }).click();
    await expect(live.getByRole('status')).toHaveText('Department: none');
  });

  test('checkbox mode: filters, keeps the panel open and summarises the choice', async ({
    page,
  }) => {
    await openPage(page, '/controls/tree-select', 'Tree select');
    const live = example(page, 'Checkbox selection and filter');
    const field = live.getByRole('button', { name: 'Teams' });
    await field.click();
    const tree = page.getByRole('tree', { name: 'Teams' });
    await panelSearch(page).fill('log');
    await expect(tree.getByRole('treeitem')).toHaveCount(2);
    await tree.locator('[data-key="logistics"]').click();
    await expect(field).toHaveAttribute('aria-expanded', 'true');
    await expect(live.getByRole('status')).toHaveText('Teams: logistics');

    await page.keyboard.press('Escape');
    await expect(page.getByRole('tree')).toHaveCount(0);
    await expect(field).toContainText('Logistics');
    await expect(field).toBeFocused();

    // Four leaves are more than maxSelectedLabels: the field shows a count.
    await field.click();
    await panelSearch(page).fill('');
    await page.getByRole('tree', { name: 'Teams' }).locator('[data-key="eng"]').click();
    await expect(field).toContainText('4 items selected');
  });

  test('multiple mode keeps the panel open and a disabled field does not open', async ({
    page,
  }) => {
    await openPage(page, '/controls/tree-select', 'Tree select');
    const live = example(page, 'Multiple and disabled');
    await live.getByRole('button', { name: 'Nodes' }).click();
    const tree = page.getByRole('tree', { name: 'Nodes' });
    await tree.locator('[data-key="fin"]').click();
    await tree.locator('[data-key="eng"]').click();
    await expect(live.getByRole('status')).toHaveText('Nodes: fin, eng');
    await expect(live.getByRole('button', { name: 'Nodes' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await page.keyboard.press('Escape');
    await expect(live.getByRole('button', { name: 'Disabled department' })).toBeDisabled();
  });

  test('Signal Forms: shows the error after leaving the field, then accepts a node', async ({
    page,
  }) => {
    await openPage(page, '/controls/tree-select', 'Tree select');
    const live = example(page, 'Signal Forms');
    const field = live.getByRole('button', { name: 'Hire department' });
    await field.focus();
    await page.keyboard.press('Tab');
    await expect(live.getByRole('alert')).toHaveText('Select a department.');
    await field.focus();
    await page.keyboard.press('Enter');
    const tree = page.getByRole('tree', { name: 'Hire department' });
    await expect(tree.locator('[data-key="eng"]')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(tree.locator('[data-key="ops"]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Valid: true');
    await expect(live.getByRole('alert')).toHaveCount(0);
  });
});

test.describe('selection pages', () => {
  for (const [path, heading] of [
    ['select', 'Select'],
    ['multi-select', 'Multi-select'],
    ['cascade-select', 'Cascade select'],
    ['listbox', 'Listbox'],
    ['autocomplete', 'Autocomplete'],
    ['tree', 'Tree'],
    ['tree-select', 'Tree select'],
  ] as const) {
    test(`${path} page opens without console errors and lists its API`, async ({ page }) => {
      const errors = collectErrors(page);
      await openPage(page, `/controls/${path}`, heading);
      await expect(page.getByRole('heading', { level: 2, name: 'API' })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});

test.describe('panel width', () => {
  // With short options, the panel must be as wide as the control (it was as wide as its content).
  const cases = [
    {
      name: 'select',
      path: '/controls/select',
      heading: 'Select',
      example: 'Objects as options',
      role: 'combobox' as const,
      label: 'Country',
    },
    {
      name: 'multi-select',
      path: '/controls/multi-select',
      heading: 'Multi-select',
      example: 'Basic',
      role: 'combobox' as const,
      label: 'Departments',
    },
    {
      name: 'autocomplete',
      path: '/controls/autocomplete',
      heading: 'Autocomplete',
      example: 'Local options',
      role: 'combobox' as const,
      label: 'City',
    },
    {
      name: 'tree select',
      path: '/controls/tree-select',
      heading: 'Tree select',
      example: 'Single node',
      role: 'button' as const,
      label: 'Department',
    },
  ];

  for (const c of cases) {
    test(`${c.name}: the panel is as wide as the control`, async ({ page }) => {
      await openPage(page, c.path, c.heading);
      const trigger = example(page, c.example).getByRole(c.role, { name: c.label });
      await trigger.click();
      if (c.name === 'autocomplete') await trigger.pressSequentially('a');
      const panel = page.locator('.cdk-overlay-pane > .star-panel');
      await expect(panel).toBeVisible();

      const control = trigger.locator(
        'xpath=ancestor-or-self::*[contains(@class,"star-select__control")][1]',
      );
      const controlWidth = (await control.boundingBox())!.width;
      const panelWidth = (await panel.boundingBox())!.width;
      expect(Math.abs(panelWidth - controlWidth)).toBeLessThanOrEqual(1);
    });
  }
});
