import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  InjectionToken,
  input,
  signal,
} from '@angular/core';
import { StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';

/**
 * Provided by `star-avatar-group`. An avatar inside a group asks it whether it is one of the
 * avatars over `max`, which the group hides.
 */
export const STAR_AVATAR_GROUP = new InjectionToken<{ hides(avatar: StarAvatar): boolean }>(
  'STAR_AVATAR_GROUP',
);

/**
 * Avatar (PrimeNG `p-avatar`): image, initials from a name, or an icon; circle or square.
 * Falls back to initials when the image fails to load.
 * `<star-avatar name="Jane Doe" [image]="user.photoUrl" size="lg" />`
 */
@Component({
  selector: 'star-avatar',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'star-avatar star-avatar--' + size() + ' star-avatar--' + shape()",
    // Without a name the avatar is decoration: it has no role and screen readers skip it.
    '[attr.role]': "name() ? 'img' : null",
    '[attr.aria-hidden]': "name() ? null : 'true'",
    '[attr.aria-label]': 'name() || null',
    '[hidden]': 'hiddenByGroup()',
  },
  template: `
    @if (image() && !failed()) {
      <img data-star-part="image" [src]="image()" alt="" (error)="failed.set(true)" />
    } @else if (initials()) {
      <span data-star-part="text" aria-hidden="true">{{ initials() }}</span>
    } @else {
      <i data-star-part="icon" [class]="icon()" aria-hidden="true"></i>
    }
  `,
})
export class StarAvatar {
  readonly name = input('');
  readonly image = input<string | null>(null);
  readonly icon = input('ph-bold ph-user');
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  readonly shape = input<'circle' | 'square'>('circle');

  private readonly group = inject(STAR_AVATAR_GROUP, { optional: true });
  /** In a `star-avatar-group`, true when this avatar is over `max` of the group. */
  protected readonly hiddenByGroup = computed(() => this.group?.hides(this) ?? false);
  protected readonly failed = signal(false);
  protected readonly initials = computed(() =>
    this.name()
      .split(/[\s.@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join(''),
  );
}
