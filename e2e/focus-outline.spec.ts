import { expect, test } from '@playwright/test';
import { DOCS_PAGES } from './support';

/**
 * A control that wraps a text field draws the focus ring on the wrapper. The docs application
 * has a global rule `:focus-visible { outline: … }`, as many applications do. That rule must
 * not add a second outline around the inner field (it has the same specificity as a plain
 * `outline: none`, so the library names `:focus-visible` in its own rule).
 */
test('no text field of a control draws an outline of its own when focused', async ({ page }) => {
  test.slow();
  const outlined: string[] = [];
  for (const path of DOCS_PAGES) {
    await page.goto(`/${path}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const hits = await page.evaluate(() => {
      const found: string[] = [];
      const fields = document.querySelectorAll<HTMLElement>(
        [
          '.docs-example__live input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color])',
          '.docs-example__live textarea',
          '.docs-example__live [contenteditable=true]',
        ].join(', '),
      );
      for (const field of fields) {
        if ((field as HTMLInputElement).disabled || field.offsetWidth === 0) continue;
        field.focus();
        const style = getComputedStyle(field);
        if (
          document.activeElement === field &&
          style.outlineStyle !== 'none' &&
          parseFloat(style.outlineWidth) > 0
        ) {
          found.push(field.className || field.tagName);
        }
      }
      return found;
    });
    outlined.push(...hits.map((name) => `${path}: ${name}`));
  }
  expect(outlined).toEqual([]);
});
