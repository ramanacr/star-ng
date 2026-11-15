import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env['E2E_PORT'] ?? 4200);
const BASE_URL = process.env['E2E_BASE_URL'] ?? `http://localhost:${PORT}`;

/**
 * End-to-end tests of the library, run against the docs application. By default Playwright
 * starts `ng serve docs`. Set E2E_BASE_URL to run against a deployed docs site instead.
 */
export default defineConfig({
  testDir: './e2e',
  // The visual regression tests have their own config (playwright.visual.config.ts).
  testIgnore: '**/visual/**',
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
  webServer: process.env['E2E_BASE_URL']
    ? undefined
    : {
        // Started through node, so it works where `pnpm` is not on the PATH (corepack only).
        command: `node node_modules/@angular/cli/bin/ng.js serve docs --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env['CI'],
        timeout: 180_000,
      },
});
