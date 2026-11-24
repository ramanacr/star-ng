import { expect, Page, test } from '@playwright/test';
import { DOCS_PAGES, example, openPage } from './support';

/**
 * Screen-reader text (`.star-sr-only`) has `position: absolute`. Its box is placed by its
 * containing block: the nearest positioned ancestor. When a scroll area between the text and that
 * ancestor is not positioned, the scroll area does not clip the text. Text in the part of the
 * content that is scrolled out of view then sticks out of the scroll area and widens the page
 * (issue #39: a wide table in right-to-left gave the page a sideways scroll).
 *
 * `escapes` lists each `.star-sr-only` box that is outside a scroll or clip area that holds it
 * in the DOM but does not contain it as a containing block.
 */
async function escapes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const name = (element: Element): string => {
      const classes =
        typeof element.className === 'string'
          ? element.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.')
          : '';
      return element.tagName.toLowerCase() + (classes ? `.${classes}` : '');
    };
    /** The element that is the containing block of an absolutely positioned child, or null. */
    const containingBlock = (element: Element): Element | null => {
      for (let up = element.parentElement; up; up = up.parentElement) {
        const style = getComputedStyle(up);
        if (
          style.position !== 'static' ||
          style.transform !== 'none' ||
          style.perspective !== 'none' ||
          style.filter !== 'none' ||
          /layout|paint|strict|content/.test(style.contain)
        ) {
          return up;
        }
      }
      return null;
    };
    const findings: string[] = [];
    for (const text of Array.from(document.querySelectorAll('.star-sr-only'))) {
      if (getComputedStyle(text).position !== 'absolute') continue;
      const block = containingBlock(text);
      const rect = text.getBoundingClientRect();
      for (let up = text.parentElement; up && up !== block; up = up.parentElement) {
        const style = getComputedStyle(up);
        if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
        const box = up.getBoundingClientRect();
        if (
          rect.left < box.left - 1 ||
          rect.right > box.right + 1 ||
          rect.top < box.top - 1 ||
          rect.bottom > box.bottom + 1
        ) {
          findings.push(`${name(up)} does not contain ${name(text)}`);
          break;
        }
      }
    }
    return findings;
  });
}

for (const dir of ['ltr', 'rtl'] as const) {
  test.describe(`screen-reader text stays in its scroll area (${dir})`, () => {
    test.beforeEach(async ({ page }) => {
      // The docs application reads this key when it starts.
      await page.addInitScript((value) => localStorage.setItem('star-direction', value), dir);
    });

    test('a wide editable table does not give the page a sideways scroll', async ({ page }) => {
      // A phone, so that the table is wider than its scroll area (issue #39).
      await page.setViewportSize({ width: 375, height: 812 });
      await openPage(page, '/controls/table-edit', 'Table editing');
      await expect(page.locator('html')).toHaveAttribute('dir', dir);
      const scroll = example(page, 'Inline cell edit').locator('.star-table__scroll');
      // The cells hold hidden text, for example the name of each edit button.
      await expect(scroll.locator('.star-sr-only').first()).toBeAttached();
      // The table scrolls sideways in its scroll area.
      expect(await scroll.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeGreaterThan(50);
      // No ancestor of the scroll area, up to the page, scrolls sideways.
      const wider = await scroll.evaluate((el) => {
        const found: string[] = [];
        for (let up = el.parentElement; up; up = up.parentElement) {
          if (up.scrollWidth > up.clientWidth + 1) {
            found.push(
              `${up.tagName.toLowerCase()}.${up.className}: ${up.scrollWidth} > ${up.clientWidth}`,
            );
          }
        }
        return found;
      });
      expect(wider).toEqual([]);
      expect(await escapes(page)).toEqual([]);
    });

    // Every docs page on a phone, where most wide controls scroll.
    test.describe('docs pages', () => {
      test.use({ viewport: { width: 375, height: 812 } });

      for (const path of DOCS_PAGES) {
        test(`${path}`, async ({ page }) => {
          await page.goto(`/${path}`);
          await expect(page.locator('html')).toHaveAttribute('dir', dir);
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          await page.waitForLoadState('networkidle');
          // Entry animations and lazy examples settle.
          await page.waitForTimeout(250);
          expect(await escapes(page)).toEqual([]);
        });
      }
    });
  });
}
