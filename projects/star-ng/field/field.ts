import { _IdGenerator } from '@angular/cdk/a11y';
import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  Directive,
  ElementRef,
  inject,
  input,
  Signal,
  signal,
} from '@angular/core';

/** The part of a Signal Forms `FieldState` that the field wrapper reads. */
export interface StarFieldStateLike {
  touched(): boolean;
  invalid(): boolean;
  required?(): boolean;
  errors(): readonly { readonly kind: string; readonly message?: string }[];
}

/**
 * Form field wrapper: uppercase label, the control, a hint and an error message
 * (PrimeNG `p-floatlabel` / `p-iftalabel` + `p-message` in one, StarNG style).
 *
 * Pass a Signal Forms field state to show its first error after the user touches the control:
 * ```html
 * <star-field label="Email" hint="Work address" [state]="form.email()">
 *   <input starInput [formField]="form.email" type="email" />
 * </star-field>
 * ```
 */
@Component({
  selector: 'star-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-field', '[class.star-field--invalid]': 'errorText()' },
  template: `
    @if (label()) {
      <label class="star-field__label" [id]="labelId" [attr.for]="controlId()">
        {{ label() }}
        @if (isRequired()) {
          <span class="star-field__required" aria-hidden="true">*</span>
        }
      </label>
    }
    <ng-content />
    @if (errorText(); as error) {
      <p class="star-field__error" [id]="errorId" role="alert">{{ error }}</p>
    } @else if (hint()) {
      <p class="star-field__hint" [id]="hintId">{{ hint() }}</p>
    }
  `,
})
export class StarField {
  readonly label = input('');
  readonly hint = input('');
  /** Explicit error text. Wins over `state` errors. */
  readonly error = input<string | null>(null);
  readonly state = input<StarFieldStateLike | null>(null);
  readonly required = input(false, { transform: booleanAttribute });
  /** Messages per validation error kind, for errors without a `message`. */
  readonly messages = input<Readonly<Record<string, string>>>({});
  /**
   * Id of the labelled control. Set automatically by `starInput` and by StarNG controls that
   * render their own input (`star-password`, `star-input-number`, `star-input-mask`).
   */
  readonly for = input<string | null>(null);

  private readonly ids = inject(_IdGenerator);
  readonly labelId = this.ids.getId('star-field-label-');
  readonly hintId = this.ids.getId('star-field-hint-');
  readonly errorId = this.ids.getId('star-field-error-');
  readonly defaultControlId = this.ids.getId('star-field-control-');

  /** Input id registered by a StarNG control inside the field (see `linkControl`). */
  private readonly linkedControlId = signal<Signal<string> | null>(null);
  protected readonly controlId = computed(
    () => this.for() ?? this.linkedControlId()?.() ?? this.defaultControlId,
  );
  protected readonly isRequired = computed(() => this.required() || !!this.state()?.required?.());

  readonly errorText = computed(() => {
    const explicit = this.error();
    if (explicit) return explicit;
    const state = this.state();
    if (!state || !state.touched() || !state.invalid()) return null;
    const first = state.errors()[0];
    if (!first) return null;
    return first.message ?? this.messages()[first.kind] ?? first.kind;
  });

  /** Ids for `aria-describedby` of the control. */
  readonly describedBy = computed(() =>
    this.errorText() ? this.errorId : this.hint() ? this.hintId : null,
  );

  /**
   * Called by a StarNG control that renders its own `<input>` inside this field, so the label
   * points at that input. The control also reads `describedBy()` and `errorText()`.
   */
  linkControl(inputId: Signal<string>): void {
    this.linkedControlId.set(inputId);
  }
}

/**
 * Applies StarNG input styling to a native `input` or `textarea` (PrimeNG `pInputText` /
 * `pTextarea`). Inside `star-field` it links label, hint and error automatically.
 * `autoResize` on a textarea grows it with its content (CSS `field-sizing: content`,
 * with a script fallback for browsers without it).
 */
@Directive({
  selector: 'input[starInput], textarea[starInput]',
  host: {
    class: 'star-input',
    '[class.star-input--sm]': "size() === 'sm'",
    '[class.star-input--lg]': "size() === 'lg'",
    '[class.star-input--auto-resize]': 'autoResize()',
    '[attr.id]': 'resolvedId()',
    '[attr.aria-describedby]': 'field?.describedBy() ?? null',
    '[attr.aria-invalid]': 'showInvalid() || null',
    '(input)': 'resizeFallback()',
  },
})
export class StarInput {
  protected readonly field = inject(StarField, { optional: true });
  private readonly host = inject<ElementRef<HTMLInputElement | HTMLTextAreaElement>>(ElementRef);

  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly invalid = input(false, { transform: booleanAttribute });
  /**
   * Signal Forms binds this with `[formField]`, so a field shows as invalid only after the user
   * has touched it. Left unbound (`undefined`), a plain `invalid` shows at once.
   */
  readonly touched = input<boolean | undefined>(undefined);
  readonly autoResize = input(false, { transform: booleanAttribute });
  /** Explicit id of the control. Defaults to the id generated by the parent `star-field`. */
  readonly id = input<string | null>(null);

  protected readonly resolvedId = computed(() => this.id() ?? this.field?.defaultControlId ?? null);
  protected readonly showInvalid = computed(
    () => (this.invalid() && (this.touched() ?? true)) || !!this.field?.errorText(),
  );

  private readonly needsFallback =
    typeof CSS === 'undefined' || !CSS.supports?.('field-sizing', 'content');

  constructor() {
    afterRenderEffect(() => {
      if (this.autoResize()) this.resizeFallback();
    });
  }

  protected resizeFallback(): void {
    const element = this.host.nativeElement;
    if (!this.autoResize() || !this.needsFallback || !(element instanceof HTMLTextAreaElement)) {
      return;
    }
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }
}
