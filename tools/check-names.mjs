// Fails when a file tracked by git contains a name that must not be in this repository.
// StarNG is a generic library: names of the product it was first made for are not allowed.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Built from parts, so this file does not match its own patterns.
const FORBIDDEN = [
  new RegExp(['s', 'm', 'x'].join(''), 'i'),
  new RegExp(['sci', 'max'].join(''), 'i'),
];
const BINARY = /\.(png|jpe?g|gif|ico|woff2?|ttf|pdf|zip)$/i;

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter((file) => file && !BINARY.test(file) && file !== 'pnpm-lock.yaml');

const hits = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // Deleted in the working tree.
  }
  text.split('\n').forEach((line, index) => {
    if (FORBIDDEN.some((pattern) => pattern.test(line))) {
      hits.push(`${file}:${index + 1}: ${line.trim().slice(0, 120)}`);
    }
  });
}

if (hits.length) {
  console.error(`Forbidden names found in ${hits.length} line(s):\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`check-names: ${files.length} files, no forbidden names.`);
