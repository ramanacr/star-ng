import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { STAR_UI_TEXT } from '@star-ng/ui/core';
import { STAR_BOTTOM_SHEET_DATA, StarBottomSheetRef } from './bottom-sheet-ref';

/** One entry of an action sheet. */
export interface StarActionSheetItem<T = unknown> {
  readonly label: string;
  /** Phosphor icon class, for example `ph-bold ph-share`. */
  readonly icon?: string;
  /** Destructive action: shown in the danger color. */
  readonly danger?: boolean;
  readonly disabled?: boolean;
  /** Any value the caller needs back, for example an id. */
  readonly value?: T;
}

/**
 * List of actions in a bottom sheet (Kendo / DevExtreme ActionSheet). Open it with
 * `StarBottomSheet.openActions(actions)`: the ref resolves with the chosen action, or `undefined`
 * for Cancel, Escape or a backdrop click.
 */
@Component({
  selector: 'star-action-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-action-sheet' },
  template: `
    <ul class="star-action-sheet__list" role="list">
      @for (action of actions; track $index) {
        <li>
          <button
            type="button"
            class="star-action-sheet__item"
            [class.star-action-sheet__item--danger]="action.danger"
            [disabled]="action.disabled"
            (click)="ref.dismiss(action)"
          >
            @if (action.icon) {
              <i class="star-action-sheet__icon" [class]="action.icon" aria-hidden="true"></i>
            }
            <span>{{ action.label }}</span>
          </button>
        </li>
      }
    </ul>
    <button
      type="button"
      class="star-action-sheet__item star-action-sheet__cancel"
      (click)="ref.dismiss()"
    >
      {{ text.reject }}
    </button>
  `,
})
export class StarActionSheet {
  protected readonly text = inject(STAR_UI_TEXT);
  protected readonly actions = inject<readonly StarActionSheetItem[]>(STAR_BOTTOM_SHEET_DATA);
  protected readonly ref = inject<StarBottomSheetRef<StarActionSheetItem>>(StarBottomSheetRef);
}
