import { expect, Page, test } from '@playwright/test';
import { example, openPage as openDocsPage } from './support';

/** Opens a docs page and waits until it is hydrated (no `ngh` marker left). */
async function openPage(page: Page, path: string, heading: string | RegExp): Promise<void> {
  await openDocsPage(page, path, heading);
  await expect(page.locator('[ngh]')).toHaveCount(0, { timeout: 15_000 });
}

test.describe('form inputs depth (wave N1)', () => {
  test('rating: the cancel option clears the rating with the keyboard', async ({ page }) => {
    await openPage(page, '/controls/rating', 'Rating');
    const live = example(page, 'Cancel and custom icons');
    await live.getByRole('radio', { name: '2 of 5' }).focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(live.getByRole('radio', { name: 'Clear' })).toBeChecked();
    await expect(live.getByRole('status')).toHaveText('Rating: none');
  });

  test('input number: the stacked buttons step the value', async ({ page }) => {
    await openPage(page, '/controls/input-number', 'Input number');
    const live = example(page, 'Button layouts');
    const field = live.getByRole('spinbutton', { name: 'Stacked' });
    await live.getByRole('button', { name: 'Increase' }).first().click();
    await expect(field).toHaveAttribute('aria-valuenow', '13');
    await field.fill('');
    await field.blur();
    await expect(field).toHaveAttribute('aria-valuenow', '13');
  });

  test('slider: a vertical slider reports the end of a change', async ({ page }) => {
    await openPage(page, '/controls/slider', 'Slider');
    const live = example(page, 'Vertical slider');
    const slider = live.getByRole('slider', { name: 'Height' });
    await expect(slider).toHaveAttribute('aria-orientation', 'vertical');
    await slider.focus();
    await page.keyboard.press('ArrowUp');
    await expect(live.locator('p.docs-output')).toHaveText('Last end: 61');
  });

  test('rating: half stars step by 0.5 with the arrow keys', async ({ page }) => {
    await openPage(page, '/controls/rating', 'Rating');
    const live = example(page, 'Half stars, vertical');
    const half = live.locator('star-rating').first();
    await half.getByRole('radio', { name: '3.5 of 5' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(half.getByRole('radio', { name: '4 of 5' })).toBeChecked();
    await expect(live.locator('p.docs-output')).toHaveText('Rating: 4');
  });

  test('toggle switch: the state label follows the switch', async ({ page }) => {
    await openPage(page, '/controls/toggle-switch', 'Toggle switch');
    const live = example(page, 'State labels and handle icons');
    const toggle = live.getByRole('switch', { name: 'Lights' });
    await expect(live.locator('[data-star-part="stateText"]')).toHaveText('On');
    await toggle.press('Space');
    await expect(toggle).not.toBeChecked();
    await expect(live.locator('[data-star-part="stateText"]')).toHaveText('Off');
  });

  test('input number: the clear button empties the field', async ({ page }) => {
    await openPage(page, '/controls/input-number', 'Input number');
    const live = example(page, 'Currency display and clear');
    const field = live.getByRole('spinbutton', { name: 'Fee' });
    await expect(field).toHaveValue(/EUR/);
    await live.getByRole('button', { name: 'Clear' }).click();
    await expect(field).toHaveValue('');
    await expect(field).toBeFocused();
  });

  test('range slider: the gap between the handles holds', async ({ page }) => {
    await openPage(page, '/controls/slider', 'Slider');
    const live = example(page, 'Range slider options');
    const low = live.getByRole('slider').first();
    await low.focus();
    await page.keyboard.press('End');
    await expect(live.locator('p.docs-output')).toHaveText('Last end: 50 to 60');
  });

  test('input mask: keepCharPositions keeps the later digits on Backspace', async ({ page }) => {
    await openPage(page, '/controls/input-mask', 'Input mask');
    const field = example(page, 'Clear, fixed positions and filled').getByRole('textbox', {
      name: 'Member number',
    });
    await field.click();
    await page.keyboard.type('12345678');
    await expect(field).toHaveValue('1234-5678');
    await field.evaluate((input: HTMLInputElement) => input.setSelectionRange(2, 2));
    await page.keyboard.press('Backspace');
    await expect(field).toHaveValue('1_34-5678');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Delete');
    await expect(field).toHaveValue('1__4-5678');
    await page.keyboard.type('9');
    await expect(field).toHaveValue('1_94-5678');
  });

  test('knob: strokeWidth changes the drawn width', async ({ page }) => {
    await openPage(page, '/controls/knob', 'Knob');
    const knobs = example(page, 'Stroke width and hidden value').locator('star-knob');
    const width = (index: number) =>
      knobs
        .nth(index)
        .locator('[data-star-part="valueItem"]')
        .evaluate((path) => getComputedStyle(path).strokeWidth);
    expect(await width(0)).toBe('14px');
    expect(await width(1)).toBe('10px');
  });
});
