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
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import {
  injectStarControlDefaults,
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarIconContext,
  StarSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { injectStarFieldLink, starFieldLabelledBy, starJoinIds } from '@star-ng/ui/field';

/**
 * Star rating (PrimeNG `p-rating`) as a native radio group: Arrow keys change the rating,
 * screen readers announce "3 of 5 stars". Hover previews the rating.
 * `<star-rating [(value)]="quality" ariaLabel="Response quality" />`
 *
 * `cancel` adds a first option that clears the rating (PrimeNG `cancel`). `allowHalf` gives each
 * star two options, so the arrow keys step by 0.5 and each option reads "2.5 of 5" (PrimeNG
 * `allowHalf`). `orientation="vertical"` stacks the stars (PrimeNG `orientation`; layout only,
 * as ARIA 1.2 gives a radio group no `aria-orientation`). Slots:
 * `<ng-template starIcon="on">` and `starIcon="off"` replace the filled and the empty star, and
 * `starIcon="cancel"` the clear icon (PrimeNG `#onicon`, `#officon`, `#cancelicon`).
 */
@Component({
  selector: 'star-rating',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarRating) }],
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-rating',
    role: 'radiogroup',
    '[attr.aria-label]': 'labelledBy() ? null : (ariaLabel() ?? text.ratingLabel)',
    '[attr.aria-labelledby]': 'labelledBy()',
    '[attr.aria-describedby]': 'fieldDescribedBy()',
    '[attr.aria-required]': 'required() || null',
    '[class.star-rating--vertical]': "orientation() === 'vertical'",
    '[class.star-rating--readonly]': 'readonly() || disabled()',
    '(mouseleave)': 'hover.set(null)',
  },
  template: `
    @if (cancel()) {
      <label data-star-part="cancelItem" class="star-rating__star star-rating__cancel">
        <input
          type="radio"
          class="star-sr-only"
          [name]="groupName"
          value="0"
          [checked]="value() === null"
          [disabled]="disabled() || readonly()"
          [attr.aria-label]="text.clear"
          (click)="clear()"
          (blur)="touch.emit()"
        />
        @if (icons().get('cancel'); as icon) {
          <span data-star-part="cancelIcon" class="star-rating__icon" aria-hidden="true">
            <ng-container *ngTemplateOutlet="icon; context: noState" />
          </span>
        } @else {
          <i data-star-part="cancelIcon" class="ph-bold ph-prohibit" aria-hidden="true"></i>
        }
      </label>
    }
    @for (star of stars(); track star) {
      @if (allowHalf()) {
        <span
          data-star-part="rateItem"
          class="star-rating__star"
          [class.star-rating__star--on]="star <= shown()"
          [class.star-rating__star--half]="star - 0.5 === shown()"
        >
          @for (option of [star - 0.5, star]; track option; let half = $first) {
            <label
              data-star-part="halfLabel"
              class="star-rating__half"
              [class.star-rating__half--end]="!half"
              (mouseenter)="!readonly() && hover.set(option)"
            >
              <input
                type="radio"
                class="star-sr-only"
                [name]="groupName"
                [value]="option"
                [checked]="value() === option"
                [disabled]="disabled() || readonly()"
                [attr.aria-label]="text.ofTotal($any(number(option)), stars().length)"
                (click)="choose(option)"
                (blur)="touch.emit()"
              />
            </label>
          }
          <ng-container *ngTemplateOutlet="starIcon; context: { $implicit: star }" />
        </span>
      } @else {
        <label
          data-star-part="rateItem"
          class="star-rating__star"
          [class.star-rating__star--on]="star <= shown()"
          (mouseenter)="!readonly() && hover.set(star)"
        >
          <input
            type="radio"
            class="star-sr-only"
            [name]="groupName"
            [value]="star"
            [checked]="value() === star"
            [disabled]="disabled() || readonly()"
            [attr.aria-label]="text.ofTotal(star, stars().length)"
            (click)="choose(star)"
            (blur)="touch.emit()"
          />
          <ng-container *ngTemplateOutlet="starIcon; context: { $implicit: star }" />
        </label>
      }
    }
    <ng-template #starIcon let-star>
      @if (icons().get(star <= shown() ? 'on' : 'off'); as icon) {
        <span starPart="rateIcon" class="star-rating__icon" aria-hidden="true">
          <ng-container *ngTemplateOutlet="icon; context: noState" />
        </span>
      } @else {
        <i starPart="rateIcon" class="ph-fill ph-star" aria-hidden="true"></i>
      }
    </ng-template>
  `,
})
export class StarRating implements FormValueControl<number | null> {
  protected readonly text = inject(STAR_UI_TEXT);
  protected readonly groupName = inject(_IdGenerator).getId('star-rating-');
  readonly value = model<number | null>(null);
  readonly count = input(5);
  /** A first option that clears the rating (value `null`). PrimeNG `cancel`. */
  readonly cancel = input(false, { transform: booleanAttribute });
  /** Half stars: each star has two options (`2.5`, `3`), the keys step by 0.5. PrimeNG `allowHalf`. */
  readonly allowHalf = input(false, { transform: booleanAttribute });
  /** `'vertical'` stacks the stars (layout only). PrimeNG `orientation`. */
  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
  readonly ariaLabel = input<string | null>(null);
  /** Id of the element that labels the rating. PrimeNG `ariaLabelledBy`. */
  readonly ariaLabelledBy = input<string | null>(null);
  /** A rating is needed (`aria-required`); also bound from Signal Forms `required()`. */
  readonly required = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** The parent `star-field` when it labels the rating (a radio group is not labelable). */
  private readonly field = injectStarFieldLink(null, () => this.focus());
  protected readonly labelledBy = computed(() =>
    starFieldLabelledBy(this.field, this.ariaLabel(), this.ariaLabelledBy()),
  );
  protected readonly fieldDescribedBy = computed(() => starJoinIds(this.field?.describedBy()));

  /** Focuses the chosen star, else the first one. */
  focus(options?: FocusOptions): void {
    const radios = [...this.host.nativeElement.querySelectorAll<HTMLInputElement>('input')];
    (radios.find((radio) => radio.checked) ?? radios[0])?.focus(options);
  }

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly noState: StarIconContext = {};

  private readonly numberFormat = new Intl.NumberFormat(
    injectStarControlDefaults([]).locale ?? undefined,
  );
  /** A half-star value in the number format of the locale ("2,5" in German). */
  protected number(value: number): string {
    return this.numberFormat.format(value);
  }

  protected readonly hover = signal<number | null>(null);
  protected readonly stars = computed(() => Array.from({ length: this.count() }, (_, i) => i + 1));
  protected readonly shown = computed(() => this.hover() ?? this.value() ?? 0);

  protected clear(): void {
    if (this.disabled() || this.readonly()) return;
    this.value.set(null);
  }

  protected choose(star: number): void {
    if (this.disabled() || this.readonly()) return;
    this.value.set(star);
  }
}
