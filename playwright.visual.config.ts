import { defineConfig, devices } from '@playwright/test';
import { docsWebServer } from './playwright.server';

const PORT = Number(process.env['E2E_PORT'] ?? 4200);
const BASE_URL = process.env['E2E_BASE_URL'] ?? `http://localhost:${PORT}`;

/**
 * Visual regression tests: one screenshot of every docs page, in the light and the dark theme.
 *
 * The baseline images in `e2e/visual/__screenshots__/` are made on Linux in CI only (the
 * `visual-baselines` workflow, or the first run of the `visual` CI job). Text rendering and
 * system fonts differ per operating system, so a Windows or macOS image would never match.
 * The path template has no platform or project part for that reason: there is one set of
 * baselines, and the tests skip on every other machine (see `e2e/visual/guard.ts`).
 *
 * `retries` is 0 on purpose. With the default `updateSnapshots: 'missing'` a missing baseline
 * is written and the test fails; a retry would then compare against the file it just wrote
 * and pass, which would hide the missing baseline.
 */
export default defineConfig({
  testDir: './e2e/visual',
  outputDir: './test-results-visual',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: process.env['CI'] ? 2 : undefined,
  reporter: process.env['CI']
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report-visual' }]]
    : [['html', { open: 'never', outputFolder: 'playwright-report-visual' }]],
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      // An absolute limit, not a ratio. A ratio grows with the slice: 0.2 percent of a
      // 1024 x 3015 slice is 6175 pixels. Two new sentences in the scheduler API table changed
      // 6464 pixels of the dark slice (it failed by a hair) and fewer of the light slice (it
      // passed with stale content). Two runs of the whole suite on one Windows machine differed
      // by 0 pixels (pixelmatch already ignores anti-aliased pixels and color steps under
      // `threshold`); the noise between CI runners is not measured yet. 100 pixels leave a
      // margin for it. A changed sentence fails; a single changed glyph may not.
      maxDiffPixels: 100,
    },
  },
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: docsWebServer(PORT, BASE_URL),
});
