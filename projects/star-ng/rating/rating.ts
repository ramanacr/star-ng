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
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { STAR_UI_TEXT, StarPart, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { injectStarFieldLink, starFieldLabelledBy, starJoinIds } from '@star-ng/ui/field';

/**
 * Star rating (PrimeNG `p-rating`) as a native radio group: Arrow keys change the rating,
 * screen readers announce "3 of 5 stars". Hover previews the rating.
 * `<star-rating [(value)]="quality" ariaLabel="Response quality" />`
 */
@Component({
  selector: 'star-rating',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-rating',
    role: 'radiogroup',
    '[attr.aria-label]': 'labelledBy() ? null : (ariaLabel() ?? text.ratingLabel)',
    '[attr.aria-labelledby]': 'labelledBy()',
    '[attr.aria-describedby]': 'fieldDescribedBy()',
    '[class.star-rating--readonly]': 'readonly() || disabled()',
    '(mouseleave)': 'hover.set(null)',
  },
  template: `
    @for (star of stars(); track star) {
      <label
        starPart="star"
        class="star-rating__star"
        [class.star-rating__star--on]="star <= shown()"
        (mouseenter)="!readonly() && hover.set(star)"
      >
        <input
          starPart="srText"
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
        <i starPart="icon" class="ph-fill ph-star" aria-hidden="true"></i>
      </label>
    }
  `,
})
export class StarRating implements FormValueControl<number | null> {
  protected readonly text = inject(STAR_UI_TEXT);
  protected readonly groupName = inject(_IdGenerator).getId('star-rating-');
  readonly value = model<number | null>(null);
  readonly count = input(5);
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** The parent `star-field` when it labels the rating (a radio group is not labelable). */
  private readonly field = injectStarFieldLink(null, () => this.focus());
  protected readonly labelledBy = computed(() => starFieldLabelledBy(this.field, this.ariaLabel()));
  protected readonly fieldDescribedBy = computed(() => starJoinIds(this.field?.describedBy()));

  /** Focuses the chosen star, else the first one. */
  focus(options?: FocusOptions): void {
    const radios = [...this.host.nativeElement.querySelectorAll<HTMLInputElement>('input')];
    (radios.find((radio) => radio.checked) ?? radios[0])?.focus(options);
  }

  protected readonly hover = signal<number | null>(null);
  protected readonly stars = computed(() => Array.from({ length: this.count() }, (_, i) => i + 1));
  protected readonly shown = computed(() => this.hover() ?? this.value() ?? 0);

  protected choose(star: number): void {
    if (this.disabled() || this.readonly()) return;
    this.value.set(star);
  }
}
