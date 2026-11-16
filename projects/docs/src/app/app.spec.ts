import { readFileSync } from 'node:fs';
import { DIRECTION_KEY } from './app';

describe('docs first-paint direction script', () => {
  const script = readFileSync('projects/docs/public/docs-direction-first-paint.js', 'utf8');

  it('reads the same localStorage key as the docs app', () => {
    expect(script).toContain(`localStorage.getItem('${DIRECTION_KEY}')`);
  });
});
