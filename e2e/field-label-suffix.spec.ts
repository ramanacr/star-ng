import { expect, test } from '@playwright/test';
import { example, openPage } from './support';

/**
 * Field: marker right after the label text (`labelSuffix`, `labelSuffixTooltip` and
 * `[starFieldLabelSuffix]`). The marker follows the label text and the required `*`, keeps AA
 * contrast in both themes, and is not part of the accessible name; its meaning is the description
 * of the control. Example: Field, "Marker right after the label".
 */
const HEADING = 'Marker right after the label';

test.describe('Field label suffix', () => {
  for (const dir of ['ltr', 'rtl'] as const) {
    test(`the marker sits right after the label text (${dir})`, async ({ page }) => {
      await openPage(page, '/controls/field', 'Field and input');
      if (dir === 'rtl') {
        await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
      }
      const live = example(page, HEADING);
      const label = live.locator('star-field').nth(1).locator('label');
      const required = label.locator('.star-field__required');
      const suffix = label.locator('.star-field__label-suffix');
      await expect(suffix).toHaveText('#');
      const [labelBox, requiredBox, suffixBox] = await Promise.all([
        label.boundingBox(),
        required.boundingBox(),
        suffix.boundingBox(),
      ]);
      if (!labelBox || !requiredBox || !suffixBox) throw new Error('label not laid out');
      // Same line as the label text, right after the required marker (mirrored in RTL), and not
      // pushed to the end of the field.
      expect(Math.abs(suffixBox.y - requiredBox.y)).toBeLessThan(2);
      if (dir === 'ltr') {
        expect(suffixBox.x).toBeGreaterThanOrEqual(requiredBox.x + requiredBox.width - 0.5);
        expect(suffixBox.x - (requiredBox.x + requiredBox.width)).toBeLessThan(8);
      } else {
        expect(suffixBox.x + suffixBox.width).toBeLessThanOrEqual(requiredBox.x + 0.5);
        expect(requiredBox.x - (suffixBox.x + suffixBox.width)).toBeLessThan(8);
      }
      const fieldBox = (await live.locator('star-field').nth(1).boundingBox())!;
      expect(suffixBox.width).toBeLessThan(fieldBox.width / 4);
    });
  }

  test('the marker is not in the accessible name; its meaning is the description', async ({
    page,
  }) => {
    await openPage(page, '/controls/field', 'Field and input');
    const live = example(page, HEADING);
    const date = live.locator('input[type=date]');
    await expect(date).toHaveAccessibleName('Received Date');
    await expect(date).toHaveAccessibleDescription('Required to close/transmit');
    const description = live.getByRole('textbox', { name: 'Description', exact: true });
    await expect(description).toHaveAccessibleName('Description');
    await expect(description).toHaveAccessibleDescription('Required to close/transmit');
    await expect(live.getByRole('textbox', { name: 'Approved by', exact: true })).toBeVisible();
  });

  test('the tooltip shows on hover of the marker and on keyboard focus', async ({ page }) => {
    await openPage(page, '/controls/field', 'Field and input');
    const live = example(page, HEADING);
    const suffix = live.locator('.star-field__label-suffix').first();
    await suffix.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Required to close/transmit');
    await page.mouse.move(0, 0);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await live.locator('input[type=date]').focus();
    await expect(page.getByRole('tooltip')).toHaveText('Required to close/transmit');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`the marker reaches 4.5:1 on its background (${theme})`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('star-theme', value), theme);
      await openPage(page, '/controls/field', 'Field and input');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const live = example(page, HEADING);
      const markers = live.locator('.star-field__label-suffix');
      expect(await markers.count()).toBe(3);
      const ratios = await markers.evaluateAll((nodes) => {
        const parse = (color: string) => {
          const unit = color.startsWith('color(') ? 1 : 255;
          const values = (color.replace(/^color\(srgb/, '').match(/[\d.]+/g) ?? []).map(Number);
          return { rgb: values.slice(0, 3).map((value) => value / unit), alpha: values[3] ?? 1 };
        };
        const luminance = (rgb: number[]) => {
          const [red, green, blue] = rgb.map((share) =>
            share <= 0.03928 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4,
          );
          return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        };
        return nodes.map((node) => {
          // The marker has no fill: its background is the first opaque one up the tree.
          let fill: number[] | null = null;
          for (let item: Element | null = node; item && !fill; item = item.parentElement) {
            const parsed = parse(getComputedStyle(item).backgroundColor);
            if (parsed.alpha >= 0.99) fill = parsed.rgb;
          }
          const text = luminance(parse(getComputedStyle(node).color).rgb);
          const back = luminance(fill ?? [1, 1, 1]);
          const ratio = (Math.max(text, back) + 0.05) / (Math.min(text, back) + 0.05);
          return Math.round(ratio * 10) / 10;
        });
      });
      for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }
});
