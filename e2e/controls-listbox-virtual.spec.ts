import { expect, Locator, Page, test } from '@playwright/test';
import { collectErrors, example, openPage } from './support';

const SINGLE = 'Large list with virtual scroll';
const GROUPS = 'Large list with groups and checkboxes';
const ROW = 40; // virtualItemSize of the first example (the default)

const orderNumber = (n: number) => `ORD-${String(n).padStart(5, '0')}`;

/** True when `aria-activedescendant` names an element that is in the DOM. */
async function activeElementExists(list: Locator): Promise<boolean> {
  return list.evaluate((el) => {
    const id = el.getAttribute('aria-activedescendant');
    return !!id && !!document.getElementById(id);
  });
}

async function openSingle(page: Page) {
  await openPage(page, '/controls/listbox', 'Listbox');
  const live = example(page, SINGLE);
  const list = live.getByRole('listbox', { name: 'Invoice number' });
  await expect(list.getByRole('option').first()).toBeVisible();
  return { live, list, status: live.getByRole('status') };
}

async function openGroups(page: Page) {
  await openPage(page, '/controls/listbox', 'Listbox');
  const live = example(page, GROUPS);
  const list = live.getByRole('listbox', { name: 'Shipments' });
  await expect(list.getByRole('option').first()).toBeVisible();
  return { live, list, status: live.getByRole('status') };
}

test.describe('listbox with virtual scroll: 10,000 options', () => {
  test('keeps far fewer option elements in the DOM than options', async ({ page }) => {
    const errors = collectErrors(page);
    const { list } = await openSingle(page);
    const count = await list.getByRole('option').count();
    expect(count).toBeGreaterThan(5);
    expect(count).toBeLessThan(40);
    expect(await list.evaluate((el) => el.querySelectorAll('*').length)).toBeLessThan(400);
    await expect(list).toHaveAttribute('tabindex', '0');
    expect(errors).toEqual([]);
  });

  test('gives each rendered option the set size and its position in the whole list', async ({
    page,
  }) => {
    const { list } = await openSingle(page);
    const first = list.getByRole('option').first();
    await expect(first).toHaveText(orderNumber(1));
    await expect(first).toHaveAttribute('aria-setsize', '10000');
    await expect(first).toHaveAttribute('aria-posinset', '1');
    await expect(list.getByRole('option').nth(2)).toHaveAttribute('aria-posinset', '3');

    await list.evaluate((el, top) => (el.scrollTop = top), ROW * 5000);
    const later = list.getByRole('option', { name: orderNumber(5001), exact: true });
    await expect(later).toHaveAttribute('aria-posinset', '5001');
    await expect(later).toHaveAttribute('aria-setsize', '10000');
  });

  test('wheel scrolling shows later options and removes earlier ones', async ({ page }) => {
    const { list } = await openSingle(page);
    await expect(list.getByRole('option', { name: orderNumber(1), exact: true })).toBeVisible();
    await list.hover();
    await page.mouse.wheel(0, ROW * 400);
    await expect(list.getByRole('option', { name: orderNumber(400), exact: true })).toBeVisible();
    await expect(list.getByRole('option', { name: orderNumber(1), exact: true })).toHaveCount(0);
    expect(await list.getByRole('option').count()).toBeLessThan(40);
  });

  test('End goes to the last option, activates and chooses it, and keeps the focus', async ({
    page,
  }) => {
    const { list, status } = await openSingle(page);
    await list.focus();
    await page.keyboard.press('End');
    await expect(status).toHaveText(`Invoice: ${orderNumber(10000)}`);
    const last = list.getByRole('option', { name: orderNumber(10000), exact: true });
    await expect(last).toBeVisible();
    await expect(last).toHaveClass(/star-listbox__option--active/);
    await expect(last).toHaveAttribute('aria-selected', 'true');
    await expect(last).toHaveAttribute('aria-posinset', '10000');
    await expect(list).toHaveAttribute('aria-activedescendant', /star-listbox-.*-9999$/);
    expect(await activeElementExists(list)).toBe(true);
    await expect(list).toBeFocused();

    await page.keyboard.press('Home');
    await expect(status).toHaveText(`Invoice: ${orderNumber(1)}`);
    await expect(list.getByRole('option', { name: orderNumber(1), exact: true })).toBeVisible();
    await expect(list).toHaveAttribute('aria-activedescendant', /star-listbox-.*-0$/);
    await expect(list).toBeFocused();
  });

  test('arrow keys and Page keys move over options that are not drawn', async ({ page }) => {
    const { list, status } = await openSingle(page);
    await list.focus();
    await page.keyboard.press('End');
    await expect(status).toHaveText(`Invoice: ${orderNumber(10000)}`);
    await page.keyboard.press('ArrowUp');
    await expect(status).toHaveText(`Invoice: ${orderNumber(9999)}`);

    // Page up moves by the lines in view minus one.
    const page_ = await list.evaluate(
      (el, row) => Math.max(1, Math.floor(el.clientHeight / row) - 1),
      ROW,
    );
    await page.keyboard.press('PageUp');
    await expect(status).toHaveText(`Invoice: ${orderNumber(9999 - page_)}`);
    await expect(
      list.getByRole('option', { name: orderNumber(9999 - page_), exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Home');
    await page.keyboard.press('PageDown');
    await expect(status).toHaveText(`Invoice: ${orderNumber(1 + page_)}`);
    await page.keyboard.press('PageDown');
    await expect(status).toHaveText(`Invoice: ${orderNumber(1 + 2 * page_)}`);
    expect(await activeElementExists(list)).toBe(true);
    await expect(list).toBeFocused();

    // Many presses in a row reach rows that were never drawn before.
    await page.keyboard.press('Home');
    for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowDown');
    await expect(status).toHaveText(`Invoice: ${orderNumber(31)}`);
    await expect(list.getByRole('option', { name: orderNumber(31), exact: true })).toBeVisible();
    expect(await activeElementExists(list)).toBe(true);
  });

  test('type-ahead finds an option far down the list', async ({ page }) => {
    const { list, status } = await openSingle(page);
    await list.focus();
    await page.keyboard.type('ord-07500');
    await expect(status).toHaveText(`Invoice: ${orderNumber(7500)}`);
    const option = list.getByRole('option', { name: orderNumber(7500), exact: true });
    await expect(option).toBeVisible();
    await expect(option).toHaveAttribute('aria-posinset', '7500');
    await expect(list).toHaveAttribute('aria-activedescendant', /star-listbox-.*-7499$/);
    expect(await activeElementExists(list)).toBe(true);
    await expect(list).toBeFocused();
  });

  test('filter narrows the list and resets the scroll position', async ({ page }) => {
    const { live, list } = await openSingle(page);
    const search = live.getByRole('searchbox', { name: 'Search' });
    await list.evaluate((el, top) => (el.scrollTop = top), ROW * 3000);
    await expect(list.getByRole('option', { name: orderNumber(3001), exact: true })).toBeVisible();

    await search.fill('ORD-0999');
    await expect(list.getByRole('option')).toHaveCount(10);
    await expect(list.getByRole('option').first()).toHaveText(orderNumber(9990));
    await expect(list.getByRole('option').first()).toHaveAttribute('aria-setsize', '10');
    await expect(list.getByRole('option').last()).toHaveAttribute('aria-posinset', '10');
    expect(await list.evaluate((el) => el.scrollTop)).toBe(0);

    await search.fill('no such number');
    await expect(list.getByRole('option')).toHaveCount(0);
    await expect(live.locator('.star-listbox__empty')).toBeVisible();

    await search.fill('');
    await expect(list.getByRole('option').first()).toHaveText(orderNumber(1));
    await expect(list.getByRole('option').first()).toHaveAttribute('aria-setsize', '10000');
    expect(await list.evaluate((el) => el.scrollTop)).toBe(0);
  });

  test('the choice survives scrolling away and back', async ({ page }) => {
    const { list, status } = await openSingle(page);
    await list.getByRole('option', { name: orderNumber(3), exact: true }).click();
    await expect(status).toHaveText(`Invoice: ${orderNumber(3)}`);
    await expect(list).toBeFocused();

    await list.evaluate((el, top) => (el.scrollTop = top), ROW * 6000);
    await expect(list.getByRole('option', { name: orderNumber(6001), exact: true })).toBeVisible();
    await expect(list.getByRole('option', { name: orderNumber(3), exact: true })).toHaveCount(0);
    await expect(status).toHaveText(`Invoice: ${orderNumber(3)}`);

    await list.evaluate((el) => (el.scrollTop = 0));
    const back = list.getByRole('option', { name: orderNumber(3), exact: true });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('listbox with virtual scroll: groups, checkboxes, disabled options', () => {
  test('draws group headings as rows and describes options by their heading', async ({ page }) => {
    const { list } = await openGroups(page);
    const heading = list.locator('.star-listbox__group').first();
    await expect(heading).toHaveText('Central');
    const first = list.getByRole('option').first();
    await expect(first).toHaveText('Shipment 1');
    await expect(first).toHaveAttribute('aria-describedby', (await heading.getAttribute('id'))!);
    // The set size counts options, not headings. Region groups are ordered by first appearance.
    await expect(first).toHaveAttribute('aria-setsize', '10000');
    await expect(first).toHaveAttribute('aria-posinset', '1');
    await expect(list.getByRole('option').nth(1)).toHaveAttribute('aria-posinset', '2');
    await expect(list).toHaveAttribute('aria-multiselectable', 'true');
    // Headings and options have the same height (virtualItemSize 36).
    const heights = await list.evaluate((el) =>
      [el.querySelector('.star-listbox__group'), el.querySelector('.star-listbox__option')].map(
        (row) => row!.getBoundingClientRect().height,
      ),
    );
    expect(heights).toEqual([36, 36]);
  });

  test('Space toggles, a disabled option is not chosen, the choice survives scrolling', async ({
    page,
  }) => {
    const { list, status } = await openGroups(page);
    await expect(status).toHaveText('Picked: 0');
    await list.focus();
    await page.keyboard.press('Space');
    await expect(status).toHaveText('Picked: 1');
    const first = list.getByRole('option', { name: 'Shipment 1', exact: true });
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(first.locator('.star-check__box')).toBeVisible();

    // End reaches the last option: it is held (disabled), so it is active but not chosen.
    await page.keyboard.press('End');
    const last = list.getByRole('option', { name: 'Shipment 10000', exact: true });
    await expect(last).toBeVisible();
    await expect(last).toHaveAttribute('aria-disabled', 'true');
    await expect(last).toHaveClass(/star-listbox__option--active/);
    await expect(last).toHaveAttribute('aria-posinset', '10000');
    // The heading of the group is 2,000 rows away and not in the DOM, so no dangling reference.
    await expect(last).not.toHaveAttribute('aria-describedby');
    expect(await activeElementExists(list)).toBe(true);
    await page.keyboard.press('Space');
    await expect(status).toHaveText('Picked: 1');
    await expect(list).toBeFocused();

    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Space');
    await expect(status).toHaveText('Picked: 2');
    await expect(list.getByRole('option', { name: 'Shipment 9995', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.keyboard.press('Home');
    await expect(list.locator('.star-listbox__group').first()).toBeInViewport();
    await expect(first).toBeVisible();
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(status).toHaveText('Picked: 2');

    // A click toggles too: clicking the chosen option clears it.
    await first.click();
    await expect(status).toHaveText('Picked: 1');
    await expect(list).toBeFocused();
  });

  test('the option template draws the rows', async ({ page }) => {
    const { list } = await openGroups(page);
    await expect(list.getByRole('option').first().locator('.star-listbox__label')).toHaveText(
      'Shipment 1',
    );
  });

  test('stays usable when the first group row is reached from below', async ({ page }) => {
    const { list } = await openGroups(page);
    await list.focus();
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    const heading = list.locator('.star-listbox__group').first();
    await expect(heading).toHaveText('Central');
    await expect(heading).toBeInViewport();
    expect(await list.evaluate((el) => el.scrollTop)).toBe(0);
    expect(await activeElementExists(list)).toBe(true);
  });
});

test.describe('listbox with virtual scroll: unchanged defaults', () => {
  test('the other examples keep a plain list with all options and no set size', async ({
    page,
  }) => {
    await openPage(page, '/controls/listbox', 'Listbox');
    const list = example(page, 'Single choice').getByRole('listbox', { name: 'Queue' });
    await expect(list.getByRole('option')).toHaveCount(5);
    await expect(list.getByRole('option').first()).not.toHaveAttribute('aria-setsize', /.*/);
    expect(await list.evaluate((el) => el.tagName)).toBe('UL');
  });
});
