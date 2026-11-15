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
  viewChildren,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { STAR_UI_TEXT, starInlineKey } from '@star-ng/ui/core';

/**
 * One-time code field (PrimeNG `p-inputotp`): one box per character, auto-advance, Backspace
 * goes back, Arrow keys move, pasting a full code fills every box, `autocomplete="one-time-code"`
 * on the first box so phones offer SMS codes.
 *
 * `<star-input-otp [length]="6" integerOnly [formField]="form.code" (completed)="verify($event)" />`
 */
@Component({
  selector: 'star-input-otp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-otp',
    role: 'group',
    '[attr.aria-label]': 'ariaLabel() ?? text.otpLabel',
    '[class.star-otp--invalid]': 'invalid() && touched()',
  },
  template: `
    @for (slot of slots(); track slot) {
      <input
        #box
        class="star-otp__box"
        maxlength="1"
        [type]="mask() ? 'password' : 'text'"
        [attr.inputmode]="integerOnly() ? 'numeric' : 'text'"
        [attr.autocomplete]="slot === 0 ? 'one-time-code' : 'off'"
        [attr.aria-label]="text.otpCharacter(slot + 1, length())"
        [value]="chars()[slot] ?? ''"
        [disabled]="disabled()"
        [readOnly]="readonly()"
        (input)="onInput($event, slot)"
        (keydown)="onKeydown($event, slot)"
        (paste)="onPaste($event, slot)"
        (focus)="box.select()"
        (blur)="slot === length() - 1 && touch.emit()"
      />
    }
  `,
})
export class StarInputOtp implements FormValueControl<string> {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly value = model('');
  readonly length = input(6);
  readonly integerOnly = input(false, { transform: booleanAttribute });
  /** Hides characters like a password. */
  readonly mask = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();
  readonly completed = output<string>();

  private readonly boxes = viewChildren<ElementRef<HTMLInputElement>>('box');
  protected readonly slots = computed(() => Array.from({ length: this.length() }, (_, i) => i));
  protected readonly chars = computed(() => [...this.value()]);

  private allowed(char: string): boolean {
    return this.integerOnly() ? /\d/.test(char) : /[\p{L}\d]/u.test(char);
  }

  private setChar(index: number, char: string): void {
    const chars = Array.from({ length: this.length() }, (_, i) => this.chars()[i] ?? '');
    chars[index] = char;
    // Keep characters packed to the left; an empty slot ends the value.
    const end = chars.indexOf('');
    const value = (end < 0 ? chars : chars.slice(0, Math.max(end, index + (char ? 1 : 0)))).join(
      '',
    );
    this.value.set(value);
    if (value.length === this.length() && !value.includes(' ')) this.completed.emit(value);
  }

  private focusBox(index: number): void {
    this.boxes()[Math.min(Math.max(index, 0), this.length() - 1)]?.nativeElement.focus();
  }

  protected onInput(event: Event, index: number): void {
    const box = event.target as HTMLInputElement;
    const char = box.value.slice(-1);
    if (char && !this.allowed(char)) {
      box.value = this.chars()[index] ?? '';
      return;
    }
    this.setChar(index, char);
    if (char) this.focusBox(index + 1);
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const box = event.target as HTMLInputElement;
    if (event.key === 'Backspace' && !box.value) {
      event.preventDefault();
      this.setChar(index - 1, '');
      this.focusBox(index - 1);
    } else if (starInlineKey(event) === 'ArrowLeft') {
      event.preventDefault();
      this.focusBox(index - 1);
    } else if (starInlineKey(event) === 'ArrowRight') {
      event.preventDefault();
      this.focusBox(index + 1);
    }
  }

  protected onPaste(event: ClipboardEvent, index: number): void {
    const text = (event.clipboardData?.getData('text') ?? '').replace(/\s/g, '');
    const chars = [...text].filter((c) => this.allowed(c));
    if (!chars.length) return;
    event.preventDefault();
    const current = [...this.value()].slice(0, index);
    const value = [...current, ...chars].slice(0, this.length()).join('');
    this.value.set(value);
    this.focusBox(value.length);
    if (value.length === this.length()) this.completed.emit(value);
  }

  focus(): void {
    this.focusBox(Math.min(this.value().length, this.length() - 1));
  }
}
