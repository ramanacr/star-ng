import { expect, Locator, Page, test } from '@playwright/test';
import { collectErrors, example, openPage } from './support';

// Select, multi-select and autocomplete with `virtualScroll` and 10,000 options. The panel is a
// popover placed by the CDK overlay, so it is found from the page and not from the example.

const ROW = 40; // virtualItemSize (the default)
const listbox = (page: Page, name: string) => page.getByRole('listbox', { name, exact: true });

/** True when `aria-activedescendant` names an element that is in the DOM. */
const namesExistingElement = (holder: Locator) =>
  holder.evaluate((el) => {
    const id = el.getAttribute('aria-activedescendant');
    return !id || !!document.getElementById(id);
  });

/** Every `aria-activedescendant` and `aria-describedby` on the page names an element. */
const referencesExist = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[aria-activedescendant], [aria-describedby]')].every((el) =>
      ['aria-activedescendant', 'aria-describedby']
        .map((name) => el.getAttribute(name))
        .filter((id): id is string => !!id)
        .every((id) => !!document.getElementById(id)),
    ),
  );

/** How many pixels of an element are outside the scrolling list (0 = fully in view). */
const clipped = (list: Locator, option: Locator) =>
  Promise.all([list.boundingBox(), option.boundingBox()]).then(([l, o]) =>
    l && o ? Math.max(0, l.y - o.y) + Math.max(0, o.y + o.height - (l.y + l.height)) : -1,
  );

const scrollTopOf = (list: Locator) => list.evaluate((el) => el.scrollTop);

/** Asserts that the active option is rendered, fully in view, and named by the focused control. */
async function expectActive(page: Page, list: Locator, text: string, holder: Locator) {
  const active = list.locator('.star-listbox__option--active');
  await expect(active).toHaveText(text);
  await expect.poll(() => clipped(list, active)).toBe(0);
  await expect.poll(() => namesExistingElement(holder)).toBe(true);
  await expect(holder).toHaveAttribute('aria-activedescendant', /.+/);
  expect(await referencesExist(page)).toBe(true);
}

test.describe('select with virtual scroll: 10,000 options in groups', () => {
  const open = async (page: Page) => {
    await openPage(page, '/controls/select', 'Select');
    const live = example(page, 'Large list with groups');
    const select = live.getByRole('combobox', { name: 'Shipment' });
    await select.click();
    const list = listbox(page, 'Shipment');
    await expect(list.getByRole('option').first()).toBeVisible();
    return {
      live,
      select,
      list,
      search: page.locator('.star-panel__filter').getByRole('searchbox'),
    };
  };

  test('keeps few options in the DOM and gives each its place in the whole list', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const { list } = await open(page);
    expect(await list.getByRole('option').count()).toBeLessThan(40);
    const first = list.getByRole('option').first();
    await expect(first).toHaveAttribute('aria-setsize', '10000');
    await expect(first).toHaveAttribute('aria-posinset', '1');
    await expect(list.locator('.star-listbox__group').first()).toHaveText('North');
    await expect(first).toHaveAttribute(
      'aria-describedby',
      (await list.locator('.star-listbox__group').first().getAttribute('id'))!,
    );
    expect(errors).toEqual([]);
  });

  test('End, Home, Page keys and arrows reach options that are not drawn, fully in view', async ({
    page,
  }) => {
    const { list, search } = await open(page);
    await page.keyboard.press('End');
    await expectActive(page, list, 'Shipment 10000', search);
    await expect(list.getByRole('option').last()).toHaveAttribute('aria-posinset', '10000');
    // The heading of the last group is 2,000 rows away: no reference to it.
    await expect(list.getByRole('option').last()).not.toHaveAttribute('aria-describedby');

    const lines = await list.evaluate((el, row) => Math.floor(el.clientHeight / row), ROW);
    await page.keyboard.press('PageUp');
    await expectActive(page, list, `Shipment ${10000 - (lines - 1)}`, search);
    await page.keyboard.press('Home');
    await expectActive(page, list, 'Shipment 1', search);
    await page.keyboard.press('PageDown');
    await expectActive(page, list, `Shipment ${1 + (lines - 1)}`, search);

    for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowDown');
    await expectActive(page, list, `Shipment ${1 + (lines - 1) + 40}`, search);
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowUp');
    await expectActive(page, list, `Shipment ${1 + (lines - 1) + 30}`, search);
  });

  test('aria-activedescendant never names an option that scrolled out of the DOM', async ({
    page,
  }) => {
    const { list, select, search } = await open(page);
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
    await expectActive(page, list, 'Shipment 6', search);

    // The scroll bar moves the list. The pointer stays away: it would make another option active.
    await list.evaluate((el, top) => (el.scrollTop = top), ROW * 3000);
    await expect(list.getByRole('option', { name: 'Shipment 6', exact: true })).toHaveCount(0);
    await expect.poll(() => referencesExist(page)).toBe(true);
    await expect(search).not.toHaveAttribute('aria-activedescendant', /.+/);
    await expect(select).not.toHaveAttribute('aria-activedescendant', /.+/);

    // The next key brings the active option back and names it again.
    await page.keyboard.press('ArrowDown');
    await expectActive(page, list, 'Shipment 7', search);
  });

  test('a new filter result starts at the top of the list', async ({ page }) => {
    const { list, search } = await open(page);
    await list.hover();
    await page.mouse.wheel(0, ROW * 3000);
    await expect(list.getByRole('option', { name: 'Shipment 3001', exact: true })).toBeVisible();

    // 1,112 shipments start with "Shipment 1": the list is still long.
    await search.fill('Shipment 1');
    await expect.poll(() => scrollTopOf(list)).toBe(0);
    const first = list.getByRole('option').first();
    await expect(first).toHaveText('Shipment 1');
    await expect(first).toHaveAttribute('aria-setsize', '1112');
    await expect.poll(() => clipped(list, first)).toBe(0);

    await search.fill('Shipment 99999');
    await expect(list.getByRole('option')).toHaveCount(0);
    await expect(list.locator('.star-listbox__empty')).toBeVisible();
  });

  test('the chosen option is in view when the panel opens again', async ({ page }) => {
    const { live, select, list } = await open(page);
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(select).toContainText('Shipment 9999');
    await expect(live.getByRole('status')).toHaveText('Shipment: 9999');

    await select.focus();
    await page.keyboard.press('Enter');
    const chosen = list.getByRole('option', { name: 'Shipment 9999', exact: true });
    await expect(chosen).toHaveClass(/star-listbox__option--active/);
    await expect(chosen).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => clipped(list, chosen)).toBe(0);
    expect(await list.getByRole('option').count()).toBeLessThan(40);
  });

  test('type-ahead with a space reaches an option that is not drawn', async ({ page }) => {
    await openPage(page, '/controls/select', 'Select');
    const select = example(page, 'Large list with groups').getByRole('combobox', {
      name: 'Shipment',
    });
    await select.focus();
    await page.keyboard.type('Shipment 7500', { delay: 5 });
    await expect(select).toContainText('Shipment 7500');
    await expect(select).toHaveAttribute('aria-expanded', 'false');
  });

  test('works with a right-to-left page', async ({ page }) => {
    await openPage(page, '/controls/select', 'Select');
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    const select = example(page, 'Large list with groups').getByRole('combobox', {
      name: 'Shipment',
    });
    await select.click();
    const list = listbox(page, 'Shipment');
    await expect(list.getByRole('option').first()).toBeVisible();
    const search = page.locator('.star-panel__filter').getByRole('searchbox');
    await page.keyboard.press('End');
    await expectActive(page, list, 'Shipment 10000', search);
    const edges = await page.evaluate(() => {
      const control = document.querySelector('[aria-label="Shipment"][role=combobox]')!;
      return [
        control.closest('.star-select__control')!.getBoundingClientRect().right,
        document.querySelector('.star-panel')!.getBoundingClientRect().right,
      ];
    });
    expect(Math.abs(edges[0] - edges[1])).toBeLessThanOrEqual(2);
  });
});

test.describe('multi-select with virtual scroll: 10,000 options', () => {
  const open = async (page: Page) => {
    await openPage(page, '/controls/multi-select', 'Multi-select');
    const live = example(page, 'Large list');
    const select = live.getByRole('combobox', { name: 'Parcels' });
    await select.click();
    const list = listbox(page, 'Parcels');
    await expect(list.getByRole('option').first()).toBeVisible();
    return { live, select, list, status: live.getByRole('status') };
  };

  test('keeps few options in the DOM, with check boxes and the set size', async ({ page }) => {
    const { list } = await open(page);
    expect(await list.getByRole('option').count()).toBeLessThan(40);
    const first = list.getByRole('option').first();
    await expect(first).toHaveAttribute('aria-setsize', '10000');
    await expect(first).toHaveAttribute('aria-posinset', '1');
    await expect(first.locator('.star-check__box')).toBeVisible();
    await expect(list).toHaveAttribute('aria-multiselectable', 'true');
  });

  test('End, Page keys and type-ahead reach options that are not drawn, and Space still toggles', async ({
    page,
  }) => {
    const { list, select, status } = await open(page);
    await page.keyboard.press('End');
    await expectActive(page, list, 'Parcel 10000', select);
    await page.keyboard.press('Home');
    await page.keyboard.press('PageDown');
    const lines = await list.evaluate((el, row) => Math.floor(el.clientHeight / row), ROW);
    await expectActive(page, list, `Parcel ${1 + (lines - 1)}`, select);

    // Space is part of the typed text and does not choose anything.
    await page.keyboard.type('Parcel 7500', { delay: 5 });
    await expectActive(page, list, 'Parcel 7500', select);
    await expect(status).toHaveText('Parcels: 0');

    // After a pause, Space chooses the active option.
    await page.waitForTimeout(600);
    await page.keyboard.press('Space');
    await expect(status).toHaveText('Parcels: 1');
    await expect(list.getByRole('option', { name: 'Parcel 7500', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('aria-activedescendant never names an option that scrolled out of the DOM', async ({
    page,
  }) => {
    const { list, select } = await open(page);
    await page.keyboard.press('ArrowDown');
    await expectActive(page, list, 'Parcel 2', select);
    await list.hover();
    await page.mouse.wheel(0, ROW * 3000);
    await expect(list.getByRole('option', { name: 'Parcel 2', exact: true })).toHaveCount(0);
    await expect.poll(() => referencesExist(page)).toBe(true);
    await expect(select).not.toHaveAttribute('aria-activedescendant', /.+/);
  });

  test('select all chooses all 10,000 options, a click toggles one', async ({ page }) => {
    const { list, status } = await open(page);
    const all = page.locator('.star-panel__toggle-all');
    await all.click();
    await expect(status).toHaveText('Parcels: 10000');
    await expect(all).toHaveAttribute('aria-checked', 'true');
    const first = list.getByRole('option').first();
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await first.click();
    await expect(status).toHaveText('Parcels: 9999');
    await expect(all).toHaveAttribute('aria-checked', 'mixed');
    await all.click();
    await expect(status).toHaveText('Parcels: 10000');
    await all.click();
    await expect(status).toHaveText('Parcels: 0');
    await expect(all).toHaveAttribute('aria-checked', 'false');
  });
});

test.describe('autocomplete with virtual scroll: 10,000 options', () => {
  const open = async (page: Page) => {
    await openPage(page, '/controls/autocomplete', 'Autocomplete');
    const live = example(page, 'Large list');
    const input = live.getByRole('combobox', { name: 'Ticket' });
    await live.getByRole('button', { name: /show options/i }).click();
    const list = listbox(page, 'Ticket');
    await expect(list.getByRole('option').first()).toBeVisible();
    return { live, input, list };
  };

  test('lists a window of all options with the set size', async ({ page }) => {
    const { list } = await open(page);
    expect(await list.getByRole('option').count()).toBeLessThan(40);
    const first = list.getByRole('option').first();
    await expect(first).toHaveAttribute('aria-setsize', '10000');
    await expect(first).toHaveAttribute('aria-posinset', '1');
  });

  test('arrow keys and Page keys reach options that are not drawn, fully in view', async ({
    page,
  }) => {
    const { list, input } = await open(page);
    await input.focus();
    await page.keyboard.press('ArrowDown');
    await expectActive(page, list, 'Ticket 00001', input);
    const lines = await list.evaluate((el, row) => Math.floor(el.clientHeight / row), ROW);
    for (let i = 0; i < 60; i++) await page.keyboard.press('ArrowDown');
    await expectActive(page, list, 'Ticket 00061', input);
    await page.keyboard.press('PageDown');
    await expectActive(page, list, `Ticket ${String(61 + (lines - 1)).padStart(5, '0')}`, input);
    await page.keyboard.press('PageUp');
    await expectActive(page, list, 'Ticket 00061', input);
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('Ticket 00061');
  });

  test('aria-activedescendant never names an option that scrolled out of the DOM', async ({
    page,
  }) => {
    const { list, input } = await open(page);
    await input.focus();
    await page.keyboard.press('ArrowDown');
    await expectActive(page, list, 'Ticket 00001', input);
    await list.hover();
    await page.mouse.wheel(0, ROW * 3000);
    await expect(list.getByRole('option', { name: 'Ticket 00001', exact: true })).toHaveCount(0);
    await expect.poll(() => referencesExist(page)).toBe(true);
    await expect(input).not.toHaveAttribute('aria-activedescendant', /.+/);
  });

  test('typing shows the new result from the top of the list', async ({ page }) => {
    const { list, input } = await open(page);
    await list.hover();
    await page.mouse.wheel(0, ROW * 3000);
    await expect(list.getByRole('option', { name: 'Ticket 03001', exact: true })).toBeVisible();

    // 9,999 tickets contain "Ticket 0": the list is still long.
    await input.fill('Ticket 0');
    await expect.poll(() => scrollTopOf(list)).toBe(0);
    const first = list.getByRole('option').first();
    await expect(first).toHaveText('Ticket 00001');
    await expect.poll(() => clipped(list, first)).toBe(0);

    await input.fill('Ticket 075');
    await expect(list.getByRole('option').first()).toHaveAttribute('aria-setsize', '100');
    expect(await list.getByRole('option').count()).toBeLessThan(40);
  });
});
