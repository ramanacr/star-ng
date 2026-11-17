import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { StarItemTemplate, StarOrderList } from '@star-ng/ui/data-display';
import { DOCS, DocsRow } from '../shared/docs';

interface Task {
  readonly id: number;
  readonly name: string;
}

@Component({
  selector: 'docs-order-list-page',
  imports: [DOCS, StarOrderList, StarItemTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Order list"
      lead="A list that the user reorders with four buttons or with Alt and the arrow keys. The moved item keeps the focus and a live region announces its new position. The PrimeNG equivalent is p-orderlist."
      importFrom="import { StarOrderList } from '@star-ng/ui/data-display';"
    >
      <docs-example
        heading="Reorder text items"
        source="order-list/basic"
        [script]="basicScript"
        note="value is a two-way model. Select an item, then use the buttons (top, up, down, bottom). A button is disabled when the move is not possible."
      >
        <div class="docs-stack">
          <star-order-list [(value)]="steps" ariaLabel="Release steps" />
          <p class="docs-output" role="status">Order: {{ steps().join(' > ') }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Objects with optionLabel"
        source="order-list/objects"
        [script]="objectsScript"
        note="For objects, optionLabel names the field (or gives a function) that is the label. The model keeps the objects."
      >
        <div class="docs-stack">
          <star-order-list [(value)]="playlist" optionLabel="name" ariaLabel="Task playlist" />
          <p class="docs-output" role="status">Ids: {{ ids() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Custom item"
        source="order-list/item"
        [script]="itemScript"
        note="starItem replaces the label of an item. It gets the item, its index (from 0) and selected. The grip icon, the option role and the keys stay. Do not put buttons or links in the template: every item is an option in a listbox and takes the keys."
      >
        <div class="docs-stack">
          <star-order-list [(value)]="playlist" optionLabel="name" ariaLabel="Task priorities">
            <ng-template
              starItem
              [starItemOf]="playlist()"
              let-task
              let-i="index"
              let-on="selected"
            >
              <strong>{{ i + 1 }}.</strong> {{ task.name }}
              @if (on) {
                <small style="color: var(--star-text-muted)">(selected)</small>
              }
            </ng-template>
          </star-order-list>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarOrderList', 'StarItemTemplate']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class OrderListPage {
  protected readonly steps = signal<readonly string[]>(['Plan', 'Build', 'Test', 'Release']);
  protected readonly playlist = signal<readonly Task[]>([
    { id: 1, name: 'Review the report' },
    { id: 2, name: 'Send the invoices' },
    { id: 3, name: 'Update the roadmap' },
    { id: 4, name: 'Book the meeting room' },
  ]);
  protected readonly ids = computed(() =>
    this.playlist()
      .map((task) => task.id)
      .join(', '),
  );

  protected readonly basicScript = `readonly steps = signal<readonly string[]>(['Plan', 'Build', 'Test', 'Release']);`;
  protected readonly objectsScript = `interface Task { id: number; name: string }
readonly playlist = signal<readonly Task[]>([
  { id: 1, name: 'Review the report' },
  { id: 2, name: 'Send the invoices' },
]);
readonly ids = computed(() => this.playlist().map((task) => task.id).join(', '));`;

  protected readonly itemScript = `// Import StarItemTemplate from '@star-ng/ui/data-display' in the component imports.
readonly playlist = signal<readonly Task[]>([ /* as above */ ]);`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starItem]',
      description:
        'Content child. Replaces the label of an item. The grip icon stays. The context has $implicit (the item), index (from 0) and selected. Set starItemOf to the items to type the item. Do not add focusable elements: every item is an option with its own keys.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-border', description: 'Border of the list.' },
    { name: '--star-radius-lg', description: 'Corner radius of the list.' },
    { name: '--star-surface', description: 'Background of the list.' },
    { name: '--star-text-soft', description: 'Color of the grip icon.' },
    { name: '--star-accent', description: 'Focus ring of an item.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Every item is a tab stop. Focusing an item selects it.' },
    {
      name: 'Arrow down / Arrow up',
      description: 'Moves the focus to the next or the previous item. It stops at the ends.',
    },
    {
      name: 'Alt + Arrow down / Alt + Arrow up',
      description: 'Moves the focused item one place down or up. The item keeps the focus.',
    },
  ];
}
