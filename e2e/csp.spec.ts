import { expect, Page, test } from '@playwright/test';
import {
  STAR_THEME_FIRST_PAINT_HASH,
  starThemeFirstPaintElement,
  starThemeFirstPaintScript,
} from '../projects/star-ng/theme/first-paint';
import { openPage } from './support';

/** Records every CSP violation of the page (events and console messages). */
async function trackViolations(page: Page): Promise<() => Promise<string[]>> {
  const messages: string[] = [];
  page.on('console', (message) => {
    if (/content security policy/i.test(message.text())) messages.push(message.text());
  });
  await page.addInitScript(() => {
    const store: string[] = ((window as any).__cspViolations = []);
    document.addEventListener('securitypolicyviolation', (event) =>
      store.push(`${event.violatedDirective} ${event.blockedURI}`),
    );
  });
  return async () => [
    ...messages,
    ...(await page.evaluate(() => (window as any).__cspViolations ?? [])),
  ];
}

test.describe('Content Security Policy of the docs application', () => {
  test('the docs page sends a strict policy with no unsafe-inline script', async ({ page }) => {
    await page.goto('/');
    const policy = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    const script = /(?:^|;)\s*script-src ([^;]*)/.exec(policy ?? '')?.[1];
    expect(script).toBe("'self'");
    await expect(page.locator('head script:not([src])')).toHaveCount(0);
    await expect(page.locator('head script[src="star-theme-first-paint.js"]')).toHaveCount(1);
  });

  test('the dark mode guide shows the current hash and the three forms', async ({ page }) => {
    await openPage(page, '/guides/dark-mode', 'Dark mode');
    await expect(
      page.getByRole('heading', { level: 2, name: 'Content Security Policy' }),
    ).toBeVisible();
    for (const name of ['1. External file', '2. Hash', '3. Nonce']) {
      await expect(page.getByRole('heading', { level: 3, name })).toBeVisible();
    }
    await expect(page.getByLabel('Hash form')).toContainText(STAR_THEME_FIRST_PAINT_HASH);
  });

  for (const [path, heading] of [
    ['/', 'StarNG'],
    ['/controls/image-compare', 'Image compare'],
    ['/controls/dialog', 'Dialog'],
  ] as const) {
    test(`no policy violation on ${path}`, async ({ page }) => {
      const violations = await trackViolations(page);
      await openPage(page, path, heading);
      // Open a menu and the theme switch: they add elements and styles at run time.
      await page
        .locator('.docs-header')
        .getByRole('button', { name: /^Theme: / })
        .click();
      await page.waitForTimeout(300);
      expect(await violations()).toEqual([]);
    });
  }
});

test.describe('strict policy with the inline script', () => {
  const html = (head: string) =>
    `<!doctype html><html><head><meta charset="utf-8">${head}</head><body>page</body></html>`;

  async function serve(page: Page, policy: string, head: string): Promise<void> {
    await page.route('**/__csp/page', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        headers: { 'content-security-policy': policy },
        body: html(head),
      }),
    );
  }

  test('runs when the hash of the text is in script-src', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    const violations = await trackViolations(page);
    await serve(
      page,
      `script-src ${STAR_THEME_FIRST_PAINT_HASH}`,
      `<script>${starThemeFirstPaintScript()}</script>`,
    );
    await page.goto('/__csp/page');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await violations()).toEqual([]);
  });

  test('is blocked when the text differs by one character', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    const violations = await trackViolations(page);
    await serve(
      page,
      `script-src ${STAR_THEME_FIRST_PAINT_HASH}`,
      `<script>${starThemeFirstPaintScript()} </script>`,
    );
    await page.goto('/__csp/page');
    await expect.poll(async () => (await violations()).length).toBeGreaterThan(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
  });

  test('runs with a matching nonce and is blocked without it', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await serve(page, `script-src 'nonce-abc123XYZ'`, starThemeFirstPaintElement('abc123XYZ'));
    await page.goto('/__csp/page');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const blocked = await page.context().newPage();
    await blocked.emulateMedia({ colorScheme: 'dark' });
    await serve(blocked, `script-src 'nonce-abc123XYZ'`, starThemeFirstPaintElement('otherNonce1'));
    await blocked.goto('/__csp/page');
    await expect(blocked.locator('html')).not.toHaveAttribute('data-theme', /.*/);
  });
});
