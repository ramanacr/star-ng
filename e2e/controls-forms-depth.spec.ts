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
});
