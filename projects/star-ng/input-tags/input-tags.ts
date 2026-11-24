import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  Directive,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarIconContext,
  StarSlot,
  starSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
  ɵstarKeyed,
} from '@star-ng/ui/core';
import { injectStarFieldLink } from '@star-ng/ui/field';

export type StarTagRejection = 'invalid' | 'duplicate' | 'limit';

/** Context of the chip slot of `star-input-tags`. */
export interface StarInputTagContext {
  /** The tag text. */
  readonly $implicit: string;
  /** Position of the tag, starting at `0`. */
  readonly index: number;
}

/**
 * Replaces the text of each chip of `star-input-tags`:
 * `<ng-template starInputTag let-tag let-index="index">…</ng-template>`. PrimeNG `#item` (chip)
 * template. The chip and its remove button stay; do not add focusable elements.
 */
@Directive({
  selector: 'ng-template[starInputTag]',
  providers: [{ provide: StarSlot, useExisting: StarInputTagTemplate }],
})
export class StarInputTagTemplate extends StarSlot<StarInputTagContext> {
  readonly name = 'inputTag';

  static ngTemplateContextGuard(
    _dir: StarInputTagTemplate,
    _ctx: unknown,
  ): _ctx is StarInputTagContext {
    return true;
  }
}

/** Context of the trailing action slot of `star-input-tags`. */
export interface StarInputTagsActionContext {
  /** The control is disabled. */
  readonly disabled: boolean;
  /** The control is read-only. */
  readonly readonly: boolean;
}

/**
 * Trailing action inside the box of `star-input-tags`, for example an icon button that opens an
 * address book: `<ng-template starInputTagsAction let-disabled="disabled">…</ng-template>`. It
 * sits at the inline end (after the clear button), vertically centred; the chips and the input
 * wrap before it. A click on it does not move the focus to the input.
 */
@Directive({
  selector: 'ng-template[starInputTagsAction]',
  providers: [{ provide: StarSlot, useExisting: StarInputTagsActionTemplate }],
})
export class StarInputTagsActionTemplate extends StarSlot<StarInputTagsActionContext> {
  readonly name = 'inputTagsAction';

  static ngTemplateContextGuard(
    _dir: StarInputTagsActionTemplate,
    _ctx: unknown,
  ): _ctx is StarInputTagsActionContext {
    return true;
  }
}

/**
 * Free-text tag field (PrimeNG `p-inputtags` / chips): type a value and press Enter, a
 * separator (default comma) or Tab to add it as a chip. Pasting "a, b; c" adds several.
 * Backspace in the empty field removes the last chip; each chip has a remove button.
 * Optional `validate` (for example an e-mail check), duplicate prevention, `maxTags` count and
 * per-tag `maxLength`. A live region announces added, removed and rejected tags.
 *
 * With `keepInvalid`, text that fails `validate` becomes a chip marked invalid (danger colours,
 * a warning icon, `aria-invalid`) instead of staying in the field. Invalid chips are part of
 * `value` (the control shows what the user typed); `invalidTags` lists them. To block submit, give
 * the form field a validator with the same check, for example
 * `validate(p.to, ({ value }) => (value().every(isEmail) ? undefined : { kind: 'email' }))`.
 * Backspace in the empty field puts the text of a last invalid chip back into the field to fix it.
 *
 * `<star-input-tags [formField]="form.cc" [validate]="isEmail" placeholder="Add e-mail" ariaLabel="CC" />`
 *
 * Slots: `starInputTag` (the text of each chip), `starInputTagsAction` (a trailing action inside
 * the box), `<ng-template starIcon="remove">` (the remove icon of a chip) and `starIcon="clear"`
 * (the clear icon).
 */
@Component({
  selector: 'star-input-tags',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarInputTags) }],
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-select star-tags',
    '[class.star-select--disabled]': 'disabled()',
    '[class.star-select--invalid]': 'showInvalid()',
  },
  template: `
    <!-- Pointer convenience only: keyboard users reach the input directly. -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
    <div
      data-star-part="controlPanel"
      class="star-select__control star-ac__control star-tags__control"
      (click)="onControlClick($event)"
    >
      <div data-star-part="mainPanel" class="star-ac__main">
        <ul
          data-star-part="list"
          class="star-tags__list"
          [attr.aria-label]="ariaLabel()"
          [attr.aria-disabled]="disabled() || null"
        >
          @for (entry of tagEntries(); track entry.key; let i = $index) {
            @let tag = entry.item;
            @let bad = invalidSet().has(tag);
            <li
              data-star-part="chipItem"
              class="star-chip star-chip--sm"
              animate.leave="star-chip--leaving"
              [class.star-chip--invalid]="bad"
              [attr.aria-invalid]="bad || null"
            >
              @if (bad) {
                <i
                  data-star-part="invalidIcon"
                  class="ph-bold ph-warning-circle star-chip__status"
                  aria-hidden="true"
                ></i>
              }
              @if (tagSlot(); as custom) {
                <ng-container *ngTemplateOutlet="custom; context: { $implicit: tag, index: i }" />
              } @else {
                {{ tag }}
              }
              @if (bad) {
                <span class="star-sr-only">({{ text.tagNotValid }})</span>
              }
              @if (!disabled() && !readonly()) {
                <button
                  data-star-part="removeButton"
                  type="button"
                  class="star-chip__remove"
                  tabindex="-1"
                  [attr.aria-label]="text.removeItem(tag)"
                  (click)="$event.stopPropagation(); removeAt(i)"
                >
                  @if (icons().get('remove'); as icon) {
                    <span data-star-part="removeIcon" class="star-chip__icon" aria-hidden="true">
                      <ng-container *ngTemplateOutlet="icon; context: noState" />
                    </span>
                  } @else {
                    <i data-star-part="removeIcon" class="ph-bold ph-x" aria-hidden="true"></i>
                  }
                </button>
              }
            </li>
          }
        </ul>
        <input
          data-star-part="input"
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
          [attr.aria-labelledby]="ariaLabelledBy()"
          [attr.aria-required]="required() || null"
          [attr.aria-describedby]="describedBy()"
          [attr.aria-busy]="fieldBusy()"
          [attr.aria-invalid]="showInvalid() || null"
          (input)="onInput(input)"
          (keydown)="onKeydown($event)"
          (paste)="onPaste($event)"
          (blur)="onBlur()"
        />
      </div>
      @if (showClear() && value().length && !disabled() && !readonly()) {
        <button
          data-star-part="clearButton"
          type="button"
          class="star-select__icon-btn"
          [attr.aria-label]="text.clear"
          (click)="$event.stopPropagation(); clear()"
        >
          @if (icons().get('clear'); as icon) {
            <span data-star-part="clearIcon" class="star-chip__icon" aria-hidden="true">
              <ng-container *ngTemplateOutlet="icon; context: noState" />
            </span>
          } @else {
            <i data-star-part="clearIcon" class="ph-bold ph-x" aria-hidden="true"></i>
          }
        </button>
      }
      @if (actionSlot(); as action) {
        <div #actionPanel data-star-part="actionPanel" class="star-tags__action">
          <ng-container *ngTemplateOutlet="action; context: actionContext()" />
        </div>
      }
    </div>
    <p class="star-sr-only" [id]="hintId">{{ text.tagsHint }}</p>
    <p class="star-sr-only" aria-live="polite">{{ announcement() }}</p>
    @if (rejectionText(); as message) {
      <p data-star-part="errorText" class="star-field__error star-tags__error" role="alert">
        {{ message }}
      </p>
    }
  `,
})
export class StarInputTags implements FormValueControl<readonly string[]> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly ids = inject(_IdGenerator);
  private readonly field = injectStarFieldLink(() => this.inputId());
  /** `aria-busy` of the control while an async validator of the parent `star-field` runs. */
  protected readonly fieldBusy = computed(() => this.field?.pending() || null);

  readonly value = model<readonly string[]>([]);
  readonly placeholder = input<string | null>(null);
  /** Characters that end a tag while typing or split pasted text (Enter always adds). */
  readonly separators = input<readonly string[]>([',', ';']);
  /**
   * Returns true for a valid tag. Invalid text stays in the field with an error, or becomes an
   * invalid chip with `keepInvalid`.
   */
  readonly validate = input<((tag: string) => boolean) | null>(null);
  /**
   * Adds text that fails `validate` as a chip marked invalid (danger colours, `aria-invalid`, a
   * live announcement) instead of keeping it in the field. The chip is in `value`; `invalidTags`
   * lists it. The duplicate and limit rules still reject. Default `false`: invalid text stays in
   * the field.
   */
  readonly keepInvalid = input(false, { transform: booleanAttribute });
  readonly allowDuplicates = input(false, { transform: booleanAttribute });
  /** Maximum number of tags (0 = no limit). */
  readonly maxTags = input(0);
  /** Maximum characters per tag. */
  readonly maxLength = input<number | undefined>(undefined);
  /** Add the typed text when the field loses focus. */
  readonly addOnBlur = input(true, { transform: booleanAttribute });
  readonly showClear = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null>(null);
  /** Id of the element that labels the control (`aria-labelledby`). PrimeNG `ariaLabelledBy`. */
  readonly ariaLabelledBy = input<string | null>(null);
  /** At least one tag is needed (`aria-required`); also bound from Signal Forms `required()`. */
  readonly required = input(false, { transform: booleanAttribute });
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
  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly tagSlot = starSlot<StarInputTagContext>(this.slots, this, 'inputTag');
  protected readonly actionSlot = starSlot<StarInputTagsActionContext>(
    this.slots,
    this,
    'inputTagsAction',
  );
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly actionContext = computed<StarInputTagsActionContext>(() => ({
    disabled: this.disabled(),
    readonly: this.readonly(),
  }));
  private readonly actionPanel = viewChild<ElementRef<HTMLElement>>('actionPanel');
  protected readonly noState: StarIconContext = {};
  /** The hint of the keys, and the hint or error of a parent `star-field`. */
  protected readonly describedBy = computed(() =>
    [this.hintId, this.field?.describedBy()].filter(Boolean).join(' '),
  );
  /** `@for` entries: a repeated tag (`allowDuplicates`) gets its own key. */
  protected readonly tagEntries = computed(() => ɵstarKeyed(this.value()));
  protected readonly draft = signal('');
  protected readonly rejection = signal<{ tag: string; reason: StarTagRejection } | null>(null);
  protected readonly announcement = signal('');
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  /**
   * The tags that fail `validate`, in order, when `keepInvalid` is on (empty otherwise). A form
   * can block submit while it has entries.
   */
  readonly invalidTags = computed<readonly string[]>(() => {
    const check = this.validate();
    if (!this.keepInvalid() || !check) return [];
    return this.value().filter((tag) => !check(tag));
  });
  protected readonly invalidSet = computed(() => new Set(this.invalidTags()));
  /** Error state of the box and the input: a form error after touch, a rejection, invalid chips. */
  protected readonly showInvalid = computed(
    () => (this.invalid() && this.touched()) || !!this.rejection() || this.invalidTags().length > 0,
  );

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
    const check = this.validate();
    for (const tag of raw.map((t) => t.trim()).filter(Boolean)) {
      const lower = tag.toLocaleLowerCase();
      const bad = !!check && !check(tag);
      let reason: StarTagRejection | null = null;
      if (this.maxTags() > 0 && next.length >= this.maxTags()) reason = 'limit';
      else if (bad && !this.keepInvalid()) reason = 'invalid';
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
      this.announcement.set(bad ? this.text.tagAddedInvalid(tag) : this.text.tagAdded(tag));
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

  /**
   * Removes the tag at `index` and puts its text into the field, so the user can fix it.
   * Backspace in the empty field calls it for a last invalid chip (`keepInvalid`).
   */
  editAt(index: number): void {
    const tag = this.value()[index];
    if (tag === undefined || this.disabled() || this.readonly()) return;
    this.value.update((tags) => tags.filter((_, i) => i !== index));
    this.removed.emit(tag);
    this.announcement.set(this.text.tagEdit(tag));
    this.rejection.set(null);
    this.setDraft(tag);
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
      const last = this.value().length - 1;
      if (this.invalidSet().has(this.value()[last])) this.editAt(last);
      else this.removeAt(last);
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

  /** A click in the box focuses the input, except a click in the trailing action. */
  protected onControlClick(event: MouseEvent): void {
    const panel = this.actionPanel()?.nativeElement;
    if (panel && event.target instanceof Node && panel.contains(event.target)) return;
    this.focus();
  }

  focus(options?: FocusOptions): void {
    this.input().nativeElement.focus(options);
  }
}
