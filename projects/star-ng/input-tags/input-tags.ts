import { _IdGenerator } from '@angular/cdk/a11y';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { STAR_UI_TEXT } from 'star-ng/core';

export type StarTagRejection = 'invalid' | 'duplicate' | 'limit';

/**
 * Free-text tag field (PrimeNG `p-inputtags` / chips): type a value and press Enter, a
 * separator (default comma) or Tab to add it as a chip. Pasting "a, b; c" adds several.
 * Backspace in the empty field removes the last chip; each chip has a remove button.
 * Optional `validate` (for example an e-mail check), duplicate prevention, `maxTags` count and
 * per-tag `maxLength`. A live region announces added, removed and rejected tags.
 *
 * `<star-input-tags [formField]="form.cc" [validate]="isEmail" placeholder="Add e-mail" ariaLabel="CC" />`
 */
@Component({
  selector: 'star-input-tags',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-select star-tags',
    '[class.star-select--disabled]': 'disabled()',
    '[class.star-select--invalid]': '(invalid() && touched()) || !!rejection()',
  },
  template: `
    <!-- Pointer convenience only: keyboard users reach the input directly. -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
    <div class="star-select__control star-ac__control star-tags__control" (click)="focus()">
      <ul class="star-tags__list" [attr.aria-label]="ariaLabel()">
        @for (tag of value(); track tag; let i = $index) {
          <li class="star-chip star-chip--sm">
            {{ tag }}
            @if (!disabled() && !readonly()) {
              <button
                type="button"
                class="star-chip__remove"
                tabindex="-1"
                [attr.aria-label]="text.removeItem(tag)"
                (click)="$event.stopPropagation(); removeAt(i)"
              >
                <i class="ph-bold ph-x" aria-hidden="true"></i>
              </button>
            }
          </li>
        }
      </ul>
      <input
        #input
        type="text"
        class="star-ac__input"
        autocomplete="off"
        [id]="inputId()"
        [attr.name]="name() || null"
        [value]="draft()"
        [attr.placeholder]="atLimit() ? null : placeholder()"
        [attr.maxlength]="maxLength() ?? null"
        [disabled]="disabled()"
        [readOnly]="readonly() || atLimit()"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-describedby]="hintId"
        [attr.aria-invalid]="(invalid() && touched()) || !!rejection() || null"
        (input)="onInput(input)"
        (keydown)="onKeydown($event)"
        (paste)="onPaste($event)"
        (blur)="onBlur()"
      />
      @if (showClear() && value().length && !disabled() && !readonly()) {
        <button
          type="button"
          class="star-select__icon-btn"
          [attr.aria-label]="text.clear"
          (click)="$event.stopPropagation(); clear()"
        >
          <i class="ph-bold ph-x" aria-hidden="true"></i>
        </button>
      }
    </div>
    <p class="star-sr-only" [id]="hintId">{{ text.tagsHint }}</p>
    <p class="star-sr-only" aria-live="polite">{{ announcement() }}</p>
    @if (rejectionText(); as message) {
      <p class="star-field__error star-tags__error" role="alert">{{ message }}</p>
    }
  `,
})
export class StarInputTags implements FormValueControl<readonly string[]> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly ids = inject(_IdGenerator);

  readonly value = model<readonly string[]>([]);
  readonly placeholder = input<string | null>(null);
  /** Characters that end a tag while typing or split pasted text (Enter always adds). */
  readonly separators = input<readonly string[]>([',', ';']);
  /** Returns true for a valid tag. Invalid text stays in the field with an error. */
  readonly validate = input<((tag: string) => boolean) | null>(null);
  readonly allowDuplicates = input(false, { transform: booleanAttribute });
  /** Maximum number of tags (0 = no limit). */
  readonly maxTags = input(0);
  /** Maximum characters per tag. */
  readonly maxLength = input<number | undefined>(undefined);
  /** Add the typed text when the field loses focus. */
  readonly addOnBlur = input(true, { transform: booleanAttribute });
  readonly showClear = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null>(null);
  readonly inputId = input(this.ids.getId('star-tags-'));

  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly name = input('');
  readonly touch = output<void>();
  readonly added = output<string>();
  readonly removed = output<string>();
  readonly rejected = output<{ tag: string; reason: StarTagRejection }>();

  protected readonly hintId = this.ids.getId('star-tags-hint-');
  protected readonly draft = signal('');
  protected readonly rejection = signal<{ tag: string; reason: StarTagRejection } | null>(null);
  protected readonly announcement = signal('');
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly atLimit = computed(
    () => this.maxTags() > 0 && this.value().length >= this.maxTags(),
  );
  protected readonly rejectionText = computed(() => {
    const rejection = this.rejection();
    if (!rejection) return null;
    if (rejection.reason === 'duplicate') return this.text.tagDuplicate(rejection.tag);
    if (rejection.reason === 'limit') return this.text.tagLimit(this.maxTags());
    return this.text.tagInvalid(rejection.tag);
  });

  /** Adds tags; returns the texts that were not added (invalid, duplicate or over the limit). */
  add(raw: readonly string[]): string[] {
    if (this.disabled() || this.readonly()) return [...raw];
    const next = [...this.value()];
    const leftover: string[] = [];
    let lastRejection: { tag: string; reason: StarTagRejection } | null = null;
    for (const tag of raw.map((t) => t.trim()).filter(Boolean)) {
      const lower = tag.toLocaleLowerCase();
      let reason: StarTagRejection | null = null;
      if (this.maxTags() > 0 && next.length >= this.maxTags()) reason = 'limit';
      else if (this.validate() && !this.validate()!(tag)) reason = 'invalid';
      else if (!this.allowDuplicates() && next.some((t) => t.toLocaleLowerCase() === lower))
        reason = 'duplicate';
      if (reason) {
        leftover.push(tag);
        lastRejection = { tag, reason };
        this.rejected.emit({ tag, reason });
        continue;
      }
      next.push(tag);
      this.added.emit(tag);
      this.announcement.set(this.text.tagAdded(tag));
    }
    if (next.length !== this.value().length) this.value.set(next);
    this.rejection.set(lastRejection);
    return leftover;
  }

  removeAt(index: number): void {
    const tag = this.value()[index];
    if (tag === undefined || this.disabled() || this.readonly()) return;
    this.value.update((tags) => tags.filter((_, i) => i !== index));
    this.removed.emit(tag);
    this.announcement.set(this.text.tagRemoved(tag));
    this.rejection.set(null);
    this.focus();
  }

  clear(): void {
    this.value.set([]);
    this.rejection.set(null);
    this.focus();
  }

  private splitPattern(): RegExp {
    const escaped = this.separators().map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`[${escaped.join('')}\\n\\t]`);
  }

  /** Writes the draft to signal and DOM (the binding skips unchanged signal values). */
  private setDraft(text: string): void {
    this.draft.set(text);
    this.input().nativeElement.value = text;
  }

  protected onInput(input: HTMLInputElement): void {
    const text = input.value;
    this.rejection.set(null);
    if (this.separators().some((s) => text.includes(s))) {
      const parts = text.split(this.splitPattern());
      const last = parts.pop() ?? '';
      const leftover = this.add(parts);
      this.setDraft(leftover.length ? leftover.join(', ') : last);
    } else {
      this.draft.set(text);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const draft = this.draft().trim();
    if ((event.key === 'Enter' || (event.key === 'Tab' && draft)) && draft) {
      event.preventDefault();
      const leftover = this.add([draft]);
      this.setDraft(leftover[0] ?? '');
    } else if (event.key === 'Backspace' && !this.draft() && this.value().length) {
      event.preventDefault();
      this.removeAt(this.value().length - 1);
    } else if (event.key === 'Escape' && this.draft()) {
      this.setDraft('');
      this.rejection.set(null);
    }
  }

  protected onPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') ?? '';
    if (!this.splitPattern().test(text)) return;
    event.preventDefault();
    const leftover = this.add(text.split(this.splitPattern()));
    this.setDraft(leftover.join(', '));
  }

  protected onBlur(): void {
    if (this.addOnBlur() && this.draft().trim()) {
      const leftover = this.add([this.draft()]);
      this.setDraft(leftover[0] ?? '');
    }
    this.touch.emit();
  }

  focus(options?: FocusOptions): void {
    this.input().nativeElement.focus(options);
  }
}
