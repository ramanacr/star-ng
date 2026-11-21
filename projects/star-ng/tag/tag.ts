import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  contentChildren,
  forwardRef,
  input,
} from '@angular/core';
import {
  STAR_SLOT_HOST,
  StarIconContext,
  StarSeverity,
  StarSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';

/**
 * Status label (PrimeNG `p-tag`): severity color, optional icon, rounded pill.
 * `<star-tag severity="success" icon="ph-bold ph-check">Closed</star-tag>`
 *
 * Slots (content children): `starIcon="icon"` replaces the icon (PrimeNG `#icon`); it shows also
 * without the `icon` input.
 */
@Component({
  selector: 'star-tag',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarTag) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'star-tag star-tag--' + severity()",
    '[class.star-tag--rounded]': 'rounded()',
  },
  template: `
    @if (icons().get('icon'); as custom) {
      <span data-star-part="icon" aria-hidden="true">
        <ng-container *ngTemplateOutlet="custom; context: iconContext" />
      </span>
    } @else if (icon(); as icon) {
      <i data-star-part="icon" [class]="icon" aria-hidden="true"></i>
    }
    <span data-star-part="text">{{ value() }}<ng-content /></span>
  `,
})
export class StarTag {
  readonly severity = input<StarSeverity>('primary');
  readonly value = input('');
  readonly icon = input<string | null>(null);
  readonly rounded = input(false, { transform: booleanAttribute });

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly iconContext: StarIconContext = {};
}
