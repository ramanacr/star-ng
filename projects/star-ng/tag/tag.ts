import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { StarPart, StarSeverity, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';

/**
 * Status label (PrimeNG `p-tag`): severity color, optional icon, rounded pill.
 * `<star-tag severity="success" icon="ph-bold ph-check">Closed</star-tag>`
 */
@Component({
  selector: 'star-tag',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'star-tag star-tag--' + severity()",
    '[class.star-tag--rounded]': 'rounded()',
  },
  template: `
    @if (icon(); as icon) {
      <i starPart="icon" [class]="icon" aria-hidden="true"></i>
    }
    <span starPart="text">{{ value() }}<ng-content /></span>
  `,
})
export class StarTag {
  readonly severity = input<StarSeverity>('primary');
  readonly value = input('');
  readonly icon = input<string | null>(null);
  readonly rounded = input(false, { transform: booleanAttribute });
}
