import { expect, Page, test } from '@playwright/test';
import { collectErrors, DOCS_PAGES } from './support';

const PAGES = DOCS_PAGES;

/**
 * Right-to-left sweep: every page of the docs navigation is opened with `dir="rtl"` on `<html>`.
 * A page passes when
 *   - the page does not scroll sideways,
 *   - no example live area scrolls sideways or has content outside its own box (in RTL the
 *     browser cannot scroll to content that sticks out on the left, so `scrollWidth` alone would
 *     miss it: the box of each element is compared with the box of the live area),
 *   - the page writes no console error.
 */

/** Pixels of rounding that are not a layout fault. */
const TOLERANCE = 1;

/**
 * Elements that may stick out of an example live area on purpose, with the reason:
 * - `.star-sr-only`, `[hidden]`, `[inert]`: not visible.
 * - `.star-table__scroll` and every other element with its own `overflow` other than `visible`
 *   clip or scroll their content (wide tables, carousel tracks): their children are skipped by
 *   the walk, only the scroller itself is compared.
 */
const SKIPPED = '.star-sr-only, .cdk-visually-hidden, [hidden], [inert]';

interface Finding {
  readonly where: string;
  readonly detail: string;
}

async function sweep(page: Page): Promise<Finding[]> {
  return page.evaluate(
    ({ tolerance, skipped }) => {
      const findings: { where: string; detail: string }[] = [];
      const name = (element: Element): string => {
        const classes =
          typeof element.className === 'string'
            ? element.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.')
            : '';
        return element.tagName.toLowerCase() + (classes ? `.${classes}` : '');
      };
      const root = document.documentElement;
      if (root.scrollWidth > root.clientWidth + tolerance) {
        findings.push({
          where: 'page',
          detail: `scrollWidth ${root.scrollWidth} > clientWidth ${root.clientWidth}`,
        });
      }
      const examples = Array.from(document.querySelectorAll('docs-example'));
      for (const example of examples) {
        const title = example.querySelector('h3')?.textContent?.trim() ?? 'example';
        const live = example.querySelector<HTMLElement>('.docs-example__live');
        if (!live) continue;
        if (live.scrollWidth > live.clientWidth + tolerance) {
          findings.push({
            where: title,
            detail: `live area scrollWidth ${live.scrollWidth} > clientWidth ${live.clientWidth}`,
          });
        }
        const box = live.getBoundingClientRect();
        for (const element of Array.from(live.querySelectorAll('*'))) {
          if (element.closest(skipped)) continue;
          const style = getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          // An ancestor inside the live area that clips or scrolls its content hides the overflow.
          let clipped = false;
          for (let up = element.parentElement; up && up !== live; up = up.parentElement) {
            const overflow = getComputedStyle(up).overflowX;
            if (overflow !== 'visible') {
              clipped = true;
              break;
            }
          }
          if (clipped || style.position === 'fixed') continue;
          if (rect.left < box.left - tolerance || rect.right > box.right + tolerance) {
            findings.push({
              where: title,
              detail: `${name(element)} [${Math.round(rect.left)}, ${Math.round(rect.right)}] outside live area [${Math.round(box.left)}, ${Math.round(box.right)}]`,
            });
            break;
          }
        }
      }
      return findings;
    },
    { tolerance: TOLERANCE, skipped: SKIPPED },
  );
}

test.describe('right-to-left sweep', () => {
  test.beforeEach(async ({ page }) => {
    // The docs application reads this key when it starts, like a product that saves the choice.
    await page.addInitScript(() => localStorage.setItem('star-direction', 'rtl'));
  });

  test('the sweep covers the whole navigation', () => {
    expect(PAGES.length).toBeGreaterThan(90);
    expect(PAGES).toContain('guides/right-to-left');
  });

  for (const path of PAGES) {
    test(`${path} has no sideways overflow and no error`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(`/${path}`);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForLoadState('networkidle');
      // Entry animations and lazy examples settle.
      await page.waitForTimeout(250);
      expect(await sweep(page)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
});

test.describe('direction switch of the docs application', () => {
  test('the button sets dir on html and remembers the choice', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'ltr');
    const button = page.locator('.docs-header').getByRole('button', { name: 'Text direction' });
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await button.click();
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('star-direction'))).toBe('rtl');

    await page.reload();
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(button).toHaveAttribute('aria-pressed', 'true');

    await button.click();
    await expect(html).toHaveAttribute('dir', 'ltr');
    expect(await page.evaluate(() => localStorage.getItem('star-direction'))).toBe('ltr');
  });

  test('the side navigation sits on the start side in both directions', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('.docs-nav');
    const main = page.locator('.docs-main');
    await expect(nav).toBeVisible();
    const ltr = { nav: await nav.boundingBox(), main: await main.boundingBox() };
    expect(ltr.nav!.x).toBeLessThan(ltr.main!.x);
    await page.locator('.docs-header__dir').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const rtl = { nav: await nav.boundingBox(), main: await main.boundingBox() };
    expect(rtl.nav!.x).toBeGreaterThan(rtl.main!.x);
  });
});
