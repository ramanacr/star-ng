// Tests of tools/ci-gate.mjs: `node --test tools/` (or `pnpm test:tools`).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ADVISORY_JOBS, JOBS } from './ci-changes.mjs';
import { evaluate } from './ci-gate.mjs';

const ALL_ON = {
  light: 'false',
  build_test: 'true',
  docs_build: 'true',
  e2e: 'true',
  a11y: 'true',
  visual: 'true',
};
const ALL_OFF = {
  light: 'true',
  build_test: 'false',
  docs_build: 'false',
  e2e: 'false',
  a11y: 'false',
  visual: 'false',
};

/** A `needs` object. `outputs` are the outputs of `changes`; `results` overrides job results. */
function needs(outputs, results = {}, changesResult = 'success') {
  const value = { changes: { result: changesResult, outputs } };
  for (const { job, output } of JOBS) {
    value[job] = {
      result: results[job] ?? (outputs[output] === 'true' ? 'success' : 'skipped'),
      outputs: {},
    };
  }
  return value;
}

const CASES = [
  ['everything needed and successful: pass', needs(ALL_ON), true],
  ['nothing needed but light, the rest skipped: pass', needs(ALL_OFF), true],
  ['needed job skipped: FAIL', needs(ALL_ON, { visual: 'skipped' }), false],
  ['needed job cancelled: FAIL', needs(ALL_ON, { e2e: 'cancelled' }), false],
  ['needed job failed: FAIL', needs(ALL_ON, { a11y: 'failure' }), false],
  [
    'needed job skipped because docs-build failed: FAIL',
    needs(ALL_ON, { 'docs-build': 'failure', e2e: 'skipped', a11y: 'skipped', visual: 'skipped' }),
    false,
  ],
  ['light needed and skipped: FAIL', needs(ALL_OFF, { light: 'skipped' }), false],
  ['not needed and skipped: pass', needs({ ...ALL_ON, visual: 'false' }), true],
  [
    'not needed but it ran and passed: pass',
    needs({ ...ALL_ON, visual: 'false' }, { visual: 'success' }),
    true,
  ],
  [
    'not needed but it ran and failed: FAIL',
    needs({ ...ALL_ON, visual: 'false' }, { visual: 'failure' }),
    false,
  ],
  [
    'not needed and cancelled: FAIL',
    needs({ ...ALL_ON, visual: 'false' }, { visual: 'cancelled' }),
    false,
  ],
  ['changes failed: FAIL', needs(ALL_ON, {}, 'failure'), false],
  ['changes cancelled: FAIL', needs(ALL_ON, {}, 'cancelled'), false],
  ['changes skipped: FAIL', needs(ALL_OFF, {}, 'skipped'), false],
  [
    'changes failed and every other job skipped: FAIL',
    needs(
      {},
      {
        light: 'skipped',
        'build-test': 'skipped',
        'docs-build': 'skipped',
        e2e: 'skipped',
        'e2e-dev': 'skipped',
        a11y: 'skipped',
        visual: 'skipped',
      },
      'failure',
    ),
    false,
  ],
  ['changes outputs missing: FAIL', needs({}), false],
  ['one output is not true or false: FAIL', needs({ ...ALL_ON, e2e: '' }), false],
  ['one output is a strange value: FAIL', needs({ ...ALL_ON, e2e: 'yes' }), false],
  [
    'a job is missing from needs: FAIL',
    (() => {
      const value = needs(ALL_ON);
      delete value.visual;
      return value;
    })(),
    false,
  ],
  [
    'changes is missing from needs: FAIL',
    (() => {
      const value = needs(ALL_ON);
      delete value.changes;
      return value;
    })(),
    false,
  ],
];

for (const [name, input, ok] of CASES) {
  test(name, () => {
    const result = evaluate(input);
    assert.equal(result.ok, ok, result.failures.join('; '));
    assert.equal(result.failures.length === 0, ok);
  });
}

test('the gate checks every job of the table', () => {
  assert.deepEqual(
    JOBS.map((entry) => entry.job),
    ['light', 'build-test', 'docs-build', 'e2e', 'e2e-dev', 'a11y', 'visual'],
  );
});

test('command line: exit code and messages', () => {
  const tool = fileURLToPath(new URL('./ci-gate.mjs', import.meta.url));
  const run = (value) =>
    spawnSync(process.execPath, [tool], {
      encoding: 'utf8',
      env: { ...process.env, NEEDS: typeof value === 'string' ? value : JSON.stringify(value) },
    });
  const pass = run(needs(ALL_ON));
  assert.equal(pass.status, 0);
  assert.match(pass.stdout, /All required gates passed/);
  const fail = run(needs(ALL_ON, { visual: 'skipped' }));
  assert.equal(fail.status, 1);
  assert.match(fail.stderr, /visual: had to run, but the result is skipped/);
  assert.equal(run('not json').status, 1);
  assert.equal(run('').status, 1);
});

test('ci.yml: every job of the table exists, uses its output, and is in the needs of the gate', () => {
  const text = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const gate = /\n {2}ci-gate:[\s\S]*?\n {4}needs: \[([^\]]*)\]/.exec(text);
  assert.ok(gate, 'the ci-gate job has a needs list');
  const gateNeeds = gate[1].split(',').map((name) => name.trim());
  assert.ok(gateNeeds.includes('changes'));
  for (const { job, output } of JOBS) {
    assert.match(text, new RegExp(`\n {2}${job}:\n`), `job ${job} exists`);
    assert.ok(text.includes(`needs.changes.outputs.${output} == 'true'`), `${job} uses ${output}`);
    assert.ok(gateNeeds.includes(job), `${job} is in the needs of the gate`);
  }
  // An advisory job (not green on a pull request yet) runs on its output but does not block.
  for (const { job, output } of ADVISORY_JOBS) {
    assert.match(text, new RegExp(`\n {2}${job}:\n`), `job ${job} exists`);
    assert.ok(text.includes(`needs.changes.outputs.${output} == 'true'`), `${job} uses ${output}`);
    assert.ok(!gateNeeds.includes(job), `advisory job ${job} is not in the needs of the gate`);
    assert.ok(!JOBS.some((entry) => entry.job === job), `${job} is not in both tables`);
  }
  // Every job of the file (two-space keys under `jobs:`) is in a table, or is `changes` or the gate.
  const ids = [...text.slice(text.indexOf('\njobs:')).matchAll(/\n {2}([a-z0-9-]+):\n/g)].map(
    (m) => m[1],
  );
  const known = new Set([
    'changes',
    'ci-gate',
    ...JOBS.map((entry) => entry.job),
    ...ADVISORY_JOBS.map((entry) => entry.job),
  ]);
  assert.deepEqual(
    ids.filter((id) => !known.has(id)),
    [],
  );
});
