import { expect, test } from '@playwright/test';
import { openPage } from './support';

// The live area of a docs example is a wrapping flex row. A wide control placed straight in it
// must fill the row, and no page may scroll sideways on a phone.
test.describe('docs layout: wide controls fill the example', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const [path, heading, selector] of [
    ['/controls/timeline', 'Timeline', 'star-timeline'],
    ['/controls/org-chart', 'Organization chart', 'star-org-chart'],
    ['/controls/data-view', 'Data view', 'star-data-view'],
  ] as const) {
    test(`${path}: ${selector} is as wide as the live area`, async ({ page }) => {
      await openPage(page, path, heading);
      const widths = await page.locator('.docs-example__live').evaluateAll(
        (lives, sel) =>
          lives.flatMap((live) =>
            [...live.querySelectorAll(sel)].map((node) => {
              const style = getComputedStyle(live);
              return {
                node: node.getBoundingClientRect().width,
                live:
                  live.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
              };
            }),
          ),
        selector,
      );
      expect(widths.length).toBeGreaterThan(0);
      // The first example of the page holds the control in the live area.
      expect(Math.abs(widths[0].node - widths[0].live)).toBeLessThanOrEqual(2);
    });
  }
});

test.describe('docs layout: no sideways page scroll on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const [path, heading] of [
    ['/controls/table', 'Table'],
    ['/controls/table-edit', 'Table editing'],
    ['/controls/timeline', 'Timeline'],
    ['/controls/org-chart', 'Organization chart'],
    ['/controls/editor', 'Editor'],
  ] as const) {
    test(`${path} does not scroll sideways`, async ({ page }) => {
      await openPage(page, path, heading);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
