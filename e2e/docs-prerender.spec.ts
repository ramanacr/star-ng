import { expect, test } from '@playwright/test';
import { collectErrors, DOCS_PAGES } from './support';

/**
 * Every docs page is prerendered: the production build writes `<route>/index.html` with the
 * title, the first-level heading and the text of that page in the HTML source. These tests read
 * that source with `request.get` (no JavaScript runs), so they cannot pass because the browser
 * rendered the page after the load.
 *
 * The static server of the test run answers an address without a file with the client-rendered
 * shell `index.csr.html` (status 200). The shell has no heading, so a page that was not
 * prerendered fails on its heading text and not only on its status.
 *
 * The development server (`ng serve`) does not prerender: these tests run against the production
 * build (`E2E_STATIC_DIR`) or a deployed site (`E2E_BASE_URL`).
 */
test.skip(
  !process.env['E2E_STATIC_DIR'] && !process.env['E2E_BASE_URL'],
  'needs the production build, which prerenders (E2E_STATIC_DIR): the dev server does not',
);

/** Text of the first element with this tag, without nested tags. */
const textOf = (html: string, tag: string): string =>
  (new RegExp(`<${tag}[^>]*>([^]*?)</${tag}>`).exec(html)?.[1] ?? '')
    .replace(/<[^>]*>/g, '')
    .trim();

test.describe('prerendered docs pages', () => {
  for (const [path, title, heading, text] of [
    ['/', 'StarNG', 'StarNG', 'Accessible Angular controls built on signals'],
    ['/controls/table', 'Table · StarNG', 'Table', 'A data table with typed columns'],
    ['/controls/select', 'Select · StarNG', 'Select', 'A dropdown for one choice'],
    ['/guides/theming', 'Theming and tokens · StarNG', 'Theming and tokens', '--star-'],
  ] as const) {
    test(`${path} answers 200 with its own title, heading and text in the HTML`, async ({
      request,
    }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(textOf(html, 'title')).toBe(title);
      expect(textOf(html, 'h1')).toBe(heading);
      expect(html).toContain(text);
      // The page text is inside the application root: it was rendered, not only the shell.
      expect(html).toMatch(/<docs-root[^>]*>\s*<a [^>]*docs-skip/);
    });
  }

  test('every page of the navigation has its heading in the HTML', async ({ request }) => {
    expect(DOCS_PAGES.length).toBeGreaterThan(90);
    const missing: string[] = [];
    for (const path of DOCS_PAGES) {
      const response = await request.get(`/${path}`);
      const heading = textOf(await response.text(), 'h1');
      if (response.status() !== 200 || !heading) missing.push(`${path}: ${response.status()}`);
    }
    expect(missing).toEqual([]);
  });

  test('an unknown address gets the fallback shell, not the content of a page', async ({
    page,
    request,
  }) => {
    const response = await request.get('/no/such/page');
    const html = await response.text();
    expect(html).toContain('<docs-root></docs-root>');
    expect(html).not.toContain('<h1');
    // The shell starts the application, and the router sends an unknown address to the home page.
    await page.goto('/no/such/page');
    await expect(page.getByRole('heading', { level: 1, name: 'StarNG' })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test('the browser reuses the prerendered page (hydration) without an error', async ({ page }) => {
    const errors = collectErrors(page);
    // Counts the header elements that the document loses while the application starts. A
    // second render would remove the header of the prerendered page and draw a new one.
    await page.addInitScript(() => {
      (window as unknown as { __headerRemoved: number }).__headerRemoved = 0;
      new MutationObserver((records) => {
        for (const record of records)
          for (const node of record.removedNodes)
            if (node instanceof Element && node.matches('.docs-header'))
              (window as unknown as { __headerRemoved: number }).__headerRemoved++;
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto('/controls/table');
    await expect(page.getByRole('heading', { level: 1, name: 'Table' })).toBeVisible();
    // The application is running: the direction button responds.
    const direction = page.getByRole('button', { name: /^Text direction: / });
    await expect(direction).toHaveAttribute('aria-pressed', 'false');
    await direction.click();
    await expect(direction).toHaveAttribute('aria-pressed', 'true');
    expect(
      await page.evaluate(() => (window as unknown as { __headerRemoved: number }).__headerRemoved),
    ).toBe(0);
    expect(errors).toEqual([]);
  });
});

test.describe('saved text direction on the prerendered page', () => {
  /** Keeps the two first-paint scripts and stops every other script, so the app never starts. */
  const blockApplication = async (page: import('@playwright/test').Page) =>
    page.route('**/*.js', (route) =>
      /\/(docs-direction|star-theme)-first-paint\.js$/.test(new URL(route.request().url()).pathname)
        ? route.continue()
        : route.abort(),
    );

  test('a saved rtl choice sets dir="rtl" before the application runs', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('star-direction', 'rtl'));
    await blockApplication(page);
    await page.goto('/controls/table');
    // The prerendered HTML says dir="ltr": only the first-paint script can have set this.
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    // Nothing started: no application, no hydrated header.
    await expect(page.locator('.docs-header')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.hasAttribute('ng-version'))).toBe(
      false,
    );
  });

  test('without a saved choice, or with ltr, the direction stays ltr', async ({ page }) => {
    await blockApplication(page);
    await page.goto('/controls/table');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.evaluate(() => localStorage.setItem('star-direction', 'ltr'));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('blocked storage does not throw and keeps ltr', async ({ page }) => {
    // Only uncaught exceptions count: the blocked application scripts log failed requests.
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    await blockApplication(page);
    await page.goto('/controls/table');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    expect(errors).toEqual([]);
  });

  test('the application keeps rtl: no flip, no console error', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('star-direction', 'rtl');
      // Every value that `dir` on <html> gets while the page loads.
      const seen: (string | null)[] = [];
      (window as unknown as { __dirSeen: typeof seen }).__dirSeen = seen;
      new MutationObserver((records) => {
        for (const record of records)
          if (record.attributeName === 'dir')
            seen.push((record.target as Element).getAttribute('dir'));
      }).observe(document, { attributes: true, attributeFilter: ['dir'], subtree: true });
    });
    await page.goto('/controls/table');
    await expect(page.getByRole('heading', { level: 1, name: 'Table' })).toBeVisible();
    const direction = page.getByRole('button', { name: /^Text direction: / });
    await expect(direction).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const seen = await page.evaluate(
      () => (window as unknown as { __dirSeen: (string | null)[] }).__dirSeen,
    );
    expect(seen).not.toContain('ltr');
    expect(errors).toEqual([]);
  });
});

test('the prerendered styling hooks guide has the pass-through and the unstyled mode', async ({
  request,
}) => {
  const html = await (await request.get('/guides/styling-hooks')).text();
  // The select with a pass-through: its trigger has the data attribute of the pt.
  expect(html).toContain('data-test="city-trigger"');
  // The unstyled select: its trigger and control parts are marked in the server HTML too.
  const unstyled = /<star-select[^>]*aria-label|<star-select[^>]*data-star-unstyled[^>]*>/.exec(
    html,
  );
  expect(unstyled).not.toBeNull();
  expect(html).toMatch(
    /data-star-part="triggerPanel"[^>]*data-star-unstyled|data-star-unstyled[^>]*data-star-part="triggerPanel"/,
  );
});
