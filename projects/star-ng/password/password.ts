import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
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
  StarUiText,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { injectStarFieldLink } from '@star-ng/ui/field';

export interface StarPasswordRule {
  readonly label: string;
  readonly test: (value: string) => boolean;
}

/** Default rules, labelled from the control texts (so they follow the active language). */
export function starPasswordRules(text: StarUiText, minLength = 12): readonly StarPasswordRule[] {
  return [
    { label: text.passwordRuleLength(minLength), test: (v) => v.length >= minLength },
    { label: text.passwordRuleUpper, test: (v) => /\p{Lu}/u.test(v) },
    { label: text.passwordRuleLower, test: (v) => /\p{Ll}/u.test(v) },
    { label: text.passwordRuleNumber, test: (v) => /\d/.test(v) },
    { label: text.passwordRuleSymbol, test: (v) => /[^\p{L}\d\s]/u.test(v) },
  ];
}

/**
 * Password field (PrimeNG `p-password`): show / hide toggle, strength meter and a rule
 * checklist (`feedback`), `autocomplete` defaults to `new-password` with feedback,
 * `current-password` without.
 *
 * `<star-password [formField]="form.newPassword" feedback />`
 *
 * Strength: the share of `rules` met gives 1 to 4 bars; `thresholds` sets the shares for fair,
 * good and strong; the level texts come from `STAR_UI_TEXT`. Slots: `<ng-template starIcon="show">`
 * and `starIcon="hide"` replace the icons of the show / hide button (PrimeNG `#showicon`,
 * `#hideicon`); `starHeader` and `starFooter` add content above and below the strength
 * feedback.
 */
@Component({
  selector: 'star-password',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarPassword) }],
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-password',
    '[class.star-password--invalid]': 'showInvalid()',
  },
  template: `
    <div data-star-part="controlPanel" class="star-password__control">
      <input
        data-star-part="input"
        #input
        class="star-password__input"
        [type]="masked() ? 'password' : 'text'"
        [id]="inputId()"
        [attr.name]="name() || null"
        [value]="value()"
        [attr.placeholder]="placeholder()"
        [attr.autocomplete]="autocomplete() ?? (feedback() ? 'new-password' : 'current-password')"
        [disabled]="disabled()"
        [readOnly]="readonly()"
        [required]="required()"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-labelledby]="ariaLabelledBy()"
        [attr.aria-describedby]="describedBy()"
        [attr.aria-invalid]="showInvalid() || null"
        (input)="value.set(input.value)"
        (blur)="touch.emit()"
      />
      <button
        data-star-part="revealButton"
        type="button"
        class="star-select__icon-btn"
        [attr.aria-label]="masked() ? text.showPassword : text.hidePassword"
        [attr.aria-pressed]="!masked()"
        [disabled]="disabled()"
        (click)="masked.set(!masked())"
      >
        @if (icons().get(masked() ? 'show' : 'hide'); as icon) {
          <span data-star-part="revealIcon" class="star-password__icon" aria-hidden="true">
            <ng-container *ngTemplateOutlet="icon; context: noState" />
          </span>
        } @else {
          <i
            data-star-part="revealIcon"
            class="ph-bold"
            [class.ph-eye]="masked()"
            [class.ph-eye-slash]="!masked()"
            aria-hidden="true"
          ></i>
        }
      </button>
    </div>
    @if (feedback()) {
      <div data-star-part="feedbackPanel" class="star-password__feedback" [id]="feedbackId">
        @if (headerSlot(); as header) {
          <ng-container *ngTemplateOutlet="header" />
        }
        <div data-star-part="meterPanel" class="star-password__meter" aria-hidden="true">
          @for (bar of bars; track bar) {
            <span
              data-star-part="barText"
              class="star-password__bar"
              [class.star-password__bar--on]="bar < score()"
              [attr.data-level]="level()"
            ></span>
          }
        </div>
        <p data-star-part="levelText" class="star-password__level" aria-live="polite">
          {{ value() ? levelText() : '' }}
        </p>
        <ul data-star-part="rulesList" class="star-password__rules">
          @for (rule of activeRules(); track $index) {
            @let ok = rule.test(value());
            <li data-star-part="rulesItem" [class.star-password__rule--ok]="ok">
              <i
                data-star-part="rulesIcon"
                class="ph-bold"
                [class.ph-check-circle]="ok"
                [class.ph-circle]="!ok"
                aria-hidden="true"
              ></i>
              {{ rule.label
              }}<span class="star-sr-only">{{ ': ' + (ok ? text.ruleMet : text.ruleNotMet) }}</span>
            </li>
          }
        </ul>
        @if (footerSlot(); as footer) {
          <ng-container *ngTemplateOutlet="footer" />
        }
      </div>
    }
  `,
})
export class StarPassword implements FormValueControl<string> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly field = injectStarFieldLink(() => this.inputId());
  private readonly ids = inject(_IdGenerator);

  readonly value = model('');
  readonly feedback = input(false, { transform: booleanAttribute });
  /** Custom rules. Default: length (`minLength`), upper, lower, number and symbol. */
  readonly rules = input<readonly StarPasswordRule[] | null>(null);
  /** Length rule; also bound from a Signal Forms `minLength()` validator. Default 12. */
  readonly minLength = input<number | undefined>(undefined);
  protected readonly activeRules = computed(
    () => this.rules() ?? starPasswordRules(this.text, this.minLength() ?? 12),
  );
  /**
   * Shares of the rules met (0 to 1) from which the strength is fair, good and strong.
   * Default `[0.375, 0.625, 0.875]` (the share rounded to quarters). Below the first share it is weak.
   */
  readonly thresholds = input<readonly [number, number, number]>([0.375, 0.625, 0.875]);
  readonly placeholder = input<string | null>(null);
  readonly autocomplete = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  /** Id of the element that labels the control (`aria-labelledby`). PrimeNG `ariaLabelledBy`. */
  readonly ariaLabelledBy = input<string | null>(null);
  readonly inputId = input(this.ids.getId('star-password-'));

  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly name = input('');
  readonly touch = output<void>();

  protected readonly feedbackId = this.ids.getId('star-password-feedback-');
  /** Invalid after touch, or while the parent `star-field` shows an error. */
  protected readonly showInvalid = computed(
    () => (this.invalid() && this.touched()) || !!this.field?.errorText(),
  );
  /** Field error or hint, then the strength feedback. */
  protected readonly describedBy = computed(
    () =>
      [this.field?.describedBy(), this.feedback() ? this.feedbackId : null]
        .filter(Boolean)
        .join(' ') || null,
  );

  protected readonly masked = signal(true);
  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly headerSlot = starSlot<object>(this.slots, this, 'header');
  protected readonly footerSlot = starSlot<object>(this.slots, this, 'footer');
  protected readonly noState: StarIconContext = {};
  protected readonly bars = [0, 1, 2, 3];
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  /** Rules met, as 0–4 bars: 1 weak, 2 fair, 3 good, 4 strong (`thresholds`). */
  protected readonly score = computed(() => {
    const rules = this.activeRules();
    if (!this.value() || !rules.length) return 0;
    const share = rules.filter((rule) => rule.test(this.value())).length / rules.length;
    const [fair, good, strong] = this.thresholds();
    return share >= strong ? 4 : share >= good ? 3 : share >= fair ? 2 : 1;
  });
  protected readonly level = computed<'weak' | 'fair' | 'good' | 'strong'>(
    () => (['weak', 'weak', 'fair', 'good', 'strong'] as const)[this.score()],
  );
  protected readonly levelText = computed(() => {
    const level = this.level();
    return level === 'weak'
      ? this.text.passwordWeak
      : level === 'fair'
        ? this.text.passwordFair
        : level === 'good'
          ? this.text.passwordGood
          : this.text.passwordStrong;
  });

  focus(options?: FocusOptions): void {
    this.input().nativeElement.focus(options);
  }
}
