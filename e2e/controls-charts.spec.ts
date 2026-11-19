import { expect, Locator, Page, test } from '@playwright/test';
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

  test('the figure has an accessible name, the marks are hidden and the legend toggles series', async ({
    page,
  }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Bar chart');
    await expect(live.getByRole('figure', { name: 'Orders per month' })).toBeVisible();
    await expect(live.locator('.star-chart__plot')).toHaveAttribute('aria-hidden', 'true');
    const legend = live.getByRole('list', { name: 'Legend: show or hide a series' });
    const shipped = legend.getByRole('button', { name: 'Shipped' });
    await expect(shipped).toHaveAttribute('aria-pressed', 'true');
    await expect(live.locator('.star-chart__bar')).toHaveCount(12);
    await shipped.click();
    await expect(shipped).toHaveAttribute('aria-pressed', 'false');
    await expect(live.locator('.star-chart__bar')).toHaveCount(6);
    await shipped.press('Enter');
    await expect(live.locator('.star-chart__bar')).toHaveCount(12);
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

  test('data points: one tab stop, arrow keys, tooltip template and pointSelect', async ({
    page,
  }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Keyboard, tooltip template and point selection');
    const points = live.getByRole('group', { name: 'Orders per month, interactive: data points' });
    const first = points.getByRole('img', { name: 'Received, Jan: 120' });
    await expect(points.locator('[tabindex="0"]')).toHaveCount(1);
    await first.focus();
    const tip = live.locator('.star-chart__tip');
    await expect(tip).toContainText('Received: 120 orders');
    await expect(tip).toContainText('Shipped: 110 orders');
    await page.keyboard.press('ArrowRight');
    await expect(points.getByRole('img', { name: 'Received, Feb: 150' })).toBeFocused();
    await expect(tip).toContainText('Feb');
    await page.keyboard.press('ArrowDown');
    await expect(points.getByRole('img', { name: 'Shipped, Feb: 140' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Selected: Shipped, Feb: 140');
    // A click on the plot selects the nearest point.
    const june = (await points.getByRole('img', { name: 'Received, Jun: 210' }).boundingBox())!;
    await page.mouse.click(june.x + june.width / 2, june.y + june.height / 2);
    await expect(live.getByRole('status')).toHaveText('Selected: Received, Jun: 210');
  });

  test('export: the SVG document is self-contained and the PNG is an image', async ({ page }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Export as SVG or PNG');
    const svgDownload = page.waitForEvent('download');
    await live.getByRole('button', { name: 'Download SVG' }).click();
    const svg = await svgDownload;
    expect(svg.suggestedFilename()).toBe('orders.svg');
    const text = await (await svg.createReadStream()).toArray();
    const content = Buffer.concat(text).toString('utf8');
    expect(content).toContain('<title>Orders per month, export</title>');
    expect(content).not.toContain('var(--');
    expect(content).toMatch(/fill:rgb/);
    const pngDownload = page.waitForEvent('download');
    await live.getByRole('button', { name: 'Download PNG' }).click();
    const png = await pngDownload;
    expect(png.suggestedFilename()).toBe('orders.png');
    const bytes = Buffer.concat(await (await png.createReadStream()).toArray());
    expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  });

  test('a horizontal bar chart and a combo chart with a second axis', async ({ page }) => {
    await openPage(page, PATH, 'Chart');
    const horizontal = example(page, 'Horizontal bars');
    await expect(horizontal.locator('.star-chart__bar')).toHaveCount(6);
    const bar = await horizontal.locator('.star-chart__bar').first().boundingBox();
    expect(bar!.width).toBeGreaterThan(bar!.height);
    const combo = example(page, 'Combo chart with a second axis');
    await expect(combo.locator('.star-chart__bar')).toHaveCount(6);
    await expect(combo.locator('.star-chart__line')).toHaveCount(1);
    const value = example(page, 'Value format and axis range');
    await expect(value.locator('text.star-chart__axis').first()).toHaveText('€0');
  });

  test('a narrow chart thins its category labels and keeps the view box', async ({ page }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Sizing');
    const chart = live.locator('star-chart').filter({ hasText: 'Visits per month, narrow' });
    const svg = chart.locator('svg.star-chart__svg');
    await expect(svg).toHaveClass(/star-chart__svg--zoom/);
    await expect(svg).toHaveAttribute('viewBox', '0 0 640 280');
    await expect(chart.locator('.star-chart__axis--category')).toHaveCount(6);
    await expect(chart.locator('.star-chart__target')).toHaveCount(12);
  });

  test('the chart fills its container and keeps its aspect ratio', async ({ page }) => {
    await openPage(page, PATH, 'Chart');
    const svg = example(page, 'Sizing').locator('svg.star-chart__svg').first();
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
    const header = page.locator('.docs-header');
    await header.getByRole('button', { name: /^Theme: / }).click();
    await header.getByRole('button', { name: 'Dark', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await tokenColor(page, '--star-chart-1')).not.toBe(light);
  });

  test('a stacked bar chart stacks the series of every month and shows the total', async ({
    page,
  }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Stacked bar chart');
    // 6 months x 4 channels, every value is more than 0.
    await expect(live.locator('.star-chart__segment')).toHaveCount(24);
    await expect(live.locator('.star-chart__legend li')).toHaveText([
      'Web',
      'Mobile app',
      'Phone',
      'Partner',
    ]);
    await expect(live.locator('.star-chart__hit')).toHaveCount(6);
    // The segments of one column touch: each one starts where the one below it ends.
    const boxes = await live.locator('.star-chart__segment').evaluateAll((nodes) =>
      nodes.slice(0, 4).map((node) => {
        const y = Number(node.getAttribute('y'));
        return [y, y + Number(node.getAttribute('height'))];
      }),
    );
    for (let i = 1; i < boxes.length; i++) expect(boxes[i][1]).toBeCloseTo(boxes[i - 1][0], 1);

    await live.locator('.star-chart__hit').nth(2).hover();
    const tip = live.locator('.star-chart__tip');
    await expect(tip).toContainText('Mar');
    await expect(tip).toContainText('Web: 170');
    await expect(tip).toContainText('Partner: 28');
    await expect(tip).toContainText('Total: 353');

    const table = live.getByRole('table', { name: 'Orders per month by channel' });
    await expect(table.getByRole('columnheader')).toHaveText([
      'Month',
      'Web',
      'Mobile app',
      'Phone',
      'Partner',
      'Total',
    ]);
    await expect(table.getByRole('row')).toHaveCount(7);
    await expect(table.getByRole('row').nth(1)).toHaveText('Jan120804025265');
  });

  test('the percent input scales every stacked column to 100 and keeps the real values', async ({
    page,
  }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Stacked bar chart, percent');
    await expect(live.locator('.star-chart__axis', { hasText: '100%' })).toHaveCount(1);
    // Every column fills the plot: its top segment starts at the 100% grid line.
    const top = await live.locator('.star-chart__grid').last().getAttribute('y1');
    const tops = await live
      .locator('.star-chart__segment')
      .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('y'))));
    for (let month = 0; month < 6; month++) {
      expect(tops[month * 4 + 3]).toBeCloseTo(Number(top), 1);
    }
    await live.locator('.star-chart__hit').nth(2).hover();
    await expect(live.locator('.star-chart__tip')).toContainText('Web: 170 (48.2%)');
    const table = live.getByRole('table', { name: 'Share of orders by channel' });
    await expect(table.getByRole('row').nth(3)).toHaveText('Mar1701203528353');
  });

  test('a radar chart draws one polygon per series with markers and a shared scale', async ({
    page,
  }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Radar chart');
    await expect(live.locator('.star-chart__polygon')).toHaveCount(3);
    // 3 models x 6 criteria.
    await expect(live.locator('.star-chart__vertex')).toHaveCount(18);
    await expect(live.locator('.star-chart__ring-label')).toHaveText(['2.5', '5', '7.5', '10']);
    await expect(live.locator('.star-chart__legend li')).toHaveText([
      'Model A',
      'Model B',
      'Model C',
    ]);
    await expect(live.locator('.star-chart__legend svg')).toHaveCount(3);
    // The marker shape differs per series, so color is not the only cue.
    const shapes = await live
      .locator('.star-chart__legend path')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('d')));
    expect(new Set(shapes).size).toBe(3);

    await live.locator('.star-chart__hit').nth(1).hover();
    const tip = live.locator('.star-chart__tip');
    await expect(tip).toContainText('Display');
    await expect(tip).toContainText('Model A: 6');
    await expect(tip).toContainText('Model B: 9');
    await expect(live.locator('.star-chart__crosshair')).toHaveCount(1);

    const table = live.getByRole('table', { name: 'Product ratings by criterion' });
    await expect(table.getByRole('columnheader')).toHaveText([
      'Criterion',
      'Model A',
      'Model B',
      'Model C',
    ]);
    await expect(table.getByRole('row')).toHaveCount(7);
    await expect(table.getByRole('row').nth(5)).toHaveText('Value for money569');
  });

  test('a polar area chart draws one sector per category and the table lists the values', async ({
    page,
  }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Polar area chart');
    await expect(live.locator('.star-chart__sector')).toHaveCount(7);
    await expect(live.locator('.star-chart__legend')).toHaveCount(0);
    await expect(live.locator('.star-chart__ring-label')).toHaveText(['500', '1,000', '1,500']);
    // The area carries the value: the area ratio of Fri (1,020) to Sun (310) is the value ratio.
    const radii = await live.locator('.star-chart__sector').evaluateAll((nodes) =>
      nodes.map((node) => {
        // Each wedge is "M0,0L<start>A<r>,<r> ...": the arc radius is the sector radius.
        const match = /A([\d.]+),/.exec(node.getAttribute('d') ?? '');
        return Number(match?.[1]);
      }),
    );
    expect((radii[4] / radii[6]) ** 2).toBeCloseTo(1020 / 310, 1);

    await live.locator('.star-chart__hit').nth(4).hover();
    await expect(live.locator('.star-chart__tip')).toContainText('Fri');
    await expect(live.locator('.star-chart__tip')).toContainText('Visits: 1,020');

    const table = live.getByRole('table', { name: 'Visits by weekday' });
    await expect(table.getByRole('columnheader')).toHaveText(['Weekday', 'Visits']);
    await expect(table.getByRole('row')).toHaveCount(8);
    await expect(table.getByRole('row').nth(5)).toHaveText('Fri1,020');
  });

  test('a scatter chart plots every point and the table lists x and y', async ({ page }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Scatter chart');
    // 6 backpacks and 6 suitcases.
    await expect(live.locator('.star-chart__point')).toHaveCount(12);
    await expect(live.locator('.star-chart__legend li')).toHaveText(['Backpacks', 'Suitcases']);
    await expect(live.locator('.star-chart__axis-title')).toHaveText(['Weight (kg)', 'Price']);
    // Both axes have numeric ticks.
    const ticks = await live.locator('svg > text.star-chart__axis').allTextContents();
    expect(ticks.map((tick) => tick.trim())).toEqual(expect.arrayContaining(['0', '300', '6']));
    // The two series differ in marker shape as well as in color.
    const shapes = await live
      .locator('.star-chart__point')
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('d')!.replace(/[\d.,-]+/g, '')),
      );
    expect(new Set(shapes.slice(0, 6)).size).toBe(1);
    expect(new Set(shapes.slice(6)).size).toBe(1);
    expect(shapes[0]).not.toBe(shapes[6]);

    await live.locator('.star-chart__hit').nth(3).hover();
    const tip = live.locator('.star-chart__tip');
    await expect(tip).toContainText('Backpacks');
    await expect(tip).toContainText('Weight (kg): 1.4');
    await expect(tip).toContainText('Price: 79');

    const table = live.getByRole('table', { name: 'Price against weight' });
    await expect(table.getByRole('columnheader')).toHaveText(['Series', 'Weight (kg)', 'Price']);
    await expect(table.getByRole('row')).toHaveCount(13);
    await expect(table.getByRole('row').nth(4)).toHaveText('Backpacks1.479');
    await expect(table.getByRole('row').nth(12)).toHaveText('Suitcases5.5215');
  });

  const NEW_TYPES = [
    [
      'Stacked bar chart',
      'Orders per month by channel',
      /^Stacked bar chart with 4 series and 6 items/,
    ],
    ['Radar chart', 'Product ratings by criterion', /^Radar chart with 3 series and 6 items/],
    ['Polar area chart', 'Visits by weekday', /^Polar area chart with 1 series and 7 items/],
    ['Scatter chart', 'Price against weight', /^Scatter chart with 2 series and 12 items/],
  ] as const;

  for (const [heading, name, description] of NEW_TYPES) {
    test(`${heading}: accessible name, description and table view`, async ({ page }) => {
      await openPage(page, PATH, 'Chart');
      const live = example(page, heading);
      const figure = live.getByRole('figure', { name });
      await expect(figure).toBeVisible();
      const describedBy = await figure.getAttribute('aria-describedby');
      await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(description);
      await expect(live.locator('.star-chart__plot')).toHaveAttribute('aria-hidden', 'true');
      // The table is in the accessibility tree and opens with the keyboard.
      const table = live.getByRole('table', { name });
      await expect(table).toHaveClass(/star-sr-only/);
      await live.getByRole('button', { name: 'Table' }).focus();
      await page.keyboard.press('Enter');
      await expect(table).not.toHaveClass(/star-sr-only/);
      await expect(live.locator('.star-chart__plot')).toBeHidden();
    });

    test(`${heading}: fills a narrow container without overflow`, async ({ page }) => {
      await page.setViewportSize({ width: 420, height: 900 });
      await openPage(page, PATH, 'Chart');
      const live = example(page, heading);
      await live.scrollIntoViewIfNeeded();
      const svg = live.locator('svg.star-chart__svg');
      const [box, host] = await Promise.all([
        svg.boundingBox(),
        live.locator('star-chart').boundingBox(),
      ]);
      expect(box!.width).toBeLessThanOrEqual(host!.width + 1);
      expect(box!.width).toBeGreaterThan(host!.width - 2);
      const viewBox = (await svg.getAttribute('viewBox'))!.split(' ').map(Number);
      expect(box!.width / box!.height).toBeCloseTo(viewBox[2] / viewBox[3], 1);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('long category names are cut with an ellipsis and keep the full name as a title', async ({
    page,
  }) => {
    await openPage(page, PATH, 'Chart');
    const live = example(page, 'Long labels');
    const radar = live.locator('star-chart').nth(1);
    const label = radar.locator('text.star-chart__axis', { hasText: 'Battery life' });
    await expect(label).toContainText('…');
    // The text node of the label, without the title element.
    const shown = await label.evaluate((node) => node.firstChild!.textContent!.trim());
    expect(shown.length).toBeLessThanOrEqual(18);
    await expect(label.locator('title')).toHaveText('Battery life under heavy load');
    // A name that fits stays as it is, without a title.
    const short = radar.locator('text.star-chart__axis', { hasText: /^\s*Sound\s*$/ });
    await expect(short.locator('title')).toHaveCount(0);
    // The table keeps the full name.
    await expect(
      radar.getByRole('table', { name: 'Detailed ratings' }).getByRole('row').nth(1),
    ).toContainText('Battery life under heavy load');
  });

  /** WCAG contrast ratio of the stroke of each element against the surface token. */
  async function strokeContrast(page: Page, marks: Locator): Promise<number[]> {
    const surface = await tokenColor(page, '--star-surface');
    return marks.evaluateAll((nodes, surfaceColor) => {
      const channels = (color: string) => {
        const unit = color.startsWith('color(') ? 1 : 255;
        return (color.replace(/^color\(srgb/, '').match(/[\d.]+/g) ?? [])
          .slice(0, 3)
          .map((value) => {
            const share = Number(value) / unit;
            return share <= 0.03928 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
          });
      };
      const luminance = (color: string) => {
        const [r, g, b] = channels(color);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const back = luminance(surfaceColor);
      return nodes.map((node) => {
        const front = luminance(getComputedStyle(node).stroke);
        return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05);
      });
    }, surface);
  }

  for (const theme of ['light', 'dark'] as const) {
    test(`new chart types use the series tokens and visible outlines in the ${theme} theme`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.addInitScript((value) => localStorage.setItem('star-theme', value), theme);
      await openPage(page, PATH, 'Chart');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const fills = (marks: Locator) =>
        marks.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).fill));

      // Stacked bar: the four segments of the first column are series 1 to 4.
      const stacked = example(page, 'Stacked bar chart').locator('.star-chart__segment');
      const stackedFills = await fills(stacked);
      for (const slot of [1, 2, 3, 4]) {
        expect(stackedFills[slot - 1]).toBe(await tokenColor(page, `--star-chart-${slot}`));
      }
      expect(await stacked.first().getAttribute('style')).toContain('--mark: var(--star-chart-1)');

      // Radar: vertex and polygon fill are series 1 to 3.
      const radar = example(page, 'Radar chart');
      const vertexFills = await fills(radar.locator('.star-chart__vertex'));
      for (const slot of [1, 2, 3]) {
        expect(vertexFills[(slot - 1) * 6]).toBe(await tokenColor(page, `--star-chart-${slot}`));
      }
      const polygonFills = await fills(radar.locator('.star-chart__polygon'));
      expect(polygonFills[1]).toBe(await tokenColor(page, '--star-chart-2'));

      // Polar area: one color, series 1.
      const sectorFills = await fills(
        example(page, 'Polar area chart').locator('.star-chart__sector'),
      );
      expect(new Set(sectorFills)).toEqual(new Set([await tokenColor(page, '--star-chart-1')]));

      // Scatter: series 1 and 2.
      const scatterFills = await fills(
        example(page, 'Scatter chart').locator('.star-chart__point'),
      );
      expect(scatterFills[0]).toBe(await tokenColor(page, '--star-chart-1'));
      expect(scatterFills[11]).toBe(await tokenColor(page, '--star-chart-2'));

      // Every mark has an outline with at least 3:1 contrast against the surface, also the
      // slots that are lighter than 3:1 on their own.
      for (const [heading, selector] of [
        ['Stacked bar chart', '.star-chart__segment'],
        ['Radar chart', '.star-chart__polygon, .star-chart__vertex'],
        ['Polar area chart', '.star-chart__sector'],
        ['Scatter chart', '.star-chart__point'],
      ]) {
        const ratios = await strokeContrast(page, example(page, heading).locator(selector));
        expect(ratios.length).toBeGreaterThan(0);
        for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(3);
      }
    });
  }

  test('marks do not animate when the user prefers reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPage(page, PATH, 'Chart');
    for (const [heading, selector] of [
      ['Stacked bar chart', '.star-chart__segment'],
      ['Radar chart', '.star-chart__vertex'],
      ['Polar area chart', '.star-chart__sector'],
      ['Scatter chart', '.star-chart__point'],
    ]) {
      const duration = await example(page, heading)
        .locator(selector)
        .first()
        .evaluate((node) => getComputedStyle(node).transitionDuration);
      expect(duration).toBe('0s');
    }
  });
});
