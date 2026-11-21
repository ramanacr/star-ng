import { expect, test } from '@playwright/test';
import { collectErrors } from './support';

/**
 * The docs load a subset of the Phosphor icons (tools/docs-icons.mjs writes it from the package
 * CSS). These tests check that subset from the outside, without the tool:
 *   1. Every icon in the prerendered HTML of a page (`ph-<weight>` with `ph-<name>` on one
 *      element) has its `:before` rule in the CSS that the page loads: the global stylesheet and
 *      the `<style>` elements in its `<head>`.
 *   2. After hydration, every icon element on the page draws a glyph (its `::before` content is
 *      not `none`), and the icon fonts load without an error.
 * They run against the production build (`E2E_STATIC_DIR`), which prerenders.
 */
test.skip(
  !process.env['E2E_STATIC_DIR'] && !process.env['E2E_BASE_URL'],
  'needs the production build, which prerenders (E2E_STATIC_DIR): the dev server does not',
);

const WEIGHTS = ['ph-thin', 'ph-light', 'ph-bold', 'ph-fill', 'ph-duotone'];

/** `ph-<weight> ph-<name>` pairs of a class list (the regular weight class is `ph`). */
function iconsOf(classList: string): string[] {
  const names = classList.split(/\s+/).filter((c) => c.startsWith('ph'));
  const weights = names.filter((c) => c === 'ph' || WEIGHTS.includes(c));
  const icons = names.filter((c) => c.startsWith('ph-') && !WEIGHTS.includes(c));
  return weights.flatMap((weight) => icons.map((icon) => `.${weight}.${icon}`));
}

/** The `.ph-<weight>.ph-<name>` selectors that have a `:before` rule in a stylesheet. */
function iconRules(css: string): Set<string> {
  return new Set([...css.matchAll(/(\.ph(?:-[a-z]+)?\.ph-[a-z0-9-]+)::?before/g)].map((m) => m[1]));
}

test.describe('Phosphor icon subset', () => {
  for (const path of [
    '',
    'controls/table',
    'controls/menu',
    'controls/icon',
    'controls/file-manager',
    'controls/editor',
    'controls/message',
    'controls/rating',
  ]) {
    test(`/${path} has a rule and a glyph for every icon`, async ({ page, request }) => {
      const html = await (await request.get(`/${path}`)).text();
      const head = html.slice(0, html.indexOf('</head>'));
      const href = /<link rel="stylesheet" href="([^"]+)"/.exec(head)?.[1];
      expect(href).toBeTruthy();
      const inline = [...head.matchAll(/<style[^>]*>([^]*?)<\/style>/g)].map((m) => m[1]);
      const global = await (await request.get(`/${href}`)).text();
      const rules = iconRules([global, ...inline].join('\n'));
      const used = new Set<string>();
      for (const m of html.matchAll(/class="([^"]*)"/g)) iconsOf(m[1]).forEach((i) => used.add(i));
      expect(used.size).toBeGreaterThan(0);
      expect([...used].filter((icon) => !rules.has(icon))).toEqual([]);

      const fonts: string[] = [];
      page.on('response', (response) => {
        if (/\.woff2?(\?|$)/.test(response.url()))
          fonts.push(`${response.status()} ${response.url()}`);
      });
      const errors = collectErrors(page);
      await page.goto(`/${path}`);
      await expect(page.locator('[ngh]')).toHaveCount(0, { timeout: 15_000 });
      await page.evaluate(() => document.fonts.ready);
      const blank = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[class*="ph-"]')]
          .filter((el) =>
            [...el.classList].some(
              (c) => c.startsWith('ph-') && c !== 'ph-bold' && c !== 'ph-fill',
            ),
          )
          .filter((el) => getComputedStyle(el, '::before').content === 'none')
          .map((el) => el.className),
      );
      expect(blank).toEqual([]);
      expect(fonts.length).toBeGreaterThan(0);
      expect(fonts.filter((line) => !line.startsWith('200 '))).toEqual([]);
      expect(await page.evaluate(() => document.fonts.check('16px "Phosphor-Bold"'))).toBe(true);
      expect(errors).toEqual([]);
    });
  }
});
