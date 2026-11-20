import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';

/**
 * Button group (PrimeNG `p-buttongroup`): joins adjacent buttons into one bar. The buttons share
 * their borders and only the outer corners are round. Works with `star-button`, a native
 * `button.star-btn` and `star-split-button`. Each button keeps its own action and its own tab
 * stop: this is not a selection control (use `star-select-button` to pick a value).
 *
 * ```html
 * <star-button-group ariaLabel="Text alignment">
 *   <star-button variant="secondary" iconOnly leadingIcon="ph-bold ph-text-align-left" ariaLabel="Left" />
 *   <star-button variant="secondary" iconOnly leadingIcon="ph-bold ph-text-align-center" ariaLabel="Center" />
 * </star-button-group>
 * ```
 */
@Component({
  selector: 'star-button-group',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-button-group', role: 'group', '[attr.aria-label]': 'ariaLabel()' },
  template: `<ng-content />`,
})
export class StarButtonGroup {
  /** Name of the group for screen readers, for example "Text alignment". */
  readonly ariaLabel = input<string | null>(null);
}
