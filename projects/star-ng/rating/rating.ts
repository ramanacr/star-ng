import { _IdGenerator } from '@angular/cdk/a11y';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { STAR_UI_TEXT } from '@star-ng/ui/core';

/**
 * Star rating (PrimeNG `p-rating`) as a native radio group: Arrow keys change the rating,
 * screen readers announce "3 of 5 stars". Hover previews the rating.
 * `<star-rating [(value)]="quality" ariaLabel="Response quality" />`
 */
@Component({
  selector: 'star-rating',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-rating',
    role: 'radiogroup',
    '[attr.aria-label]': 'ariaLabel() ?? text.ratingLabel',
    '[class.star-rating--readonly]': 'readonly() || disabled()',
    '(mouseleave)': 'hover.set(null)',
  },
  template: `
    @for (star of stars(); track star) {
      <label
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
        <i class="ph-fill ph-star" aria-hidden="true"></i>
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

  protected readonly hover = signal<number | null>(null);
  protected readonly stars = computed(() => Array.from({ length: this.count() }, (_, i) => i + 1));
  protected readonly shown = computed(() => this.hover() ?? this.value() ?? 0);

  protected choose(star: number): void {
    if (this.disabled() || this.readonly()) return;
    this.value.set(star);
  }
}
