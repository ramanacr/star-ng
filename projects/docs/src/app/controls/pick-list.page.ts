import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarEmptyTemplate } from '@star-ng/ui/core';
import {
  StarItemTemplate,
  StarListItemsEvent,
  StarPickList,
  StarPickListHeaderTemplate,
} from '@star-ng/ui/data-display';
import { DOCS, DocsRow } from '../shared/docs';

interface Member {
  readonly id: number;
  readonly name: string;
}

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './pick-list.page.scss',
  selector: 'docs-pick-list-page',
  imports: [DOCS, StarPickList, StarItemTemplate, StarPickListHeaderTemplate, StarEmptyTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Pick list"
      lead="Two lists with buttons that move items from one to the other. Double-click or Enter moves one item. The PrimeNG equivalent is p-picklist."
      importFrom="import { StarPickList } from '@star-ng/ui/data-display';"
    >
      <docs-example
        heading="Move text items"
        source="pick-list/basic"
        [script]="basicScript"
        note="source and target are two-way models. Click or press Space to select items. The buttons move the selection or all items. Moved items go to the end of the other list."
      >
        <div class="docs-stack">
          <star-pick-list [(source)]="available" [(target)]="chosen" />
          <p class="docs-output" role="status">Chosen: {{ chosen().join(', ') || 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Objects and headers"
        source="pick-list/objects"
        [script]="objectsScript"
        note="optionLabel names the label field of an object. sourceHeader and targetHeader replace the default headers. Each header shows the item count."
      >
        <div class="docs-stack">
          <star-pick-list
            [(source)]="people"
            [(target)]="team"
            optionLabel="name"
            sourceHeader="Available people"
            targetHeader="Project team"
          />
          <p class="docs-output" role="status">Team size: {{ team().length }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Custom item"
        source="pick-list/item"
        [script]="itemScript"
        note="starItem replaces the label of an item in both lists. It gets the item, its index, selected and list (source or target). Use list to show a different item in each list. Do not put buttons or links in the template: every item is an option in a listbox and takes the keys."
      >
        <div class="docs-stack">
          <star-pick-list [(source)]="people" [(target)]="team" optionLabel="name">
            <ng-template starItem [starItemOf]="people()" let-member let-list="list">
              {{ member.name }}
              @if (list === 'target') {
                <small style="color: var(--star-text-muted)">on the team</small>
              }
            </ng-template>
          </star-pick-list>
        </div>
      </docs-example>

      <docs-example
        heading="Filter, drag and drop and reorder"
        source="pick-list/filter-drag"
        [script]="filterScript"
        note="filter shows a search field above each list (filterBy chooses the fields, filterMatchMode the match: contains, startsWith, endsWith, equals or notContains). Move all moves only the items that the filter shows. dragdrop lets the mouse drag items to the other list or to another place in the same list; the keys and the buttons do the same without a mouse. showSourceControls and showTargetControls add buttons that move the selected items of that list up, down, to the top or to the bottom. metaKeySelection makes a click select only the clicked item (Ctrl or Cmd and a click adds it). The outputs give the moved items."
      >
        <div class="docs-stack">
          <star-pick-list
            [(source)]="cities"
            [(target)]="route"
            filter
            filterMatchMode="startsWith"
            dragdrop
            showTargetControls
            stripedRows
            sourceHeader="Cities"
            targetHeader="Route"
            sourceFilterPlaceholder="Find a city"
            targetFilterPlaceholder="Find a stop"
            (moveToTarget)="lastMove.set('to the route: ' + names($event))"
            (moveAllToTarget)="lastMove.set('all to the route: ' + names($event))"
            (moveToSource)="lastMove.set('back to the cities: ' + names($event))"
            (moveAllToSource)="lastMove.set('all back: ' + names($event))"
            (targetReorder)="lastMove.set('route reordered: ' + names($event))"
          />
          <p class="docs-output" role="status">Last move: {{ lastMove() || 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Header and empty slots"
        source="pick-list/slots"
        [script]="slotsScript"
        note="starPickListHeader replaces the header text of each list; it gets the list (source or target) and count. starEmpty replaces the empty message; it gets the filter text and list. starListFilter replaces the filter field, and starIcon (moveToTarget, moveAllToTarget, moveToSource, moveAllToSource, moveUp, moveTop, moveDown, moveBottom) replaces the icon of a button."
      >
        <star-pick-list [(source)]="crates" [(target)]="loaded">
          <ng-template starPickListHeader let-list let-count="count">
            {{ list === 'source' ? 'In the warehouse' : 'On the truck' }} ({{ count }} crates)
          </ng-template>
          <ng-template starEmpty let-list="list">
            {{ list === 'source' ? 'The warehouse is empty.' : 'Nothing loaded yet.' }}
          </ng-template>
        </star-pick-list>
      </docs-example>

      <h2>Names in PrimeNG</h2>
      <p>
        The PrimeNG p-picklist names that StarNG gives in another way: sourceitem and targetitem are
        the one starItem slot (use list); the filters show with filter (PrimeNG shows them when
        filterBy is set); style, sourceStyle, targetStyle, buttonProps and the move...Props inputs
        are the pass-through pt (parts sidePanel, list, transferButton, reorderButton); the button
        aria labels come from the UI texts; sourceAriaLabel and targetAriaLabel are the headers,
        which name the lists; onFocus and onBlur are the native focusin and focusout events. Not
        needed: tabindex and autoOptionFocus (every item is a tab stop), trackBy, sourceTrackBy,
        targetTrackBy and dataKey (items are compared by identity) and responsive (deprecated in
        PrimeNG; use breakpoint).
      </p>

      <h2>Right-to-left</h2>
      <p>
        The source list is on the right in a right-to-left page and the transfer arrows turn around,
        so they point to the list that receives the items. See the Right-to-left guide.
      </p>

      <docs-api
        [of]="[
          'StarPickList',
          'StarItemTemplate',
          'StarPickListHeaderTemplate',
          'StarListFilterTemplate',
        ]"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class PickListPage {
  protected readonly available = signal<readonly string[]>(['Berlin', 'Lisbon', 'Oslo', 'Prague']);
  protected readonly chosen = signal<readonly string[]>([]);
  protected readonly people = signal<readonly Member[]>([
    { id: 1, name: 'Ada Ford' },
    { id: 2, name: 'Ben Hale' },
    { id: 3, name: 'Cora Lind' },
  ]);
  protected readonly team = signal<readonly Member[]>([{ id: 4, name: 'Dan Moss' }]);
  protected readonly cities = signal<readonly string[]>([
    'Lisbon',
    'Lyon',
    'Leeds',
    'Oslo',
    'Porto',
    'Prague',
  ]);
  protected readonly route = signal<readonly string[]>(['Berlin']);
  protected readonly lastMove = signal('');
  protected readonly crates = signal<readonly string[]>(['Crate A', 'Crate B']);
  protected readonly loaded = signal<readonly string[]>([]);
  protected names(event: StarListItemsEvent<string>): string {
    return event.items.join(', ');
  }

  protected readonly basicScript = `readonly available = signal<readonly string[]>(['Berlin', 'Lisbon', 'Oslo', 'Prague']);
readonly chosen = signal<readonly string[]>([]);`;
  protected readonly objectsScript = `interface Member { id: number; name: string }
readonly people = signal<readonly Member[]>([
  { id: 1, name: 'Ada Ford' },
  { id: 2, name: 'Ben Hale' },
]);
readonly team = signal<readonly Member[]>([{ id: 4, name: 'Dan Moss' }]);`;

  protected readonly filterScript = `readonly cities = signal<readonly string[]>(['Lisbon', 'Lyon', 'Leeds', 'Oslo', 'Porto', 'Prague']);
readonly route = signal<readonly string[]>(['Berlin']);
readonly lastMove = signal('');
names(event: StarListItemsEvent<string>): string {
  return event.items.join(', ');
}`;
  protected readonly slotsScript = `// Import StarPickListHeaderTemplate from '@star-ng/ui/data-display'
// and StarEmptyTemplate from '@star-ng/ui/core'.
readonly crates = signal<readonly string[]>(['Crate A', 'Crate B']);
readonly loaded = signal<readonly string[]>([]);`;

  protected readonly itemScript = `// Import StarItemTemplate from '@star-ng/ui/data-display' in the component imports.
readonly people = signal<readonly Member[]>([ /* as above */ ]);
readonly team = signal<readonly Member[]>([ /* as above */ ]);`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starItem]',
      description:
        'Content child. Replaces the label of an item in both lists. The context has $implicit (the item), index (from 0), selected and list (source or target). Set starItemOf to the items to type the item. Do not add focusable elements: every item is an option with its own keys.',
    },
    {
      name: 'ng-template[starPickListHeader]',
      description:
        'Content child. Replaces the header text of each list. The context has $implicit (source or target) and count. PrimeNG sourceheader and targetheader.',
    },
    {
      name: 'ng-template[starListFilter]',
      description:
        'Content child, with filter. Replaces the filter field of each list. The context has $implicit (the filter text), list, filter(text) and reset(). PrimeNG sourcefilter and targetfilter.',
    },
    {
      name: 'ng-template[starEmpty]',
      description:
        'Content child. Replaces the empty message of a list. The context has $implicit (the filter text) and list. PrimeNG emptymessagesource, emptyfiltermessagesource and their target pair.',
    },
    {
      name: 'ng-template[starIcon]',
      description:
        'Content child. Replaces the icon of a button: moveToTarget, moveAllToTarget, moveToSource, moveAllToSource, moveUp, moveTop, moveDown or moveBottom. PrimeNG movetotargeticon and the other icon templates.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-border', description: 'Border of a list.' },
    { name: '--star-radius-lg', description: 'Corner radius of a list.' },
    { name: '--star-surface', description: 'Background of a list.' },
    { name: '--star-text-muted', description: 'Color of a header.' },
    { name: '--star-accent', description: 'Focus ring of an item.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Every item and every button is a tab stop.' },
    { name: 'Space', description: 'Selects or clears the focused item.' },
    { name: 'Enter', description: 'Moves the focused item (only this item) to the other list.' },
    {
      name: 'Arrow down / Arrow up',
      description: 'Moves the focus to the next or the previous item.',
    },
  ];
}
