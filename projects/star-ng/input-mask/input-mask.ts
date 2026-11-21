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
import {
  injectStarControlDefaults,
  STAR_UI_TEXT,
  StarInputVariant,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { injectStarFieldLink } from '@star-ng/ui/field';

/** Mask slot tokens (PrimeNG `p-inputmask` syntax): `9` digit, `a` letter, `*` letter or digit. */
const TOKENS: Record<string, RegExp> = { '9': /\d/, a: /\p{L}/u, '*': /[\p{L}\d]/u };

/**
 * The tokens with `a` replaced by a custom character pattern (`characterPattern`). A pattern that
 * is not a valid regular expression keeps the default `a` token.
 */
function tokensFor(characterPattern?: string | null): Record<string, RegExp> {
  if (!characterPattern) return TOKENS;
  try {
    return { ...TOKENS, a: new RegExp(`^(?:${characterPattern})$`, 'u') };
  } catch {
    return TOKENS;
  }
}

/** Applies a mask to raw characters; returns the masked text (unfilled slots as `slotChar`). */
export function applyMask(
  mask: string,
  raw: string,
  slotChar = '_',
  characterPattern?: string | null,
): string {
  return applyTokens(mask, raw, slotChar, tokensFor(characterPattern));
}

function applyTokens(
  mask: string,
  raw: string,
  slotChar: string,
  tokens: Record<string, RegExp>,
): string {
  let out = '';
  let r = 0;
  for (const char of mask) {
    const token = tokens[char];
    if (!token) {
      out += char;
      continue;
    }
    while (r < raw.length && !token.test(raw[r])) r++;
    out += r < raw.length ? raw[r++] : slotChar;
  }
  return out;
}

/** Characters typed into the slots, without literals and slot chars. */
export function unmask(mask: string, masked: string, slotChar = '_'): string {
  // Slot positions do not depend on the character pattern.
  let out = '';
  [...mask].forEach((char, i) => {
    if (TOKENS[char] && masked[i] !== undefined && masked[i] !== slotChar) out += masked[i];
  });
  return out;
}

/**
 * Masked text field (PrimeNG `p-inputmask`): fixed-format entry such as phone numbers, postal
 * codes or serial numbers. Mask tokens: `9` digit, `a` letter, `*` letter or digit; other
 * characters are literals. The value is the masked text, or the raw slots with `unmask`.
 * `characterPattern` changes what an `a` slot takes (PrimeNG `characterPattern`). With
 * `keepCharPositions`, deleting a character leaves its slot empty and the later characters stay
 * in place. `showClear` adds a clear button; `variant` is `outlined` or `filled`.
 *
 * `<star-input-mask mask="(999) 999-9999" [formField]="form.phone" ariaLabel="Phone number" />`
 */
@Component({
  selector: 'star-input-mask',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-mask',
    '[class.star-mask--filled]': "variant() === 'filled'",
    '[class.star-mask--clear]': 'showClear()',
  },
  template: `
    <input
      data-star-part="input"
      #input
      type="text"
      class="star-input star-mask__input"
      [class.star-input--filled]="variant() === 'filled'"
      autocomplete="off"
      [attr.inputmode]="numericOnly() ? 'numeric' : null"
      [id]="inputId()"
      [attr.name]="name() || null"
      [value]="display()"
      [attr.placeholder]="placeholder() ?? mask().replace(tokenPattern, slotChar())"
      [disabled]="disabled()"
      [readOnly]="readonly()"
      [required]="required()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-labelledby]="ariaLabelledBy()"
      [attr.aria-describedby]="field?.describedBy() ?? null"
      [attr.aria-invalid]="showInvalid() || null"
      (beforeinput)="onBeforeInput(input, $any($event))"
      (input)="onInput(input)"
      (focus)="onFocus(input)"
      (blur)="onBlur(input)"
    />
    @if (showClear() && value() && !disabled() && !readonly()) {
      <button
        data-star-part="clearButton"
        type="button"
        class="star-select__icon-btn star-mask__clear"
        [attr.aria-label]="uiText.clear"
        (click)="clear()"
      >
        <i data-star-part="clearIcon" class="ph-bold ph-x" aria-hidden="true"></i>
      </button>
    }
  `,
})
export class StarInputMask implements FormValueControl<string> {
  private readonly defaults = injectStarControlDefaults([]);
  protected readonly uiText = inject(STAR_UI_TEXT);
  protected readonly field = injectStarFieldLink(() => this.inputId());
  /** Invalid after touch, or while the parent `star-field` shows an error. */
  protected readonly showInvalid = computed(
    () => (this.invalid() && this.touched()) || !!this.field?.errorText(),
  );

  readonly value = model('');
  readonly mask = input.required<string>();
  readonly slotChar = input('_');
  /** Store only the typed characters (no literals). */
  readonly unmask = input(false, { transform: booleanAttribute });
  /** Keep a partly filled value on blur (default clears it). */
  readonly autoClear = input(true, { transform: booleanAttribute });
  /**
   * Pattern of one character of an `a` slot, as regular expression source (default: any
   * letter). For example `[A-F]` for upper-case hex letters. PrimeNG `characterPattern`.
   */
  readonly characterPattern = input<string | null>(null);
  readonly placeholder = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  /** Id of the element that labels the control (`aria-labelledby`). PrimeNG `ariaLabelledBy`. */
  readonly ariaLabelledBy = input<string | null>(null);
  /** A clear button while the field has a value. PrimeNG `showClear`. */
  readonly showClear = input(false, { transform: booleanAttribute });
  /**
   * Deleting a character leaves its slot empty; the later characters keep their places.
   * PrimeNG `keepCharPositions`.
   */
  readonly keepCharPositions = input(false, { transform: booleanAttribute });
  /** Look: border on every side, or a filled surface. Default: `inputVariant` of `provideStarNg`, else `outlined`. PrimeNG `variant`. */
  readonly variant = input<StarInputVariant>(this.defaults.inputVariant ?? 'outlined');
  readonly inputId = input(inject(_IdGenerator).getId('star-mask-'));
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly name = input('');
  readonly touch = output<void>();
  readonly completed = output<string>();

  protected readonly tokenPattern = /[9a*]/g;
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly numericOnly = computed(() => !/[a*]/.test(this.mask()));
  /** The slot tokens, compiled once per `characterPattern`. */
  private readonly tokens = computed(() => tokensFor(this.characterPattern()));
  private readonly focused = signal(false);
  /** The mask with every slot empty. */
  private readonly emptyMask = computed(() =>
    applyTokens(this.mask(), '', this.slotChar(), this.tokens()),
  );
  protected readonly display = computed(() => {
    const value = this.value();
    // While focused an empty field shows the empty slots.
    if (!value) return this.focused() ? this.emptyMask() : '';
    // keepCharPositions: a masked value keeps its empty slots.
    if (this.keepCharPositions() && value.length === this.mask().length) {
      return this.positional(value);
    }
    return applyTokens(this.mask(), value, this.slotChar(), this.tokens());
  });

  private slotsFilled(masked: string): boolean {
    return !masked.includes(this.slotChar());
  }

  /** The slot token at a position of the mask, or `undefined` for a literal. */
  private tokenAt(index: number): RegExp | undefined {
    return this.tokens()[this.mask()[index]];
  }

  protected onFocus(input: HTMLInputElement): void {
    this.focused.set(true);
    if (!input.value) input.value = this.emptyMask();
    queueMicrotask(() => this.placeCaret(input));
  }

  /**
   * `keepCharPositions`: the edit runs on the slots at the caret, so the other characters keep
   * their places. Typing and paste fill the slots from the caret (over the old characters, over
   * the literals); Backspace and Delete empty one slot, or every slot of a selection.
   */
  protected onBeforeInput(input: HTMLInputElement, event: InputEvent): void {
    if (!this.keepCharPositions() || this.readonly() || this.disabled()) return;
    const type = event.inputType;
    const insert =
      type === 'insertText' || type === 'insertFromPaste' || type === 'insertReplacementText';
    const remove = type === 'deleteContentBackward' || type === 'deleteContentForward';
    if (!insert && !remove) return;
    event.preventDefault();
    const length = this.mask().length;
    const chars = [
      ...(input.value.length === length
        ? this.positional(input.value)
        : this.display() || this.emptyMask()),
    ];
    const from = input.selectionStart ?? 0;
    const to = input.selectionEnd ?? from;
    const slot = this.slotChar();
    let caret = from;
    if (remove && to > from) {
      for (let i = from; i < to; i++) if (this.tokenAt(i)) chars[i] = slot;
    } else if (type === 'deleteContentBackward') {
      let i = from - 1;
      while (i >= 0 && !this.tokenAt(i)) i--;
      if (i >= 0) {
        chars[i] = slot;
        caret = i;
      }
    } else if (type === 'deleteContentForward') {
      let i = from;
      while (i < length && !this.tokenAt(i)) i++;
      if (i < length) chars[i] = slot;
    } else {
      const data = event.data ?? event.dataTransfer?.getData('text/plain') ?? '';
      if (to > from) for (let i = from; i < to; i++) if (this.tokenAt(i)) chars[i] = slot;
      let i = from;
      for (const char of data) {
        while (i < length && !this.tokenAt(i)) i++;
        if (i >= length) break;
        if (!this.tokenAt(i)!.test(char)) continue;
        chars[i++] = char;
      }
      while (i < length && !this.tokenAt(i)) i++;
      caret = Math.min(i, length);
    }
    this.write(input, chars.join(''), caret);
  }

  protected onInput(input: HTMLInputElement): void {
    // Take every character that a slot takes, in order: works for typing inside the mask and for
    // pasting raw text such as "5551234567". Mask literals drop out.
    const tokens = Object.values(this.tokens());
    const raw = [...input.value]
      .filter((char) => char !== this.slotChar() && tokens.some((token) => token.test(char)))
      .join('');
    input.value = applyTokens(this.mask(), raw, this.slotChar(), this.tokens());
    this.placeCaret(input);
    this.store(input.value);
  }

  /** Writes masked text to the field, puts the caret and stores the value. */
  private write(input: HTMLInputElement, masked: string, caret: number): void {
    input.value = masked;
    input.setSelectionRange?.(caret, caret);
    this.store(masked);
  }

  private store(masked: string): void {
    const typed = unmask(this.mask(), masked, this.slotChar());
    this.value.set(this.unmask() ? typed : typed ? masked : '');
    if (this.slotsFilled(masked)) this.completed.emit(this.value());
  }

  protected onBlur(input: HTMLInputElement): void {
    this.focused.set(false);
    const typed = unmask(this.mask(), input.value, this.slotChar());
    if (!typed || (this.autoClear() && !this.slotsFilled(input.value))) {
      this.value.set('');
      input.value = '';
    }
    this.touch.emit();
  }

  /** `keepCharPositions`: each slot keeps the character at its own position, if it fits. */
  private positional(text: string): string {
    const slot = this.slotChar();
    return [...this.mask()]
      .map((char, i) => {
        const token = this.tokenAt(i);
        if (!token) return char;
        const typed = text[i] ?? '';
        return typed && typed !== slot && token.test(typed) ? typed : slot;
      })
      .join('');
  }

  /** Empties the value (the clear button). */
  clear(): void {
    this.value.set('');
    this.input().nativeElement.value = '';
    this.input().nativeElement.focus();
  }

  /** Puts the caret on the first empty slot. */
  private placeCaret(input: HTMLInputElement): void {
    const index = input.value.indexOf(this.slotChar());
    const position = index < 0 ? input.value.length : index;
    input.setSelectionRange?.(position, position);
  }

  focus(): void {
    this.input().nativeElement.focus();
  }
}
