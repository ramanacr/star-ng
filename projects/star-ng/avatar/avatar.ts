import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * Avatar (PrimeNG `p-avatar`): image, initials from a name, or an icon; circle or square.
 * Falls back to initials when the image fails to load.
 * `<star-avatar name="Jane Doe" [image]="user.photoUrl" size="lg" />`
 */
@Component({
  selector: 'star-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'star-avatar star-avatar--' + size() + ' star-avatar--' + shape()",
    // Without a name the avatar is decoration: it has no role and screen readers skip it.
    '[attr.role]': "name() ? 'img' : null",
    '[attr.aria-hidden]': "name() ? null : 'true'",
    '[attr.aria-label]': 'name() || null',
  },
  template: `
    @if (image() && !failed()) {
      <img [src]="image()" alt="" (error)="failed.set(true)" />
    } @else if (initials()) {
      <span aria-hidden="true">{{ initials() }}</span>
    } @else {
      <i [class]="icon()" aria-hidden="true"></i>
    }
  `,
})
export class StarAvatar {
  readonly name = input('');
  readonly image = input<string | null>(null);
  readonly icon = input('ph-bold ph-user');
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  readonly shape = input<'circle' | 'square'>('circle');

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
