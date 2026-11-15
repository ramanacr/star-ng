import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { StarSeverity } from '@star-ng/ui/core';

/**
 * Status label (PrimeNG `p-tag`): severity color, optional icon, rounded pill.
 * `<star-tag severity="success" icon="ph-bold ph-check">Closed</star-tag>`
 */
@Component({
  selector: 'star-tag',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'star-tag star-tag--' + severity()",
    '[class.star-tag--rounded]': 'rounded()',
  },
  template: `
    @if (icon(); as icon) {
      <i [class]="icon" aria-hidden="true"></i>
    }
    <span>{{ value() }}<ng-content /></span>
  `,
})
export class StarTag {
  readonly severity = input<StarSeverity>('primary');
  readonly value = input('');
  readonly icon = input<string | null>(null);
  readonly rounded = input(false, { transform: booleanAttribute });
}
