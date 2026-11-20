// Character tests of `starKeyFilter`. Internal: the directive and its spec use them; the entry
// point does not export them. They live in their own file so that the entry point index re-exports
// with `export *` only, which keeps the unused controls out of the docs initial bundle.
import type { StarKeyFilterPreset, StarKeyFilterRule } from './key-filter';

/** The character test of each preset. */
export const STAR_KEY_FILTER_PRESETS: Readonly<Record<StarKeyFilterPreset, RegExp>> = {
  int: /^[\d-]$/,
  num: /^[\d.,-]$/,
  money: /^[\d.,\s']$/,
  hex: /^[0-9a-f]$/i,
  alpha: /^[\p{L}\p{M}_]$/u,
  alphanum: /^[\p{L}\p{M}\p{N}_]$/u,
  email: /^[\p{L}\p{N}_.\-+@]$/u,
};

/** True when every character of `text` passes the filter. */
export function starKeyFilterAllows(filter: StarKeyFilterRule, text: string): boolean {
  const test = typeof filter === 'string' ? STAR_KEY_FILTER_PRESETS[filter] : filter;
  for (const char of Array.from(text)) {
    test.lastIndex = 0;
    if (!test.test(char)) return false;
  }
  return true;
}

/** `text` without the characters that the filter does not allow. */
export function starKeyFilterClean(filter: StarKeyFilterRule, text: string): string {
  return Array.from(text)
    .filter((char) => starKeyFilterAllows(filter, char))
    .join('');
}
