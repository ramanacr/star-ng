import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarAvatar } from '@star-ng/ui/avatar';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-avatar-page',
  imports: [DOCS, StarAvatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Avatar"
      lead="A small round or square image of a person or an account. It shows the initials of a name when there is no image, and an icon when there is no name. The PrimeNG equivalent is p-avatar."
      importFrom="import { StarAvatar } from '@star-ng/ui/avatar';"
    >
      <docs-example heading="Initials and icon" source="avatar/basic">
        <star-avatar name="Jane Doe" />
        <star-avatar name="Sam Lee" shape="square" />
        <star-avatar />
        <star-avatar name="Ava Stone" icon="ph-bold ph-buildings" />
      </docs-example>

      <docs-example
        heading="Sizes"
        source="avatar/sizes"
        note="The sizes are sm, md (default), lg and xl."
      >
        <star-avatar name="Jane Doe" size="sm" />
        <star-avatar name="Jane Doe" size="md" />
        <star-avatar name="Jane Doe" size="lg" />
        <star-avatar name="Jane Doe" size="xl" />
      </docs-example>

      <docs-example
        heading="Image with a fallback"
        source="avatar/image"
        note="When the image fails to load, the avatar shows the initials."
      >
        <star-avatar name="Broken Image" image="data:," size="lg" />
      </docs-example>

      <docs-api [of]="['StarAvatar']" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class AvatarPage {
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-text-strong', description: 'Background of the avatar.' },
    { name: '--star-on-tone', description: 'Color of the initials and the icon.' },
    { name: '--star-radius-md', description: 'Corner radius of a square avatar.' },
  ];
}
