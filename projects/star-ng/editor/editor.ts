import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  numberAttribute,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { STAR_UI_TEXT, starInlineKey, StarUiText } from '@star-ng/ui/core';
import { injectStarFieldLink, starFieldLabelledBy, starJoinIds } from '@star-ng/ui/field';
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
import { STAR_EDITOR_SANITIZE_DEFAULTS, starEditorSanitize } from './editor-sanitize';
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
  imports: [StarEditorLink, StarEditorColor, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-editor',
    '[class.star-editor--disabled]': 'disabled()',
    '[class.star-editor--invalid]': 'invalid() && touched()',
    '[class.star-editor--over]': 'over()',
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
   * The toolbar: command names in order, with `'|'` between groups. Unknown names are left out.
   * `STAR_EDITOR_FULL_TOOLBAR` has every command. PrimeNG toolbar formats (Quill `toolbar`).
   */
  readonly toolbar = input<readonly StarEditorToolbarItem[]>(STAR_EDITOR_DEFAULT_TOOLBAR);
  readonly touch = output<void>();

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
        area.innerHTML = this.sanitize(text ? starEditorTextToHtml(value) : value);
        this.lastWritten = value;
        this.length.set(starEditorPlainLength(area));
        this.history.reset({ html: area.innerHTML, selection: null });
        this.typing = false;
        this.updateHistoryState();
      },
    });
    // Toolbar groups that do not fit go into the "More actions" panel.
    afterNextRender(() => {
      const view = this.area().nativeElement.ownerDocument.defaultView;
      const toolbar = this.toolbarElement()?.nativeElement;
      if (!toolbar || !view || typeof view.ResizeObserver !== 'function') return;
      this.fitting.set(true);
      const observer = new view.ResizeObserver(() => this.fitToolbar());
      observer.observe(toolbar);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private readonly destroyRef = inject(DestroyRef);

  /** The allow-list sanitizer, with the link target rules. */
  private sanitize(html: string): string {
    return starEditorSanitize(
      html,
      this.area().nativeElement.ownerDocument,
      STAR_EDITOR_SANITIZE_DEFAULTS,
    );
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
    if (starEditorIsSelect(cmd) || !STAR_EDITOR_BUTTONS[cmd].toggle) return null;
    return this.isActive(cmd);
  }

  /** `aria-expanded` of a button that opens a panel, else `null`. */
  protected expanded(cmd: StarEditorCommand): boolean | null {
    if (cmd === 'link') return this.linkOpen();
    if (cmd === 'textColor' || cmd === 'highlight') return this.colorPanel() === cmd;
    return null;
  }

  /** Undo and redo are off when there is nothing to undo or redo. */
  protected unavailable(cmd: StarEditorCommand): boolean {
    return (cmd === 'undo' && !this.canUndo()) || (cmd === 'redo' && !this.canRedo());
  }

  /** True when the format of `command` is on at the caret, for example `isActive('bold')`. */
  isActive(command: StarEditorCommand): boolean {
    return this.active().has(command);
  }

  protected onInput(): void {
    this.commit(true);
    this.refreshState();
  }

  /** Stores the area in the model and, with `record`, in the history. */
  private commit(record: boolean): void {
    const element = this.area().nativeElement;
    const length = starEditorPlainLength(element);
    let value = '';
    if (length && element.textContent?.trim()) {
      value = this.format() === 'text' ? starEditorText(element) : this.sanitize(element.innerHTML);
    }
    this.lastWritten = value;
    this.value.set(value);
    this.length.set(length);
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
    if (this.locked() || !data) return;
    event.preventDefault();
    this.insertData(data);
  }

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

  /** Inserts clipboard or drag data at the selection (see `onPaste`). */
  private insertData(data: DataTransfer): void {
    const area = this.area().nativeElement;
    const range = starEditorRange(area);
    if (!range) return;
    const max = this.maxLength();
    const room =
      max === undefined ? Infinity : Math.max(0, max - this.length() + range.toString().length);
    const html = data.getData('text/html');
    let clean = '';
    if (html && !this.pasteAsText() && this.format() === 'html') {
      clean = this.sanitize(html);
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
    const max = this.maxLength();
    if (max === undefined || !event.inputType.startsWith('insert')) return;
    if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') return;
    const added = event.data?.length ?? event.dataTransfer?.getData('text/plain').length ?? 0;
    const range = starEditorRange(this.area().nativeElement);
    const replaced = range ? range.toString().length : 0;
    if (this.length() - replaced + added > max) event.preventDefault();
  }

  /**
   * Keys of the area: Ctrl+Z and Ctrl+Y (Ctrl+Shift+Z) use the history of the editor; Tab and
   * Shift+Tab in a list item nest it and take it out (when it cannot move, Tab leaves the area as
   * usual); Ctrl+Enter checks a checklist item.
   */
  protected onAreaKeydown(event: KeyboardEvent): void {
    if (this.locked()) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && !event.altKey && (key === 'z' || key === 'y')) {
      event.preventDefault();
      this.travel(key === 'y' || event.shiftKey ? 1 : -1);
      return;
    }
    const area = this.area().nativeElement;
    const range = starEditorRange(area);
    if (!range) return;
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

  /** A click on the box of a checklist item checks it. */
  protected onAreaClick(event: MouseEvent): void {
    if (this.locked()) return;
    const item = event.target instanceof Element ? event.target : null;
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
    if (command === 'undo' || command === 'redo') {
      this.travel(command === 'undo' ? -1 : 1);
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
    this.active.set(on);
  }

  focus(): void {
    this.area().nativeElement.focus();
  }
}
