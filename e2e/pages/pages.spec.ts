import { expect, Page, test } from '@playwright/test';

/**
 * The docs application as GitHub Pages serves it: under the sub-path `/star-ng/`, with
 * `404.html` as the only fallback (status 404). Run with `pnpm e2e:pages`.
 */
const BASE = '/star-ng/';

/** Console errors, page errors and CSP violations of a page, from the moment of the call. */
async function trackProblems(page: Page, expected404?: string): Promise<() => Promise<string[]>> {
  const problems: string[] = [];
  page.on('console', (message) => {
    // Chrome logs the 404 status of a deep link document itself as a console error.
    if (expected404 && message.location().url.endsWith(expected404)) return;
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => problems.push(`failed: ${request.url()}`));
  await page.addInitScript(() => {
    const store: string[] = ((window as any).__csp = []);
    document.addEventListener('securitypolicyviolation', (event) =>
      store.push(`${event.violatedDirective} ${event.blockedURI}`),
    );
  });
  return async () => [
    ...problems,
    ...(await page.evaluate(() => (window as any).__csp as string[])).map((v) => `csp: ${v}`),
  ];
}

const heading = (page: Page, name: string | RegExp) =>
  page.getByRole('heading', { level: 1, name });

test.describe('docs site under /star-ng/', () => {
  test('the home page loads without console error or CSP violation', async ({ page }) => {
    const problems = await trackProblems(page);
    const response = await page.goto(BASE);
    expect(response?.status()).toBe(200);
    await expect(heading(page, 'StarNG')).toBeVisible();
    await expect(page.locator('base')).toHaveAttribute('href', BASE);
    expect(await problems()).toEqual([]);
  });

  test('a click through the navigation changes page and address', async ({ page }) => {
    const problems = await trackProblems(page);
    await page.goto(BASE);
    await page
      .locator('docs-root')
      .getByRole('link', { name: 'Button', exact: true })
      .first()
      .click();
    await expect(heading(page, 'Button')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${BASE}controls/button$`));
    expect(await problems()).toEqual([]);
  });

  test('a deep link renders the page (the response is the 404.html, status 404)', async ({
    page,
  }) => {
    const problems = await trackProblems(page, `${BASE}controls/button`);
    const response = await page.goto(`${BASE}controls/button`);
    expect(response?.status()).toBe(404);
    await expect(heading(page, 'Button')).toBeVisible();
    expect(await problems()).toEqual([]);
  });

  test('a reload on a deep link keeps the page', async ({ page }) => {
    await page.goto(`${BASE}controls/button`);
    await expect(heading(page, 'Button')).toBeVisible();
    await page.reload();
    await expect(heading(page, 'Button')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${BASE}controls/button$`));
  });

  test('an unknown route redirects to the home page', async ({ page }) => {
    await page.goto(`${BASE}no/such/page`);
    await expect(heading(page, 'StarNG')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${BASE}$`));
  });

  test('the first-paint script applies a saved dark theme without application scripts', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('star-theme', 'dark'));
    await page.route('**/*.js', (route) =>
      new URL(route.request().url()).pathname === `${BASE}star-theme-first-paint.js`
        ? route.continue()
        : route.abort(),
    );
    await page.goto(BASE);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('the icon font loads from the sub-path and an icon has a width', async ({ page }) => {
    const fonts: { url: string; status: number }[] = [];
    page.on('response', (response) => {
      if (/\.woff2?$/.test(new URL(response.url()).pathname))
        fonts.push({ url: response.url(), status: response.status() });
    });
    await page.goto(BASE);
    await expect(heading(page, 'StarNG')).toBeVisible();
    const icon = page.locator('.docs-header i.ph-fill.ph-star');
    await expect(icon).toBeAttached();
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(async () => (await icon.boundingBox())?.width ?? 0, { message: 'icon width' })
      .toBeGreaterThan(0);
    expect(fonts.length).toBeGreaterThan(0);
    for (const font of fonts) {
      expect(font.url).toContain(`${BASE}media/`);
      expect(font.status).toBe(200);
    }
    expect(await page.evaluate(() => document.fonts.check('1em "Phosphor-Bold"'))).toBe(true);
  });
});
