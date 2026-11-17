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
import { STAR_UI_TEXT, StarUiText } from '@star-ng/ui/core';
import { injectStarFieldLink, starFieldLabelledBy, starJoinIds } from '@star-ng/ui/field';
import { StarToolbar } from '@star-ng/ui/layout';

interface EditorCommand {
  readonly command: string;
  readonly label: keyof StarUiText;
  readonly icon: string;
  readonly value?: string;
}

const COMMANDS: readonly EditorCommand[] = [
  { command: 'bold', label: 'editorBold', icon: 'ph-bold ph-text-b' },
  { command: 'italic', label: 'editorItalic', icon: 'ph-bold ph-text-italic' },
  { command: 'underline', label: 'editorUnderline', icon: 'ph-bold ph-text-underline' },
  { command: 'formatBlock', value: 'h3', label: 'editorHeading', icon: 'ph-bold ph-text-h' },
  { command: 'insertUnorderedList', label: 'editorBulletList', icon: 'ph-bold ph-list-bullets' },
  { command: 'insertOrderedList', label: 'editorNumberedList', icon: 'ph-bold ph-list-numbers' },
  { command: 'removeFormat', label: 'editorClearFormatting', icon: 'ph-bold ph-text-t-slash' },
];

/**
 * Rich text field (PrimeNG `p-editor`, without Quill): a `contenteditable` area with a
 * formatting toolbar (bold, italic, underline, heading, lists, link, clear). Value is HTML,
 * sanitized with Angular's `DomSanitizer` both when it is shown and when it is stored.
 *
 * Note: formatting uses `document.execCommand`, which browsers still support but no longer
 * develop. For complex documents use a dedicated editor library.
 *
 * `<star-editor [formField]="form.response" ariaLabel="Response" />`
 */
@Component({
  selector: 'star-editor',
  imports: [StarToolbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-editor',
    '[class.star-editor--disabled]': 'disabled()',
    '[class.star-editor--invalid]': 'invalid() && touched()',
  },
  template: `
    <star-toolbar
      class="star-editor__toolbar"
      [ariaLabel]="text.editorFormatting(ariaLabel() ?? text.editorLabel)"
    >
      <ng-container starToolbarStart>
        @for (cmd of commands; track cmd.command + (cmd.value ?? '')) {
          <button
            type="button"
            class="star-editor__btn"
            [attr.aria-label]="label(cmd)"
            [attr.aria-pressed]="isActive(cmd)"
            [disabled]="disabled() || readonly()"
            (mousedown)="$event.preventDefault()"
            (click)="run(cmd)"
          >
            <i [class]="cmd.icon" aria-hidden="true"></i>
          </button>
        }
        <button
          type="button"
          class="star-editor__btn"
          [attr.aria-label]="text.editorLink"
          [disabled]="disabled() || readonly()"
          (mousedown)="$event.preventDefault()"
          (click)="link()"
        >
          <i class="ph-bold ph-link" aria-hidden="true"></i>
        </button>
      </ng-container>
    </star-toolbar>
    <div
      #area
      class="star-editor__area"
      role="textbox"
      aria-multiline="true"
      [attr.tabindex]="disabled() ? -1 : 0"
      [attr.contenteditable]="disabled() || readonly() ? 'false' : 'true'"
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
  readonly touch = output<void>();

  protected readonly commands = COMMANDS;

  protected label(cmd: EditorCommand): string {
    return this.text[cmd.label] as string;
  }
  private readonly area = viewChild.required<ElementRef<HTMLDivElement>>('area');
  /** The parent `star-field` when it labels the area (a `div` textbox is not labelable). */
  private readonly field = injectStarFieldLink(null, () => this.focus());
  protected readonly labelledBy = computed(() => starFieldLabelledBy(this.field, this.ariaLabel()));
  protected readonly fieldDescribedBy = computed(() => starJoinIds(this.field?.describedBy()));
  private readonly active = signal<ReadonlySet<string>>(new Set());
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

  protected onInput(): void {
    const element = this.area().nativeElement;
    const html = element.textContent?.trim() ? this.sanitize(element.innerHTML) : '';
    this.lastWritten = html;
    this.value.set(html);
    this.refreshState();
  }

  protected run(cmd: EditorCommand): void {
    this.area().nativeElement.focus();
    document.execCommand?.(cmd.command, false, cmd.value);
    this.onInput();
  }

  protected link(): void {
    const url = prompt(this.text.editorLinkPrompt);
    if (!url || !/^https?:\/\//i.test(url)) return;
    this.area().nativeElement.focus();
    document.execCommand?.('createLink', false, url);
    this.onInput();
  }

  protected isActive(cmd: EditorCommand): boolean | null {
    return cmd.command === 'formatBlock' || cmd.command === 'removeFormat'
      ? null
      : this.active().has(cmd.command);
  }

  protected refreshState(): void {
    const on = new Set<string>();
    for (const cmd of COMMANDS) {
      try {
        if (document.queryCommandState?.(cmd.command)) on.add(cmd.command);
      } catch {
        // Some commands have no state.
      }
    }
    this.active.set(on);
  }

  focus(): void {
    this.area().nativeElement.focus();
  }
}
