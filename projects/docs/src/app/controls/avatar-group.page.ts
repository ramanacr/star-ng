import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { StarAvatar, StarAvatarGroup } from '@star-ng/ui/avatar';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './avatar-group.page.scss',
  selector: 'docs-avatar-group-page',
  imports: [DOCS, StarAvatar, StarAvatarGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Avatar group"
      lead="A row of overlapping avatars, for example the members of a project. With max, the avatars over the limit are hidden and a '+N' avatar counts them. Its accessible name is 'N more'. The PrimeNG equivalent is p-avatargroup."
      importFrom="import { StarAvatar, StarAvatarGroup } from '@star-ng/ui/avatar';"
    >
      <docs-example
        heading="Group with a limit"
        source="avatar-group/max"
        [script]="maxScript"
        note="The group has role group and the name from ariaLabel. The '+N' text comes from STAR_UI_TEXT (moreCount)."
      >
        <star-avatar-group [max]="3" ariaLabel="Project team">
          @for (member of team; track member) {
            <star-avatar [name]="member" />
          }
        </star-avatar-group>
      </docs-example>

      <docs-example
        heading="Sizes and shapes"
        source="avatar-group/sizes"
        note="Give the group the size and the shape of its avatars: the '+N' avatar uses them."
      >
        <div class="docs-stack">
          <star-avatar-group size="sm" ariaLabel="Reviewers">
            <star-avatar name="Jane Doe" size="sm" />
            <star-avatar name="Sam Lee" size="sm" />
            <star-avatar name="Ava Stone" size="sm" />
          </star-avatar-group>
          <star-avatar-group [max]="2" size="lg" shape="square" ariaLabel="Workspaces">
            <star-avatar name="North Office" size="lg" shape="square" />
            <star-avatar name="South Office" size="lg" shape="square" />
            <star-avatar name="East Office" size="lg" shape="square" />
            <star-avatar name="West Office" size="lg" shape="square" />
          </star-avatar-group>
        </div>
      </docs-example>

      <docs-api [of]="['StarAvatarGroup']" [slots]="slots" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class AvatarGroupPage {
  protected readonly team: readonly string[] = [
    'Jane Doe',
    'Sam Lee',
    'Ava Stone',
    'Max Moor',
    'Lea Park',
  ];

  protected readonly maxScript = `readonly team = ['Jane Doe', 'Sam Lee', 'Ava Stone', 'Max Moor', 'Lea Park'];`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'The star-avatar elements of the group.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Ring around each avatar, so they stand apart.' },
    { name: '--star-surface-muted', description: 'Background of the "+N" avatar.' },
    { name: '--star-text-strong', description: 'Text color of the "+N" avatar.' },
  ];
}
