import { expect, Locator, Page, test } from '@playwright/test';
import { example, openPage } from './support';

/**
 * `look="pills"` of `star-select-button` on the select button page: separate pills with counts,
 * the keyboard of the radio group, the count in the accessible name, wrapping in a narrow
 * container, the contrast of the counts and right-to-left.
 */

const PAGE = '/controls/select-button';
const HEADING = 'Select button and toggle button';

const pills = (page: Page) =>
  example(page, 'Pills with counts').getByRole('radiogroup', { name: 'Order status' });

const box = async (locator: Locator) => (await locator.boundingBox())!;

/** Contrast of each count against the fill of its pill (the first fill outwards). */
async function countContrast(group: Locator): Promise<{ text: string; ratio: number }[]> {
  return group.locator('[data-star-part="countText"]').evaluateAll((nodes) => {
    const channels = (color: string) => {
      const unit = color.startsWith('color(') ? 1 : 255;
      return (color.replace(/^color\(srgb/, '').match(/[\d.]+/g) ?? []).slice(0, 3).map((value) => {
        const share = Number(value) / unit;
        return share <= 0.03928 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
      });
    };
    const luminance = (color: string) => {
      const [red, green, blue] = channels(color);
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const fillOf = (element: Element | null): string => {
      for (let node = element; node; node = node.parentElement) {
        const color = getComputedStyle(node).backgroundColor;
        if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
      }
      return 'rgb(255, 255, 255)';
    };
    return nodes.map((node) => {
      const text = luminance(getComputedStyle(node).color);
      const fill = luminance(fillOf(node));
      const ratio = (Math.max(text, fill) + 0.05) / (Math.min(text, fill) + 0.05);
      return { text: node.textContent?.trim() ?? '', ratio: Math.round(ratio * 100) / 100 };
    });
  });
}

test.describe('select button pills', () => {
  // No colour transitions, so a read right after a click sees the final colours.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('separate pills about 30px high, the count in the accessible name', async ({ page }) => {
    await openPage(page, PAGE, HEADING);
    const group = pills(page);
    await expect(group).toHaveClass(/star-select-button--pills/);
    const all = group.getByRole('radio', { name: 'All', exact: true });
    const open = group.getByRole('radio', { name: 'Open, 3' });
    await expect(all).toBeChecked();
    await expect(open).toBeVisible();
    await expect(group.getByRole('radio', { name: 'Returned, 0' })).toBeVisible();
    await expect(group.getByRole('radio', { name: 'Archived', exact: true })).toBeVisible();
    await expect(open.locator('[data-star-part="countText"]')).toHaveText('3');

    const a = await box(all);
    const b = await box(open);
    expect(Math.abs(a.height - 30)).toBeLessThanOrEqual(1.5);
    // Separate pills: a gap between them.
    expect(b.x - (a.x + a.width)).toBeGreaterThanOrEqual(4);
    expect(await all.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).not.toBe('0px');
    // Reduced motion: no transition.
    expect(await all.evaluate((el) => getComputedStyle(el).transitionProperty)).toBe('none');
    expect(await all.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
  });

  test('keyboard: one tab stop, arrows move and select, Space and Enter select', async ({
    page,
  }) => {
    await openPage(page, PAGE, HEADING);
    const live = example(page, 'Pills with counts');
    const group = pills(page);
    const all = group.getByRole('radio', { name: 'All', exact: true });
    const open = group.getByRole('radio', { name: 'Open, 3' });
    const archived = group.getByRole('radio', { name: 'Archived', exact: true });
    await expect(open).toHaveAttribute('tabindex', '-1');

    await all.focus();
    await page.keyboard.press('ArrowRight');
    await expect(open).toBeFocused();
    await expect(open).toBeChecked();
    await expect(live.getByRole('status')).toHaveText('Status: open');
    // Visible focus ring.
    expect(await open.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');

    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(archived).toBeFocused();
    await expect(archived).toBeChecked();

    // Tab leaves the group; Shift+Tab comes back to the selected pill.
    await page.keyboard.press('Tab');
    await expect(archived).not.toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(archived).toBeFocused();

    await all.focus();
    await page.keyboard.press('Space');
    await expect(all).toBeChecked();
    await open.focus();
    await page.keyboard.press('Enter');
    await expect(open).toBeChecked();
    await expect(live.getByRole('status')).toHaveText('Status: open');
  });

  test('the selected pill takes the primary fill', async ({ page }) => {
    await openPage(page, PAGE, HEADING);
    const group = pills(page);
    const shipped = group.getByRole('radio', { name: 'Shipped, 12' });
    const open = group.getByRole('radio', { name: 'Open, 3' });
    await shipped.click();
    await expect(shipped).toBeChecked();
    const fills = await Promise.all(
      [shipped, open].map((pill) => pill.evaluate((el) => getComputedStyle(el).backgroundColor)),
    );
    const primary = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--star-primary-fill)';
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    expect(fills[0]).toBe(primary);
    expect(fills[1]).not.toBe(primary);
  });

  test('forced colors: the selected pill keeps a distinct fill', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await openPage(page, PAGE, HEADING);
    const group = pills(page);
    const shipped = group.getByRole('radio', { name: 'Shipped, 12' });
    await shipped.click();
    await expect(shipped).toBeChecked();
    const fill = (pill: Locator) => pill.evaluate((el) => getComputedStyle(el).backgroundColor);
    const selected = await fill(shipped);
    expect(selected).not.toBe(await fill(group.getByRole('radio', { name: 'Open, 3' })));
    const count = shipped.locator('[data-star-part="countText"]');
    expect(await count.evaluate((el) => getComputedStyle(el).color)).toBe(
      await shipped.evaluate((el) => getComputedStyle(el).color),
    );
  });

  test('pills wrap onto more lines in a narrow container', async ({ page }) => {
    await openPage(page, PAGE, HEADING);
    const live = example(page, 'Pills that wrap');
    const group = live.getByRole('radiogroup', { name: 'Order status, narrow' });
    const radios = group.getByRole('radio');
    await expect(radios).toHaveCount(5);
    const tops = new Set<number>();
    for (const radio of await radios.all()) tops.add(Math.round((await box(radio)).y));
    expect(tops.size).toBeGreaterThan(1);
    const container = await box(group.locator('..'));
    const host = await box(group);
    expect(host.width).toBeLessThanOrEqual(container.width + 0.5);
    // No horizontal overflow.
    expect(await group.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    // size sm is smaller.
    const small = live.getByRole('radiogroup', { name: 'Range' }).getByRole('radio').first();
    expect((await box(small)).height).toBeLessThan((await box(radios.first())).height);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`counts have AA contrast, selected and not, in the ${theme} theme`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('star-theme', value), theme);
      await openPage(page, PAGE, HEADING);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const group = pills(page);
      await group.getByRole('radio', { name: 'Shipped, 12' }).click();
      await expect(group.getByRole('radio', { name: 'Shipped, 12' })).toBeChecked();
      const measured = await countContrast(group);
      expect(measured.length).toBe(3);
      expect(measured.filter((item) => item.ratio < 4.5)).toEqual([]);
    });
  }

  test('right-to-left: the first pill is on the right and Arrow left selects the next', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('star-direction', 'rtl'));
    await openPage(page, PAGE, HEADING);
    const group = pills(page);
    const all = group.getByRole('radio', { name: 'All', exact: true });
    const open = group.getByRole('radio', { name: 'Open, 3' });
    const a = await box(all);
    const b = await box(open);
    expect(a.x).toBeGreaterThan(b.x);
    // The count sits after the label in the reading order: on its left.
    const label = await box(open.locator('[data-star-part="itemText"]'));
    const count = await box(open.locator('[data-star-part="countText"]'));
    expect(count.x).toBeLessThan(label.x);

    await all.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(open).toBeFocused();
    await expect(open).toBeChecked();
    await page.keyboard.press('ArrowRight');
    await expect(all).toBeChecked();
  });
});
