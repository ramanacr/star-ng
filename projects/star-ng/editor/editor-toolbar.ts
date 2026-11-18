import type { StarUiText } from '@star-ng/ui/core';

/**
 * A command of `star-editor`. Most names are `document.execCommand` names. The others:
 * `heading` turns the block into a level 3 heading and back; `formatBlock` is the text style
 * select (paragraph, heading 1 to 3); `blockquote` and `code` (inline) wrap and unwrap; `link`
 * opens the link popover; `justifyLeft`, `justifyCenter` and `justifyRight` align the block to the
 * start, the center and the end of the line (logical: the start is on the right in right-to-left).
 */
export type StarEditorCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikeThrough'
  | 'code'
  | 'heading'
  | 'formatBlock'
  | 'blockquote'
  | 'insertUnorderedList'
  | 'insertOrderedList'
  | 'justifyLeft'
  | 'justifyCenter'
  | 'justifyRight'
  | 'link'
  | 'removeFormat'
  | 'undo'
  | 'redo';

/** An entry of the `toolbar` input: a command, or `'|'` for a separator between groups. */
export type StarEditorToolbarItem = StarEditorCommand | '|';

/** Text styles of the `formatBlock` select. */
export type StarEditorBlockFormat = 'p' | 'h1' | 'h2' | 'h3';

/** The toolbar of earlier versions, and the default. */
export const STAR_EDITOR_DEFAULT_TOOLBAR: readonly StarEditorToolbarItem[] = [
  'bold',
  'italic',
  'underline',
  'heading',
  'insertUnorderedList',
  'insertOrderedList',
  'removeFormat',
  'link',
];

/** Every command, in groups. */
export const STAR_EDITOR_FULL_TOOLBAR: readonly StarEditorToolbarItem[] = [
  'undo',
  'redo',
  '|',
  'formatBlock',
  '|',
  'bold',
  'italic',
  'underline',
  'strikeThrough',
  'code',
  '|',
  'insertUnorderedList',
  'insertOrderedList',
  'blockquote',
  '|',
  'justifyLeft',
  'justifyCenter',
  'justifyRight',
  '|',
  'link',
  'removeFormat',
];

/** A toolbar button: its label in `STAR_UI_TEXT`, its icon, and whether it shows `aria-pressed`. */
export interface StarEditorButtonInfo {
  readonly label: keyof StarUiText;
  readonly icon: string;
  readonly toggle: boolean;
}

export const STAR_EDITOR_BUTTONS: Readonly<
  Record<Exclude<StarEditorCommand, 'formatBlock'>, StarEditorButtonInfo>
> = {
  bold: { label: 'editorBold', icon: 'ph-bold ph-text-b', toggle: true },
  italic: { label: 'editorItalic', icon: 'ph-bold ph-text-italic', toggle: true },
  underline: { label: 'editorUnderline', icon: 'ph-bold ph-text-underline', toggle: true },
  strikeThrough: {
    label: 'editorStrikethrough',
    icon: 'ph-bold ph-text-strikethrough',
    toggle: true,
  },
  code: { label: 'editorCode', icon: 'ph-bold ph-code', toggle: true },
  heading: { label: 'editorHeading', icon: 'ph-bold ph-text-h', toggle: false },
  blockquote: { label: 'editorQuote', icon: 'ph-bold ph-quotes', toggle: true },
  insertUnorderedList: { label: 'editorBulletList', icon: 'ph-bold ph-list-bullets', toggle: true },
  insertOrderedList: { label: 'editorNumberedList', icon: 'ph-bold ph-list-numbers', toggle: true },
  justifyLeft: { label: 'editorAlignStart', icon: 'ph-bold ph-text-align-left', toggle: true },
  justifyCenter: { label: 'editorAlignCenter', icon: 'ph-bold ph-text-align-center', toggle: true },
  justifyRight: { label: 'editorAlignEnd', icon: 'ph-bold ph-text-align-right', toggle: true },
  link: { label: 'editorLink', icon: 'ph-bold ph-link', toggle: true },
  removeFormat: { label: 'editorClearFormatting', icon: 'ph-bold ph-text-t-slash', toggle: false },
  undo: { label: 'editorUndo', icon: 'ph-bold ph-arrow-counter-clockwise', toggle: false },
  redo: { label: 'editorRedo', icon: 'ph-bold ph-arrow-clockwise', toggle: false },
};

/** The commands of a `toolbar` list in groups, without unknown names and empty groups. */
export function starEditorGroups(
  items: readonly StarEditorToolbarItem[],
): readonly (readonly StarEditorCommand[])[] {
  const groups: StarEditorCommand[][] = [[]];
  for (const item of items) {
    if (item === '|') groups.push([]);
    else if (item === 'formatBlock' || item in STAR_EDITOR_BUTTONS) groups.at(-1)!.push(item);
  }
  return groups.filter((group) => group.length);
}

/**
 * Index of the toolbar control that a key moves to, or `null` for a key the toolbar does not use.
 * `key` is already in reading order (see `starInlineKey`). It wraps around.
 */
export function starEditorToolbarMove(key: string, index: number, count: number): number | null {
  if (!count) return null;
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count;
    case 'ArrowLeft':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
