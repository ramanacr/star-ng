import { Directive, inject, TemplateRef } from '@angular/core';
import type { StarUiText } from '@star-ng/ui/core';

/**
 * A command of `star-editor`. `bold`, `italic`, `underline` and `strikeThrough` are
 * `document.execCommand` names. The others:
 * `heading` turns the block into a level 3 heading and back; `formatBlock` is the text style
 * select (paragraph, heading 1 to 3) and `fontSize` the font size select (small, normal, large,
 * larger, largest); `blockquote` and `code` (inline) wrap and unwrap; `subscript` and
 * `superscript` toggle; `textColor` and `highlight` open a color panel (palette tokens, no color,
 * a custom color); `link` opens the link popover; `justifyLeft`, `justifyCenter`, `justifyRight`
 * and `justifyFull` align the block to the start, the center and the end of the line, or justify
 * it (logical: the start is on the right in right-to-left); `insertUnorderedList`,
 * `insertOrderedList` and `checklist` toggle lists; `indent` and `outdent` nest a list item or
 * indent a block; `image` opens the image panel (address or file, required alternative text or
 * decorative, caption, width; with the image at the caret it edits it) and `embed` the embed
 * panel (a video or page on the embed hosts of the allow-list); `horizontalRule` inserts a line;
 * `removeFormat` clears inline formats and the alignment. Alignment is stored as the classes `star-text-center`, `star-text-end` and
 * `star-text-justify`, so the HTML needs the StarNG CSS where it is shown. `undo` and `redo` use
 * the history of the editor, which has every change.
 */
export type StarEditorCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikeThrough'
  | 'subscript'
  | 'superscript'
  | 'code'
  | 'textColor'
  | 'highlight'
  | 'fontSize'
  | 'heading'
  | 'formatBlock'
  | 'blockquote'
  | 'insertUnorderedList'
  | 'insertOrderedList'
  | 'checklist'
  | 'indent'
  | 'outdent'
  | 'justifyLeft'
  | 'justifyCenter'
  | 'justifyRight'
  | 'justifyFull'
  | 'link'
  | 'image'
  | 'embed'
  | 'horizontalRule'
  | 'removeFormat'
  | 'undo'
  | 'redo';

/** The commands that the toolbar shows as a select, not a button. */
export type StarEditorSelectCommand = 'formatBlock' | 'fontSize';

/** True for the commands that the toolbar shows as a select. */
export function starEditorIsSelect(command: string): command is StarEditorSelectCommand {
  return command === 'formatBlock' || command === 'fontSize';
}

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
  'fontSize',
  '|',
  'bold',
  'italic',
  'underline',
  'strikeThrough',
  'subscript',
  'superscript',
  'code',
  '|',
  'textColor',
  'highlight',
  '|',
  'insertUnorderedList',
  'insertOrderedList',
  'checklist',
  'outdent',
  'indent',
  'blockquote',
  '|',
  'justifyLeft',
  'justifyCenter',
  'justifyRight',
  'justifyFull',
  '|',
  'link',
  'image',
  'embed',
  'horizontalRule',
  'removeFormat',
];

/** A toolbar button: its label in `STAR_UI_TEXT`, its icon, and whether it shows `aria-pressed`. */
export interface StarEditorButtonInfo {
  readonly label: keyof StarUiText;
  readonly icon: string;
  readonly toggle: boolean;
}

export const STAR_EDITOR_BUTTONS: Readonly<
  Record<Exclude<StarEditorCommand, StarEditorSelectCommand>, StarEditorButtonInfo>
> = {
  bold: { label: 'editorBold', icon: 'ph-bold ph-text-b', toggle: true },
  italic: { label: 'editorItalic', icon: 'ph-bold ph-text-italic', toggle: true },
  underline: { label: 'editorUnderline', icon: 'ph-bold ph-text-underline', toggle: true },
  strikeThrough: {
    label: 'editorStrikethrough',
    icon: 'ph-bold ph-text-strikethrough',
    toggle: true,
  },
  subscript: { label: 'editorSubscript', icon: 'ph-bold ph-text-subscript', toggle: true },
  superscript: { label: 'editorSuperscript', icon: 'ph-bold ph-text-superscript', toggle: true },
  code: { label: 'editorCode', icon: 'ph-bold ph-code', toggle: true },
  textColor: { label: 'editorTextColor', icon: 'ph-bold ph-text-a-underline', toggle: false },
  highlight: { label: 'editorHighlight', icon: 'ph-bold ph-highlighter', toggle: false },
  heading: { label: 'editorHeading', icon: 'ph-bold ph-text-h', toggle: false },
  blockquote: { label: 'editorQuote', icon: 'ph-bold ph-quotes', toggle: true },
  insertUnorderedList: { label: 'editorBulletList', icon: 'ph-bold ph-list-bullets', toggle: true },
  insertOrderedList: { label: 'editorNumberedList', icon: 'ph-bold ph-list-numbers', toggle: true },
  checklist: { label: 'editorChecklist', icon: 'ph-bold ph-list-checks', toggle: true },
  indent: { label: 'editorIndent', icon: 'ph-bold ph-text-indent', toggle: false },
  outdent: { label: 'editorOutdent', icon: 'ph-bold ph-text-outdent', toggle: false },
  justifyLeft: { label: 'editorAlignStart', icon: 'ph-bold ph-text-align-left', toggle: true },
  justifyCenter: { label: 'editorAlignCenter', icon: 'ph-bold ph-text-align-center', toggle: true },
  justifyRight: { label: 'editorAlignEnd', icon: 'ph-bold ph-text-align-right', toggle: true },
  justifyFull: { label: 'editorJustify', icon: 'ph-bold ph-text-align-justify', toggle: true },
  link: { label: 'editorLink', icon: 'ph-bold ph-link', toggle: true },
  image: { label: 'editorImage', icon: 'ph-bold ph-image', toggle: false },
  embed: { label: 'editorEmbed', icon: 'ph-bold ph-film-strip', toggle: false },
  horizontalRule: { label: 'editorHorizontalRule', icon: 'ph-bold ph-minus', toggle: false },
  removeFormat: { label: 'editorClearFormatting', icon: 'ph-bold ph-text-t-slash', toggle: false },
  undo: { label: 'undo', icon: 'ph-bold ph-arrow-counter-clockwise', toggle: false },
  redo: { label: 'redo', icon: 'ph-bold ph-arrow-clockwise', toggle: false },
};

/** Context of the `starEditorToolbar` template. */
export interface StarEditorToolbarContext {
  /** Runs a command on the selection: `exec('bold')`, `exec('formatBlock', 'h2')`. */
  readonly exec: (command: StarEditorCommand, value?: string) => void;
  /** True when the format of the command is on at the caret. */
  readonly isActive: (command: StarEditorCommand) => boolean;
  /** True while the editor is disabled or read-only: turn the controls off. */
  readonly disabled: boolean;
  /** The same as `exec` (`let-exec` or `let-tools`). */
  readonly $implicit: (command: StarEditorCommand, value?: string) => void;
}

/**
 * Replaces the toolbar of `star-editor`:
 * `<ng-template starEditorToolbar let-exec="exec" let-isActive="isActive">…</ng-template>`.
 * Give the container `role="toolbar"` and a name, and stop `mousedown` on its buttons
 * (`$event.preventDefault()`) so the text keeps its selection. PrimeNG `#header` template of
 * `p-editor`.
 */
@Directive({ selector: 'ng-template[starEditorToolbar]' })
export class StarEditorToolbarTemplate {
  readonly template = inject<TemplateRef<StarEditorToolbarContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _dir: StarEditorToolbarTemplate,
    _ctx: unknown,
  ): _ctx is StarEditorToolbarContext {
    return true;
  }
}

/**
 * The commands of a `toolbar` list in groups, without unknown names (also inherited object
 * names such as `toString`), repeated commands and empty groups.
 */
export function starEditorGroups(
  items: readonly StarEditorToolbarItem[],
): readonly (readonly StarEditorCommand[])[] {
  const groups: StarEditorCommand[][] = [[]];
  const seen = new Set<string>();
  for (const item of items) {
    if (item === '|') groups.push([]);
    else if (
      !seen.has(item) &&
      (starEditorIsSelect(item) || Object.hasOwn(STAR_EDITOR_BUTTONS, item))
    ) {
      // A command shows once: its first place wins.
      seen.add(item);
      groups.at(-1)!.push(item);
    }
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

/**
 * How many toolbar groups fit in `available` pixels: the groups in order, with `gap` between
 * them, and room for the "More" button when some groups do not fit. At least one group shows.
 */
export function starEditorFit(
  widths: readonly number[],
  available: number,
  more: number,
  gap = 0,
): number {
  const total =
    widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);
  if (total <= available) return widths.length;
  let used = more;
  let count = 0;
  for (const width of widths) {
    const next = used + width + gap;
    if (next > available) break;
    used = next;
    count++;
  }
  return Math.max(1, count);
}
