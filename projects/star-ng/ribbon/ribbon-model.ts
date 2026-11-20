// Pure rules of `star-ribbon`: which groups collapse when the ribbon is narrow, and the KeyTips.

/** How a ribbon group shows: all items with labels, small icons only, or one overflow button. */
export type StarRibbonGroupMode = 'full' | 'small' | 'collapsed';

/** Measured width of one group in each mode, in pixels. */
export interface StarRibbonGroupWidths {
  readonly full: number;
  readonly small: number;
  readonly collapsed: number;
}

/**
 * The mode of each group for the available width. Groups get small from the last to the first,
 * then collapse to their overflow button from the last to the first, until the row fits. An
 * unknown width (0 or less, for example on the server) keeps every group full.
 */
export function starRibbonGroupModes(
  widths: readonly StarRibbonGroupWidths[],
  available: number,
  gap = 0,
): StarRibbonGroupMode[] {
  const modes: StarRibbonGroupMode[] = widths.map(() => 'full');
  if (available <= 0) return modes;
  const gaps = gap * Math.max(0, widths.length - 1);
  const fits = () => widths.reduce((sum, width, i) => sum + width[modes[i]], 0) + gaps <= available;
  for (const step of ['small', 'collapsed'] as const) {
    for (let i = widths.length - 1; i >= 0; i--) {
      if (fits()) return modes;
      modes[i] = step;
    }
  }
  return modes;
}

/** One target of a KeyTip: a tab, an item or a group button. */
export interface StarKeyTipEntry {
  readonly id: string;
  readonly label: string;
  /** The KeyTip that the owner chose; it wins unless an earlier entry has it already. */
  readonly keyTip?: string | null;
}

/** Upper-case letters and digits of a text, without accents. */
function keyChars(text: string): string[] {
  return [
    ...text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, ''),
  ];
}

const DIGITS = '123456789'.split('');
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * KeyTips for a set of targets (Microsoft Fluent ribbon KeyTips). The owner's `keyTip` comes
 * first. Other targets get the first free letter of their label, then a free digit, then two
 * characters (a letter and a digit). No tip is the start of another, so typing a tip never stops
 * at a shorter one. `reserved` tips are not given out. The map keeps the order of `entries`.
 */
export function starAssignKeyTips(
  entries: readonly StarKeyTipEntry[],
  reserved: Iterable<string> = [],
): Map<string, string> {
  const used = new Set([...reserved].map((tip) => tip.toUpperCase()));
  const free = (tip: string) =>
    !!tip && ![...used].some((other) => other.startsWith(tip) || tip.startsWith(other));
  const given = new Map<string, string>();
  const take = (id: string, tip: string) => {
    used.add(tip);
    given.set(id, tip);
  };
  const rest: StarKeyTipEntry[] = [];
  for (const entry of entries) {
    const tip = keyChars(entry.keyTip ?? '').join('');
    if (tip && free(tip)) take(entry.id, tip);
    else rest.push(entry);
  }
  for (const entry of rest) {
    const letters = keyChars(entry.label);
    const first = letters.find((char) => /[A-Z]/.test(char));
    const pairs = [...(first ? [first] : []), ...LETTERS].flatMap((a) => DIGITS.map((d) => a + d));
    const tip = [...letters, ...DIGITS, ...pairs].find(free);
    if (tip) take(entry.id, tip);
  }
  const result = new Map<string, string>();
  for (const entry of entries) {
    const tip = given.get(entry.id);
    if (tip) result.set(entry.id, tip);
  }
  return result;
}

/** The target whose KeyTip is `typed`, or whether `typed` is the start of a longer tip. */
export function starKeyTipMatch(
  tips: ReadonlyMap<string, string>,
  typed: string,
): { id: string | null; partial: boolean } {
  const text = typed.toUpperCase();
  for (const [id, tip] of tips) if (tip === text) return { id, partial: false };
  return { id: null, partial: [...tips.values()].some((tip) => tip.startsWith(text)) };
}
