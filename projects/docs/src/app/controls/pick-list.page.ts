import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarPickList } from 'star-ng/data-display';
import { DOCS, DocsRow } from '../shared/docs';

interface Member {
  readonly id: number;
  readonly name: string;
}

@Component({
  selector: 'docs-pick-list-page',
  imports: [DOCS, StarPickList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Pick list"
      lead="Two lists with buttons that move items from one to the other. Double-click or Enter moves one item. The PrimeNG equivalent is p-picklist."
      importFrom="import { StarPickList } from 'star-ng/data-display';"
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

      <docs-api [of]="['StarPickList']" [slots]="slots" [cssVars]="cssVars" [keyboard]="keyboard" />
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

  protected readonly basicScript = `readonly available = signal<readonly string[]>(['Berlin', 'Lisbon', 'Oslo', 'Prague']);
readonly chosen = signal<readonly string[]>([]);`;
  protected readonly objectsScript = `interface Member { id: number; name: string }
readonly people = signal<readonly Member[]>([
  { id: 1, name: 'Ada Ford' },
  { id: 2, name: 'Ben Hale' },
]);
readonly team = signal<readonly Member[]>([{ id: 4, name: 'Dan Moss' }]);`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: '(none)',
      description: 'The items come from the source and target models, not from content.',
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
  ];
}
