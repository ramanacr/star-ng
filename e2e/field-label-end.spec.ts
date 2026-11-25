import { expect, test } from '@playwright/test';
import { example, openPage } from './support';

/**
 * Field: content at the end of the label row (`labelEnd` and `[starFieldLabelEnd]`). The end
 * content sits at the inline end of the row (right in LTR, left in RTL) and is not part of the
 * accessible name of the control. Example: Field, "Content at the end of the label row".
 */
test.describe('Field label end', () => {
  for (const dir of ['ltr', 'rtl'] as const) {
    test(`end content sits at the inline end of the label row (${dir})`, async ({ page }) => {
      await openPage(page, '/controls/field', 'Field and input');
      if (dir === 'rtl') {
        await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
      }
      const live = example(page, 'Content at the end of the label row');
      for (const field of await live.locator('star-field').all()) {
        const row = field.locator('.star-field__label-row');
        const label = row.locator('label');
        const end = row.locator('.star-field__label-end');
        const [rowBox, labelBox, endBox] = await Promise.all([
          row.boundingBox(),
          label.boundingBox(),
          end.boundingBox(),
        ]);
        if (!rowBox || !labelBox || !endBox) throw new Error('label row not laid out');
        if (dir === 'ltr') {
          expect(Math.abs(endBox.x + endBox.width - (rowBox.x + rowBox.width))).toBeLessThan(1);
          expect(Math.abs(labelBox.x - rowBox.x)).toBeLessThan(1);
          expect(endBox.x).toBeGreaterThan(labelBox.x + labelBox.width);
        } else {
          expect(Math.abs(endBox.x - rowBox.x)).toBeLessThan(1);
          expect(Math.abs(labelBox.x + labelBox.width - (rowBox.x + rowBox.width))).toBeLessThan(1);
          expect(endBox.x + endBox.width).toBeLessThan(labelBox.x);
        }
      }
    });
  }

  test('the end content is not part of the accessible name', async ({ page }) => {
    await openPage(page, '/controls/field', 'Field and input');
    const live = example(page, 'Content at the end of the label row');
    const reason = live.getByRole('textbox', { name: 'Reason', exact: true });
    await expect(reason).toBeVisible();
    await expect(reason).toHaveAccessibleName('Reason');
    await expect(reason).toHaveAccessibleDescription('');
    const password = live.locator('input[type=password]');
    await expect(password).toHaveAccessibleName('Password');
    // The link stays reachable by its own name.
    await expect(live.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
  });
});
