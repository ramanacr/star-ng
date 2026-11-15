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
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { StarField } from '@star-ng/ui/field';

/** Mask slot tokens (PrimeNG `p-inputmask` syntax): `9` digit, `a` letter, `*` letter or digit. */
const TOKENS: Record<string, RegExp> = { '9': /\d/, a: /\p{L}/u, '*': /[\p{L}\d]/u };

/** Applies a mask to raw characters; returns the masked text (unfilled slots as `slotChar`). */
export function applyMask(mask: string, raw: string, slotChar = '_'): string {
  let out = '';
  let r = 0;
  for (const char of mask) {
    const token = TOKENS[char];
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
 *
 * `<star-input-mask mask="(999) 999-9999" [formField]="form.phone" ariaLabel="Phone number" />`
 */
@Component({
  selector: 'star-input-mask',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-mask' },
  template: `
    <input
      #input
      type="text"
      class="star-input star-mask__input"
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
      [attr.aria-describedby]="field?.describedBy() ?? null"
      [attr.aria-invalid]="showInvalid() || null"
      (input)="onInput(input)"
      (focus)="onFocus(input)"
      (blur)="onBlur(input)"
    />
  `,
})
export class StarInputMask implements FormValueControl<string> {
  protected readonly field = inject(StarField, { optional: true });
  /** Invalid after touch, or while the parent `star-field` shows an error. */
  protected readonly showInvalid = computed(
    () => (this.invalid() && this.touched()) || !!this.field?.errorText(),
  );

  constructor() {
    this.field?.linkControl(this.inputId);
  }

  readonly value = model('');
  readonly mask = input.required<string>();
  readonly slotChar = input('_');
  /** Store only the typed characters (no literals). */
  readonly unmask = input(false, { transform: booleanAttribute });
  /** Keep a partly filled value on blur (default clears it). */
  readonly autoClear = input(true, { transform: booleanAttribute });
  readonly placeholder = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
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
  protected readonly display = computed(() => {
    const value = this.value();
    return value ? applyMask(this.mask(), value, this.slotChar()) : '';
  });

  private slotsFilled(masked: string): boolean {
    return !masked.includes(this.slotChar());
  }

  protected onFocus(input: HTMLInputElement): void {
    if (!input.value) input.value = applyMask(this.mask(), '', this.slotChar());
    queueMicrotask(() => this.placeCaret(input));
  }

  protected onInput(input: HTMLInputElement): void {
    // Take every letter or digit in order: works for typing inside the mask and for pasting
    // raw text such as "5551234567". Mask literals are punctuation, so they drop out.
    const raw = [...input.value]
      .filter((char) => char !== this.slotChar() && /[\p{L}\d]/u.test(char))
      .join('');
    const masked = applyMask(this.mask(), raw, this.slotChar());
    input.value = masked;
    this.placeCaret(input);
    const typed = unmask(this.mask(), masked, this.slotChar());
    this.value.set(this.unmask() ? typed : typed ? masked : '');
    if (this.slotsFilled(masked)) this.completed.emit(this.value());
  }

  protected onBlur(input: HTMLInputElement): void {
    const typed = unmask(this.mask(), input.value, this.slotChar());
    if (!typed || (this.autoClear() && !this.slotsFilled(input.value))) {
      this.value.set('');
      input.value = '';
    }
    this.touch.emit();
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
