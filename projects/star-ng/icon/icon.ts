import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';

/** Weights of the Phosphor icons. The CSS of a weight must be loaded (`@phosphor-icons/web`). */
export type StarIconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

/**
 * Icon: a Phosphor icon class as a control, with a weight, a size and an accessible name.
 * PrimeNG has icon classes (`pi pi-check`) and no icon component; Material `mat-icon`.
 *
 * ```html
 * <star-icon name="trash" />                                  <!-- decorative -->
 * <star-icon name="warning" weight="fill" label="Warning" />  <!-- has a name -->
 * ```
 *
 * Without `label` the icon is decorative (`aria-hidden="true"`): use it next to text. With
 * `label` it is an image (`role="img"`) with that name: use it alone. The icon takes the color
 * of the text (`currentColor`) and scales with `size`.
 */
@Component({
  selector: 'star-icon',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-icon',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
    '[style.font-size]': 'fontSize()',
  },
  template: `<i data-star-part="glyphIcon" [class]="classes()" aria-hidden="true"></i>`,
})
export class StarIcon {
  /** Phosphor icon name, for example `house` (the `ph-` prefix is optional). */
  readonly name = input.required<string>();
  /** Weight (default `bold`, as the StarNG controls use). */
  readonly weight = input<StarIconWeight>('bold');
  /** Size: a number is pixels, text is a CSS length (`'1.5rem'`). Default: the font size. */
  readonly size = input<number | string | null>(null);
  /** Accessible name. Without it the icon is decorative. */
  readonly label = input<string | null>(null);
  /** Mirrors the icon in a right-to-left page (arrows and other icons with a direction). */
  readonly mirror = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(() => {
    const name = this.name().trim().replace(/^ph-/, '');
    const weight = this.weight();
    const base = weight === 'regular' ? 'ph' : `ph-${weight}`;
    return [base, `ph-${name}`, this.mirror() ? 'star-icon-mirror' : ''].filter(Boolean).join(' ');
  });
  protected readonly fontSize = computed(() => {
    const size = this.size();
    if (size === null || size === '') return null;
    return typeof size === 'number' ? `${size}px` : size;
  });
}
