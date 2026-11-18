import {
  booleanAttribute,
  computed,
  Directive,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { AbstractControl, NG_VALIDATORS, ValidationErrors, Validator } from '@angular/forms';
import { STAR_UI_TEXT } from '@star-ng/ui/core';

/**
 * Named character sets of `starKeyFilter` (PrimeNG `pKeyFilter`):
 * - `int`: digits and the minus sign.
 * - `num`: digits, minus sign and decimal point (`.` and `,`).
 * - `money`: digits, decimal point (`.` and `,`), space and apostrophe as group separators.
 * - `hex`: 0-9 and a-f.
 * - `alpha`: letters of any script, their combining marks and the underscore.
 * - `alphanum`: letters of any script, combining marks, digits and the underscore.
 * - `email`: letters, digits and `_ . - + @`.
 */
export type StarKeyFilterPreset = 'int' | 'num' | 'money' | 'hex' | 'alpha' | 'alphanum' | 'email';

/** A preset name, or a regular expression that one allowed character matches. */
export type StarKeyFilterRule = StarKeyFilterPreset | RegExp;

/** The character test of each preset. */
export const STAR_KEY_FILTER_PRESETS: Readonly<Record<StarKeyFilterPreset, RegExp>> = {
  int: /^[\d-]$/,
  num: /^[\d.,-]$/,
  money: /^[\d.,\s']$/,
  hex: /^[0-9a-f]$/i,
  alpha: /^[\p{L}\p{M}_]$/u,
  alphanum: /^[\p{L}\p{M}\p{N}_]$/u,
  email: /^[\p{L}\p{N}_.\-+@]$/u,
};

/** True when every character of `text` passes the filter. */
export function starKeyFilterAllows(filter: StarKeyFilterRule, text: string): boolean {
  const test = typeof filter === 'string' ? STAR_KEY_FILTER_PRESETS[filter] : filter;
  for (const char of Array.from(text)) {
    test.lastIndex = 0;
    if (!test.test(char)) return false;
  }
  return true;
}

/** `text` without the characters that the filter does not allow. */
export function starKeyFilterClean(filter: StarKeyFilterRule, text: string): string {
  return Array.from(text)
    .filter((char) => starKeyFilterAllows(filter, char))
    .join('');
}

/**
 * Lets the user type only the allowed characters into an `input` or a `textarea` (PrimeNG
 * `pKeyFilter`). The filter is a preset (`int`, `num`, `money`, `hex`, `alpha`, `alphanum`,
 * `email`) or a `RegExp` that one allowed character matches.
 *
 * ```html
 * <input starInput starKeyFilter="int" aria-label="Quantity" />
 * <input starInput [starKeyFilter]="/[A-Z0-9]/" aria-label="Code" />
 * ```
 *
 * - Typing: a character that the filter does not allow is not inserted (`beforeinput`).
 * - Paste and drop: only the allowed characters of the text are inserted, up to `maxlength`. A
 *   filtered drop goes to the caret, not to the drop point.
 * - IME composition (Chinese, Japanese, Korean input and accent keys) is never interrupted; after the
 *   composition ends, the characters that are not allowed are removed.
 * - `validateOnly`: nothing is blocked, and the value is checked again when it changes (typing, a
 *   form value set by code, a new rule). The directive sets an error instead: `valid()` is false,
 *   the element gets a native validation message (`setCustomValidity`), and a Reactive or template
 *   form control gets the error `starKeyFilter`.
 *
 * The filter does not replace validation of the whole value (for example a minimum or a format).
 */
@Directive({
  selector: 'input[starKeyFilter], textarea[starKeyFilter]',
  providers: [
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => StarKeyFilter), multi: true },
  ],
  host: {
    '[class.star-key-filter--invalid]': '!valid()',
    '(beforeinput)': 'onBeforeInput($event)',
    '(paste)': 'onPaste($event)',
    '(drop)': 'onDrop($event)',
    '(compositionstart)': 'composing = true',
    '(compositionend)': 'onCompositionEnd()',
    '(input)': 'check()',
  },
})
export class StarKeyFilter implements Validator {
  private readonly host = inject<ElementRef<HTMLInputElement | HTMLTextAreaElement>>(ElementRef);
  private readonly text = inject(STAR_UI_TEXT);

  /** The allowed characters: a preset name or a `RegExp` for one character. */
  readonly starKeyFilter = input.required<StarKeyFilterRule>();
  /** Does not block; marks a value with characters that are not allowed as invalid. PrimeNG `pValidateOnly`. */
  readonly validateOnly = input(false, { transform: booleanAttribute });
  /** Message of the native validation error with `validateOnly`. Default: the `keyFilterInvalid` UI text. */
  readonly validationMessage = input<string | null>(null);
  /** Emits with `validateOnly` when the result of the check changes: `true` when the value has only allowed characters. */
  readonly validChange = output<boolean>();

  private readonly allowed = signal(true);
  /** False while the value has characters that are not allowed (only with `validateOnly`). */
  readonly valid = computed(() => !this.validateOnly() || this.allowed());

  /** @internal True between `compositionstart` and `compositionend`. */
  composing = false;
  private onValidatorChange: () => void = () => undefined;

  constructor() {
    // A new rule or mode checks the value again.
    effect(() => {
      this.starKeyFilter();
      this.validateOnly();
      untracked(() => {
        this.check();
        this.onValidatorChange();
      });
    });
  }

  protected onBeforeInput(raw: Event): void {
    const event = raw as InputEvent;
    if (this.validateOnly() || this.composing || event.isComposing) return;
    if (!event.inputType?.startsWith('insert') || event.inputType === 'insertCompositionText') {
      return;
    }
    if (event.inputType === 'insertFromPaste' || event.inputType === 'insertFromDrop') return; // `paste` and `drop` handle them.
    const text = event.data ?? event.dataTransfer?.getData('text/plain') ?? '';
    if (text && !starKeyFilterAllows(this.starKeyFilter(), text)) event.preventDefault();
  }

  protected onPaste(raw: Event): void {
    this.filterTransfer(raw, (raw as ClipboardEvent).clipboardData);
  }

  protected onDrop(raw: Event): void {
    this.filterTransfer(raw, (raw as DragEvent).dataTransfer);
  }

  private filterTransfer(event: Event, data: DataTransfer | null | undefined): void {
    if (this.validateOnly() || !data) return;
    const text = data.getData('text/plain') || data.getData('text') || '';
    if (starKeyFilterAllows(this.starKeyFilter(), text)) return;
    event.preventDefault();
    this.insert(starKeyFilterClean(this.starKeyFilter(), text));
  }

  protected onCompositionEnd(): void {
    this.composing = false;
    if (this.validateOnly()) {
      this.check();
      return;
    }
    const element = this.host.nativeElement;
    const clean = starKeyFilterClean(this.starKeyFilter(), element.value);
    if (clean === element.value) return;
    const removed = element.value.length - clean.length;
    const caret = hasSelection(element)
      ? Math.max(0, (element.selectionEnd ?? element.value.length) - removed)
      : null;
    element.value = clean;
    if (caret !== null) {
      try {
        element.setSelectionRange(caret, caret);
      } catch {
        // The type has no selection (email, number): the caret goes to the end.
      }
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /** Checks the current value (with `validateOnly`). The `input` event calls it. */
  check(): void {
    if (this.composing) return;
    this.apply(this.host.nativeElement.value);
  }

  /** Sets the result of a check of `value`; emits and tells the forms only when it changes. */
  private apply(value: string): void {
    const ok = !this.validateOnly() || starKeyFilterAllows(this.starKeyFilter(), value);
    this.host.nativeElement.setCustomValidity?.(
      ok ? '' : (this.validationMessage() ?? this.text.keyFilterInvalid),
    );
    if (ok === this.allowed()) return;
    this.allowed.set(ok);
    this.onValidatorChange();
    if (this.validateOnly() || !ok) this.validChange.emit(ok);
  }

  /** @internal Angular forms: the error `starKeyFilter` with `validateOnly`. */
  validate(control: AbstractControl): ValidationErrors | null {
    if (!this.validateOnly()) return null;
    const value =
      control.value === null || control.value === undefined ? '' : String(control.value);
    // A value set by code (writeValue) has no input event: check it here.
    untracked(() => this.apply(value));
    return starKeyFilterAllows(this.starKeyFilter(), value) ? null : { starKeyFilter: true };
  }

  /** @internal */
  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  /**
   * Inserts text at the caret, as typing would, up to `maxlength`, and tells the forms. A type
   * without a selection API (`email`, `number`) gets the text at the end.
   */
  private insert(text: string): void {
    const element = this.host.nativeElement;
    const selection = hasSelection(element);
    const start = selection
      ? (element.selectionStart ?? element.value.length)
      : element.value.length;
    const end = selection ? (element.selectionEnd ?? start) : start;
    const max = element.maxLength;
    const room = max >= 0 ? Math.max(0, max - (element.value.length - (end - start))) : Infinity;
    const chars = Array.from(text);
    const fit = chars.length > room ? chars.slice(0, room).join('') : text;
    if (!fit) return;
    if (selection) {
      try {
        element.setRangeText(fit, start, end, 'end');
      } catch {
        element.value = element.value.slice(0, start) + fit + element.value.slice(end);
      }
    } else {
      element.value = element.value + fit;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/** False for input types without a selection API (`email`, `number`): `selectionStart` is `null`. */
function hasSelection(element: HTMLInputElement | HTMLTextAreaElement): boolean {
  try {
    return element.selectionStart !== null;
  } catch {
    return false;
  }
}
