import { expect, Locator, Page, test } from '@playwright/test';
import { collectErrors, example, openPage } from './support';

// Every example uses fixed dates (November 2026) and an explicit locale, so the tests do not
// depend on today's date, on the browser locale or on the time zone. The one test of the
// Today button fixes the clock of the page at noon.

// The popup of a date picker is a native popover with role dialog; only one is open at a time.
const panel = (page: Page) => page.getByRole('dialog', { name: 'Choose date' });
// A day button of the open calendar, found by its ISO date.
// The scope is the page for a popup, or one example for an inline calendar (a docs page has several).
const day = (scope: Page | Locator, iso: string) =>
  scope.locator(`.star-calendar__day[data-date="${iso}"]`);

test.describe('date picker', () => {
  test('opens with the arrow key, moves in the grid, chooses with Enter and returns the focus', async ({
    page,
  }) => {
    await openPage(page, '/controls/date-picker', 'Date picker');
    const live = example(page, 'Single date');
    const input = live.getByRole('textbox', { name: 'Delivery date' });
    await expect(input).toHaveValue('17/11/2026');
    await expect(input).toHaveAttribute('aria-expanded', 'false');

    await input.focus();
    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await expect(panel(page)).toBeVisible();
    // The focus moves to the chosen day (Tuesday 17 November).
    await expect(day(page, '2026-11-17')).toBeFocused();
    await expect(day(page, '2026-11-17')).toHaveClass(/star-calendar__day--selected/);

    const moves: [string, string][] = [
      ['ArrowRight', '2026-11-18'],
      ['ArrowDown', '2026-11-25'],
      ['ArrowLeft', '2026-11-24'],
      ['Home', '2026-11-23'], // Monday of that week
      ['End', '2026-11-29'], // Sunday
      ['PageDown', '2026-12-29'],
      ['PageUp', '2026-11-29'],
      ['PageUp', '2026-10-29'],
      ['Shift+PageDown', '2027-10-29'],
      ['Shift+PageUp', '2026-10-29'],
      ['ArrowUp', '2026-10-22'],
    ];
    for (const [key, expected] of moves) {
      await page.keyboard.press(key);
      await expect(day(page, expected), `${key} moves to ${expected}`).toBeFocused();
    }

    await page.keyboard.press('Enter');
    await expect(panel(page)).toHaveCount(0);
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('22/10/2026');
    await expect(live.getByRole('status')).toHaveText('Delivery: 2026-10-22');
  });

  test('closes with Escape, keeps the value and returns the focus to the field', async ({
    page,
  }) => {
    await openPage(page, '/controls/date-picker', 'Date picker');
    const live = example(page, 'Single date');
    const input = live.getByRole('textbox', { name: 'Delivery date' });

    await live.getByRole('button', { name: 'Choose date' }).click();
    await expect(panel(page)).toBeVisible();
    await expect(day(page, '2026-11-17')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('17/11/2026');
    await expect(live.getByRole('status')).toHaveText('Delivery: 2026-11-17');
  });

  test('chooses a day with a click and clears the value with the Clear button', async ({
    page,
  }) => {
    await openPage(page, '/controls/date-picker', 'Date picker');
    const live = example(page, 'Single date');
    await live.getByRole('button', { name: 'Choose date' }).click();
    await day(page, '2026-11-20').click();
    await expect(panel(page)).toHaveCount(0);
    await expect(live.getByRole('status')).toHaveText('Delivery: 2026-11-20');

    await live.getByRole('button', { name: 'Choose date' }).click();
    await panel(page).getByRole('button', { name: 'Clear' }).click();
    await expect(live.getByRole('textbox', { name: 'Delivery date' })).toHaveValue('');
    await expect(live.getByRole('status')).toHaveText('Delivery: none');
  });

  test('the Today button chooses the day of the page clock', async ({ page }) => {
    // Noon, so no time zone moves the clock to another day.
    await page.clock.setFixedTime('2026-06-15T12:00:00');
    await openPage(page, '/controls/date-picker', 'Date picker');
    const live = example(page, 'Single date');
    await live.getByRole('button', { name: 'Choose date' }).click();
    await panel(page).getByRole('button', { name: 'Today' }).click();
    await expect(live.getByRole('status')).toHaveText('Delivery: 2026-06-15');
    await expect(live.getByRole('textbox', { name: 'Delivery date' })).toHaveValue('15/06/2026');
  });

  test('reads typed text: locale order, ISO text, and reverts invalid text', async ({ page }) => {
    await openPage(page, '/controls/date-picker', 'Date picker');
    const live = example(page, 'Typed input and format');
    const input = live.getByRole('textbox', { name: 'Invoice date', exact: true });
    const status = live.getByRole('status');
    await expect(input).toHaveValue('17/11/2026');

    // en-GB order is day, month, year; Enter applies the text.
    await input.fill('20/11/2026');
    await input.press('Enter');
    await expect(status).toHaveText('Invoice: 2026-11-20');
    await expect(input).toHaveValue('20/11/2026');

    // ISO text applies when the field loses the focus; other separators and a short year work.
    await input.fill('2026-12-01');
    await input.blur();
    await expect(status).toHaveText('Invoice: 2026-12-01');
    await expect(input).toHaveValue('01/12/2026');
    await input.fill('05.01.27');
    await input.press('Enter');
    await expect(status).toHaveText('Invoice: 2027-01-05');

    // A day that does not exist and text that is not a date go back to the last value.
    await input.fill('31/02/2027');
    await input.press('Enter');
    await expect(status).toHaveText('Invoice: 2027-01-05');
    await expect(input).toHaveValue('05/01/2027');
    await input.fill('tomorrow');
    await input.blur();
    await expect(status).toHaveText('Invoice: 2027-01-05');
    await expect(input).toHaveValue('05/01/2027');

    // Empty text clears the value.
    await input.fill('');
    await input.press('Enter');
    await expect(status).toHaveText('Invoice: none');
  });

  test('a pick-only field does not take typing and opens on a click', async ({ page }) => {
    await openPage(page, '/controls/date-picker', 'Date picker');
    const input = example(page, 'Typed input and format').getByRole('textbox', {
      name: 'Invoice date, pick only',
    });
    await expect(input).toHaveJSProperty('readOnly', true);
    await input.click();
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expect(input).toBeFocused();
  });

  test('chooses a range with two clicks and swaps the ends when the second click is earlier', async ({
    page,
  }) => {
    await openPage(page, '/controls/date-picker', 'Date picker');
    const live = example(page, 'Date range');
    const input = live.getByRole('textbox', { name: 'Booking range' });
    const status = live.getByRole('status');
    await expect(input).toHaveValue('09/11/2026 – 13/11/2026');
    await expect(status).toHaveText('Booking: 2026-11-09 to 2026-11-13');

    await live.getByRole('button', { name: 'Choose date' }).click();
    await expect(day(page, '2026-11-13')).toBeFocused();
    // The first click starts a new range. The popup stays open.
    await day(page, '2026-11-16').click();
    await expect(panel(page)).toBeVisible();
    await expect(status).toHaveText('Booking: 2026-11-16 to none');
    await day(page, '2026-11-20').click();
    await expect(panel(page)).toHaveCount(0);
    await expect(status).toHaveText('Booking: 2026-11-16 to 2026-11-20');
    await expect(input).toHaveValue('16/11/2026 – 20/11/2026');

    await live.getByRole('button', { name: 'Choose date' }).click();
    await expect(day(page, '2026-11-16')).toHaveClass(/star-calendar__day--selected/);
    await expect(day(page, '2026-11-18').locator('..')).toHaveClass(/star-calendar__cell--range/);
    await day(page, '2026-11-24').click();
    await day(page, '2026-11-18').click();
    await expect(status).toHaveText('Booking: 2026-11-18 to 2026-11-24');
  });

  test('chooses a range with the keyboard and types a range', async ({ page }) => {
    await openPage(page, '/controls/date-picker', 'Date picker');
    const live = example(page, 'Date range');
    const input = live.getByRole('textbox', { name: 'Booking range' });
    const status = live.getByRole('status');

    await input.focus();
    await page.keyboard.press('ArrowDown');
    await expect(day(page, '2026-11-13')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(day(page, '2026-11-14')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(panel(page)).toHaveCount(0);
    await expect(status).toHaveText('Booking: 2026-11-14 to 2026-11-21');
    await expect(input).toBeFocused();

    // Any dash or "to" between two dates; the earlier date becomes the start.
    await input.fill('25/11/2026 to 02/11/2026');
    await input.press('Enter');
    await expect(status).toHaveText('Booking: 2026-11-02 to 2026-11-25');
  });

  test('chooses several days, removes a day with a click, and stops at the limit', async ({
    page,
  }) => {
    await openPage(page, '/controls/date-picker', 'Date picker');
    const live = example(page, 'Several days');
    const status = live.getByRole('status');
    const input = live.getByRole('textbox', { name: 'Visit days' });
    await expect(input).toHaveValue('10/11/2026, 12/11/2026');
    await expect(status).toHaveText('Days: 2');

    await live.getByRole('button', { name: 'Choose date' }).click();
    await day(page, '2026-11-16').click();
    await day(page, '2026-11-12').click();
    // The popup stays open while the user chooses days.
    await expect(panel(page)).toBeVisible();
    await expect(status).toHaveText('Days: 2');
    await expect(input).toHaveValue('10/11/2026, 16/11/2026');
    await day(page, '2026-11-17').click();
    await day(page, '2026-11-18').click();
    await expect(status).toHaveText('Days: 4');
    // The limit is 4 days: a fifth day is not added.
    await day(page, '2026-11-19').click();
    await expect(status).toHaveText('Days: 4');
    await expect(day(page, '2026-11-19')).not.toHaveClass(/star-calendar__day--selected/);
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);

    await live.getByRole('button', { name: 'Clear' }).click();
    await expect(status).toHaveText('Days: 0');
  });

  test('minimum, maximum and disabled dates cannot be chosen', async ({ page }) => {
    await openPage(page, '/controls/date-picker', 'Date picker');
    const live = example(page, 'Minimum, maximum and disabled dates');
    const input = live.getByRole('textbox', { name: 'Pick-up date' });
    const status = live.getByRole('status');
    await expect(status).toHaveText('Pick-up: 2026-11-18');

    await input.focus();
    await page.keyboard.press('ArrowDown');
    await expect(day(page, '2026-11-18')).toBeFocused();
    const blocked = [
      '2026-11-02', // before minDate
      '2026-11-01', // Sunday, and before minDate
      '2026-11-14', // Saturday
      '2026-11-11', // in disabledDates
      '2026-11-28', // after maxDate
    ];
    for (const iso of blocked) {
      await expect(day(page, iso), iso).toHaveAttribute('aria-disabled', 'true');
    }
    await expect(day(page, '2026-11-10')).not.toHaveAttribute('aria-disabled', 'true');
    await expect(day(page, '2026-11-27')).not.toHaveAttribute('aria-disabled', 'true');

    // The keyboard reaches a day after the maximum, but Enter does not choose it.
    await page.keyboard.press('ArrowDown');
    await expect(day(page, '2026-11-25')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(day(page, '2026-12-02')).toBeFocused();
    await expect(day(page, '2026-12-02')).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Enter');
    await expect(panel(page)).toBeVisible();
    await expect(status).toHaveText('Pick-up: 2026-11-18');
    // A click on a blocked day does nothing either.
    await page.keyboard.press('PageUp');
    await day(page, '2026-11-14').click({ force: true });
    await expect(status).toHaveText('Pick-up: 2026-11-18');
    await page.keyboard.press('Escape');

    // Typed text follows the same rules.
    await input.fill('28/11/2026');
    await input.press('Enter');
    await expect(status).toHaveText('Pick-up: 2026-11-18');
    await expect(input).toHaveValue('18/11/2026');
    await input.fill('14/11/2026');
    await input.press('Enter');
    await expect(status).toHaveText('Pick-up: 2026-11-18');
    await input.fill('20/11/2026');
    await input.press('Enter');
    await expect(status).toHaveText('Pick-up: 2026-11-20');
  });

  test('the locale sets the first day of the week, the names and the week numbers', async ({
    page,
  }) => {
    await openPage(page, '/controls/date-picker', 'Date picker');
    const live = example(page, 'Locale and first day of the week');

    const german = live.getByRole('textbox', { name: 'Lieferdatum' });
    await expect(german).toHaveValue('17.11.2026');
    await expect(german).toHaveAttribute('placeholder', 'dd.mm.yyyy');
    await german.focus();
    await page.keyboard.press('ArrowDown');
    const weekdays = panel(page).locator('th[abbr]:not(.star-calendar__week)');
    await expect(weekdays.first()).toHaveAttribute('abbr', 'Montag');
    await expect(weekdays.last()).toHaveAttribute('abbr', 'Sonntag');
    // 17 November 2026 is in ISO week 47.
    await expect(
      panel(page)
        .locator('tbody tr', { has: day(page, '2026-11-17') })
        .locator('th'),
    ).toHaveText('47');
    await page.keyboard.press('Escape');

    const american = live.getByRole('textbox', { name: 'Delivery date (US)' });
    await expect(american).toHaveValue('11/17/2026');
    await american.focus();
    await page.keyboard.press('ArrowDown');
    await expect(panel(page).locator('table')).toHaveCount(2);
    await expect(panel(page).locator('caption')).toHaveText(['November 2026', 'December 2026']);
    await expect(panel(page).locator('table').first().locator('th[abbr]').first()).toHaveAttribute(
      'abbr',
      'Sunday',
    );
  });

  test('picks a date and a time, and keeps the time when another day is chosen', async ({
    page,
  }) => {
    await openPage(page, '/controls/date-picker', 'Date picker');
    const live = example(page, 'Date and time');
    const input = live.getByRole('textbox', { name: 'Meeting start' });
    const status = live.getByRole('status');
    await expect(input).toHaveValue('17/11/2026, 09:30');
    await expect(status).toHaveText('Meeting: 2026-11-17 09:30');

    // The popup is placed in the viewport: bring the example to the top so it has room.
    await live.evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await live.getByRole('button', { name: 'Choose date' }).click();
    await day(page, '2026-11-15').click();
    // With a time the popup stays open for the time field.
    await expect(panel(page)).toBeVisible();
    await expect(status).toHaveText('Meeting: 2026-11-15 09:30');
    await panel(page).getByLabel('Time', { exact: true }).fill('14:30');
    await expect(status).toHaveText('Meeting: 2026-11-15 14:30');
    await panel(page).getByRole('button', { name: 'Done' }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(input).toHaveValue('15/11/2026, 14:30');
    await expect(input).toBeFocused();

    // Typed date and time; a date without a time keeps the time of the value.
    await input.fill('20/11/2026, 08:15');
    await input.press('Enter');
    await expect(status).toHaveText('Meeting: 2026-11-20 08:15');
    await input.fill('21/11/2026');
    await input.press('Enter');
    await expect(status).toHaveText('Meeting: 2026-11-21 08:15');
    await input.fill('21/11/2026, 25:00');
    await input.press('Enter');
    await expect(status).toHaveText('Meeting: 2026-11-21 08:15');
  });

  test('chooses a month or a year', async ({ page }) => {
    await openPage(page, '/controls/date-picker', 'Date picker');
    const live = example(page, 'Month and year views');
    const month = live.getByRole('textbox', { name: 'Report month' });
    const year = live.getByRole('textbox', { name: 'Report year' });
    const status = live.getByRole('status');
    await expect(month).toHaveValue('11/2026');
    await expect(year).toHaveValue('2026');

    await month.focus();
    await page.keyboard.press('ArrowDown');
    const months = panel(page).getByRole('group', { name: 'Choose month' });
    await expect(months.getByRole('button', { name: 'Nov' })).toBeFocused();
    // Left moves one month, Up moves one row of three.
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    await expect(months.getByRole('button', { name: 'Jul' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(panel(page)).toHaveCount(0);
    await expect(month).toHaveValue('07/2026');
    await expect(status).toHaveText('Month: 2026-07-01, year: 2026-01-01');

    await year.focus();
    await page.keyboard.press('ArrowDown');
    const years = panel(page).getByRole('group', { name: 'Choose year' });
    await expect(years.getByRole('button', { name: '2026', exact: true })).toBeFocused();
    await years.getByRole('button', { name: '2020', exact: true }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(year).toHaveValue('2020');
    await expect(status).toHaveText('Month: 2026-07-01, year: 2020-01-01');

    // Typed text for a month and a year.
    await month.fill('3/2027');
    await month.press('Enter');
    await expect(status).toHaveText('Month: 2027-03-01, year: 2020-01-01');
    await year.fill('2031');
    await year.press('Enter');
    await expect(status).toHaveText('Month: 2027-03-01, year: 2031-01-01');
    await month.fill('13/2027');
    await month.press('Enter');
    await expect(month).toHaveValue('03/2027');
  });

  test('disabled and read-only pickers do not open', async ({ page }) => {
    await openPage(page, '/controls/date-picker', 'Date picker');
    const live = example(page, 'Sizes and states');
    await expect(live.getByRole('textbox', { name: 'Disabled date picker' })).toBeDisabled();
    await expect(live.getByRole('button', { name: 'Choose date' }).nth(1)).toBeDisabled();
    await expect(live.getByRole('button', { name: 'Choose date' }).nth(2)).toBeDisabled();
    await live.getByRole('textbox', { name: 'Read-only date picker' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(panel(page)).toHaveCount(0);
  });

  test('works with Signal Forms: shows the error after a visit and becomes valid', async ({
    page,
  }) => {
    await openPage(page, '/controls/date-picker', 'Date picker');
    const live = example(page, 'Signal Forms');
    const input = live.getByRole('textbox', { name: 'Required delivery date' });
    await expect(live.getByRole('status')).toHaveText('Valid: false');
    await expect(live.getByRole('alert')).toHaveCount(0);

    await input.focus();
    await input.blur();
    await expect(live.getByRole('alert')).toHaveText('Choose a delivery date.');
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    // The example has minDate 3 November 2026.
    await input.fill('01/11/2026');
    await input.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Valid: false');
    await input.fill('20/11/2026');
    await input.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Valid: true');
    await expect(live.getByRole('alert')).toHaveCount(0);
    await expect(input).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('has no console errors and names the days and the grid', async ({ page }) => {
    const errors = collectErrors(page);
    await openPage(page, '/controls/date-picker', 'Date picker');
    await example(page, 'Single date').getByRole('button', { name: 'Choose date' }).click();
    await expect(panel(page).getByRole('grid')).toBeVisible();
    // Every day has a full date as its name, and the grid has the month as its name.
    await expect(day(page, '2026-11-17')).toHaveAccessibleName(/17 November 2026/);
    await expect(panel(page).getByRole('grid', { name: /November\s*2026/ })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('date helpers', () => {
  test('the helpers section lists the exported functions', async ({ page }) => {
    await openPage(page, '/controls/date-picker', 'Date picker');
    const table = page.getByRole('table', { name: 'Exports of date-utils' });
    await expect(table.getByRole('rowheader', { name: 'parseDate(text, locale)' })).toBeVisible();
    await expect(table.getByRole('rowheader', { name: 'isoDay(date)' })).toBeVisible();
  });
});

test.describe('calendar', () => {
  test('moves with the keyboard in the grid and chooses with Space', async ({ page }) => {
    await openPage(page, '/controls/calendar', 'Calendar');
    const live = example(page, 'Inline calendar');
    const status = live.getByRole('status');
    await expect(status).toHaveText('Ship date: 2026-11-17');
    // One tab stop: the chosen day.
    await expect(day(live, '2026-11-17')).toHaveAttribute('tabindex', '0');
    await expect(day(live, '2026-11-18')).toHaveAttribute('tabindex', '-1');

    await day(live, '2026-11-17').focus();
    for (const [key, expected] of [
      ['ArrowDown', '2026-11-24'],
      ['ArrowRight', '2026-11-25'],
      ['Home', '2026-11-23'],
      ['End', '2026-11-29'],
      ['PageDown', '2026-12-29'],
      ['Shift+PageUp', '2025-12-29'],
      ['PageDown', '2026-01-29'],
    ]) {
      await page.keyboard.press(key);
      await expect(day(live, expected), `${key} moves to ${expected}`).toBeFocused();
    }
    await page.keyboard.press('Space');
    // The calendar does not keep the value: the page does, from dateSelect.
    await expect(status).toHaveText('Ship date: 2026-01-29');
    await expect(day(live, '2026-01-29')).toHaveClass(/star-calendar__day--selected/);
    await expect(live.getByRole('heading', { level: 2 })).toContainText('January');
  });

  test('moves between months with the buttons and jumps with the month and year views', async ({
    page,
  }) => {
    await openPage(page, '/controls/calendar', 'Calendar');
    const live = example(page, 'Inline calendar');
    const title = live.getByRole('heading', { level: 2 });
    await expect(title).toHaveText(/November\s+2026/);

    await live.getByRole('button', { name: 'Next month' }).click();
    await expect(title).toHaveText(/December\s+2026/);
    await live.getByRole('button', { name: 'Previous month' }).click();
    await live.getByRole('button', { name: 'Previous month' }).click();
    await expect(title).toHaveText(/October\s+2026/);

    await live.getByRole('button', { name: /^Choose month/ }).click();
    const months = live.getByRole('group', { name: 'Choose month' });
    await months.getByRole('button', { name: 'Mar' }).click();
    await expect(title).toHaveText(/March\s+2026/);
    await expect(live.getByRole('grid')).toBeVisible();

    await live.getByRole('button', { name: /^Choose year/ }).click();
    const years = live.getByRole('group', { name: 'Choose year' });
    await years.getByRole('button', { name: '2022', exact: true }).click();
    // A year opens the month view of that year; then a month opens its days.
    await months.getByRole('button', { name: 'Feb' }).click();
    await expect(title).toHaveText(/February\s+2022/);
    await expect(day(live, '2022-02-14')).toBeVisible();
  });

  test('chooses a range with two clicks and previews it on hover', async ({ page }) => {
    await openPage(page, '/controls/calendar', 'Calendar');
    const live = example(page, 'Range');
    const status = live.getByRole('status');
    await expect(status).toHaveText('Booking: 2026-11-09 to 2026-11-13');
    await expect(day(live, '2026-11-11').locator('..')).toHaveClass(/star-calendar__cell--range/);

    await day(live, '2026-11-16').click();
    await expect(status).toHaveText('Booking: 2026-11-16 to none');
    // While only the start is chosen, the fill follows the pointer.
    await day(live, '2026-11-19').hover();
    await expect(day(live, '2026-11-18').locator('..')).toHaveClass(/star-calendar__cell--range/);
    await expect(day(live, '2026-11-20').locator('..')).not.toHaveClass(
      /star-calendar__cell--range\b/,
    );
    await day(live, '2026-11-19').click();
    await expect(status).toHaveText('Booking: 2026-11-16 to 2026-11-19');
  });

  test('shows two months with week numbers and blocks days outside the limits', async ({
    page,
  }) => {
    await openPage(page, '/controls/calendar', 'Calendar');
    const live = example(page, 'Two months, week numbers and limits');
    await expect(live.locator('table')).toHaveCount(2);
    await expect(live.locator('caption')).toHaveText(['November 2026', 'December 2026']);
    await expect(live.getByRole('columnheader', { name: 'Wk' })).toHaveCount(2);
    // Sundays are disabled (disabledDays) and the days of the other month are blank.
    await expect(day(live, '2026-11-15')).toHaveAttribute('aria-disabled', 'true');
    await expect(day(live, '2026-11-16')).not.toHaveAttribute('aria-disabled', 'true');
    await day(live, '2026-12-02').click();
    await expect(day(live, '2026-12-02')).toHaveClass(/star-calendar__day--selected/);
    await day(live, '2026-12-06').click({ force: true });
    await expect(day(live, '2026-12-06')).not.toHaveClass(/star-calendar__day--selected/);
  });

  test('the month view chooses a month directly', async ({ page }) => {
    await openPage(page, '/controls/calendar', 'Calendar');
    const live = example(page, 'Month view');
    await live.getByRole('button', { name: 'Jun' }).click();
    await expect(live.getByRole('status')).toHaveText('Month: 2026-06-01');
    await expect(live.getByRole('button', { name: 'Jun' })).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('time picker', () => {
  test('types a time and clears it', async ({ page }) => {
    await openPage(page, '/controls/time-picker', 'Time picker');
    const live = example(page, 'Time of day');
    const input = live.getByLabel('Meeting time');
    const status = live.getByRole('status');
    await expect(status).toHaveText('Meeting: 09:30');
    await expect(input).toHaveValue('09:30');

    await input.fill('14:45');
    await expect(status).toHaveText('Meeting: 14:45');
    await input.fill('');
    await expect(status).toHaveText('Meeting: none');
  });

  test('changes the hour with the arrow keys and carries the 24-hour value', async ({ page }) => {
    await openPage(page, '/controls/time-picker', 'Time picker');
    const live = example(page, 'Time of day');
    const input = live.getByLabel('Meeting time');
    await input.focus();
    // The first part of a time field is the hour in every locale of the browser.
    await page.keyboard.press('ArrowUp');
    await expect(live.getByRole('status')).toHaveText('Meeting: 10:30');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(live.getByRole('status')).toHaveText('Meeting: 08:30');
  });

  test('has limits, a step and a disabled state', async ({ page }) => {
    await openPage(page, '/controls/time-picker', 'Time picker');
    const limits = example(page, 'Limits and step').getByLabel('Opening time');
    await expect(limits).toHaveAttribute('min', '08:00');
    await expect(limits).toHaveAttribute('max', '18:00');
    await expect(limits).toHaveAttribute('step', '900');
    await expect(
      example(page, 'Sizes and states').getByLabel('Disabled time picker'),
    ).toBeDisabled();
    await expect(
      example(page, 'Sizes and states').getByLabel('Read-only time picker'),
    ).toHaveJSProperty('readOnly', true);
  });

  test('works with Signal Forms', async ({ page }) => {
    await openPage(page, '/controls/time-picker', 'Time picker');
    const live = example(page, 'Signal Forms');
    const input = live.getByLabel('Pick-up time', { exact: true });
    await expect(live.getByRole('status')).toHaveText('Valid: false');
    await input.focus();
    await input.blur();
    await expect(live.getByRole('alert')).toHaveText('Choose a pick-up time.');
    await input.fill('10:15');
    await expect(live.getByRole('status')).toHaveText('Valid: true');
    await expect(live.getByRole('alert')).toHaveCount(0);
  });
});

test.describe('forms guide with a date picker', () => {
  test('a date picker in the Reactive Forms group writes its value and follows the lock', async ({
    page,
  }) => {
    await openPage(page, '/guides/forms', 'Forms');
    const live = example(page, 'Reactive Forms');
    const input = live.getByRole('textbox', { name: 'Delivery date' });
    await expect(live.getByRole('status')).toContainText('"delivery": null');

    await input.fill('15/11/2026');
    await input.press('Enter');
    // The group value holds a Date (shown as ISO text in UTC): the day depends on the zone.
    await expect(live.getByRole('status')).toContainText(/"delivery": "2026-11-1[45]T/);

    await live.getByRole('switch', { name: 'Lock the form' }).check();
    await expect(input).toBeDisabled();
    // A disabled control leaves the value of the group.
    await expect(live.getByRole('status')).not.toContainText('delivery');
  });
});
