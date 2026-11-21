import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { StarItemTemplate, StarOrderList } from '@star-ng/ui/data-display';
import { DOCS, DocsRow } from '../shared/docs';

interface Task {
  readonly id: number;
  readonly name: string;
}

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './order-list.page.scss',
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

      <docs-example
        heading="Header, filter and drag and drop"
        source="order-list/filter-drag"
        [script]="filterScript"
        note="header names the list. filter shows a search field (filterBy, filterMatchMode, filterLocale). dragdrop lets the mouse drag an item to the place of another item; the buttons and Alt with the arrow keys do the same without a mouse. selection is a two-way model of the selected item. reorder emits the moved item. controlsPosition puts the buttons at the end; stripedRows and scrollHeight change the look."
      >
        <div class="docs-stack">
          <star-order-list
            [(value)]="queue"
            [(selection)]="current"
            header="Delivery queue"
            filter
            dragdrop
            stripedRows
            controlsPosition="end"
            scrollHeight="12rem"
            (reorder)="moved.set($event.items.join(', '))"
          />
          <p class="docs-output" role="status">
            Selected: {{ current().join(', ') || 'none' }}. Last moved: {{ moved() || 'none' }}.
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Several selected items"
        source="order-list/multiple"
        [script]="multipleScript"
        note="selection is a two-way model of the selected items, in list order. Ctrl or Cmd and a click adds or removes an item, Shift and a click or Shift and an arrow key selects a range, and Space adds or removes the focused item. The buttons and Alt with the arrow keys move every selected item one step or to an end, and the items keep their order. A live message gives the new position of the first moved item."
      >
        <div class="docs-stack">
          <star-order-list
            [(value)]="batch"
            [(selection)]="batchSelection"
            ariaLabel="Batch order"
          />
          <p class="docs-output" role="status">
            Selected: {{ batchSelection().join(', ') || 'none' }}
          </p>
        </div>
      </docs-example>

      <h2>Names in PrimeNG</h2>
      <p>
        The PrimeNG p-orderlist names that StarNG gives in another way: the filter shows with filter
        (PrimeNG shows it when filterBy is set); onFilterEvent is listFilter; emptymessage and
        emptyfiltermessage are the one starEmpty slot (its context has the filter text);
        metaKeySelection is always on (a click selects one item, Ctrl or Cmd and a click adds);
        listStyle, style, buttonProps and the move...ButtonProps inputs are the pass-through pt;
        onFocus and onBlur are the native focusin and focusout events. Not needed: tabindex and
        autoOptionFocus (every item is a tab stop), trackBy and dataKey (items are compared by
        identity), responsive and breakpoint (the list and its buttons stay side by side; they are
        narrow).
      </p>

      <docs-api
        [of]="['StarOrderList', 'StarItemTemplate', 'StarListFilterTemplate']"
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

  protected readonly queue = signal<readonly string[]>([
    'Order 1041',
    'Order 1042',
    'Order 1043',
    'Order 1044',
    'Order 1045',
  ]);
  protected readonly current = signal<readonly string[]>([]);
  protected readonly batch = signal<readonly string[]>(['Pack', 'Label', 'Weigh', 'Load', 'Ship']);
  protected readonly batchSelection = signal<readonly string[]>(['Label', 'Load']);
  protected readonly multipleScript = `readonly batch = signal<readonly string[]>(['Pack', 'Label', 'Weigh', 'Load', 'Ship']);
readonly batchSelection = signal<readonly string[]>(['Label', 'Load']);`;
  protected readonly moved = signal('');
  protected readonly filterScript = `readonly queue = signal<readonly string[]>(['Order 1041', 'Order 1042', 'Order 1043', 'Order 1044', 'Order 1045']);
readonly current = signal<readonly string[]>([]);
readonly moved = signal('');`;
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
    {
      name: 'ng-template[starHeader]',
      description: 'Content child. Replaces the header text. PrimeNG header template.',
    },
    {
      name: 'ng-template[starListFilter]',
      description:
        'Content child, with filter. Replaces the filter field. The context has $implicit (the filter text), filter(text) and reset(). PrimeNG filter template.',
    },
    {
      name: 'ng-template[starEmpty]',
      description:
        'Content child. Replaces the empty message. $implicit is the filter text. PrimeNG emptymessage and emptyfiltermessage.',
    },
    {
      name: 'ng-template[starIcon]',
      description:
        'Content child. Replaces the icon of a button: moveTop, moveUp, moveDown or moveBottom. PrimeNG movetopicon and the other icon templates.',
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
    {
      name: 'Tab',
      description:
        'Every item is a tab stop. Focusing an item selects it while at most one item is selected.',
    },
    { name: 'Space', description: 'Adds the focused item to the selection or removes it.' },
    {
      name: 'Shift + Arrow down / Shift + Arrow up',
      description: 'Selects the range from the last chosen item to the next or previous item.',
    },
    {
      name: 'Ctrl or Cmd + click / Shift + click',
      description: 'Adds or removes one item / selects a range.',
    },
    {
      name: 'Arrow down / Arrow up',
      description: 'Moves the focus to the next or the previous item. It stops at the ends.',
    },
    {
      name: 'Alt + Arrow down / Alt + Arrow up',
      description:
        'Moves the selected items (or the focused item) one place down or up. The focus stays on the item.',
    },
  ];
}
