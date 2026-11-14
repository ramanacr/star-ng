import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarMegaMenu, StarMenuItem } from 'star-ng/menu';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-mega-menu-page',
  imports: [DOCS, StarMegaMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Mega menu"
      lead="A menubar where a top-level item opens one wide panel. The child items of the item are the columns of the panel."
      importFrom="import { StarMegaMenu } from 'star-ng/menu';"
    >
      <docs-example
        heading="Panel with columns"
        source="mega-menu/basic"
        [script]="catalogueScript"
        note="The items have three levels: the top-level item, the columns (their label is the column heading) and the links or actions of each column. A top-level item without items is a plain action."
      >
        <div class="docs-stack">
          <star-mega-menu
            ariaLabel="Catalogue"
            [items]="catalogue"
            (itemClick)="last.set($event.label ?? '')"
          />
          <p class="docs-output" role="status">Last action: {{ last() }}</p>
        </div>
      </docs-example>

      <docs-api [of]="['StarMegaMenu']" [slots]="slots" [cssVars]="cssVars" [keyboard]="keyboard" />

      <h2>Technical notes</h2>
      <p>
        The Angular CDK menu resolves the menu of an item through dependency injection. Menu items
        in a shared <code>ng-template</code> are outside the menu and fail injection. For this
        reason the items of the mega menu are written in place in its template, not in a shared
        template.
      </p>
    </docs-page>
  `,
})
export class MegaMenuPage {
  protected readonly last = signal('none');

  protected readonly catalogue: readonly StarMenuItem[] = [
    {
      label: 'Products',
      icon: 'ph-bold ph-package',
      items: [
        { label: 'Hardware', items: [{ label: 'Laptops' }, { label: 'Monitors' }] },
        { label: 'Software', items: [{ label: 'Editor Plus' }, { label: 'Viewer' }] },
        { label: 'Services', items: [{ label: 'Setup' }, { label: 'Training' }] },
      ],
    },
    {
      label: 'Orders',
      icon: 'ph-bold ph-folder-open',
      items: [
        { label: 'By state', items: [{ label: 'Open' }, { label: 'Shipped' }] },
        { label: 'By region', items: [{ label: 'Europe' }, { label: 'Asia' }] },
      ],
    },
    { label: 'Reports', icon: 'ph-bold ph-chart-bar' },
  ];

  protected readonly catalogueScript = `readonly last = signal('none');

readonly catalogue: readonly StarMenuItem[] = [
  {
    label: 'Products',
    icon: 'ph-bold ph-package',
    items: [
      { label: 'Hardware', items: [{ label: 'Laptops' }, { label: 'Monitors' }] },
      { label: 'Software', items: [{ label: 'Editor Plus' }, { label: 'Viewer' }] },
      { label: 'Services', items: [{ label: 'Setup' }, { label: 'Training' }] },
    ],
  },
  {
    label: 'Orders',
    icon: 'ph-bold ph-folder-open',
    items: [
      { label: 'By state', items: [{ label: 'Open' }, { label: 'Shipped' }] },
      { label: 'By region', items: [{ label: 'Europe' }, { label: 'Asia' }] },
    ],
  },
  { label: 'Reports', icon: 'ph-bold ph-chart-bar' },
];`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(none)', description: 'The items come from the items input, not from content.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of the bar and the panel.' },
    { name: '--star-border', description: 'Border of the bar and the panel.' },
    { name: '--star-text-muted', description: 'Color of the column headings.' },
    { name: '--star-surface-muted', description: 'Background of the hovered or open item.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Arrow left / Arrow right', description: 'Moves between the top-level items.' },
    { name: 'Arrow down / Enter / Space', description: 'Opens the panel of the focused item.' },
    { name: 'Arrow up / Arrow down', description: 'Moves through all items of the open panel.' },
    { name: 'Escape', description: 'Closes the panel. The focus returns to its top-level item.' },
  ];
}
