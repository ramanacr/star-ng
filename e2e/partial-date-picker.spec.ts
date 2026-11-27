import { expect, Locator, Page, test } from '@playwright/test';
import { collectErrors, example, openPage as openDocsPage } from './support';

/**
 * `star-partial-date-picker` on the date picker page: typed entry of a full date, a month and
 * year and a year, the day, month and year views of the popup, invalid text, the read-only and
 * disabled states, Signal Forms with a start / stop check, and right-to-left.
 */

/** Opens the date picker page and waits until the partial date pickers are hydrated. */
async function openPage(page: Page): Promise<void> {
  await openDocsPage(page, '/controls/date-picker', 'Date picker');
  await expect(page.locator('star-partial-date-picker[ngh]')).toHaveCount(0, { timeout: 15_000 });
}

const panel = (page: Page) => page.getByRole('dialog', { name: 'Choose date' });
const precision = (page: Page) => panel(page).getByRole('radiogroup', { name: 'Precision' });
const pick = (page: Page, value: string | number) =>
  panel(page).locator(`.star-calendar__pick[data-pick="${value}"]`);
const day = (page: Page, iso: string) => panel(page).locator(`[data-date="${iso}"]`);

async function typeText(input: Locator, text: string, key = 'Enter'): Promise<void> {
  await input.fill(text);
  await input.press(key);
}

test.describe('partial date picker', () => {
  test('typed entry keeps the precision and shows only the known parts', async ({ page }) => {
    const errors = collectErrors(page);
    await openPage(page);
    const live = example(page, 'Partial dates');
    const input = live.getByRole('textbox', { name: 'First noticed' });
    const output = live.getByRole('status');
    await expect(input).toHaveValue('Mar-2026');
    await expect(input).toHaveAttribute('placeholder', 'dd-MMM-yyyy, MMM-yyyy, yyyy');

    await typeText(input, '14-APR-2026');
    await expect(input).toHaveValue('14-Apr-2026');
    await expect(output).toContainText('{"year":2026,"month":4,"day":14}');

    await typeText(input, 'MAR-2026', 'Tab');
    await expect(input).toHaveValue('Mar-2026');
    await expect(output).toContainText('{"year":2026,"month":3,"day":null}');

    await typeText(input, '1981');
    await expect(input).toHaveValue('1981');
    await expect(output).toContainText('{"year":1981,"month":null,"day":null}');

    // ISO text is read too.
    await typeText(input, '2026-04');
    await expect(input).toHaveValue('Apr-2026');

    // The second field takes a month and year or a year only, in the en-GB order.
    const service = live.getByRole('textbox', { name: 'Service month or year' });
    await expect(service).toHaveValue('2025');
    await typeText(service, '04/2026');
    await expect(service).toHaveValue('04/2026');
    await typeText(service, '14/04/2026');
    await expect(service).toHaveValue('04/2026');
    await expect(output).toContainText('Service: {"year":2026,"month":4,"day":null}');
    expect(errors).toEqual([]);
  });

  test('the popup opens in the view of the precision and picks a day, a month or a year', async ({
    page,
  }) => {
    await openPage(page);
    const live = example(page, 'Partial dates');
    const input = live.getByRole('textbox', { name: 'First noticed' });

    // Month and year: the month view, with the focus on March.
    await input.focus();
    await page.keyboard.press('ArrowDown');
    await expect(precision(page)).toBeVisible();
    await expect(precision(page).getByRole('radio', { name: 'Month and year' })).toBeChecked();
    await expect(pick(page, 2)).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(pick(page, 3)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(panel(page)).toBeHidden();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('Apr-2026');

    // Year only: the year view.
    await page.keyboard.press('ArrowDown');
    await precision(page).getByRole('radio', { name: 'Year only' }).check();
    await expect(panel(page).locator('[data-date]')).toHaveCount(0);
    await pick(page, 2024).click();
    await expect(input).toHaveValue('2024');

    // Full date: the day view, in January 2024, without a chosen day.
    await input.focus();
    await page.keyboard.press('ArrowDown');
    await expect(precision(page).getByRole('radio', { name: 'Year only' })).toBeChecked();
    await precision(page).getByRole('radio', { name: 'Full date' }).check();
    await expect(panel(page).locator('[aria-selected="true"]')).toHaveCount(0);
    await day(page, '2024-01-10').click();
    await expect(input).toHaveValue('10-Jan-2024');

    // Escape closes the popup and leaves the value.
    await page.keyboard.press('ArrowDown');
    await expect(day(page, '2024-01-10')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();
    await expect(input).toHaveValue('10-Jan-2024');
  });

  test('a picker limited to months has two precisions', async ({ page }) => {
    await openPage(page);
    const input = example(page, 'Partial dates').getByRole('textbox', {
      name: 'Service month or year',
    });
    await input.focus();
    await page.keyboard.press('ArrowDown');
    await expect(precision(page).getByRole('radio')).toHaveCount(2);
    await expect(precision(page).getByRole('radio', { name: 'Year only' })).toBeChecked();
    await precision(page).getByRole('radio', { name: 'Month and year' }).check();
    await pick(page, 10).click();
    await expect(input).toHaveValue('11/2025');
  });

  test('impossible and out-of-range text is invalid', async ({ page }) => {
    await openPage(page);
    const first = example(page, 'Partial dates').getByRole('textbox', { name: 'First noticed' });
    // Without keepInvalid the text goes back to the value.
    await typeText(first, '13-2026', 'Tab');
    await expect(first).toHaveValue('Mar-2026');
    await expect(first).not.toHaveAttribute('aria-invalid', /.*/);

    const live = example(page, 'Partial date states and limits');
    await expect(live.getByRole('textbox', { name: 'Impossible month' })).toHaveValue('');
    await expect(live.getByRole('textbox', { name: 'Impossible month' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );

    const limited = live.getByRole('textbox', { name: 'Between 15 March and 10 June 2026' });
    await typeText(limited, '31-Apr-2026', 'Tab');
    await expect(limited).toHaveValue('31-Apr-2026');
    await expect(limited).toHaveAttribute('aria-invalid', 'true');
    await typeText(limited, 'Feb-2026', 'Tab');
    await expect(limited).toHaveAttribute('aria-invalid', 'true');
    await expect(live.getByRole('status')).toHaveText('Limited: none');
    // minDate is 15 March 2026: March as a whole is allowed, 14 March is not.
    await typeText(limited, 'Mar-2026', 'Tab');
    await expect(limited).not.toHaveAttribute('aria-invalid', /.*/);
    await expect(live.getByRole('status')).toHaveText(
      'Limited: {"year":2026,"month":3,"day":null}',
    );
    await typeText(limited, '14-Mar-2026', 'Tab');
    await expect(limited).toHaveAttribute('aria-invalid', 'true');

    // The calendar disables the months outside the limits.
    await typeText(limited, '2026', 'Tab');
    await limited.focus();
    await page.keyboard.press('ArrowDown');
    await precision(page).getByRole('radio', { name: 'Month and year' }).check();
    await expect(pick(page, 1)).toBeDisabled();
    await expect(pick(page, 2)).toBeEnabled();
    await expect(pick(page, 5)).toBeEnabled();
    await expect(pick(page, 6)).toBeDisabled();
  });

  test('read-only and disabled fields do not open', async ({ page }) => {
    await openPage(page);
    const live = example(page, 'Partial date states and limits');
    const readonly = live.getByRole('textbox', { name: 'Read-only partial date' });
    await expect(readonly).toHaveValue('Mar-2026');
    await expect(readonly).toHaveAttribute('readonly', '');
    await readonly.focus();
    await page.keyboard.press('ArrowDown');
    await expect(panel(page)).toHaveCount(0);

    const disabled = live.getByRole('textbox', { name: 'Disabled partial date' });
    await expect(disabled).toBeDisabled();
    await expect(disabled).toHaveValue('Mar-2026');
    await expect(
      live
        .locator('star-partial-date-picker', {
          has: page.getByRole('textbox', { name: 'Disabled partial date' }),
        })
        .getByRole('button', { name: 'Choose date' }),
    ).toBeDisabled();

    await expect(live.getByRole('textbox', { name: 'Full date' })).toHaveValue('14-Apr-2026');
    await expect(live.getByRole('textbox', { name: 'Year only' })).toHaveValue('1981');
    await expect(live.getByRole('textbox', { name: 'Empty' })).toHaveValue('');
  });

  test('Signal Forms: the stop is checked against the start', async ({ page }) => {
    await openPage(page);
    const live = example(page, 'Start and stop with partial dates');
    const start = live.getByRole('textbox', { name: 'Start', exact: true });
    const stop = live.getByRole('textbox', { name: 'Stop', exact: true });
    const output = live.getByRole('status');
    await expect(start).toHaveValue('Mar-2026');
    await expect(stop).toHaveValue('10-Feb-2026');
    await expect(output).toHaveText('Valid: false');

    // The error shows after the user leaves the field.
    await stop.focus();
    await stop.press('Tab');
    await expect(live.getByText('The stop is before the start.')).toBeVisible();
    await expect(stop).toHaveAttribute('aria-invalid', 'true');

    // A stop in 2026 is not before a start in March 2026 at the precision of a year.
    await typeText(stop, '2026', 'Tab');
    await expect(output).toHaveText('Valid: true');
    await expect(live.getByText('The stop is before the start.')).toHaveCount(0);
    await typeText(stop, '14-Apr-2026', 'Tab');
    await expect(output).toHaveText('Valid: true');

    // Clearing the start breaks the required check.
    await typeText(start, '', 'Tab');
    await expect(output).toHaveText('Valid: false');
    await expect(live.getByText('Enter the start.')).toBeVisible();
  });
});

test.describe('partial date picker, right-to-left', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('star-direction', 'rtl'));
  });

  test('the precision options run from right to left and the month view keys follow', async ({
    page,
  }) => {
    await openPage(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const input = example(page, 'Partial dates').getByRole('textbox', { name: 'First noticed' });
    await input.focus();
    await page.keyboard.press('ArrowDown');
    const box = async (name: string) =>
      (await precision(page).getByRole('radio', { name }).locator('..').boundingBox())!;
    const full = await box('Full date');
    const year = await box('Year only');
    expect(full.x).toBeGreaterThan(year.x);

    // In the month view, Arrow left is the next month.
    await expect(pick(page, 2)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(pick(page, 3)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('Apr-2026');
  });
});
