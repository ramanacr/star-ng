import { expect, test } from '@playwright/test';
import { example, openPage } from './support';

test.describe('sparkline', () => {
  test('sums up the data in its label and draws inside a table cell', async ({ page }) => {
    await openPage(page, '/controls/sparkline', 'Sparkline');
    const inText = example(page, 'Line in text').locator('star-sparkline');
    await expect(inText).toHaveAttribute('role', 'img');
    await expect(inText).toHaveAttribute(
      'aria-label',
      /^Trend up: first 12, last 21\.5, lowest 9, highest 21\.5$/,
    );
    const box = (await inText.boundingBox())!;
    expect(box.height).toBeLessThan(box.width);
    const cells = example(page, 'In a table').locator('star-sparkline');
    await expect(cells).toHaveCount(4);
    await expect(cells.nth(1)).toHaveAttribute('aria-label', /^Trend down/);
  });

  test('mirrors the x axis in right-to-left', async ({ page }) => {
    await openPage(page, '/controls/sparkline', 'Sparkline');
    const line = example(page, 'Line in text').locator('.star-sparkline__line');
    await expect(line).toHaveAttribute('d', /^M 0\.00 /);
    await page.evaluate(() => (document.documentElement.dir = 'rtl'));
    await expect(line).toHaveAttribute('d', /^M 100\.00 /);
  });
});

test.describe('gauge', () => {
  test('is a meter with a formatted value text', async ({ page }) => {
    await openPage(page, '/controls/gauge', 'Gauge');
    const live = example(page, 'Radial gauge');
    const gauge = live.getByRole('meter', { name: 'Server load' });
    await expect(gauge).toHaveAttribute('aria-valuenow', '58');
    await expect(gauge).toHaveAttribute('aria-valuetext', '58%');
    await live.getByRole('button', { name: 'More' }).click();
    await expect(gauge).toHaveAttribute('aria-valuenow', '73');
  });

  test('sets the value with the keyboard and the pointer in interactive mode', async ({ page }) => {
    await openPage(page, '/controls/gauge', 'Gauge');
    const live = example(page, 'Interactive with Signal Forms');
    const slider = live.getByRole('slider', { name: 'Volume' });
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuenow', '45');
    await page.keyboard.press('PageUp');
    await expect(slider).toHaveAttribute('aria-valuenow', '55');
    await page.keyboard.press('Home');
    await expect(slider).toHaveAttribute('aria-valuenow', '0');
    await expect(live.getByText('Volume: 0')).toBeVisible();

    // Click at the end of the scale (x 304 of 320 view units).
    const box = (await slider.locator('svg').boundingBox())!;
    await page.mouse.click(box.x + (box.width * 304) / 320, box.y + box.height / 3);
    await expect(slider).toHaveAttribute('aria-valuenow', '100');
    await expect(live.getByRole('meter', { name: 'Volume level' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });
});

test.describe('barcode and QR code', () => {
  test('shows the human-readable value and an error state', async ({ page }) => {
    await openPage(page, '/controls/barcode', 'Barcode');
    await expect(
      example(page, 'Product codes').getByRole('img', { name: '5901234123457' }),
    ).toBeVisible();
    const live = example(page, 'Error state');
    await expect(live.locator('.star-barcode__error')).toHaveText(
      'The value cannot be encoded as EAN-13.',
    );
    await expect(live.getByText('Valid: no')).toBeVisible();
    await live.getByRole('textbox', { name: 'Barcode value' }).fill('590123412345');
    await expect(live.getByRole('img', { name: '5901234123457' })).toBeVisible();
    await expect(live.getByText('Valid: yes')).toBeVisible();
  });

  test('draws a QR code that grows with the error correction level', async ({ page }) => {
    await openPage(page, '/controls/qr-code', 'QR code');
    const live = example(page, 'Error correction');
    const code = live.locator('star-qr-code');
    await expect(code).toHaveAttribute(
      'aria-label',
      'QR code: https://example.com/invoices/2026-0042',
    );
    const side = async () =>
      Number((await code.locator('svg').getAttribute('viewBox'))!.split(' ')[2]);
    const medium = await side();
    await live.getByRole('radio', { name: 'H' }).click();
    await expect.poll(side).toBeGreaterThan(medium);
    await expect(example(page, 'Centre image').locator('.star-qr-code__image')).toHaveAttribute(
      'href',
      'favicon.svg',
    );
  });
});
