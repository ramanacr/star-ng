import { _IdGenerator } from '@angular/cdk/a11y';
import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  output,
  SecurityContext,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { DomSanitizer } from '@angular/platform-browser';
import { STAR_UI_TEXT, starInlineKey } from '@star-ng/ui/core';
import { injectStarFieldLink, starFieldLabelledBy, starJoinIds } from '@star-ng/ui/field';
import {
  starEditorAlign,
  starEditorAlignmentAt,
  starEditorClosest,
  starEditorPath,
  starEditorRange,
  starEditorRestore,
  starEditorToggleCode,
  starEditorUnwrap,
} from './editor-dom';
import {
  StarEditorLink,
  StarEditorLinkValue,
  starEditorSafeUrl,
  starEditorSetLink,
} from './editor-link';
import {
  STAR_EDITOR_BUTTONS,
  STAR_EDITOR_DEFAULT_TOOLBAR,
  StarEditorBlockFormat,
  StarEditorCommand,
  starEditorGroups,
  StarEditorToolbarItem,
  starEditorToolbarMove,
} from './editor-toolbar';

/** Inline formats that `document.queryCommandState` reports. */
const NATIVE_STATES = [
  'bold',
  'italic',
  'underline',
  'strikeThrough',
  'insertUnorderedList',
  'insertOrderedList',
] as const;

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
  CODE: 'code',
  A: 'link',
  BLOCKQUOTE: 'blockquote',
  UL: 'insertUnorderedList',
  OL: 'insertOrderedList',
};

/**
 * Rich text field (PrimeNG `p-editor`, without Quill): a `contenteditable` area with a
 * formatting toolbar. Value is HTML, sanitized with Angular's `DomSanitizer` both when it is
 * shown and when it is stored.
 *
 * The toolbar is a WAI-ARIA toolbar (one tab stop, arrow keys, `aria-pressed` for the formats at
 * the caret). `toolbar` chooses the commands and their groups (PrimeNG toolbar formats).
 *
 * Note: formatting uses `document.execCommand`, which browsers still support but no longer
 * develop. For complex documents use a dedicated editor library.
 *
 * `<star-editor [formField]="form.response" ariaLabel="Response" />`
 */
@Component({
  selector: 'star-editor',
  imports: [StarEditorLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-editor',
    '[class.star-editor--disabled]': 'disabled()',
    '[class.star-editor--invalid]': 'invalid() && touched()',
  },
  template: `
    <div
      #toolbarElement
      class="star-toolbar star-editor__toolbar"
      role="toolbar"
      [attr.aria-label]="text.editorFormatting(ariaLabel() ?? text.editorLabel)"
      [attr.aria-controls]="areaId"
    >
      @for (group of groups(); track $index; let first = $first) {
        @if (!first) {
          <span class="star-editor__separator" role="separator" aria-orientation="vertical"></span>
        }
        <div class="star-toolbar__group">
          @for (cmd of group; track cmd) {
            @if (cmd === 'formatBlock') {
              <select
                class="star-editor__select"
                data-editor-control
                [attr.aria-label]="text.editorTextStyle"
                [attr.tabindex]="cmd === rovingCommand() ? 0 : -1"
                [disabled]="locked()"
                (keydown)="onToolbarKeydown($event)"
                (focus)="onToolbarFocus($event)"
                (change)="exec('formatBlock', $any($event.target).value)"
              >
                @for (option of blockFormats; track option) {
                  <option [value]="option" [selected]="option === blockFormat()">
                    {{
                      option === 'p' ? text.editorParagraph : text.editorHeadingLevel(+option[1])
                    }}
                  </option>
                }
              </select>
            } @else {
              <button
                type="button"
                class="star-editor__btn"
                data-editor-control
                [attr.aria-label]="label(cmd)"
                [attr.aria-pressed]="pressed(cmd)"
                [attr.aria-expanded]="cmd === 'link' ? linkOpen() : null"
                [attr.tabindex]="cmd === rovingCommand() ? 0 : -1"
                [disabled]="locked()"
                (keydown)="onToolbarKeydown($event)"
                (focus)="onToolbarFocus($event)"
                (mousedown)="$event.preventDefault()"
                (click)="exec(cmd)"
              >
                <i [class]="icon(cmd)" aria-hidden="true"></i>
              </button>
            }
          }
        </div>
      }
    </div>
    @if (linkOpen()) {
      <star-editor-link
        [initialUrl]="linkUrl()"
        [initialNewTab]="linkNewTab()"
        [editing]="linkUrl() !== ''"
        (apply)="applyLink($event)"
        (remove)="removeLink()"
        (dismissed)="closeLink()"
      />
    }
    <div
      #area
      class="star-editor__area"
      role="textbox"
      aria-multiline="true"
      [id]="areaId"
      [attr.tabindex]="disabled() ? -1 : 0"
      [attr.contenteditable]="locked() ? 'false' : 'true'"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-labelledby]="labelledBy()"
      [attr.aria-describedby]="fieldDescribedBy()"
      [attr.aria-readonly]="readonly() || null"
      [attr.aria-disabled]="disabled() || null"
      [attr.data-placeholder]="placeholder()"
      [style.min-height]="minHeight()"
      (input)="onInput()"
      (keyup)="refreshState()"
      (mouseup)="refreshState()"
      (blur)="touch.emit()"
    ></div>
  `,
})
export class StarEditor implements FormValueControl<string> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly areaId = inject(_IdGenerator).getId('star-editor-area-');

  /** The content as HTML. Edits by the user are stored sanitized. */
  readonly value = model('');
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
   * The toolbar: command names in order, with `'|'` between groups. Unknown names are left out.
   * `STAR_EDITOR_FULL_TOOLBAR` has every command. PrimeNG toolbar formats (Quill `toolbar`).
   */
  readonly toolbar = input<readonly StarEditorToolbarItem[]>(STAR_EDITOR_DEFAULT_TOOLBAR);
  readonly touch = output<void>();

  protected readonly blockFormats: readonly StarEditorBlockFormat[] = ['p', 'h1', 'h2', 'h3'];
  protected readonly groups = computed(() => starEditorGroups(this.toolbar()));
  private readonly commands = computed(() => this.groups().flat());
  /** No edits: the toolbar is off and the area is not editable. */
  protected readonly locked = computed(() => this.disabled() || this.readonly());

  private readonly area = viewChild.required<ElementRef<HTMLDivElement>>('area');
  private readonly toolbarElement = viewChild<ElementRef<HTMLElement>>('toolbarElement');
  /** The parent `star-field` when it labels the area (a `div` textbox is not labelable). */
  private readonly field = injectStarFieldLink(null, () => this.focus());
  protected readonly labelledBy = computed(() => starFieldLabelledBy(this.field, this.ariaLabel()));
  protected readonly fieldDescribedBy = computed(() => starJoinIds(this.field?.describedBy()));

  /** Formats on at the caret. */
  private readonly active = signal<ReadonlySet<StarEditorCommand>>(new Set());
  /** Text style of the block at the caret. */
  protected readonly blockFormat = signal<StarEditorBlockFormat>('p');
  /** The toolbar control in the tab order (roving tabindex). */
  private readonly rovingIndex = signal(0);
  protected readonly rovingCommand = computed(
    () => this.commands()[Math.min(this.rovingIndex(), this.commands().length - 1)],
  );

  protected readonly linkOpen = signal(false);
  protected readonly linkUrl = signal('');
  protected readonly linkNewTab = signal(false);
  /** The selection when the link popover opened, and the link at it. */
  private linkRange: Range | null = null;
  private linkAnchor: HTMLAnchorElement | null = null;
  private lastWritten: string | null = null;

  constructor() {
    // Write the model into the editable area only when it changed from outside.
    afterRenderEffect({
      write: () => {
        const html = this.value();
        if (html === this.lastWritten) return;
        this.area().nativeElement.innerHTML = this.sanitize(html);
        this.lastWritten = html;
      },
    });
  }

  private sanitize(html: string): string {
    return this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
  }

  protected label(cmd: StarEditorCommand): string {
    return cmd === 'formatBlock'
      ? this.text.editorTextStyle
      : (this.text[STAR_EDITOR_BUTTONS[cmd].label] as string);
  }

  protected icon(cmd: StarEditorCommand): string {
    return cmd === 'formatBlock' ? '' : STAR_EDITOR_BUTTONS[cmd].icon;
  }

  /** `aria-pressed` of a toggle button, `null` for an action button. */
  protected pressed(cmd: StarEditorCommand): boolean | null {
    if (cmd === 'formatBlock' || !STAR_EDITOR_BUTTONS[cmd].toggle) return null;
    return this.isActive(cmd);
  }

  /** True when the format of `command` is on at the caret, for example `isActive('bold')`. */
  isActive(command: StarEditorCommand): boolean {
    return this.active().has(command);
  }

  protected onInput(): void {
    const element = this.area().nativeElement;
    const html = element.textContent?.replace(/\u200b/g, '').trim()
      ? this.sanitize(element.innerHTML)
      : '';
    this.lastWritten = html;
    this.value.set(html);
    this.refreshState();
  }

  /**
   * Runs a toolbar command on the selection, for example `exec('bold')` or
   * `exec('formatBlock', 'h2')`. `exec('link')` opens the link popover; `exec('link', url)` links
   * the selection to a safe `url` at once. Nothing happens while the editor is disabled or
   * read-only.
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
    // Focusing the area can move the caret: keep the selection that the command is for.
    const saved = starEditorRange(area)?.cloneRange() ?? null;
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
      case 'justifyLeft':
      case 'justifyCenter':
      case 'justifyRight':
        if (range) {
          const alignment =
            command === 'justifyLeft' ? 'start' : command === 'justifyCenter' ? 'center' : 'end';
          starEditorAlign(area, range, alignment);
        }
        break;
      default:
        run(command);
    }
    this.onInput();
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
      // The browser command keeps the undo history and the formats of the text.
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

  // ---- Toolbar keyboard ----

  private controls(): HTMLElement[] {
    const toolbar = this.toolbarElement()?.nativeElement;
    return toolbar ? [...toolbar.querySelectorAll<HTMLElement>('[data-editor-control]')] : [];
  }

  protected onToolbarFocus(event: FocusEvent): void {
    const index = this.controls().indexOf(event.target as HTMLElement);
    if (index >= 0) this.rovingIndex.set(index);
  }

  protected onToolbarKeydown(event: KeyboardEvent): void {
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

  /** Reads the formats at the caret: the selection walk, then the browser's command state. */
  protected refreshState(): void {
    const area = this.area().nativeElement;
    const on = new Set<StarEditorCommand>();
    const range = starEditorRange(area);
    const path = starEditorPath(range?.startContainer ?? null, area);
    for (const tag of path) if (FORMAT_TAGS[tag]) on.add(FORMAT_TAGS[tag]);
    const doc = area.ownerDocument;
    for (const command of NATIVE_STATES) {
      try {
        if (doc.queryCommandState?.(command)) on.add(command);
      } catch {
        // Some commands have no state.
      }
    }
    const alignment = starEditorAlignmentAt(range?.startContainer ?? null, area);
    on.add(
      alignment === 'start'
        ? 'justifyLeft'
        : alignment === 'center'
          ? 'justifyCenter'
          : 'justifyRight',
    );
    const heading = path.find((tag) => tag === 'H1' || tag === 'H2' || tag === 'H3');
    this.blockFormat.set(heading ? (heading.toLowerCase() as StarEditorBlockFormat) : 'p');
    this.active.set(on);
  }

  focus(): void {
    this.area().nativeElement.focus();
  }
}
