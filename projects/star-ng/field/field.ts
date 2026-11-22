import { _IdGenerator } from '@angular/cdk/a11y';
import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  Directive,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  Signal,
  signal,
} from '@angular/core';
import {
  injectStarControlDefaults,
  StarInputVariant,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';

/** The part of a Signal Forms `FieldState` that the field wrapper reads. */
export interface StarFieldStateLike {
  touched(): boolean;
  invalid(): boolean;
  required?(): boolean;
  /** An async validator runs (Signal Forms `validateAsync`, `validateHttp`). Optional. */
  pending?(): boolean;
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
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-field',
    '[class.star-field--invalid]': 'errorText()',
    '[class.star-field--pending]': 'pending()',
    '[attr.aria-busy]': 'pending() || null',
  },
  template: `
    @if (label()) {
      <!-- A click on the label only moves the focus to the control (see onLabelClick). Keyboard
           users reach the control itself with Tab, so the label needs no key handler. -->
      <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
      <label
        data-star-part="label"
        class="star-field__label"
        [id]="labelId"
        [attr.for]="labelFor()"
        (click)="onLabelClick($event)"
      >
        {{ label() }}
        @if (isRequired()) {
          <span data-star-part="requiredText" class="star-field__required" aria-hidden="true"
            >*</span
          >
        }
      </label>
    }
    <ng-content />
    @if (errorText(); as error) {
      <p data-star-part="errorText" class="star-field__error" [id]="errorId" role="alert">
        {{ error }}
      </p>
    } @else if (hint() || pending()) {
      <p data-star-part="hintText" class="star-field__hint" [id]="hintId">
        @if (pending()) {
          <i
            data-star-part="pendingIcon"
            class="ph-bold ph-circle-notch star-field__pending"
            aria-hidden="true"
          ></i>
        }
        {{ hint() }}
      </p>
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
   * Id of the labelled control. Set automatically by `starInput` and by the StarNG form controls
   * (see `linkControl`). Set it only for a native control that is not a StarNG control.
   */
  readonly for = input<string | null>(null);

  private readonly ids = inject(_IdGenerator);
  private readonly document = inject(DOCUMENT);
  readonly labelId = this.ids.getId('star-field-label-');
  readonly hintId = this.ids.getId('star-field-hint-');
  readonly errorId = this.ids.getId('star-field-error-');
  readonly defaultControlId = this.ids.getId('star-field-control-');

  /** The StarNG control inside the field that registered with `linkControl`. */
  private readonly linked = signal<{
    readonly id: (() => string) | null;
    readonly focus: (() => void) | null;
  } | null>(null);
  /** Id of the control that the label names. */
  protected readonly controlId = computed(
    () => this.for() ?? this.linked()?.id?.() ?? this.defaultControlId,
  );
  /**
   * The `for` of the label. A control without a labelable element (a `div` combobox, a group)
   * gets no `for`: it takes its name from `aria-labelledby` (see `labelledBy`), and a click on
   * the label calls its focus callback.
   */
  protected readonly labelFor = computed(() =>
    this.for() === null && this.linked()?.focus ? null : this.controlId(),
  );
  /**
   * Id of the visible label, or `null` when the field has no label. A control without a labelable
   * element puts it in `aria-labelledby` when the user set no `ariaLabel` or `ariaLabelledBy`.
   */
  readonly labelledBy = computed(() => (this.label() ? this.labelId : null));
  /**
   * The state has an async validator running (`pending()` of a Signal Forms field state): the
   * field is `aria-busy` and the hint row shows a busy icon (hidden from assistive technology).
   * Every control that links to the field (`starInput` and the StarNG form controls) is
   * `aria-busy` too, on the element with its role: a screen reader reports the state of the
   * focused control, not of its wrapper.
   */
  readonly pending = computed(() => !!this.state()?.pending?.());
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
   * Called by a StarNG control inside this field. The control also reads `describedBy()` and
   * `errorText()`. Use `injectStarFieldLink` in a control: it calls this method and returns the
   * field only when the control owns the label.
   *
   * The first control wins: a control inside the popup of another one (the calendar of a date
   * picker, the tree of a tree select) does not take the label. The link ends when the control is
   * destroyed, so the next control that links (for example after an `@if`) gets the label.
   * Returns `true` when this control now owns the label. A control that gets `false` must not use
   * the label, the hint or the error of the field.
   *
   * The link ends with `destroyRef`. Without it, a call in an injection context (a constructor or
   * a field initializer) uses the `DestroyRef` of the caller. A call outside an injection context
   * without `destroyRef` keeps the link until `unlinkControl` is called with the same id.
   *
   * - A control with a labelable element (`input`, `textarea`, `select`, `button`) passes only the
   *   id of that element. The label points at it with `for`, so the browser names it, and a click
   *   on the label focuses it.
   * - A control without one (a `div` combobox, a radio group, a slider drawn in SVG) also passes
   *   `focus`. The label then has no `for` (a `for` that names such an element is invalid HTML),
   *   the control names itself with `aria-labelledby` (`labelledBy()`), and a click on the label
   *   calls `focus`. Such a control may pass `null` as the id.
   */
  linkControl(
    controlId: Signal<string> | (() => string) | null,
    focus?: () => void,
    destroyRef?: DestroyRef,
  ): boolean {
    if (this.linked()) return false;
    const link = { id: controlId, focus: focus ?? null };
    this.linked.set(link);
    (destroyRef ?? callerDestroyRef())?.onDestroy(() => {
      if (this.linked() === link) this.linked.set(null);
    });
    return true;
  }

  /** Ends the link of the control that linked with `controlId` (see `linkControl`). */
  unlinkControl(controlId: Signal<string> | (() => string) | null): void {
    if (this.linked()?.id === controlId) this.linked.set(null);
  }

  /**
   * A click on the label moves the focus to the control and does nothing else. The native label
   * click would also activate the input: open the file dialog, toggle a checkbox, or open the
   * popup of a date picker that opens on click. The field label is a heading above the control
   * (a checkbox has its own label), so it only focuses. A `for` that the user set keeps the
   * native behaviour.
   */
  protected onLabelClick(event: MouseEvent): void {
    if (this.for() !== null) return;
    const focus = this.linked()?.focus;
    if (focus) {
      focus();
      return;
    }
    const control = this.document.getElementById(this.controlId());
    if (!control) return;
    event.preventDefault();
    control.focus();
  }
}

/** The `DestroyRef` of the caller in an injection context, else `null`. */
function callerDestroyRef(): DestroyRef | null {
  try {
    return inject(DestroyRef);
  } catch {
    return null;
  }
}

/**
 * `aria-labelledby` of a StarNG control without a labelable element inside a `star-field`: the
 * value that the user set wins; with an `aria-label` the control needs no label id; otherwise the
 * id of the field label.
 */
export function starFieldLabelledBy(
  field: StarField | null,
  ariaLabel: string | null | undefined,
  ariaLabelledBy: string | null | undefined = null,
): string | null {
  if (ariaLabelledBy) return ariaLabelledBy;
  if (ariaLabel) return null;
  return field?.labelledBy() ?? null;
}

/** Joins id lists for `aria-describedby`. Returns `null` when there is no id. */
export function starJoinIds(...ids: readonly (string | null | undefined)[]): string | null {
  const joined = ids.filter(Boolean).join(' ');
  return joined || null;
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
    '[class.star-input--filled]': "variant() === 'filled'",
    '[class.star-input--auto-resize]': 'autoResize()',
    '[attr.id]': 'resolvedId()',
    '[attr.aria-describedby]': 'field?.describedBy() ?? null',
    '[attr.aria-invalid]': 'showInvalid() || null',
    '[attr.aria-busy]': 'field?.pending() || null',
    '(input)': 'resizeFallback()',
  },
})
export class StarInput {
  protected readonly field = inject(StarField, { optional: true });
  private readonly host = inject<ElementRef<HTMLInputElement | HTMLTextAreaElement>>(ElementRef);
  private readonly defaults = injectStarControlDefaults(['sm', 'md', 'lg']);

  /** Size. Default: `size` of `provideStarNg`, else `md`. */
  readonly size = input<'sm' | 'md' | 'lg'>(this.defaults.size ?? 'md');
  /** Look: border on every side, or a filled surface. Default: `inputVariant` of `provideStarNg`, else `outlined`. PrimeNG `variant`. */
  readonly variant = input<StarInputVariant>(this.defaults.inputVariant ?? 'outlined');
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

/**
 * Injects the parent `star-field` and links the control to it (see `StarField.linkControl`).
 * Returns the field only when this control owns its label, else `null`: a control in the popup
 * of another control then keeps its own labelling. Call it in a field initializer or constructor.
 */
export function injectStarFieldLink(
  controlId: Signal<string> | (() => string) | null,
  focus?: () => void,
): StarField | null {
  const field = inject(StarField, { optional: true });
  return field?.linkControl(controlId, focus, inject(DestroyRef)) ? field : null;
}
