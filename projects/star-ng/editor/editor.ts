// Ported from Aurora RTE `packages/angular/src/editor.component.ts`,
// `packages/editor/src/create-editor.ts` and `packages/editor/src/events.ts`, MIT
// (https://github.com/ramanacr/aurora-rte, see THIRD_PARTY_NOTICES.md).
import { _IdGenerator } from '@angular/cdk/a11y';
import { CdkContextMenuTrigger } from '@angular/cdk/menu';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  contentChild,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  numberAttribute,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import {
  STAR_UI_TEXT,
  starInlineKey,
  StarPart,
  StarStyled,
  StarUiText,
  ɵSTAR_PART_HOST,
  ɵstarIsContextMenuKey,
  ɵstarOpenContextMenu,
} from '@star-ng/ui/core';
import { injectStarFieldLink, starFieldLabelledBy, starJoinIds } from '@star-ng/ui/field';
import { StarContextMenu, StarMenu, StarMenuItem } from '@star-ng/ui/menu';
import { starEditorAudit, StarEditorIssue } from './editor-audit';
import { StarEditorColor } from './editor-color';
import {
  starEditorAlign,
  starEditorAlignmentAt,
  starEditorBlocks,
  starEditorClosest,
  starEditorPath,
  starEditorPlainLength,
  starEditorRange,
  starEditorRestore,
  starEditorText,
  starEditorTextToHtml,
  starEditorToggleCode,
  starEditorUnwrap,
} from './editor-dom';
import {
  starEditorCounts,
  starEditorFind,
  starEditorInputRule,
  starEditorReplace,
  starEditorReplaceAll,
} from './editor-find';
import {
  STAR_EDITOR_FONT_SIZES,
  starEditorClearFormat,
  StarEditorFontSize,
  starEditorFontSizeAt,
  starEditorIndentBlocks,
  starEditorInsertRule,
  starEditorSetStyle,
  starEditorStyleAt,
  starEditorToggleScript,
} from './editor-format';
import { StarEditorHistory, starEditorPathRange, starEditorSelectionPath } from './editor-history';
import { StarEditorEmbed, StarEditorImage } from './editor-image';
import {
  StarEditorLink,
  StarEditorLinkValue,
  starEditorSafeUrl,
  starEditorSetLink,
} from './editor-link';
import {
  STAR_EDITOR_CHECKLIST_CLASS,
  starEditorIndentItems,
  starEditorItems,
  starEditorListAt,
  starEditorToggleCheck,
  starEditorToggleList,
} from './editor-list';
import {
  starEditorEmbedUrl,
  starEditorImageOf,
  StarEditorImageValue,
  starEditorProtectEmbeds,
  starEditorPutEmbed,
  starEditorPutImage,
  StarEditorUpload,
} from './editor-media';
import { starEditorCleanPaste } from './editor-paste';
import {
  STAR_EDITOR_SANITIZE_DEFAULTS,
  starEditorSanitize,
  StarEditorSanitizeConfig,
} from './editor-sanitize';
import { starEditorFormatHtml, starEditorReadSource } from './editor-source';
import {
  starEditorCellPlace,
  starEditorColumnWidth,
  starEditorDeleteColumn,
  starEditorDeleteRow,
  starEditorInsertColumn,
  starEditorInsertRow,
  starEditorMergeBelow,
  starEditorMergeNext,
  starEditorNewTable,
  starEditorSetColumnWidth,
  starEditorSetTableLook,
  starEditorSiblingCell,
  starEditorSplitCell,
  StarEditorTableAlign,
  StarEditorTableBorders,
  starEditorTableGrid,
  starEditorTableLook,
  starEditorToggleHeaderRow,
} from './editor-table';
import { StarEditorTableInsert, StarEditorTableProperties } from './editor-table-panel';
import {
  STAR_EDITOR_BUTTONS,
  STAR_EDITOR_DEFAULT_TOOLBAR,
  StarEditorBlockFormat,
  StarEditorCommand,
  starEditorFit,
  starEditorGroups,
  starEditorIsSelect,
  StarEditorToolbarContext,
  StarEditorToolbarItem,
  starEditorToolbarMove,
  StarEditorToolbarTemplate,
} from './editor-toolbar';

/** Inline formats that `document.queryCommandState` reports. */
const NATIVE_STATES = ['bold', 'italic', 'underline', 'strikeThrough'] as const;

/** Tag names that mean a format is on at the caret (the selection walk). */
const FORMAT_TAGS: Readonly<Record<string, StarEditorCommand>> = {
  B: 'bold',
  STRONG: 'bold',
  I: 'italic',
  EM: 'italic',
  U: 'underline',
  S: 'strikeThrough',
  STRIKE: 'strikeThrough',
  DEL: 'strikeThrough',
  SUB: 'subscript',
  SUP: 'superscript',
  CODE: 'code',
  A: 'link',
  BLOCKQUOTE: 'blockquote',
};

/** The font size select: steps and their labels. */
const FONT_SIZES: readonly { key: StarEditorFontSize; label: keyof StarUiText }[] = [
  { key: 'small', label: 'editorSizeSmall' },
  { key: 'normal', label: 'editorSizeNormal' },
  { key: 'large', label: 'editorSizeLarge' },
  { key: 'larger', label: 'editorSizeLarger' },
  { key: 'largest', label: 'editorSizeLargest' },
];

/** Typing within this time after the last typing is one undo step. */
const TYPING_MERGE_MS = 1000;

type Panel = 'textColor' | 'highlight';

/**
 * The payload of `textChange`: the value after a change by the user. `html` is the sanitized HTML
 * of the area (also with `format="text"`), `text` the plain text, one line per paragraph.
 */
export interface StarEditorTextChange {
  readonly html: string;
  readonly text: string;
}

/**
 * The payload of `selectionChange`: the selection in the text of the area. `index` is the
 * character offset of its start in the text content (line breaks between blocks do not count),
 * `length` the number of selected characters (0 for a caret), `text` the selected text.
 */
export interface StarEditorSelectionChange {
  readonly index: number;
  readonly length: number;
  readonly text: string;
}

/**
 * Rich text field (PrimeNG `p-editor`, without Quill): a `contenteditable` area with a
 * formatting toolbar. Value is HTML, sanitized with the allow-list of the editor both when it is
 * shown and when it is stored.
 *
 * The toolbar is a WAI-ARIA toolbar (one tab stop, arrow keys, `aria-pressed` for the formats at
 * the caret). `toolbar` chooses the commands and their groups (PrimeNG toolbar formats); groups
 * that do not fit go into a "More actions" panel.
 *
 * Note: bold, italic, underline, strikethrough and the text style use `document.execCommand`,
 * which browsers still support but no longer develop. The other commands change the DOM
 * directly, and the editor keeps its own undo history for all of them.
 *
 * `<star-editor [formField]="form.response" ariaLabel="Response" />`
 */
@Component({
  selector: 'star-editor',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [
    StarPart,
    StarEditorTableInsert,
    StarEditorTableProperties,
    StarMenu,
    StarContextMenu,
    StarEditorLink,
    StarEditorColor,
    StarEditorImage,
    StarEditorEmbed,
    NgTemplateOutlet,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-editor',
    '[class.star-editor--disabled]': 'disabled()',
    '[class.star-editor--invalid]': 'invalid() && touched()',
    '[class.star-editor--over]': 'over()',
    '[class.star-editor--full-screen]': 'fullScreen()',
  },
  templateUrl: './editor.html',
})
export class StarEditor implements FormValueControl<string> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly ids = inject(_IdGenerator);
  protected readonly areaId = this.ids.getId('star-editor-area-');
  protected readonly counterId = this.ids.getId('star-editor-counter-');
  protected readonly overflowId = this.ids.getId('star-editor-more-');

  /**
   * The content: HTML (sanitized when the user edits it), or plain text with `format="text"`.
   */
  readonly value = model('');
  /**
   * `'html'` (default): the value is HTML. `'text'`: the value is plain text, one line per
   * paragraph; the toolbar still formats the text on the screen, but the value has no markup.
   * PrimeNG `onTextChange` gives the text next to the HTML.
   */
  readonly format = input<'html' | 'text'>('html');
  /**
   * Most characters of text (line breaks do not count). Typing stops at the limit, a counter
   * shows under the area and describes it, and a live message gives the rest near the end.
   * A Signal Forms `maxLength` rule sets it too; note that the rule checks the length of the
   * value (HTML, tags included, with `format="html"`), while the editor counts text.
   * PrimeNG has no equivalent.
   */
  readonly maxLength = input<number | undefined, unknown>(undefined, {
    transform: (value: unknown) =>
      value === null || value === undefined || value === '' ? undefined : numberAttribute(value),
  });
  /** Text shown while the editor is empty. */
  readonly placeholder = input('');
  /** CSS `min-height` of the editing area. */
  readonly minHeight = input('8rem');
  /** Accessible name of the editing area. */
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  /**
   * Paste plain text only. Without it, pasted HTML is sanitized (no scripts, no style elements,
   * no event handlers, only allowed styles) before it goes in. PrimeNG has no equivalent (Quill
   * clipboard matchers).
   */
  readonly pasteAsText = input(false, { transform: booleanAttribute });
  /**
   * The allow-list of the sanitizer: elements, attributes per element, URL protocols and the
   * hosts of embeds. Spread `STAR_EDITOR_SANITIZE_DEFAULTS` to change it. Script, style, SVG and
   * form elements, event handlers and `javascript:`, `vbscript:` and `data:` addresses (except
   * `data:` images) never pass, whatever the list says. PrimeNG has no equivalent.
   */
  readonly sanitize = input<StarEditorSanitizeConfig>(STAR_EDITOR_SANITIZE_DEFAULTS);
  /**
   * The toolbar: command names in order, with `'|'` between groups. Unknown names are left out.
   * `STAR_EDITOR_FULL_TOOLBAR` has every command. PrimeNG toolbar formats (Quill `toolbar`).
   */
  readonly toolbar = input<readonly StarEditorToolbarItem[]>(STAR_EDITOR_DEFAULT_TOOLBAR);
  /**
   * Shows the number of words and characters under the area. With `maxLength` the counter of the
   * limit shows next to it. PrimeNG has no equivalent.
   */
  readonly showCount = input(false, { transform: booleanAttribute });
  /**
   * Markdown-style input rules: `# `, `## ` and `### ` at the start of a paragraph make headings,
   * `> ` a quote, `- ` or `* ` a bulleted list, `1. ` a numbered list, `[] ` a checklist, and
   * `**text**` bold text. Off by default. PrimeNG has no equivalent.
   */
  readonly markdownShortcuts = input(false, { transform: booleanAttribute });
  /**
   * Stores an image file that the user chose in the image panel and gives back its address.
   * Without it, the file goes into the HTML as a `data:` address (large values).
   */
  readonly upload = input<StarEditorUpload | null>(null);
  readonly touch = output<void>();
  /**
   * Emits after the user changed the content (typing, a toolbar command, a paste, undo …) with the
   * HTML and the plain text. A value that the owner writes does not emit. PrimeNG `onTextChange`
   * (its `htmlValue` and `textValue`; the Quill `delta` and `source` have no equivalent).
   */
  readonly textChange = output<StarEditorTextChange>();
  /**
   * Emits when the selection in the area changes: its text offset, length and text, or `null`
   * when the selection leaves the area. A caret move is a change too (also while the user
   * types), and the offset is counted from the start of the area each time: keep the handler
   * light. PrimeNG `onSelectionChange` (its `range`; `oldRange` is the
   * previous event).
   */
  readonly selectionChange = output<StarEditorSelectionChange | null>();

  /** The `starEditorToolbar` template that replaces the toolbar. */
  protected readonly customToolbar = contentChild(StarEditorToolbarTemplate);
  private readonly execBound = (command: StarEditorCommand, value?: string) =>
    this.exec(command, value);
  private readonly isActiveBound = (command: StarEditorCommand) => this.isActive(command);
  /** A new context when the state changes, so the template shows it. */
  protected readonly toolbarContext = computed<StarEditorToolbarContext>(() => {
    this.active();
    return {
      $implicit: this.execBound,
      exec: this.execBound,
      isActive: this.isActiveBound,
      disabled: this.locked(),
    };
  });
  protected readonly blockFormats: readonly StarEditorBlockFormat[] = ['p', 'h1', 'h2', 'h3'];
  protected readonly fontSizes = FONT_SIZES;
  protected readonly groups = computed(() => starEditorGroups(this.toolbar()));
  /** No edits: the toolbar is off and the area is not editable. */
  protected readonly locked = computed(() => this.disabled() || this.readonly());

  private readonly area = viewChild.required<ElementRef<HTMLDivElement>>('area');
  private readonly toolbarElement = viewChild<ElementRef<HTMLElement>>('toolbarElement');
  /** The parent `star-field` when it labels the area (a `div` textbox is not labelable). */
  private readonly field = injectStarFieldLink(null, () => this.focus());
  protected readonly labelledBy = computed(() => starFieldLabelledBy(this.field, this.ariaLabel()));
  protected readonly describedBy = computed(() =>
    starJoinIds(this.field?.describedBy(), this.maxLength() !== undefined ? this.counterId : null),
  );
  /** Characters of text now (see `maxLength`). */
  protected readonly length = signal(0);
  /** Words and characters now (see `showCount`). */
  protected readonly counts = signal({ words: 0, characters: 0 });
  /** The accessibility check: open, and the problems found. */
  protected readonly auditOpen = signal(false);
  protected readonly issues = signal<readonly StarEditorIssue[]>([]);
  /** The editor fills the window. */
  protected readonly fullScreen = signal(false);
  /** Find and replace: the open panel, its fields and the matches. */
  protected readonly findOpen = signal<'find' | 'replace' | null>(null);
  protected readonly findQuery = signal('');
  protected readonly replaceText = signal('');
  protected readonly matchCase = signal(false);
  protected readonly wholeWord = signal(false);
  protected readonly matchIndex = signal(-1);
  protected readonly matchTotal = signal(0);
  protected readonly findStatus = signal('');
  protected readonly findId = this.ids.getId('star-editor-find-');
  protected readonly shortcutsId = this.ids.getId('star-editor-shortcuts-');
  private matches: Range[] = [];
  private readonly shortcutsDialog = viewChild<ElementRef<HTMLDialogElement>>('shortcutsDialog');
  /** The text that the coming input event types. */
  private typedNext: string | null = null;
  protected readonly over = computed(() => {
    const max = this.maxLength();
    return max !== undefined && this.length() > max;
  });
  /** Live message near the limit: the characters left, else nothing. */
  protected readonly limitMessage = computed(() => {
    const max = this.maxLength();
    if (max === undefined) return '';
    const left = Math.max(0, max - this.length());
    return left <= Math.max(1, Math.ceil(max * 0.1)) ? this.text.editorCharactersLeft(left) : '';
  });

  /** Formats on at the caret. */
  private readonly active = signal<ReadonlySet<StarEditorCommand>>(new Set());
  /** Text style of the block at the caret. */
  protected readonly blockFormat = signal<StarEditorBlockFormat>('p');
  /** Font size step at the caret. */
  protected readonly fontSize = signal<StarEditorFontSize>('normal');
  /** Text color and highlight at the caret (`''` for none). */
  protected readonly textColorAt = signal('');
  protected readonly highlightAt = signal('');
  /** Undo and redo are possible. */
  private readonly canUndo = signal(false);
  private readonly canRedo = signal(false);

  // ---- Toolbar overflow ----
  /** Groups that show in the bar; the others are in the "More actions" panel. */
  protected readonly visibleCount = signal(Infinity);
  protected readonly moreOpen = signal(false);
  /** The toolbar is measured (the browser has `ResizeObserver`). */
  protected readonly fitting = signal(false);
  /** Widths of the groups, measured while they show in the bar. */
  private groupWidths: number[] = [];

  /** The toolbar control in the tab order (roving tabindex): a command, or `'more'`. */
  private readonly rovingKey = signal<string | null>(null);
  /** The keys of the toolbar controls that show now, in order. */
  private readonly shownKeys = computed(() => {
    const groups = this.groups();
    const count = Math.min(this.visibleCount(), groups.length);
    const keys: string[] = groups.slice(0, count).flat();
    if (count < groups.length) {
      keys.push('more');
      if (this.moreOpen()) keys.push(...groups.slice(count).flat());
    }
    return keys;
  });
  protected readonly tabStop = computed(() => {
    const keys = this.shownKeys();
    const key = this.rovingKey();
    return key && keys.includes(key) ? key : keys[0];
  });

  protected readonly linkOpen = signal(false);
  protected readonly linkUrl = signal('');
  protected readonly linkNewTab = signal(false);
  /** The open color panel. */
  protected readonly colorPanel = signal<Panel | null>(null);
  /** The HTML source view: on, its text, and what the last read found. */
  protected readonly sourceMode = signal(false);
  protected readonly sourceText = signal('');
  protected readonly sourceChanged = signal(false);
  protected readonly sourceUnclosed = signal<string | null>(null);
  protected readonly sourceId = this.ids.getId('star-editor-source-');
  protected readonly sourceStatusId = this.ids.getId('star-editor-source-status-');
  private sourceTimer: ReturnType<typeof setTimeout> | null = null;
  /** The source text when the view opened. */
  private sourceOpened = '';
  /** The open image or embed panel, and the image it edits. */
  protected readonly mediaPanel = signal<'image' | 'embed' | null>(null);
  /** The open table panel, and the table its properties are for. */
  protected readonly tablePanel = signal<'insert' | 'properties' | null>(null);
  protected readonly tableLook = signal<{
    borders: StarEditorTableBorders;
    align: StarEditorTableAlign;
  }>({ borders: 'all', align: 'start' });
  private panelTable: HTMLTableElement | null = null;
  /** The cell of the open table context menu. */
  private menuCell: HTMLTableCellElement | null = null;
  private readonly menuTrigger = viewChild('area', { read: CdkContextMenuTrigger });
  /** Items of the table context menu. */
  protected readonly tableMenu = computed<readonly StarMenuItem[]>(() => {
    const t = this.text;
    const item = (label: string, icon: string, run: (cell: HTMLTableCellElement) => unknown) => ({
      label,
      icon,
      command: () => this.tableCommand(run),
    });
    return [
      item(t.editorRowAbove, 'ph-bold ph-arrow-line-up', (c) => starEditorInsertRow(c, false)),
      item(t.editorRowBelow, 'ph-bold ph-arrow-line-down', (c) => starEditorInsertRow(c, true)),
      item(t.editorColumnBefore, 'ph-bold ph-arrow-line-left', (c) =>
        starEditorInsertColumn(c, false),
      ),
      item(t.editorColumnAfter, 'ph-bold ph-arrow-line-right', (c) =>
        starEditorInsertColumn(c, true),
      ),
      { separator: true },
      item(t.editorMergeNext, 'ph-bold ph-arrows-merge', starEditorMergeNext),
      item(t.editorMergeBelow, 'ph-bold ph-arrows-merge', starEditorMergeBelow),
      item(t.editorSplitCell, 'ph-bold ph-square-split-horizontal', starEditorSplitCell),
      item(t.editorHeaderRow, 'ph-bold ph-rows', (c) =>
        starEditorToggleHeaderRow(c.closest('table')!),
      ),
      { separator: true },
      {
        label: t.editorTableProperties,
        icon: 'ph-bold ph-sliders',
        command: () => this.openTableProperties(this.menuCell?.closest('table') ?? null),
      },
      { separator: true },
      item(t.editorDeleteRow, 'ph-bold ph-trash', starEditorDeleteRow),
      item(t.editorDeleteColumn, 'ph-bold ph-trash', starEditorDeleteColumn),
      {
        ...item(t.editorDeleteTable, 'ph-bold ph-trash', (c) => c.closest('table')!.remove()),
        danger: true,
      },
    ];
  });
  protected readonly imageInitial = signal<StarEditorImageValue | null>(null);
  private editedImage: HTMLImageElement | null = null;
  /** The selected image (a click, or a selection of just the image) and its frame. */
  private readonly selectedImage = signal<HTMLImageElement | null>(null);
  protected readonly imageFrame = signal<{
    top: number;
    left: number;
    width: number;
    height: number;
    max: number;
  } | null>(null);
  protected readonly embedResolver = (url: string) =>
    starEditorEmbedUrl(url, this.sanitize().embedHosts ?? []);
  /** The selection when the link popover opened, and the link at it. */
  private linkRange: Range | null = null;
  private linkAnchor: HTMLAnchorElement | null = null;
  /** The selection when a panel opened. */
  private panelRange: Range | null = null;
  private lastWritten: string | null = null;

  private readonly history = new StarEditorHistory();
  /** The last change was typing, and when. */
  private typing = false;
  private typedAt = 0;
  /** The input event that comes is typing (set in `beforeinput`). */
  private typingNext = false;

  constructor() {
    // Write the model into the editable area only when it changed from outside.
    afterRenderEffect({
      write: () => {
        const value = this.value();
        const text = this.format() === 'text';
        if (value === this.lastWritten) return;
        const area = this.area().nativeElement;
        area.innerHTML = this.clean(text ? starEditorTextToHtml(value) : value);
        this.lastWritten = value;
        this.length.set(starEditorPlainLength(area));
        if (this.showCount()) this.counts.set(starEditorCounts(area));
        starEditorProtectEmbeds(area);
        this.selectImage(null);
        this.history.reset({ html: area.innerHTML, selection: null });
        this.typing = false;
        this.updateHistoryState();
      },
    });
    // Toolbar groups that do not fit go into the "More actions" panel.
    this.destroyRef.onDestroy(() => {
      if (this.sourceTimer) clearTimeout(this.sourceTimer);
    });
    this.destroyRef.onDestroy(() => {
      if (this.findOpen()) this.paintMatches(true);
    });
    afterNextRender(() => {
      const area = this.area().nativeElement;
      // The frame of a selected image follows it when images load or the layout changes.
      const replace = () => {
        if (this.selectedImage()) this.placeFrame();
      };
      area.addEventListener('load', replace, true);
      area.addEventListener('error', replace, true);
      const onSelection = () => this.emitSelection();
      area.ownerDocument.addEventListener('selectionchange', onSelection);
      this.destroyRef.onDestroy(() =>
        area.ownerDocument.removeEventListener('selectionchange', onSelection),
      );
      const view = area.ownerDocument.defaultView;
      if (view && typeof view.ResizeObserver === 'function') {
        const areaObserver = new view.ResizeObserver(replace);
        areaObserver.observe(area);
        this.destroyRef.onDestroy(() => areaObserver.disconnect());
      }
      const toolbar = this.toolbarElement()?.nativeElement;
      if (!toolbar || !view || typeof view.ResizeObserver !== 'function') return;
      this.fitting.set(true);
      const observer = new view.ResizeObserver(() => this.fitToolbar());
      observer.observe(toolbar);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private readonly destroyRef = inject(DestroyRef);

  /** The last `selectionChange` payload, as a key (`undefined`: nothing emitted yet). */
  private lastSelection: string | null | undefined;

  /** Emits `selectionChange` when the selection in the area moved, or left it. */
  private emitSelection(): void {
    const area = this.area().nativeElement;
    const range = starEditorRange(area);
    if (!range) {
      if (this.lastSelection === null || this.lastSelection === undefined) return;
      this.lastSelection = null;
      this.selectionChange.emit(null);
      return;
    }
    const before = area.ownerDocument.createRange();
    before.selectNodeContents(area);
    before.setEnd(range.startContainer, range.startOffset);
    const text = range.toString();
    const change = { index: before.toString().length, length: text.length, text };
    const key = `${change.index}:${change.length}`;
    if (key === this.lastSelection) return;
    this.lastSelection = key;
    this.selectionChange.emit(change);
  }

  /** The allow-list sanitizer, with the link target rules. */
  private clean(html: string): string {
    return starEditorSanitize(html, this.area().nativeElement.ownerDocument, this.sanitize());
  }

  protected label(cmd: StarEditorCommand): string {
    if (cmd === 'formatBlock') return this.text.editorTextStyle;
    if (cmd === 'fontSize') return this.text.editorFontSize;
    return this.text[STAR_EDITOR_BUTTONS[cmd].label] as string;
  }

  protected icon(cmd: StarEditorCommand): string {
    return starEditorIsSelect(cmd) ? '' : STAR_EDITOR_BUTTONS[cmd].icon;
  }

  /** `aria-pressed` of a toggle button, `null` for an action button. */
  protected pressed(cmd: StarEditorCommand): boolean | null {
    if (cmd === 'source') return this.sourceMode();
    if (cmd === 'fullScreen') return this.fullScreen();
    if (starEditorIsSelect(cmd) || !STAR_EDITOR_BUTTONS[cmd].toggle) return null;
    return this.isActive(cmd);
  }

  /** `aria-expanded` of a button that opens a panel, else `null`. */
  protected expanded(cmd: StarEditorCommand): boolean | null {
    if (cmd === 'link') return this.linkOpen();
    if (cmd === 'textColor' || cmd === 'highlight') return this.colorPanel() === cmd;
    if (cmd === 'image' || cmd === 'embed') return this.mediaPanel() === cmd;
    if (cmd === 'table') return this.tablePanel() !== null;
    if (cmd === 'find') return this.findOpen() !== null;
    if (cmd === 'accessibility') return this.auditOpen();
    return null;
  }

  /**
   * Undo and redo are off when there is nothing to undo or redo; in the source view only the
   * source button works.
   */
  protected unavailable(cmd: StarEditorCommand): boolean {
    if (this.sourceMode())
      return (
        cmd !== 'source' && cmd !== 'fullScreen' && cmd !== 'shortcuts' && cmd !== 'accessibility'
      );
    return (cmd === 'undo' && !this.canUndo()) || (cmd === 'redo' && !this.canRedo());
  }

  /** True when the format of `command` is on at the caret, for example `isActive('bold')`. */
  isActive(command: StarEditorCommand): boolean {
    return this.active().has(command);
  }

  protected onInput(): void {
    const typed = this.typedNext;
    this.typedNext = null;
    if (
      this.markdownShortcuts() &&
      !this.sourceMode() &&
      (typed === ' ' || typed === '*') &&
      this.format() === 'html'
    ) {
      const area = this.area().nativeElement;
      const range = starEditorRange(area);
      if (range && starEditorInputRule(area, range)) this.typingNext = false;
    }
    this.commit(true);
    this.refreshState();
    if (this.selectedImage()) this.placeFrame();
    if (this.auditOpen()) this.issues.set(starEditorAudit(this.area().nativeElement));
  }

  /** Stores the area in the model and, with `record`, in the history. */
  private commit(record: boolean): void {
    const element = this.area().nativeElement;
    starEditorProtectEmbeds(element);
    const length = starEditorPlainLength(element);
    let value = '';
    if (length && element.textContent?.trim()) {
      value = this.format() === 'text' ? starEditorText(element) : this.clean(element.innerHTML);
    }
    this.lastWritten = value;
    const changed = value !== this.value();
    this.value.set(value);
    if (changed) {
      // Reuse the value: it is already the sanitized HTML, or the text with `format="text"`.
      const text = this.format() === 'text';
      this.textChange.emit({
        html: text ? this.clean(element.innerHTML) : value,
        text: text ? value : starEditorText(element),
      });
    }
    this.length.set(length);
    if (this.showCount()) this.counts.set(starEditorCounts(element));
    if (record) {
      const now = Date.now();
      const merge = this.typingNext && this.typing && now - this.typedAt < TYPING_MERGE_MS;
      this.history.record(
        {
          html: element.innerHTML,
          selection: starEditorSelectionPath(element, starEditorRange(element)),
        },
        merge,
      );
      this.typing = this.typingNext;
      this.typedAt = now;
      this.typingNext = false;
      this.updateHistoryState();
    }
  }

  private updateHistoryState(): void {
    this.canUndo.set(this.history.canUndo);
    this.canRedo.set(this.history.canRedo);
  }

  /** Undo (`-1`) or redo (`1`) with the history of the editor. */
  private travel(direction: -1 | 1): void {
    const state = direction < 0 ? this.history.undo() : this.history.redo();
    if (!state) return;
    const area = this.area().nativeElement;
    area.innerHTML = state.html;
    area.focus();
    starEditorRestore(starEditorPathRange(area, state.selection));
    this.typing = false;
    this.commit(false);
    this.updateHistoryState();
    this.refreshState();
  }

  /**
   * Inserts the clipboard: sanitized HTML, or plain text with `pasteAsText`, with `format="text"`
   * or when the HTML would pass `maxLength` (then the text is cut to fit).
   */
  protected onPaste(event: ClipboardEvent): void {
    const data = event.clipboardData;
    const plain = this.plainPaste;
    this.plainPaste = false;
    if (this.locked() || !data) return;
    event.preventDefault();
    this.insertData(data, plain);
  }

  /** Ctrl+Shift+V was pressed: the paste that comes is plain text. */
  private plainPaste = false;

  /** True while a drag that started inside this editor is under way (the browser moves its text). */
  protected dragFromInside = false;

  /**
   * A drop from outside the editor is a paste at the drop point: the same sanitizing,
   * `pasteAsText` and `maxLength`. Files are not taken. A drag that started inside the editor
   * keeps the native move. The drop is taken over only when its point resolves inside the area,
   * so a browser that cannot resolve it (Firefox) keeps its own drop.
   */
  protected onDrop(event: DragEvent): void {
    const internal = this.dragFromInside;
    this.dragFromInside = false;
    const data = event.dataTransfer;
    if (internal || this.locked() || !data) return;
    const area = this.area().nativeElement;
    const doc = area.ownerDocument as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    const at = doc.caretRangeFromPoint?.(event.clientX, event.clientY);
    if (!at || !area.contains(at.startContainer)) return;
    event.preventDefault();
    starEditorRestore(at);
    this.insertData(data);
  }

  /**
   * Inserts clipboard or drag data at the selection (see `onPaste`). HTML is cleaned (Word,
   * Google Docs and web page markup) and sanitized; `plain` inserts only the text.
   */
  private insertData(data: DataTransfer, plain = false): void {
    const area = this.area().nativeElement;
    const range = starEditorRange(area);
    if (!range) return;
    const max = this.maxLength();
    const room =
      max === undefined ? Infinity : Math.max(0, max - this.length() + range.toString().length);
    const html = data.getData('text/html');
    let clean = '';
    if (html && !plain && !this.pasteAsText() && this.format() === 'html') {
      clean = this.clean(starEditorCleanPaste(html, area.ownerDocument));
      // A template is inert: its images do not load while the text is measured.
      const probe = area.ownerDocument.createElement('template');
      probe.innerHTML = clean;
      if (starEditorPlainLength(probe.content) > room) clean = '';
    }
    const doc = area.ownerDocument;
    if (clean) {
      if (!doc.execCommand?.('insertHTML', false, clean)) {
        range.deleteContents();
        const fragment = range.createContextualFragment(clean);
        const last = fragment.lastChild;
        range.insertNode(fragment);
        if (last) range.setStartAfter(last);
        range.collapse(true);
        starEditorRestore(range);
      }
    } else {
      const text = data.getData('text/plain').slice(0, room === Infinity ? undefined : room);
      if (text && !doc.execCommand?.('insertText', false, text)) {
        range.deleteContents();
        const node = doc.createTextNode(text);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        starEditorRestore(range);
      }
    }
    this.onInput();
  }

  /**
   * Stops text input that would pass `maxLength`. Line breaks and deletions pass. The browser
   * history steps (`historyUndo`, `historyRedo`, for example from the Edit menu) use the history
   * of the editor.
   */
  protected onBeforeInput(event: InputEvent): void {
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      event.preventDefault();
      this.travel(event.inputType === 'historyUndo' ? -1 : 1);
      return;
    }
    this.typingNext = event.inputType === 'insertText';
    this.typedNext = event.inputType === 'insertText' ? event.data : null;
    const max = this.maxLength();
    if (max === undefined || !event.inputType.startsWith('insert')) return;
    if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') return;
    const added = event.data?.length ?? event.dataTransfer?.getData('text/plain').length ?? 0;
    const range = starEditorRange(this.area().nativeElement);
    const replaced = range ? range.toString().length : 0;
    if (this.length() - replaced + added > max) event.preventDefault();
  }

  /**
   * Keys of the area: Ctrl+Shift+V makes the next paste plain text; Ctrl+Z and Ctrl+Y
   * (Ctrl+Shift+Z) use the history of the editor; Tab and
   * Shift+Tab in a list item nest it and take it out (when it cannot move, Tab leaves the area as
   * usual); Ctrl+Enter checks a checklist item.
   */
  protected onAreaKeydown(event: KeyboardEvent): void {
    if (this.locked()) return;
    if (this.selectedImage() && !event.shiftKey && event.key !== 'Tab') this.selectImage(null);
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    this.plainPaste = mod && event.shiftKey && key === 'v';
    if (mod && !event.altKey && !event.shiftKey && (key === 'f' || key === 'h')) {
      event.preventDefault();
      this.openFind(key === 'h' ? 'replace' : 'find');
      return;
    }
    if (event.key === 'Escape' && this.fullScreen()) {
      event.preventDefault();
      this.fullScreen.set(false);
      return;
    }
    if (mod && !event.altKey && (key === 'z' || key === 'y')) {
      event.preventDefault();
      this.travel(key === 'y' || event.shiftKey ? 1 : -1);
      return;
    }
    const area = this.area().nativeElement;
    const range = starEditorRange(area);
    if (!range) return;
    if (this.tableKey(event, range)) return;
    if (event.key === 'Tab' && !mod && !event.altKey) {
      const items = starEditorItems(area, range);
      if (items.length && starEditorIndentItems(area, range, items, event.shiftKey ? -1 : 1)) {
        event.preventDefault();
        this.onInput();
      }
      return;
    }
    if (event.key === 'Enter' && mod) {
      const item = starEditorClosest(range.startContainer, area, ['LI']);
      if (item?.parentElement?.classList.contains(STAR_EDITOR_CHECKLIST_CLASS)) {
        event.preventDefault();
        starEditorToggleCheck(item);
        this.onInput();
      }
    }
  }

  /** A click on the box of a checklist item checks it; a click on an image selects it. */
  protected onAreaClick(event: MouseEvent): void {
    if (this.locked()) return;
    const item = event.target instanceof Element ? event.target : null;
    if (item instanceof HTMLImageElement) {
      const range = item.ownerDocument.createRange();
      range.selectNode(item);
      starEditorRestore(range);
      this.selectImage(item);
      return;
    }
    this.selectImage(null);
    if (
      item?.tagName !== 'LI' ||
      !item.parentElement?.classList.contains(STAR_EDITOR_CHECKLIST_CLASS)
    )
      return;
    const box = item.getBoundingClientRect();
    const rtl = item.ownerDocument.defaultView?.getComputedStyle(item).direction === 'rtl';
    const fromStart = rtl ? box.right - event.clientX : event.clientX - box.left;
    // The box is in the padding at the start of the item (see the editor styles).
    if (fromStart > 28) return;
    starEditorToggleCheck(item);
    this.onInput();
  }

  /**
   * Runs a toolbar command on the selection, for example `exec('bold')` or
   * `exec('formatBlock', 'h2')`. `exec('link')` opens the link popover; `exec('link', url)` links
   * the selection to a safe `url` at once. `exec('textColor')` and `exec('highlight')` open the
   * color panel; with a value (a CSS color, `var(--star-…)`, or `''` for none) they set it.
   * `exec('fontSize', 'large')` sets a size step. Nothing happens while the editor is disabled or
   * read-only.
   *
   * Alignment is stored as the classes `star-text-center`, `star-text-end` and
   * `star-text-justify` (where the HTML is shown later, the StarNG CSS must be loaded). Colors,
   * sizes and indentation are inline styles that the sanitizer keeps.
   */
  exec(command: StarEditorCommand, value?: string): void {
    if (this.locked()) return;
    const area = this.area().nativeElement;
    if (command === 'link') {
      if (value === undefined) this.openLink();
      else {
        const url = starEditorSafeUrl(value);
        if (!url) return;
        this.linkRange = starEditorRange(area)?.cloneRange() ?? null;
        this.linkAnchor = this.anchorAt(this.linkRange);
        this.applyLink({ url, newTab: false });
      }
      return;
    }
    if (command === 'source') {
      this.toggleSource();
      return;
    }
    if (command === 'fullScreen') {
      this.fullScreen.set(!this.fullScreen());
      return;
    }
    if (command === 'accessibility') {
      this.auditOpen.set(!this.auditOpen());
      if (this.auditOpen()) this.issues.set(starEditorAudit(area));
      return;
    }
    if (command === 'shortcuts') {
      this.openShortcuts();
      return;
    }
    if (command === 'find') {
      this.openFind(this.findOpen() ? null : 'replace');
      return;
    }
    if (this.sourceMode()) return;
    if (command === 'undo' || command === 'redo') {
      this.travel(command === 'undo' ? -1 : 1);
      return;
    }
    if (command === 'image' || command === 'embed') {
      this.openMedia(command);
      return;
    }
    if (command === 'table') {
      const table = this.cellAt(starEditorRange(area))?.closest('table') ?? null;
      if (table) this.openTableProperties(table);
      else this.openTableInsert();
      return;
    }
    if ((command === 'textColor' || command === 'highlight') && value === undefined) {
      this.openPanel(command);
      return;
    }
    // The selects keep the focus, so a keyboard user can try the next option.
    const returnTo =
      starEditorIsSelect(command) && area.ownerDocument.activeElement instanceof HTMLSelectElement
        ? area.ownerDocument.activeElement
        : null;
    // Focusing the area can move the caret: keep the selection that the command is for.
    const saved = (this.panelRange ?? starEditorRange(area))?.cloneRange() ?? null;
    area.focus();
    if (saved) starEditorRestore(saved);
    const range = starEditorRange(area);
    const run = (name: string, argument?: string) =>
      area.ownerDocument.execCommand?.(name, false, argument);
    switch (command) {
      case 'heading':
        run('formatBlock', this.blockFormat() === 'h3' ? 'p' : 'h3');
        break;
      case 'formatBlock':
        run('formatBlock', value && this.blockFormats.includes(value as never) ? value : 'p');
        break;
      case 'blockquote':
        run('formatBlock', this.isActive('blockquote') ? 'p' : 'blockquote');
        break;
      case 'code':
        if (range) starEditorToggleCode(area, range);
        break;
      case 'subscript':
      case 'superscript':
        if (range) starEditorToggleScript(area, range, command === 'subscript' ? 'SUB' : 'SUP');
        break;
      case 'textColor':
      case 'highlight':
        if (range)
          starEditorSetStyle(
            area,
            range,
            command === 'textColor' ? 'color' : 'background-color',
            value || null,
          );
        break;
      case 'fontSize':
        if (range)
          starEditorSetStyle(
            area,
            range,
            'font-size',
            STAR_EDITOR_FONT_SIZES[(value ?? 'normal') as StarEditorFontSize] || null,
          );
        break;
      case 'insertUnorderedList':
      case 'insertOrderedList':
      case 'checklist':
        if (range)
          starEditorToggleList(
            area,
            range,
            command === 'checklist' ? 'checklist' : command === 'insertOrderedList' ? 'ol' : 'ul',
          );
        break;
      case 'indent':
      case 'outdent':
        if (range) {
          const delta = command === 'indent' ? 1 : -1;
          const items = starEditorItems(area, range);
          if (items.length) starEditorIndentItems(area, range, items, delta);
          else starEditorIndentBlocks(starEditorBlocks(area, range), delta);
        }
        break;
      case 'horizontalRule':
        if (range) starEditorInsertRule(area, range);
        break;
      case 'removeFormat':
        if (range) starEditorClearFormat(area, range);
        break;
      case 'justifyLeft':
      case 'justifyCenter':
      case 'justifyRight':
      case 'justifyFull':
        if (range) {
          const alignment =
            command === 'justifyLeft'
              ? 'start'
              : command === 'justifyCenter'
                ? 'center'
                : command === 'justifyRight'
                  ? 'end'
                  : 'justify';
          starEditorAlign(area, range, alignment);
        }
        break;
      default:
        run(command);
    }
    this.panelRange = null;
    this.onInput();
    if (this.moreOpen()) this.moreOpen.set(false);
    returnTo?.focus();
  }

  // ---- Panels ----

  private openPanel(kind: Panel): void {
    this.panelRange = starEditorRange(this.area().nativeElement)?.cloneRange() ?? null;
    this.linkOpen.set(false);
    this.mediaPanel.set(null);
    this.tablePanel.set(null);
    this.colorPanel.set(this.colorPanel() === kind ? null : kind);
  }

  protected pickColor(kind: Panel, color: string): void {
    this.colorPanel.set(null);
    this.exec(kind, color);
  }

  protected closePanel(): void {
    this.colorPanel.set(null);
    this.area().nativeElement.focus();
    starEditorRestore(this.panelRange);
    this.panelRange = null;
    this.refreshState();
  }

  // ---- HTML source view ----

  /** Switches between the editing area and the HTML source view. */
  private toggleSource(): void {
    const area = this.area().nativeElement;
    if (!this.sourceMode()) {
      this.linkOpen.set(false);
      this.colorPanel.set(null);
      this.mediaPanel.set(null);
      this.selectImage(null);
      this.sourceText.set(starEditorFormatHtml(this.clean(area.innerHTML), area.ownerDocument));
      this.sourceOpened = this.sourceText();
      this.sourceChanged.set(false);
      this.sourceUnclosed.set(null);
      this.sourceMode.set(true);
      return;
    }
    // A source that was not edited is not read back: the area and the value stay as they are.
    if (this.sourceText() !== this.sourceOpened || this.sourceTimer) this.readSource();
    this.sourceMode.set(false);
    area.focus();
    this.refreshState();
  }

  /** The source changed: read it back after a short pause in typing. */
  protected onSourceInput(text: string): void {
    this.sourceText.set(text);
    if (this.sourceTimer) clearTimeout(this.sourceTimer);
    this.sourceTimer = setTimeout(() => this.readSource(), 300);
  }

  /** Reads the source into the area and the value, sanitized. */
  private readSource(): void {
    if (this.sourceTimer) clearTimeout(this.sourceTimer);
    this.sourceTimer = null;
    const area = this.area().nativeElement;
    const result = starEditorReadSource(this.sourceText(), area.ownerDocument, this.sanitize());
    this.sourceChanged.set(result.changed);
    this.sourceUnclosed.set(result.unclosed);
    if (result.html === area.innerHTML) return;
    area.innerHTML = result.html;
    starEditorProtectEmbeds(area);
    this.typing = false;
    this.commit(true);
  }

  // ---- Find and replace ----

  private findOptions() {
    return { matchCase: this.matchCase(), wholeWord: this.wholeWord() };
  }

  /** Opens find (`'find'`) or find and replace (`'replace'`), or closes it (`null`). */
  private openFind(mode: 'find' | 'replace' | null): void {
    if (this.sourceMode() && mode) return;
    if (!mode) {
      this.closeFind();
      return;
    }
    const range = starEditorRange(this.area().nativeElement);
    const selected = range?.toString() ?? '';
    if (selected && !selected.includes('\n') && selected.length < 100) this.findQuery.set(selected);
    this.findOpen.set(mode);
    this.runFind();
    // Render the panel now and focus its field in the same key event: the keys that the user
    // types next go into the field, not into the content (a render wait lost them).
    this.changeDetector.detectChanges();
    const field = this.host.nativeElement.querySelector<HTMLInputElement>(`#${this.findId}`);
    field?.focus();
    field?.select();
  }

  private readonly changeDetector = inject(ChangeDetectorRef);

  private readonly injector = inject(Injector);

  protected closeFind(): void {
    this.findOpen.set(null);
    this.paintMatches(true);
    const area = this.area().nativeElement;
    area.focus();
    const current = this.matches[this.matchIndex()];
    if (current && area.contains(current.startContainer)) starEditorRestore(current);
  }

  /** Finds the matches again (the query, an option or the text changed). */
  protected runFind(): void {
    const area = this.area().nativeElement;
    this.matches = starEditorFind(area, this.findQuery(), this.findOptions());
    this.matchTotal.set(this.matches.length);
    this.matchIndex.set(this.matches.length ? 0 : -1);
    this.findStatus.set(this.statusText());
    this.paintMatches(false);
  }

  private statusText(): string {
    if (!this.findQuery()) return '';
    return this.matches.length
      ? this.text.editorMatchCount(this.matchIndex() + 1, this.matches.length)
      : this.text.noResults;
  }

  protected moveMatch(delta: 1 | -1): void {
    if (!this.matches.length) return;
    this.matchIndex.set((this.matchIndex() + delta + this.matches.length) % this.matches.length);
    this.findStatus.set(this.statusText());
    this.paintMatches(false);
  }

  /** Marks the matches with the CSS Custom Highlight API, where the browser has it. */
  private paintMatches(clear: boolean): void {
    const view = this.area().nativeElement.ownerDocument.defaultView as
      | (Window & {
          CSS?: { highlights?: Map<string, unknown> };
          Highlight?: new (...ranges: Range[]) => unknown;
        })
      | null;
    const highlights = view?.CSS?.highlights;
    const current = this.matches[this.matchIndex()];
    if (!clear && current) {
      const target = current.startContainer.parentElement;
      target?.scrollIntoView?.({ block: 'nearest' });
    }
    if (!highlights || !view?.Highlight) return;
    if (clear || !this.matches.length) {
      highlights.delete('star-editor-match');
      highlights.delete('star-editor-match-current');
      return;
    }
    highlights.set('star-editor-match', new view.Highlight(...this.matches));
    highlights.set('star-editor-match-current', new view.Highlight(current));
  }

  protected onFindKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeFind();
    } else if (event.key === 'Enter' && (event.target as Element).id === this.findId) {
      event.preventDefault();
      this.moveMatch(event.shiftKey ? -1 : 1);
    }
  }

  protected replaceCurrent(): void {
    const current = this.matches[this.matchIndex()];
    if (!current || this.locked()) return;
    const index = this.matchIndex();
    starEditorReplace(current, this.replaceText());
    this.commit(true);
    this.runFind();
    if (this.matches.length) {
      this.matchIndex.set(Math.min(index, this.matches.length - 1));
      this.findStatus.set(this.statusText());
      this.paintMatches(false);
    }
  }

  protected replaceAll(): void {
    if (this.locked() || !this.findQuery()) return;
    const count = starEditorReplaceAll(
      this.area().nativeElement,
      this.findQuery(),
      this.replaceText(),
      this.findOptions(),
    );
    this.commit(true);
    this.runFind();
    this.findStatus.set(this.text.editorReplaced(count));
  }

  // ---- Accessibility check ----

  /** The text of a problem. */
  protected issueText(issue: StarEditorIssue): string {
    const t = this.text;
    switch (issue.kind) {
      case 'alt':
        return t.editorIssueAlt;
      case 'emptyLink':
        return t.editorIssueEmptyLink;
      case 'heading':
        return t.editorIssueHeading(issue.detail[0], issue.detail[1]);
      case 'tableHeader':
        return t.editorIssueTableHeader;
      default:
        return t.editorIssueContrast(issue.detail[0]);
    }
  }

  /** Selects the element of a problem in the area. */
  protected goToIssue(issue: StarEditorIssue): void {
    const area = this.area().nativeElement;
    if (!area.contains(issue.element)) return;
    area.focus();
    const range = area.ownerDocument.createRange();
    range.selectNode(issue.element);
    starEditorRestore(range);
    issue.element.scrollIntoView?.({ block: 'nearest' });
    if (issue.element instanceof HTMLImageElement) this.selectImage(issue.element);
    this.refreshState();
  }

  /** Repairs a problem, and checks again. */
  protected fixIssue(issue: StarEditorIssue): void {
    const area = this.area().nativeElement;
    if (this.locked() || !area.contains(issue.element)) return;
    issue.fix();
    this.commit(true);
    this.issues.set(starEditorAudit(area));
  }

  // ---- Keyboard shortcut help ----

  private openShortcuts(): void {
    const dialog = this.shortcutsDialog()?.nativeElement;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  protected closeShortcuts(): void {
    const dialog = this.shortcutsDialog()?.nativeElement;
    if (typeof dialog?.close === 'function') dialog.close();
    else dialog?.removeAttribute('open');
    this.focus();
  }

  /** The rows of the shortcut help: keys and what they do. */
  protected readonly shortcutRows = computed(() => {
    const t = this.text;
    return [
      ['Ctrl+B', t.editorBold],
      ['Ctrl+I', t.editorItalic],
      ['Ctrl+U', t.editorUnderline],
      ['Ctrl+Z', t.undo],
      ['Ctrl+Y, Ctrl+Shift+Z', t.redo],
      ['Ctrl+F', t.editorFind],
      ['Ctrl+H', t.editorFindReplace],
      ['Ctrl+Shift+V', t.editorPastePlain],
      ['Tab', t.editorIndent],
      ['Shift+Tab', t.editorOutdent],
      ['Ctrl+Enter', t.editorCheckItem],
      ['Tab, Shift+Tab', t.editorNextCell],
      ['Shift+F10', t.editorTableMenu],
      ['Alt+Shift+←, Alt+Shift+→', t.editorColumnWidth],
      ['Escape', t.close],
      ...(this.markdownShortcuts() ? [['#, ##, >, -, 1., [], **', t.editorMarkdownHint]] : []),
    ] as const;
  });

  // ---- Tables ----

  /** The table cell of the range in this area, or `null`. */
  private cellAt(range: Range | null): HTMLTableCellElement | null {
    if (!range) return null;
    return starEditorClosest(range.startContainer, this.area().nativeElement, [
      'TD',
      'TH',
    ]) as HTMLTableCellElement | null;
  }

  private closePanels(): void {
    this.linkOpen.set(false);
    this.colorPanel.set(null);
    this.mediaPanel.set(null);
    this.tablePanel.set(null);
  }

  private openTableInsert(): void {
    this.panelRange = starEditorRange(this.area().nativeElement)?.cloneRange() ?? null;
    const open = this.tablePanel() === 'insert';
    this.closePanels();
    if (!open) this.tablePanel.set('insert');
  }

  private openTableProperties(table: HTMLTableElement | null): void {
    if (!table) return;
    this.panelRange = starEditorRange(this.area().nativeElement)?.cloneRange() ?? null;
    this.panelTable = table;
    this.tableLook.set(starEditorTableLook(table));
    this.closePanels();
    this.tablePanel.set('properties');
  }

  protected closeTablePanel(): void {
    this.tablePanel.set(null);
    this.area().nativeElement.focus();
    starEditorRestore(this.panelRange);
    this.panelRange = null;
  }

  protected insertTable(size: { rows: number; cols: number; header: boolean }): void {
    const area = this.area().nativeElement;
    this.tablePanel.set(null);
    area.focus();
    starEditorRestore(this.panelRange);
    this.panelRange = null;
    const range = starEditorRange(area) ?? this.endRange();
    const table = starEditorNewTable(area.ownerDocument, size.rows, size.cols, size.header);
    let anchor: Element | null = starEditorBlocks(area, range).at(-1) ?? null;
    while (anchor && anchor.parentElement !== area) anchor = anchor.parentElement;
    if (anchor && !anchor.textContent?.trim() && !anchor.querySelector('img,iframe,table,hr'))
      anchor.replaceWith(table);
    else if (anchor) anchor.after(table);
    else area.appendChild(table);
    if (!table.nextElementSibling) {
      const paragraph = area.ownerDocument.createElement('p');
      paragraph.appendChild(area.ownerDocument.createElement('br'));
      table.after(paragraph);
    }
    this.caretIn(table.rows[0].cells[0]);
    this.onInput();
  }

  protected applyTableLook(look: {
    borders: StarEditorTableBorders;
    align: StarEditorTableAlign;
  }): void {
    this.tablePanel.set(null);
    const table = this.panelTable;
    this.area().nativeElement.focus();
    starEditorRestore(this.panelRange);
    this.panelRange = null;
    if (table && this.area().nativeElement.contains(table)) {
      starEditorSetTableLook(table, look);
      this.onInput();
    }
  }

  /** Puts the caret at the start of `cell` (its whole text selected). */
  private caretIn(cell: HTMLTableCellElement): void {
    const range = cell.ownerDocument.createRange();
    range.selectNodeContents(cell);
    if (!cell.textContent?.trim()) range.collapse(true);
    starEditorRestore(range);
  }

  /** Runs a table command on the cell of the menu, and puts the caret back in the table. */
  private tableCommand(run: (cell: HTMLTableCellElement) => unknown): void {
    const cell = this.menuCell;
    const area = this.area().nativeElement;
    if (!cell || !area.contains(cell) || this.locked()) return;
    const table = cell.closest('table')!;
    const row = cell.parentElement as HTMLTableRowElement;
    run(cell);
    area.focus();
    const target = area.contains(cell)
      ? cell
      : row.isConnected && row.cells[0]
        ? row.cells[0]
        : area.contains(table)
          ? table.rows[0]?.cells[0]
          : null;
    if (target) this.caretIn(target);
    this.onInput();
  }

  /** The table context menu works only on table cells; elsewhere the browser menu shows. */
  protected onAreaPointerDown(event: PointerEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const cell = target?.closest('td, th');
    const trigger = this.menuTrigger();
    if (trigger)
      trigger.disabled = this.locked() || !cell || !this.area().nativeElement.contains(cell);
    if (cell) this.menuCell = cell as HTMLTableCellElement;
    if (event.button === 0) this.startColumnResize(event);
  }

  protected onAreaContextMenu(event: MouseEvent): void {
    const cell = (event.target as Element | null)?.closest?.('td, th');
    const trigger = this.menuTrigger();
    if (trigger) trigger.disabled = this.locked() || !cell;
    if (cell) this.menuCell = cell as HTMLTableCellElement;
  }

  /** Keys in a table cell. True when the key was used. */
  private tableKey(event: KeyboardEvent, range: Range): boolean {
    const cell = this.cellAt(range);
    const trigger = this.menuTrigger();
    if (!cell) {
      // Outside a table the browser menu shows.
      if (trigger && ɵstarIsContextMenuKey(event)) trigger.disabled = true;
      return false;
    }
    if (ɵstarIsContextMenuKey(event)) {
      event.preventDefault();
      this.menuCell = cell;
      if (trigger) trigger.disabled = false;
      ɵstarOpenContextMenu(cell);
      return true;
    }
    if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      const next = starEditorSiblingCell(cell, event.shiftKey ? -1 : 1);
      // At the last cell (or the first, with Shift) Tab leaves the area as usual.
      if (!next) return true;
      event.preventDefault();
      this.caretIn(next);
      this.refreshState();
      return true;
    }
    const key = starInlineKey(event, this.area().nativeElement);
    if (event.altKey && event.shiftKey && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      event.preventDefault();
      const table = cell.closest('table')!;
      const col = starEditorCellPlace(starEditorTableGrid(table), cell).col;
      const width = starEditorColumnWidth(table, col) || cell.offsetWidth || 120;
      starEditorSetColumnWidth(table, col, width + (key === 'ArrowRight' ? 10 : -10));
      this.onInput();
      return true;
    }
    return false;
  }

  /** A drag that started on the end edge of a cell resizes its column. */
  private columnDrag: {
    table: HTMLTableElement;
    col: number;
    x: number;
    width: number;
    rtl: boolean;
  } | null = null;

  private startColumnResize(event: PointerEvent): void {
    const cell = (event.target as Element | null)?.closest?.(
      'td, th',
    ) as HTMLTableCellElement | null;
    if (!cell || this.locked()) return;
    const box = cell.getBoundingClientRect();
    const view = cell.ownerDocument.defaultView;
    const rtl = view?.getComputedStyle(cell).direction === 'rtl';
    const fromEnd = rtl ? event.clientX - box.left : box.right - event.clientX;
    if (fromEnd < 0 || fromEnd > 5) return;
    event.preventDefault();
    const table = cell.closest('table')!;
    const place = starEditorCellPlace(starEditorTableGrid(table), cell);
    const col = place.col + Math.max(1, cell.colSpan) - 1;
    this.columnDrag = {
      table,
      col,
      x: event.clientX,
      width: starEditorColumnWidth(table, col) || box.width / Math.max(1, cell.colSpan),
      rtl,
    };
    this.area().nativeElement.setPointerCapture?.(event.pointerId);
  }

  protected onAreaPointerMove(event: PointerEvent): void {
    const drag = this.columnDrag;
    const area = this.area().nativeElement;
    if (drag) {
      const delta = event.clientX - drag.x;
      starEditorSetColumnWidth(drag.table, drag.col, drag.width + (drag.rtl ? -delta : delta));
      return;
    }
    // The resize cursor shows on the end edge of a cell.
    const cell = (event.target as Element | null)?.closest?.('td, th');
    let edge = false;
    if (cell && !this.locked()) {
      const box = cell.getBoundingClientRect();
      const rtl = cell.ownerDocument.defaultView?.getComputedStyle(cell).direction === 'rtl';
      const fromEnd = rtl ? event.clientX - box.left : box.right - event.clientX;
      edge = fromEnd >= 0 && fromEnd <= 5;
    }
    area.classList.toggle('star-editor__area--col-resize', edge);
  }

  protected onAreaPointerUp(): void {
    if (!this.columnDrag) return;
    this.columnDrag = null;
    this.onInput();
  }

  // ---- Images and embeds ----

  private openMedia(kind: 'image' | 'embed'): void {
    const area = this.area().nativeElement;
    this.panelRange = starEditorRange(area)?.cloneRange() ?? null;
    this.linkOpen.set(false);
    this.colorPanel.set(null);
    this.tablePanel.set(null);
    this.editedImage = kind === 'image' ? this.imageAt(this.panelRange) : null;
    this.imageInitial.set(this.editedImage ? starEditorImageOf(this.editedImage) : null);
    this.mediaPanel.set(this.mediaPanel() === kind ? null : kind);
  }

  /** The image that the range selects, or the selected image. */
  private imageAt(range: Range | null): HTMLImageElement | null {
    const selected = this.selectedImage();
    if (selected && this.area().nativeElement.contains(selected)) return selected;
    if (!range || range.startContainer !== range.endContainer) return null;
    const node = range.startContainer.childNodes[range.startOffset];
    return range.endOffset === range.startOffset + 1 && node instanceof HTMLImageElement
      ? node
      : null;
  }

  protected closeMedia(): void {
    this.mediaPanel.set(null);
    this.area().nativeElement.focus();
    starEditorRestore(this.panelRange);
    this.panelRange = null;
  }

  protected applyImage(value: StarEditorImageValue): void {
    const area = this.area().nativeElement;
    this.mediaPanel.set(null);
    area.focus();
    starEditorRestore(this.panelRange);
    const range = starEditorRange(area) ?? this.endRange();
    const existing = this.editedImage && area.contains(this.editedImage) ? this.editedImage : null;
    const image = starEditorPutImage(area, range, value, existing);
    this.panelRange = null;
    this.onInput();
    if (existing) this.selectImage(image);
  }

  protected applyEmbed(embed: { src: string; title: string }): void {
    const area = this.area().nativeElement;
    this.mediaPanel.set(null);
    area.focus();
    starEditorRestore(this.panelRange);
    starEditorPutEmbed(area, starEditorRange(area) ?? this.endRange(), embed.src, embed.title);
    this.panelRange = null;
    this.onInput();
  }

  /** A caret at the end of the area. */
  private endRange(): Range {
    const area = this.area().nativeElement;
    const range = area.ownerDocument.createRange();
    range.selectNodeContents(area);
    range.collapse(false);
    return range;
  }

  private selectImage(image: HTMLImageElement | null): void {
    this.selectedImage.set(image);
    this.placeFrame();
  }

  /** Puts the resize frame over the selected image. */
  private placeFrame(): void {
    const image = this.selectedImage();
    const area = this.area().nativeElement;
    if (!image || !area.contains(image) || this.locked()) {
      this.imageFrame.set(null);
      return;
    }
    const host = this.host.nativeElement.getBoundingClientRect();
    const box = image.getBoundingClientRect();
    this.imageFrame.set({
      top: box.top - host.top,
      left: box.left - host.left,
      width: Math.round(box.width || Number(image.getAttribute('width')) || image.width),
      height: Math.round(box.height || image.height),
      max: Math.max(16, area.clientWidth || 4000),
    });
  }

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private resizeStart: { x: number; width: number; rtl: boolean } | null = null;

  /** Sets the width of the selected image, from 16 pixels to the width of the area. */
  private resizeImage(width: number): void {
    const image = this.selectedImage();
    const frame = this.imageFrame();
    if (!image || !frame) return;
    image.setAttribute('width', String(Math.round(Math.max(16, Math.min(frame.max, width)))));
    image.removeAttribute('height');
    this.placeFrame();
  }

  protected onHandleDown(event: PointerEvent): void {
    const image = this.selectedImage();
    if (!image) return;
    event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    const view = this.host.nativeElement.ownerDocument.defaultView;
    const rtl = view?.getComputedStyle(this.host.nativeElement).direction === 'rtl';
    this.resizeStart = { x: event.clientX, width: this.imageFrame()?.width ?? image.width, rtl };
  }

  protected onHandleMove(event: PointerEvent): void {
    const start = this.resizeStart;
    if (!start) return;
    const delta = event.clientX - start.x;
    this.resizeImage(start.width + (start.rtl ? -delta : delta));
  }

  protected onHandleUp(): void {
    if (!this.resizeStart) return;
    this.resizeStart = null;
    this.commit(true);
  }

  /** The keyboard alternative of the handle: a slider of the image width. */
  protected onHandleKeydown(event: KeyboardEvent): void {
    const frame = this.imageFrame();
    if (!frame) return;
    const step = event.shiftKey ? 50 : 10;
    const key = starInlineKey(event, this.host.nativeElement);
    const width =
      key === 'ArrowRight' || key === 'ArrowUp'
        ? frame.width + step
        : key === 'ArrowLeft' || key === 'ArrowDown'
          ? frame.width - step
          : key === 'Home'
            ? 16
            : key === 'End'
              ? frame.max
              : null;
    if (width === null) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.focus();
      }
      return;
    }
    event.preventDefault();
    this.resizeImage(width);
    this.commit(true);
  }

  // ---- Link popover ----

  private anchorAt(range: Range | null): HTMLAnchorElement | null {
    if (!range) return null;
    const area = this.area().nativeElement;
    return starEditorClosest(range.commonAncestorContainer, area, [
      'A',
    ]) as HTMLAnchorElement | null;
  }

  private openLink(): void {
    const area = this.area().nativeElement;
    this.colorPanel.set(null);
    this.mediaPanel.set(null);
    this.tablePanel.set(null);
    this.linkRange = starEditorRange(area)?.cloneRange() ?? null;
    this.linkAnchor = this.anchorAt(this.linkRange);
    this.linkUrl.set(this.linkAnchor?.getAttribute('href') ?? '');
    this.linkNewTab.set(this.linkAnchor?.getAttribute('target') === '_blank');
    this.linkOpen.set(true);
  }

  protected closeLink(): void {
    this.linkOpen.set(false);
    this.area().nativeElement.focus();
    starEditorRestore(this.linkRange);
    this.refreshState();
  }

  protected applyLink(link: StarEditorLinkValue): void {
    const area = this.area().nativeElement;
    const doc = area.ownerDocument;
    area.focus();
    starEditorRestore(this.linkRange);
    const range = this.linkRange;
    if (this.linkAnchor && area.contains(this.linkAnchor)) {
      starEditorSetLink(this.linkAnchor, link);
    } else if (range) {
      const before = new Set(area.querySelectorAll('a'));
      // The browser command keeps the formats of the text.
      const done = !range.collapsed && doc.execCommand?.('createLink', false, link.url);
      if (done) {
        for (const anchor of area.querySelectorAll('a'))
          if (!before.has(anchor) && anchor.getAttribute('href') === link.url)
            starEditorSetLink(anchor, link);
      } else {
        const anchor = doc.createElement('a');
        starEditorSetLink(anchor, link);
        if (range.collapsed) anchor.textContent = link.url;
        else {
          const content = range.extractContents();
          for (const inner of content.querySelectorAll('a')) starEditorUnwrap(inner);
          anchor.appendChild(content);
        }
        range.insertNode(anchor);
        range.selectNodeContents(anchor);
        starEditorRestore(range);
      }
    }
    this.linkOpen.set(false);
    this.onInput();
  }

  protected removeLink(): void {
    const area = this.area().nativeElement;
    if (this.linkAnchor && area.contains(this.linkAnchor)) starEditorUnwrap(this.linkAnchor);
    this.linkOpen.set(false);
    area.focus();
    this.onInput();
  }

  // ---- Toolbar keyboard and overflow ----

  private controls(): HTMLElement[] {
    const toolbar = this.toolbarElement()?.nativeElement;
    return toolbar ? [...toolbar.querySelectorAll<HTMLElement>('[data-editor-control]')] : [];
  }

  protected onToolbarFocus(key: string): void {
    this.rovingKey.set(key);
  }

  protected onToolbarKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.moreOpen()) {
      this.closeMore(event);
      return;
    }
    const controls = this.controls();
    const index = controls.indexOf(event.target as HTMLElement);
    if (index < 0) return;
    const enabled = controls.filter((control) => !(control as HTMLButtonElement).disabled);
    const target = starEditorToolbarMove(
      starInlineKey(event, this.toolbarElement()?.nativeElement),
      enabled.indexOf(controls[index]),
      enabled.length,
    );
    if (target === null) return;
    event.preventDefault();
    enabled[target].focus();
  }

  private closeMore(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.moreOpen.set(false);
    this.toolbarElement()
      ?.nativeElement.querySelector<HTMLElement>('[data-editor-key=more]')
      ?.focus();
  }

  /** Puts the groups that do not fit into the "More actions" panel. */
  private fitToolbar(): void {
    const toolbar = this.toolbarElement()?.nativeElement;
    if (!toolbar) return;
    for (const group of toolbar.querySelectorAll<HTMLElement>('[data-editor-group]'))
      this.groupWidths[Number(group.dataset['editorGroup'])] = group.offsetWidth;
    const widths = this.groups().map((_, index) => this.groupWidths[index] ?? 0);
    const style = toolbar.ownerDocument.defaultView?.getComputedStyle(toolbar);
    const padding = style
      ? parseFloat(style.paddingInlineStart || '0') + parseFloat(style.paddingInlineEnd || '0')
      : 0;
    // A separator and its gaps between groups; the More button with its separator.
    const count = starEditorFit(widths, toolbar.clientWidth - padding, 48, 13);
    if (count !== this.visibleCount()) {
      this.visibleCount.set(count >= widths.length ? Infinity : count);
      if (count >= widths.length) this.moreOpen.set(false);
    }
  }

  /** Reads the formats at the caret: the selection walk, then the browser's command state. */
  protected refreshState(): void {
    const area = this.area().nativeElement;
    const on = new Set<StarEditorCommand>();
    const range = starEditorRange(area);
    const node = range?.startContainer ?? null;
    const path = starEditorPath(node, area);
    for (const tag of path) if (FORMAT_TAGS[tag]) on.add(FORMAT_TAGS[tag]);
    const list = starEditorListAt(node, area);
    if (list)
      on.add(
        list === 'ol' ? 'insertOrderedList' : list === 'ul' ? 'insertUnorderedList' : 'checklist',
      );
    const doc = area.ownerDocument;
    // The browser state is for the whole document: read it only for a selection in this area.
    for (const command of range ? NATIVE_STATES : []) {
      try {
        if (doc.queryCommandState?.(command)) on.add(command);
      } catch {
        // Some commands have no state.
      }
    }
    const alignment = starEditorAlignmentAt(node, area);
    on.add(
      alignment === 'start'
        ? 'justifyLeft'
        : alignment === 'center'
          ? 'justifyCenter'
          : alignment === 'end'
            ? 'justifyRight'
            : 'justifyFull',
    );
    const heading = path.find((tag) => tag === 'H1' || tag === 'H2' || tag === 'H3');
    this.blockFormat.set(heading ? (heading.toLowerCase() as StarEditorBlockFormat) : 'p');
    this.fontSize.set(starEditorFontSizeAt(node, area));
    this.textColorAt.set(starEditorStyleAt(node, area, 'color'));
    this.highlightAt.set(starEditorStyleAt(node, area, 'background-color'));
    // A selection of just an image (Shift and an arrow key) selects it.
    const image = this.imageAt(range);
    if (range && image !== this.selectedImage() && image) this.selectImage(image);
    this.active.set(on);
  }

  focus(): void {
    this.area().nativeElement.focus();
  }
}
