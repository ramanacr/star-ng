import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  forwardRef,
  inject,
  input,
} from '@angular/core';
import { STAR_UI_TEXT, StarPart, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { STAR_AVATAR_GROUP, StarAvatar } from './avatar';

/**
 * Avatar group (PrimeNG `p-avatargroup`): a row of overlapping `star-avatar`s. With `max`, the
 * avatars over the limit are hidden and a "+N" avatar takes their place; its accessible name is
 * "N more" (`STAR_UI_TEXT.moreCount`).
 *
 * ```html
 * <star-avatar-group [max]="3" ariaLabel="Project team">
 *   @for (member of team; track member.id) {
 *     <star-avatar [name]="member.name" />
 *   }
 * </star-avatar-group>
 * ```
 */
@Component({
  selector: 'star-avatar-group',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_AVATAR_GROUP, useExisting: forwardRef(() => StarAvatarGroup) }],
  host: {
    class: 'star-avatar-group',
    role: 'group',
    '[attr.aria-label]': 'ariaLabel()',
  },
  template: `
    <ng-content />
    @if (overflow() > 0) {
      <span
        starPart="text"
        role="img"
        [class]="
          'star-avatar star-avatar--' +
          size() +
          ' star-avatar--' +
          shape() +
          ' star-avatar-group__more'
        "
        [attr.aria-label]="text.moreCount(overflow())"
        ><span starPart="text" aria-hidden="true">+{{ overflow() }}</span></span
      >
    }
  `,
})
export class StarAvatarGroup {
  protected readonly text = inject(STAR_UI_TEXT);
  /** Number of avatars to show. The rest are counted in the "+N" avatar. `null` shows all. */
  readonly max = input<number | null>(null);
  /** Size of the "+N" avatar. Use the size of the avatars. */
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  /** Shape of the "+N" avatar. Use the shape of the avatars. */
  readonly shape = input<'circle' | 'square'>('circle');
  /** Name of the group, for example "Project team". */
  readonly ariaLabel = input<string | null>(null);

  private readonly avatars = contentChildren(StarAvatar);
  /** Number of avatars over `max`. */
  protected readonly overflow = computed(() => {
    const max = this.max();
    return max === null ? 0 : Math.max(0, this.avatars().length - Math.max(0, max));
  });

  /** True when the avatar is over `max` (called by `star-avatar`). */
  hides(avatar: StarAvatar): boolean {
    const max = this.max();
    return max !== null && this.avatars().indexOf(avatar) >= Math.max(0, max);
  }
}
