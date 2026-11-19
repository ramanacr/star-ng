import { expect, test } from '@playwright/test';
import { example, openPage } from './support';

test.describe('configuration guide', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, '/guides/configuration', 'Configuration');
  });

  test('starKeyFilter blocks keys that the filter does not allow', async ({ page }) => {
    const live = example(page, 'Filtered fields');
    const quantity = live.getByLabel('Quantity');
    // The page is prerendered: keys typed before the hydration reach the plain input. Retry.
    await expect(async () => {
      await quantity.fill('');
      await quantity.pressSequentially('12a-3.');
      await expect(quantity).toHaveValue('12-3', { timeout: 500 });
    }).toPass();
    const hex = live.getByLabel('Color code (hex)');
    await hex.pressSequentially('c0ffeg');
    await expect(hex).toHaveValue('c0ffe');
  });

  test('starKeyFilter with validateOnly shows an error and does not block', async ({ page }) => {
    const live = example(page, 'Filtered fields');
    const reference = live.getByLabel('Reference');
    await expect(async () => {
      await reference.fill('');
      await reference.pressSequentially('ORD 1042');
      await expect(reference).toHaveAttribute('aria-invalid', 'true', { timeout: 500 });
    }).toPass();
    await expect(reference).toHaveValue('ORD 1042');
    await expect(live.getByText('Use letters, digits and the underscore only.')).toBeVisible();
    await reference.fill('ORD_1042');
    await expect(reference).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('starCopy copies and announces the result', async ({ page }) => {
    const live = example(page, 'Copy button');
    await live.getByRole('button', { name: 'Copy order id' }).click();
    await expect(live.getByText(/Copy: (copied|failed)/)).toBeVisible();
    await expect(page.locator('.cdk-live-announcer-element')).toHaveText(/Copied|Copy failed/);
  });

  test('the select defaults of one component apply to its select', async ({ page }) => {
    const live = example(page, 'Defaults for one part of the page');
    await expect(live.locator('star-select')).toHaveClass(/star-select--sm/);
  });
});
