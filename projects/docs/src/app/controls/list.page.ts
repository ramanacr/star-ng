import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarEmptyTemplate } from '@star-ng/ui/core';
import { StarList, StarListItem, StarListSubheader } from '@star-ng/ui/list';
import { StarTag } from '@star-ng/ui/tag';
import { DOCS, DocsRow } from '../shared/docs';

interface Project {
  readonly id: string;
  readonly name: string;
  readonly tasks: number;
}

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './list.page.scss',
  selector: 'docs-list-page',
  imports: [DOCS, StarList, StarListItem, StarListSubheader, StarEmptyTemplate, StarTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="List"
      lead="A list of items with an optional icon or avatar, a title, a subtitle and meta text or actions. Items can be text, links or buttons. The Angular Material equivalents are mat-list, mat-nav-list and mat-action-list. For a list where the user selects options, use star-listbox."
      importFrom="import { StarList, StarListItem, StarListSubheader } from '@star-ng/ui/list';"
    >
      <docs-example
        heading="Plain list"
        source="list/basic"
        note="A plain list is text only. The subheader is a visual heading in the list; use separate lists with their own label when the groups matter to screen reader users."
      >
        <star-list ariaLabel="Warehouses" divider>
          <star-list-subheader>Portugal</star-list-subheader>
          <star-list-item>
            <i starListItemStart class="ph-bold ph-warehouse" aria-hidden="true"></i>
            Lisbon
            <span starListItemSubtitle>Main warehouse</span>
            <span starListItemEnd>1,240 orders</span>
          </star-list-item>
          <star-list-item>
            <i starListItemStart class="ph-bold ph-warehouse" aria-hidden="true"></i>
            Porto
            <span starListItemSubtitle>Returns</span>
            <span starListItemEnd>310 orders</span>
          </star-list-item>
          <star-list-subheader>Spain</star-list-subheader>
          <star-list-item>
            <i starListItemStart class="ph-bold ph-warehouse" aria-hidden="true"></i>
            Valencia
            <span starListItemSubtitle>Cross-dock</span>
            <star-tag starListItemEnd severity="success" value="Open" />
          </star-list-item>
        </star-list>
      </docs-example>

      <docs-example
        heading="Navigation list"
        source="list/navigation"
        note="With routerLink or href the items are links. The list is one Tab stop: the arrow keys, Home and End move between the links. A router link gets aria-current=page while its route is active; for href items, set active."
      >
        <star-list mode="navigation" ariaLabel="Documentation">
          <star-list-item routerLink="/controls/list">
            <i starListItemStart class="ph-bold ph-list-bullets" aria-hidden="true"></i>
            List
            <span starListItemSubtitle>This page</span>
          </star-list-item>
          <star-list-item routerLink="/controls/listbox">
            <i starListItemStart class="ph-bold ph-check-square" aria-hidden="true"></i>
            Listbox
            <span starListItemSubtitle>For selection</span>
          </star-list-item>
          <star-list-item routerLink="/controls/virtual-scroller">
            <i starListItemStart class="ph-bold ph-rows" aria-hidden="true"></i>
            Virtual scroller
            <span starListItemSubtitle>For thousands of items</span>
          </star-list-item>
        </star-list>
      </docs-example>

      <docs-example
        heading="Action list, dense"
        source="list/action"
        [script]="actionScript"
        note="In action mode the items are buttons that emit activated. Disabled items are skipped by the arrow keys."
      >
        <div class="docs-stack">
          <star-list mode="action" dense ariaLabel="Projects">
            @for (project of projects; track project.id) {
              <star-list-item
                [active]="opened() === project.id"
                (activated)="opened.set(project.id)"
              >
                {{ project.name }}
                <span starListItemEnd>{{ project.tasks }} tasks</span>
              </star-list-item>
            }
            <star-list-item disabled>
              Archive
              <span starListItemEnd>Read only</span>
            </star-list-item>
          </star-list>
          <p class="docs-output" role="status">Opened: {{ opened() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Empty list"
        source="list/empty"
        note="The starEmpty slot shows when the list has no items. The list role is removed then."
      >
        <star-list ariaLabel="Recent orders">
          <ng-template starEmpty>No recent orders.</ng-template>
        </star-list>
      </docs-example>

      <docs-api
        [of]="['StarList', 'StarListItem', 'StarListSubheader']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class ListPage {
  protected readonly projects: readonly Project[] = [
    { id: 'apollo', name: 'Apollo', tasks: 12 },
    { id: 'borealis', name: 'Borealis', tasks: 4 },
    { id: 'cassini', name: 'Cassini', tasks: 27 },
  ];
  protected readonly opened = signal<string | null>(null);

  protected readonly actionScript = `readonly projects = [
  { id: 'apollo', name: 'Apollo', tasks: 12 },
  { id: 'borealis', name: 'Borealis', tasks: 4 },
  { id: 'cassini', name: 'Cassini', tasks: 27 },
];
readonly opened = signal<string | null>(null);`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'star-list: the items and subheaders. Item: the title.' },
    { name: '[starListItemStart]', description: 'Item: an icon or avatar before the title.' },
    { name: '[starListItemSubtitle]', description: 'Item: a second line under the title.' },
    {
      name: '[starListItemEnd]',
      description:
        'Item: meta text or actions at the end. It is outside the link or button of the item.',
    },
    { name: 'ng-template[starEmpty]', description: 'star-list: shown when there are no items.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-border', description: 'Line between the items (divider).' },
    { name: '--star-surface-muted', description: 'Background of a hovered link or button.' },
    { name: '--star-primary-soft', description: 'Background of the active item.' },
    { name: '--star-text-muted', description: 'Color of the subtitle, the icon and the end area.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Moves the focus into the list (one Tab stop) and out of it.' },
    {
      name: 'Arrow Down / Arrow Up',
      description: 'Navigation and action mode: the next or previous item.',
    },
    { name: 'Home / End', description: 'The first or last item.' },
    { name: 'Letters', description: 'The next item whose title starts with the typed text.' },
    { name: 'Enter', description: 'Opens the link or activates the button.' },
    { name: 'Space', description: 'Action mode: activates the button.' },
  ];
}
