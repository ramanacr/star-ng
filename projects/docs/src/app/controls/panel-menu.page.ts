import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarMenuItem, StarPanelMenu } from '@star-ng/ui/menu';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './panel-menu.page.scss',
  selector: 'docs-panel-menu-page',
  imports: [DOCS, StarPanelMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Panel menu"
      lead="A vertical menu where an item with child items opens and closes in place, to any depth. Use it for side navigation with sections."
      importFrom="import { StarPanelMenu } from '@star-ng/ui/menu';"
    >
      <docs-example
        heading="Sections that open in place"
        source="panel-menu/basic"
        [script]="sectionsScript"
        note="Each parent is a button with aria-expanded. The expandedKeys model holds the positions of the open sections: 0, 1.0, and so on."
      >
        <div class="docs-stack">
          <star-panel-menu
            ariaLabel="Settings"
            [items]="sections"
            [(expandedKeys)]="open"
            (itemClick)="last.set($event.label ?? '')"
          />
          <p class="docs-output" role="status">
            Open: {{ open().join(', ') || 'none' }}. Last action: {{ last() }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="One section at a time"
        source="panel-menu/single"
        note="With single, opening a section closes its sibling sections."
      >
        <star-panel-menu ariaLabel="Settings, single" single [items]="sections" />
      </docs-example>

      <docs-api
        [of]="['StarPanelMenu']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class PanelMenuPage {
  protected readonly open = signal<readonly string[]>([]);
  protected readonly last = signal('none');

  protected readonly sections: readonly StarMenuItem[] = [
    {
      label: 'Account',
      icon: 'ph-bold ph-user',
      items: [{ label: 'Profile' }, { label: 'Password', disabled: true }],
    },
    {
      label: 'Projects',
      icon: 'ph-bold ph-folder',
      items: [
        { label: 'Templates', items: [{ label: 'Invoice' }, { label: 'Report' }] },
        { label: 'Defaults' },
      ],
    },
    { label: 'Sign out', icon: 'ph-bold ph-sign-out' },
  ];

  protected readonly sectionsScript = `readonly open = signal<readonly string[]>([]);
readonly last = signal('none');

readonly sections: readonly StarMenuItem[] = [
  {
    label: 'Account',
    icon: 'ph-bold ph-user',
    items: [{ label: 'Profile' }, { label: 'Password', disabled: true }],
  },
  {
    label: 'Projects',
    icon: 'ph-bold ph-folder',
    items: [
      { label: 'Templates', items: [{ label: 'Invoice' }, { label: 'Report' }] },
      { label: 'Defaults' },
    ],
  },
  { label: 'Sign out', icon: 'ph-bold ph-sign-out' },
];`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starMenuTemplate]',
      description:
        'Content child. "item" replaces the icon and label of each item (let-level, let-hasSubmenu), "itemIcon" the icon of an item with an icon. PrimeNG #item and #headericon.',
    },
    {
      name: 'ng-template[starIcon="submenu"]',
      description:
        'Content child. Replaces the arrow of a section; let-expanded is true when it is open. PrimeNG #submenuicon.',
    },
    { name: '(none)', description: 'The items come from the items input, not from content.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface-muted', description: 'Background of a hovered item.' },
    { name: '--star-primary-soft', description: 'Background of the active router link item.' },
    { name: '--star-text-strong', description: 'Text color of a top-level section.' },
    { name: '--star-accent', description: 'Focus ring of an item.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab / Shift+Tab', description: 'Moves through the visible items.' },
    { name: 'Enter / Space', description: 'Opens or closes a section, or runs a leaf item.' },
  ];
}
