import { expect, Locator, Page, test } from '@playwright/test';
import { example, openPage } from './support';

/** Box, padding and divider of a slot region, and the box of its panel. */
async function measure(region: Locator, panel: Locator) {
  const box = (await region.boundingBox())!;
  const outer = (await panel.boundingBox())!;
  const style = await region.evaluate((el) => {
    const css = getComputedStyle(el);
    return {
      paddingStart: parseFloat(css.paddingInlineStart),
      paddingTop: parseFloat(css.paddingTop),
      borderTop: parseFloat(css.borderTopWidth),
      borderBottom: parseFloat(css.borderBottomWidth),
      fontSize: parseFloat(css.fontSize),
    };
  });
  return { box, outer, ...style };
}

/**
 * Opens a docs page after hydration (a click before it is lost; the pattern of
 * controls-selection.spec.ts).
 */
async function openHydrated(page: Page, control: string, heading: string): Promise<void> {
  await openPage(page, `/controls/${control}`, heading);
  await expect(page.locator(`star-${control}[ngh], docs-${control}-page[ngh]`)).toHaveCount(0, {
    timeout: 15_000,
  });
}

/** Clicks the trigger until the panel is open. */
async function openPanel(page: Page, trigger: Locator): Promise<void> {
  await expect(async () => {
    if ((await page.locator('.star-panel:visible').count()) === 0) {
      await trigger.click();
    }
    await expect(page.locator('.star-panel:visible')).toBeVisible({
      timeout: 1_000,
    });
  }).toPass({ timeout: 15_000 });
}

/** The header and footer regions of the open panel (a popover, inline or in the overlay container). */
function regions(page: Page) {
  const panel = page.locator('.star-panel:visible');
  return {
    panel,
    header: panel.locator('[data-star-part="headerSlotPanel"]'),
    footer: panel.locator('[data-star-part="footerSlotPanel"]'),
  };
}

test.describe('header and footer slots in panels', () => {
  test('select: the regions sit inside the panel, padded, with a divider to the list', async ({
    page,
  }) => {
    await openHydrated(page, 'select', 'Select');
    await openPanel(page, example(page, 'Slots').getByRole('combobox', { name: 'City' }));
    const { panel, header, footer } = regions(page);
    await expect(header).toHaveText('Cities with an office');
    await expect(footer).toHaveText(/cities/);

    const head = await measure(header, panel);
    expect(head.paddingStart).toBeGreaterThan(8);
    expect(head.paddingTop).toBeGreaterThan(4);
    expect(head.borderBottom).toBe(1);
    expect(head.fontSize).toBe(12);
    expect(head.box.y).toBeGreaterThanOrEqual(head.outer.y);

    const foot = await measure(footer, panel);
    expect(foot.paddingStart).toBeGreaterThan(8);
    expect(foot.borderTop).toBe(1);
    // The footer is the bottom of the panel, inside its border, and outside the scrolling list.
    expect(foot.box.y + foot.box.height).toBeLessThanOrEqual(foot.outer.y + foot.outer.height);
    expect(foot.box.y + foot.box.height).toBeGreaterThan(foot.outer.y + foot.outer.height - 3);
    await expect(
      panel.getByRole('listbox').locator('[data-star-part="footerSlotPanel"]'),
    ).toHaveCount(0);
  });

  test('select: the footer stays in view when the list scrolls', async ({ page }) => {
    await openHydrated(page, 'select', 'Select');
    await openPanel(page, example(page, 'Slots').getByRole('combobox', { name: 'City' }));
    const { panel, footer } = regions(page);
    await expect(footer).toBeVisible();
    // Positions relative to the panel, measured in one frame (the panel may still slide in).
    const moved = await panel.evaluate((root) => {
      const list = root.querySelector<HTMLElement>('[role=listbox]')!;
      const foot = root.querySelector('[data-star-part="footerSlotPanel"]')!;
      const head = root.querySelector('[data-star-part="headerSlotPanel"]')!;
      const offsets = () => {
        const top = root.getBoundingClientRect().top;
        return [foot.getBoundingClientRect().top - top, head.getBoundingClientRect().top - top];
      };
      const before = offsets();
      list.scrollTop = list.scrollHeight;
      const after = offsets();
      return { scrolled: list.scrollTop > 0, before, after };
    });
    expect(moved.scrolled).toBe(true);
    expect(moved.after).toEqual(moved.before);
  });

  test('date picker: the regions reach the edges of the padded panel', async ({ page }) => {
    await openHydrated(page, 'date-picker', 'Date picker');
    await openPanel(page, example(page, 'Slots').getByRole('button').first());
    const { panel, header, footer } = regions(page);
    await expect(header).toBeVisible();
    const head = await measure(header, panel);
    expect(Math.abs(head.box.x - head.outer.x)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(head.box.width - head.outer.width)).toBeLessThanOrEqual(3);
    const foot = await measure(footer, panel);
    expect(foot.borderTop).toBe(1);
    expect(Math.abs(foot.box.width - foot.outer.width)).toBeLessThanOrEqual(3);
  });

  test('listbox: the inline box has the same regions', async ({ page }) => {
    await openHydrated(page, 'listbox', 'Listbox');
    const live = example(page, 'Slots');
    const header = live.locator('[data-star-part="headerSlotPanel"]');
    const footer = live.locator('[data-star-part="footerSlotPanel"]');
    await expect(header).toHaveText('Cities with an office');
    await expect(header).toHaveCSS('border-bottom-width', '1px');
    await expect(footer).toHaveCSS('border-top-width', '1px');
    expect(parseFloat(await header.evaluate((el) => getComputedStyle(el).paddingLeft))).toBe(18);
  });

  test('right-to-left: the padding is on the start side (the right)', async ({ page }) => {
    await openHydrated(page, 'select', 'Select');
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    await openPanel(page, example(page, 'Slots').getByRole('combobox', { name: 'City' }));
    const { header } = regions(page);
    await expect(header).toBeVisible();
    const css = await header.evaluate((el) => {
      const style = getComputedStyle(el);
      return { right: style.paddingRight, align: style.direction };
    });
    expect(css.align).toBe('rtl');
    expect(css.right).toBe('18px');
  });
});
