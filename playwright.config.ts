import { defineConfig, devices } from '@playwright/test';
import { docsWebServer } from './playwright.server';

const PORT = Number(process.env['E2E_PORT'] ?? 4200);
const BASE_URL = process.env['E2E_BASE_URL'] ?? `http://localhost:${PORT}`;

/**
 * End-to-end tests of the library, run against the docs application. By default Playwright
 * starts `ng serve docs`. Set E2E_STATIC_DIR (a built docs folder) to serve the production build
 * instead (CI does this), or E2E_BASE_URL to run against a deployed docs site. See
 * `playwright.server.ts`.
 */
export default defineConfig({
  testDir: './e2e',
  // The visual regression tests and the GitHub Pages tests have their own configs
  // (playwright.visual.config.ts, playwright.pages.config.ts).
  testIgnore: ['**/visual/**', '**/pages/**'],
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: docsWebServer(PORT, BASE_URL),
});
