import { starFoldText, starTextParts } from '@star-ng/ui/core';

/**
 * Search highlight of `star-table` (`searchText`): the matches in the cell texts, one entry per
 * occurrence, and the parts of a text with the active match. Pure helpers, no DOM. Ignite UI grid
 * `findNext` / `findPrev` / `clearSearch`, AG Grid find.
 */

/** `searchMatches`: the number of matches and the index of the active match (-1: none). */
export interface StarTableSearchMatches {
  readonly count: number;
  readonly active: number;
}

/** One part of a cell text: `match` around a match, `active` on the active match. */
export interface StarTableTextPart {
  readonly text: string;
  readonly match: boolean;
  readonly active: boolean;
}

/** The matches of one cell: the index of its first match in all matches, and their number. */
export interface StarSearchCell {
  readonly rowKey: unknown;
  readonly field: string;
  readonly start: number;
  readonly count: number;
}

/**
 * Number of matches of `query` in `text`, as `starTextParts` marks them (case- and
 * accent-insensitive, with the locale). A quick check of the folded text comes first, so a cell
 * without the text costs one fold.
 */
export function countMatches(text: string, query: string, locale: string | null): number {
  const needle = starFoldText(query.trim(), locale);
  if (!needle || !text || !starFoldText(text, locale).includes(needle)) return 0;
  return starTextParts(text, query, 'contains', locale).filter((part) => part.match).length;
}

/** The parts of a text with the matches of `query`; the match number `active` (in the text) is active. */
export function highlightParts(
  text: string,
  query: string,
  locale: string | null,
  active: number,
): StarTableTextPart[] {
  if (!query.trim()) return text ? [{ text, match: false, active: false }] : [];
  let index = 0;
  return starTextParts(text, query, 'contains', locale).map((part) => ({
    ...part,
    active: part.match && index++ === active,
  }));
}
