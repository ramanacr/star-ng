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
      // Anti-aliasing noise only: a changed control moves far more than 0.2 percent of a page.
      maxDiffPixelRatio: 0.002,
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
