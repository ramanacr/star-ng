/**
 * Where the visual tests may run. Baselines come from Linux in CI only: a Windows or macOS run
 * would never match them, and must never write a baseline of its own.
 *
 * Set `VISUAL_ALLOW_LOCAL=1` to run elsewhere, for example inside a Linux container that has
 * the same fonts as the CI image, to debug a failure. Without it the tests skip.
 */
export function visualRunAllowed(): boolean {
  if (process.env['VISUAL_ALLOW_LOCAL'] === '1') return true;
  return process.platform === 'linux' && !!process.env['CI'];
}

export const VISUAL_SKIP_MESSAGE =
  'Visual tests run on Linux in CI only (baselines are made there). ' +
  'Set VISUAL_ALLOW_LOCAL=1 to run them elsewhere for debugging; never commit images made that way.';
