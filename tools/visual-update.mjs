// Writes the baseline images of the visual regression tests: `pnpm e2e:visual:update`.
// It refuses to run outside Linux in CI, because images from another operating system never
// match the CI run. Set VISUAL_ALLOW_LOCAL=1 to run it elsewhere on purpose (for example in a
// Linux container with the CI fonts). To get baselines the normal way, run the
// "Visual baselines" workflow in GitHub Actions and commit the artifact.
import { spawnSync } from 'node:child_process';

const allowed =
  process.env.VISUAL_ALLOW_LOCAL === '1' || (process.platform === 'linux' && !!process.env.CI);

if (!allowed) {
  console.error(
    'e2e:visual:update refuses to run here: baselines must come from Linux in CI.\n' +
      'Run the "Visual baselines" workflow in GitHub Actions and commit its artifact\n' +
      '(see "Visual regression tests" in README.md), or set VISUAL_ALLOW_LOCAL=1 to override.',
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [
    'node_modules/@playwright/test/cli.js',
    'test',
    '-c',
    'playwright.visual.config.ts',
    '--update-snapshots',
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
