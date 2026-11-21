import { expect, Locator, Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Route paths of the docs navigation, read from `nav.ts` as text. The file is not imported:
 * it loads every docs page with a dynamic `import()`, which the e2e project cannot type check.
 */
export const DOCS_PAGES: readonly string[] = [
  ...readFileSync(join(__dirname, '../projects/docs/src/app/nav.ts'), 'utf8').matchAll(
    /^\s+path: '([^']+)',$/gm,
  ),
].map((match) => match[1]);

/**
 * Tests that need a development build carry the tag `@dev` in the title and call this first.
 * The static run (E2E_STATIC_DIR, the production build) skips them; the CI job `e2e-dev` and a
 * normal local run (`ng serve`) execute them. Use it only for a check that a production build
 * cannot do, for example `window.ng`.
 */
export function needsDevBuild(): void {
  test.skip(
    !!process.env['E2E_STATIC_DIR'] && !process.env['E2E_BASE_URL'],
    'needs a development build (window.ng): run by the e2e-dev job against ng serve',
  );
}

/**
 * Opens a docs page, waits for its heading and then for hydration. The production build is
 * prerendered, so the page is visible before the application runs, and a key, a click or a fill
 * before hydration is lost. A hydrated component loses its `ngh` attribute; the development
 * server does not prerender, so there the wait ends at once.
 */
export async function openPage(page: Page, path: string, heading: string | RegExp): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  await expect(page.locator('docs-root[ngh], #main [ngh]')).toHaveCount(0, { timeout: 15_000 });
}

/**
 * Waits until the cross-fade of a page change (a view transition of the router) has ended.
 * While it runs, the browser sends every pointer event to the document element, not to the
 * page, so a `page.mouse` press on the new page does nothing. A `click()` does not need this:
 * it waits until the element receives the pointer events.
 */
export async function pageTransitionDone(page: Page): Promise<void> {
  // Without `document.activeViewTransition` the wait below would end at once and hide the cause
  // of a missed press, so the helper fails instead.
  expect(
    await page.evaluate(() => 'activeViewTransition' in document),
    'document.activeViewTransition is supported by this browser',
  ).toBe(true);
  await page.waitForFunction(
    () => !(document as Document & { activeViewTransition?: unknown }).activeViewTransition,
  );
}

/** The live area of one example of the open page, found by the example heading. */
export function example(page: Page, heading: string): Locator {
  return page
    .locator('docs-example')
    .filter({ has: page.getByRole('heading', { level: 2, name: heading, exact: true }) })
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

/**
 * A toolbar control of an editor example. When its group is in the "More actions" panel (a
 * narrow page), the panel opens first.
 */
export async function editorTool(live: Locator, name: string): Promise<Locator> {
  const control = live.getByRole('button', { name, exact: true });
  if ((await control.count()) === 0) {
    await live.getByRole('button', { name: 'More actions' }).click();
  }
  return control;
}
