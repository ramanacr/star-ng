import { expect, Locator, Page } from '@playwright/test';

/** Opens a docs page and waits for its heading. */
export async function openPage(page: Page, path: string, heading: string | RegExp): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
}

/** The live area of one example of the open page, found by the example heading. */
export function example(page: Page, heading: string): Locator {
  return page
    .locator('docs-example')
    .filter({ has: page.getByRole('heading', { level: 3, name: heading, exact: true }) })
    .locator('.docs-example__live');
}

/** Console errors and page errors of a page, collected from the moment of the call. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/**
 * WCAG contrast ratio of the text color against the fill color of each visible element.
 * Returns the elements under `minimum`.
 */
export async function lowContrast(
  elements: Locator,
  minimum = 4.5,
): Promise<{ name: string; ratio: number }[]> {
  const measured = await elements.evaluateAll((nodes) => {
    // `rgb(79, 70, 229)` has 0-255 channels; `color(srgb 0.55 0.32 0.14)` (the result of
    // `color-mix()`) has 0-1 channels.
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
    return nodes
      .filter((node) => (node as HTMLElement).offsetWidth > 0)
      .map((node) => {
        const style = getComputedStyle(node);
        const text = luminance(style.color);
        const fill = luminance(style.backgroundColor);
        const ratio = (Math.max(text, fill) + 0.05) / (Math.min(text, fill) + 0.05);
        return { name: node.className, ratio: Math.round(ratio * 10) / 10 };
      });
  });
  return measured.filter((item) => item.ratio < minimum);
}
