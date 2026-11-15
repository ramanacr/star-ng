import type { PlaywrightTestConfig } from '@playwright/test';

/**
 * The web server of the end-to-end and visual configs (one place, so the three jobs of CI and
 * the local runs use the same rule). The choice is made with environment variables:
 *
 * - `E2E_BASE_URL` set: no server starts. The tests run against that address (a deployed site).
 * - `E2E_STATIC_DIR` set: `tools/pages-serve.mjs --spa` serves that folder under `/`. CI sets it
 *   to the production build of the docs (`dist/docs/browser`), which `docs-build` makes once
 *   and the test jobs download. Build first: `pnpm build:docs`.
 * - neither set: `ng serve docs` (development build with live reload). This is the default for
 *   developers: a change is rebuilt in a second, and the development-only checks run.
 *
 * The folder is relative to the repository root. Both servers are started through node, so
 * they work where `pnpm` is not on the PATH (corepack only).
 */
export function docsWebServer(port: number, baseUrl: string): PlaywrightTestConfig['webServer'] {
  if (process.env['E2E_BASE_URL']) return undefined;
  const staticDir = process.env['E2E_STATIC_DIR'];
  if (staticDir) {
    return {
      command: `node tools/pages-serve.mjs --spa --dir "${staticDir}" --port ${port}`,
      url: baseUrl,
      reuseExistingServer: !process.env['CI'],
      timeout: 30_000,
    };
  }
  return {
    command: `node node_modules/@angular/cli/bin/ng.js serve docs --port ${port}`,
    url: baseUrl,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  };
}
