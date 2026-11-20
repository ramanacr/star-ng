import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';

/**
 * Loading placeholder (PrimeNG `p-skeleton`). Respects `prefers-reduced-motion`.
 * `<star-skeleton width="60%" height="1rem" />`, `<star-skeleton shape="circle" size="2.5rem" />`
 */
@Component({
  selector: 'star-skeleton',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-skeleton',
    'aria-hidden': 'true',
    '[class.star-skeleton--circle]': "shape() === 'circle'",
    '[class.star-skeleton--static]': "animation() === 'none'",
    '[style.width]': 'size() ?? width()',
    '[style.height]': 'size() ?? height()',
    '[style.border-radius]': 'borderRadius()',
  },
  template: ``,
})
export class StarSkeleton {
  readonly shape = input<'rectangle' | 'circle'>('rectangle');
  readonly width = input('100%');
  readonly height = input('1rem');
  /** Width and height together (squares and circles). */
  readonly size = input<string | null>(null);
  readonly borderRadius = input<string | null>(null);
  readonly animation = input<'wave' | 'none'>('wave');
}
