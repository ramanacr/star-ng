import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env['E2E_PORT'] ?? 4300);

/**
 * Tests of the GitHub Pages build of the docs application (`pnpm e2e:pages`). They run against
 * `tools/pages-serve.mjs`, which serves `dist/docs/browser` under `/star-ng/` and answers an
 * unknown path with `404.html` and the status 404, like GitHub Pages. `pnpm e2e:pages` builds
 * first (`pnpm build:pages`). These tests are not part of `pnpm e2e`.
 */
export default defineConfig({
  testDir: './e2e/pages',
  outputDir: './test-results-pages',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node tools/pages-serve.mjs --port ${PORT}`,
    url: `http://localhost:${PORT}/star-ng/`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
