import { expect, Page, test } from '@playwright/test';
import { example, openPage } from './support';

const PATH = '/controls/chart';

/** The resolved color of a token, as the browser computes it. */
async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);
}

test.describe('chart', () => {
  test('a bar chart draws one mark per value and has a legend', async ({ page }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Bar chart');
    // 6 months x 2 series.
    await expect(live.locator('.star-chart__bar')).toHaveCount(12);
    await expect(live.locator('.star-chart__legend li')).toHaveText(['Received', 'Shipped']);
    await expect(live.locator('.star-chart__hit')).toHaveCount(6);
  });

  test('a line chart draws one line per series and one dot per series on hover', async ({
    page,
  }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Line chart');
    await expect(live.locator('.star-chart__line')).toHaveCount(2);
    await expect(live.locator('.star-chart__area')).toHaveCount(0);
    await expect(live.locator('.star-chart__dot')).toHaveCount(0);
    await live.locator('.star-chart__hit').nth(2).hover();
    await expect(live.locator('.star-chart__dot')).toHaveCount(2);
    await expect(live.locator('.star-chart__crosshair')).toHaveCount(1);
  });

  test('an area chart adds a fill under each line', async ({ page }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Area chart');
    await expect(live.locator('.star-chart__line')).toHaveCount(2);
    await expect(live.locator('.star-chart__area')).toHaveCount(2);
  });

  test('a doughnut chart groups small categories as Other and shows the total', async ({
    page,
  }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Doughnut chart');
    await expect(live.locator('.star-chart__slice')).toHaveCount(4);
    await expect(live.locator('.star-chart__legend li')).toHaveText([
      'Search',
      'Direct',
      'Referral',
      'Other',
    ]);
    await expect(live.locator('.star-chart__total')).toHaveText('11,200');
  });

  test('a pie chart draws wedges without a hole or a total', async ({ page }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Pie chart');
    await expect(live.locator('.star-chart__slice')).toHaveCount(4);
    await expect(live.locator('.star-chart__total')).toHaveCount(0);
  });

  test('hovering a mark shows a tooltip with the values and leaving hides it', async ({ page }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Bar chart');
    await live.locator('.star-chart__hit').first().hover();
    const tip = live.locator('.star-chart__tip');
    await expect(tip).toContainText('Jan');
    await expect(tip).toContainText('Received: 120');
    await expect(tip).toContainText('Shipped: 110');
    await page.mouse.move(0, 0);
    await expect(tip).toHaveCount(0);

    const pie = example(page, 'Pie chart');
    await pie.locator('.star-chart__slice').first().hover();
    await expect(pie.locator('.star-chart__tip')).toContainText('North: 48,000 (32.4%)');
  });

  test('the figure has an accessible name and the marks are hidden from screen readers', async ({
    page,
  }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Bar chart');
    await expect(live.getByRole('figure', { name: 'Orders per month' })).toBeVisible();
    await expect(live.locator('.star-chart__plot')).toHaveAttribute('aria-hidden', 'true');
    await expect(live.locator('.star-chart__legend')).toHaveAttribute('aria-hidden', 'true');
  });

  test('the data table is available to screen readers and opens with the keyboard', async ({
    page,
  }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Bar chart');
    const table = live.getByRole('table', { name: 'Orders per month' });
    // Present in the accessibility tree while it is visually hidden.
    await expect(table).toHaveClass(/star-sr-only/);
    await expect(table.getByRole('columnheader')).toHaveText(['Month', 'Received', 'Shipped']);
    await expect(table.getByRole('row').nth(1)).toHaveText('Jan120110');
    await expect(table.getByRole('row')).toHaveCount(7);

    const toggle = live.getByRole('button', { name: 'Table' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(table).not.toHaveClass(/star-sr-only/);
    await expect(live.locator('.star-chart__plot')).toBeHidden();
    await expect(live.locator('.star-chart__legend')).toHaveCount(0);
    const back = live.getByRole('button', { name: 'Chart' });
    await expect(back).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Space');
    await expect(live.locator('.star-chart__plot')).toBeVisible();
  });

  test('the table of a doughnut chart lists value and share', async ({ page }) => {
    await openPage(page, PATH, 'Chart');
    const table = example(page, 'Doughnut chart').getByRole('table', {
      name: 'Traffic by channel',
    });
    await expect(table.getByRole('columnheader')).toHaveText(['Category', 'Visits', 'Share']);
    await expect(table.getByRole('row').last()).toHaveText('Other1,50013.4%');
  });

  test('the table input starts with the table open', async ({ page }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Data table');
    await expect(live.getByRole('table')).toBeVisible();
    await expect(live.getByRole('columnheader').first()).toHaveText('Region');
    await expect(live.getByRole('button', { name: 'Chart' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('the chart fills its container and keeps its aspect ratio', async ({ page }) => {
    await openPage(page, PATH, 'Chart');
    const svg = example(page, 'Sizing').locator('svg.star-chart__svg');
    const box = (await svg.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(22 * 16 + 1);
    expect(box.width / box.height).toBeCloseTo(640 / 280, 1);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`series colors come from the tokens in the ${theme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.addInitScript((value) => localStorage.setItem('star-theme', value), theme);
      await openPage(page, PATH, 'Chart');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

      const bars = example(page, 'Bar chart').locator('.star-chart__bar');
      const fills = await bars.evaluateAll((nodes) =>
        nodes.map((node) => [node.getAttribute('style'), getComputedStyle(node).fill]),
      );
      // Bars alternate between series 1 and series 2.
      const first = await tokenColor(page, '--star-chart-1');
      const second = await tokenColor(page, '--star-chart-2');
      expect(first).not.toBe(second);
      expect(fills[0][0]).toContain('var(--star-chart-1)');
      expect(fills[1][0]).toContain('var(--star-chart-2)');
      expect(fills[0][1]).toBe(first);
      expect(fills[1][1]).toBe(second);

      const lines = example(page, 'Line chart').locator('.star-chart__line');
      expect(await lines.nth(1).evaluate((node) => getComputedStyle(node).stroke)).toBe(second);

      const swatches = example(page, 'Doughnut chart').locator('.star-chart__swatch');
      for (const slot of [1, 2, 3, 4]) {
        const color = await tokenColor(page, `--star-chart-${slot}`);
        expect(
          await swatches.nth(slot - 1).evaluate((node) => getComputedStyle(node).backgroundColor),
        ).toBe(color);
      }
    });
  }

  test('the series colors differ between the light and the dark theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openPage(page, PATH, 'Chart');
    const light = await tokenColor(page, '--star-chart-1');
    await page
      .getByRole('group', { name: 'Theme' })
      .getByRole('button', { name: 'Dark theme' })
      .click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await tokenColor(page, '--star-chart-1')).not.toBe(light);
  });
});
