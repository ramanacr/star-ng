import { expect, Page, test } from '@playwright/test';
import {
  STAR_THEME_FIRST_PAINT_HASH,
  starThemeFirstPaintElement,
  starThemeFirstPaintScript,
} from '../projects/star-ng/theme/first-paint';
import { collectErrors, openPage } from './support';

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
    const script = /(?:^|;)\s*script-src ([^;]*)/.exec(policy ?? '')?.[1] ?? '';
    // 'self', plus (in the production build) the hashes of the event replay scripts that
    // tools/csp-hashes.mjs adds. Never 'unsafe-inline'.
    const [first, ...hashes] = script.trim().split(/\s+/);
    expect(first).toBe("'self'");
    for (const hash of hashes) expect(hash).toMatch(/^'sha256-[A-Za-z0-9+/]+=*'$/);
    await expect(page.locator('head script:not([src])')).toHaveCount(0);
    await expect(page.locator('head script[src="star-theme-first-paint.js"]')).toHaveCount(1);
  });

  test('the policy of a prerendered page has the hash of each inline script', async ({ page }) => {
    test.skip(!process.env['E2E_STATIC_DIR'], 'needs the production build (prerender)');
    await page.goto('/controls/gantt');
    const result = await page.evaluate(async () => {
      const policy =
        document
          .querySelector('meta[http-equiv="Content-Security-Policy"]')
          ?.getAttribute('content') ?? '';
      const missing: string[] = [];
      const scripts = [...document.querySelectorAll('script:not([src])')].filter((script) =>
        /^(|text\/javascript|module)$/.test(script.getAttribute('type') ?? ''),
      );
      for (const script of scripts) {
        const bytes = new TextEncoder().encode(script.textContent ?? '');
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const hash = btoa(String.fromCharCode(...new Uint8Array(digest)));
        if (!policy.includes(`'sha256-${hash}'`)) missing.push(script.id || 'replay');
      }
      return { count: scripts.length, missing };
    });
    // The event contract and the replay call of incremental hydration.
    expect(result.count).toBe(2);
    expect(result.missing).toEqual([]);
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
    ['/controls/table', 'Table'],
    ['/controls/gantt', 'Gantt chart'],
    ['/controls/editor', 'Editor'],
    ['/controls/tabs', 'Tabs'],
    ['/guides/forms', 'Forms'],
  ] as const) {
    test(`no policy violation and no hydration error on ${path}`, async ({ page }) => {
      const violations = await trackViolations(page);
      const errors = collectErrors(page);
      await openPage(page, path, heading);
      // Open a menu and the theme switch: they add elements and styles at run time.
      await page
        .locator('.docs-header')
        .getByRole('button', { name: /^Theme: / })
        .click();
      await page.waitForTimeout(300);
      expect(await violations()).toEqual([]);
      // A hydration mismatch (NG0500 to NG0507) or any other console error fails the page.
      expect(errors).toEqual([]);
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
