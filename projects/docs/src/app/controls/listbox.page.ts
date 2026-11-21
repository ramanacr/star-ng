import { moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField, minLength } from '@angular/forms/signals';
import { STAR_SLOTS } from '@star-ng/ui/core';
import { StarField } from '@star-ng/ui/field';
import { StarListbox, StarListboxDropEvent } from '@star-ng/ui/listbox';
import { StarOptionTemplate } from '@star-ng/ui/select';
import { DOCS, DocsRow } from '../shared/docs';
import { lazyOrders } from '../shared/lazy-orders';

interface Queue {
  readonly id: string;
  readonly name: string;
  readonly site: string;
  readonly closed?: boolean;
}

interface Shipment {
  readonly id: number;
  readonly name: string;
  readonly region: string;
  readonly held: boolean;
}

interface City {
  readonly code: string;
  readonly name: string;
  readonly country: string;
}

const REGIONS = ['Central', 'East', 'North', 'South', 'West'];

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './listbox.page.scss',
  selector: 'docs-listbox-page',
  imports: [DOCS, StarListbox, StarOptionTemplate, STAR_SLOTS, StarField, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Listbox"
      lead="A list of choices that stays in the page. It chooses one value, or several with checkboxes. It has a filter, groups and option templates."
      importFrom="import { StarListbox } from '@star-ng/ui/listbox';"
    >
      <docs-example
        heading="Single choice"
        source="listbox/single"
        [script]="singleScript"
        note="The list has one tab stop. Arrow keys move the active option and choose it. Letters jump to the option that starts with the typed text."
      >
        <div class="docs-stack">
          <star-listbox
            [options]="queues"
            optionLabel="name"
            optionValue="id"
            [(value)]="queue"
            scrollHeight="12rem"
            ariaLabel="Queue"
          />
          <p class="docs-output" role="status">Queue: {{ queue() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Multiple with filter"
        source="listbox/multiple"
        note="multiple adds a checkbox to each row, and the value is an array. Space and Enter toggle the active option. filter adds a search field."
      >
        <div class="docs-stack">
          <star-listbox
            [options]="queues"
            optionLabel="name"
            optionValue="id"
            [(value)]="many"
            multiple
            filter
            scrollHeight="12rem"
            ariaLabel="Queues"
          />
          <p class="docs-output" role="status">Queues: {{ manyText() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Filter fields and match mode"
        source="listbox/filter-match"
        note="filterBy names the fields that the filter searches. filterMatchMode sets how the text must match, and filterLocale compares with the rules of a language (case and accents do not count). Here the filter finds a city by the start of its code or name."
      >
        <star-listbox
          [options]="cities"
          optionLabel="name"
          optionValue="code"
          [filterBy]="['code', 'name']"
          filterMatchMode="startsWith"
          filterLocale="de"
          [(value)]="matchedCity"
          filter
          scrollHeight="12rem"
          ariaLabel="City by code or name"
        />
      </docs-example>

      <docs-example
        heading="Groups and disabled options"
        source="listbox/groups"
        note="optionGroup shows headings. optionDisabled marks options that cannot be chosen; the keyboard does not choose them."
      >
        <star-listbox
          [options]="queues"
          optionLabel="name"
          optionValue="id"
          optionGroup="site"
          optionDisabled="closed"
          [(value)]="grouped"
          scrollHeight="14rem"
          ariaLabel="Queue by site"
        />
      </docs-example>

      <docs-example
        heading="Option template"
        source="listbox/template"
        note="A starOption template (from @star-ng/ui/select) draws each row."
      >
        <star-listbox
          [options]="queues"
          optionLabel="name"
          optionValue="id"
          [(value)]="templated"
          scrollHeight="12rem"
          ariaLabel="Queue with template"
        >
          <ng-template starOption [starOptionOf]="queues" let-item let-selected="selected">
            <span>
              {{ item.name }}
              <small>{{ item.site }}</small>
            </span>
          </ng-template>
        </star-listbox>
      </docs-example>

      <docs-example
        heading="Large list with virtual scroll"
        source="listbox/virtual"
        [script]="virtualScript"
        note="virtualScroll draws only the rows in and near the view, so 10,000 options stay fast. Every row has the height virtualItemSize (40 px by default) and the text stays on one line. Keys work over all options: End goes to the last one, Page up and Page down move by a page, and letters find an option that is far down. Try typing ord-07500."
      >
        <div class="docs-stack">
          <star-listbox
            [options]="invoiceNumbers"
            [(value)]="invoice"
            virtualScroll
            filter
            scrollHeight="16rem"
            ariaLabel="Invoice number"
          />
          <p class="docs-output" role="status">Invoice: {{ invoice() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Large list with groups and checkboxes"
        source="listbox/virtual-groups"
        [script]="virtualGroupsScript"
        note="Group headings are rows of the same height. With multiple, the choice stays when you scroll away and back. Every tenth option is disabled. The option template gets the same context as without virtual scroll."
      >
        <div class="docs-stack">
          <star-listbox
            [options]="shipments"
            optionLabel="name"
            optionValue="id"
            optionGroup="region"
            optionDisabled="held"
            [(value)]="picked"
            multiple
            virtualScroll
            [virtualItemSize]="36"
            scrollHeight="16rem"
            ariaLabel="Shipments"
          >
            <ng-template starOption [starOptionOf]="shipments" let-item let-selected="selected">
              {{ item.name }}
            </ng-template>
          </star-listbox>
          <p class="docs-output" role="status">Picked: {{ pickedCount() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Disabled"
        source="listbox/disabled"
        note="A disabled listbox takes no focus and does not change."
      >
        <star-listbox
          [options]="queues"
          optionLabel="name"
          optionValue="id"
          [value]="'intake'"
          disabled
          scrollHeight="8rem"
          ariaLabel="Disabled queue"
        />
      </docs-example>

      <docs-example
        heading="Signal Forms"
        source="listbox/form"
        [script]="formScript"
        note="Bind with formField. The rule here needs at least one choice. The listbox is a focusable list: it has no input id, so label it with ariaLabel."
      >
        <div class="docs-stack">
          <star-field label="Notify queues" [state]="alert.queues()">
            <star-listbox
              [formField]="alert.queues"
              [options]="queues"
              optionLabel="name"
              optionValue="id"
              multiple
              scrollHeight="10rem"
              ariaLabel="Notify queues"
            />
          </star-field>
          <p class="docs-output" role="status">Valid: {{ alert().valid() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Slots"
        source="listbox/slots"
        [script]="slotsScript"
        note="starHeader sits above the filter and starFooter below the list. starEmpty gets the filter text. starGroup gets the label and the count of options in the group after filtering."
      >
        <star-listbox
          [options]="cities"
          optionLabel="name"
          optionValue="code"
          optionGroup="country"
          [(value)]="city"
          scrollHeight="12rem"
          filter
          ariaLabel="City"
        >
          <ng-template starHeader> Cities with an office </ng-template>
          <ng-template starGroup let-country let-count="count">
            {{ country }} ({{ count }})
          </ng-template>
          <ng-template starEmpty let-text>No city matches {{ text }}.</ng-template>
          <ng-template starFooter> {{ cities.length }} cities </ng-template>
        </star-listbox>
      </docs-example>

      <docs-example
        heading="Check boxes and select all"
        source="listbox/checkbox"
        note="checkbox adds a check box to each option (aria-checked) and a Select all box above the list. It implies multiple. Select all works on the shown, enabled options and shows a mixed state when only some are chosen. A double-click on an option fires optionDblClick."
      >
        <div class="docs-stack">
          <star-listbox
            [options]="queues"
            optionLabel="name"
            optionValue="id"
            optionDisabled="closed"
            [(value)]="checkedQueues"
            checkbox
            filter
            scrollHeight="12rem"
            ariaLabel="Queues with check boxes"
            (optionDblClick)="lastOpened.set($event.option.name)"
          />
          <p class="docs-output" role="status">
            Queues: {{ checkedText() }}. Double-clicked: {{ lastOpened() ?? 'none' }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Drag and drop"
        source="listbox/dragdrop"
        [script]="dragScript"
        note="dragdrop reorders the options with the CDK drag and drop, and connectedTo lets options move into the other list. Alt + Arrow up and Alt + Arrow down move the active option with the keyboard, and a live region tells the new position. The listbox does not change its options: dropped gives the item, from, to (dropListData), previousIndex and index, ready for moveItemInArray and transferArrayItem."
      >
        <div class="docs-row">
          <star-listbox
            #availableList
            [options]="availableOrders()"
            [(value)]="availablePick"
            dragdrop
            dropListData="available"
            [connectedTo]="[plannedList]"
            scrollHeight="14rem"
            ariaLabel="Available orders"
            (dropped)="moveOrder($event)"
          />
          <star-listbox
            #plannedList
            [options]="plannedOrders()"
            [(value)]="plannedPick"
            dragdrop
            dropListData="planned"
            [connectedTo]="[availableList]"
            scrollHeight="14rem"
            ariaLabel="Planned orders"
            (dropped)="moveOrder($event)"
          />
        </div>
      </docs-example>

      <docs-example
        heading="Lazy loading"
        source="listbox/lazy"
        [script]="lazyScript"
        note="lazy with virtualScroll loads the rows in view through lazyLoad. The list has aria-busy while it shows rows that are not loaded."
      >
        <div class="docs-stack">
          <star-listbox
            #lazyControl
            [options]="lazyList.options()"
            optionLabel="name"
            optionValue="id"
            [(value)]="lazyOrder"
            lazy
            virtualScroll
            filter
            scrollHeight="14rem"
            ariaLabel="Order, loaded on demand"
            (lazyLoad)="lazyList.load($event)"
          />
          <p class="docs-output" role="status">Order: {{ lazyOrder() ?? 'none' }}</p>
          @if (lazyList.failed()) {
            <button
              type="button"
              class="star-btn star-btn--sm star-btn--ghost"
              (click)="lazyControl.resetLazy()"
            >
              Retry
            </button>
          }
        </div>
      </docs-example>

      <docs-api
        [of]="['StarListbox', 'StarOptionTemplate']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class ListboxPage {
  protected readonly checkedQueues = signal<string | readonly string[] | null>(['intake']);
  protected readonly lastOpened = signal<string | null>(null);
  protected checkedText(): string {
    const value = this.checkedQueues();
    return Array.isArray(value) && value.length ? value.join(', ') : 'none';
  }

  protected readonly availableOrders = signal<readonly string[]>([
    'Order 1001',
    'Order 1002',
    'Order 1003',
    'Order 1004',
  ]);
  protected readonly plannedOrders = signal<readonly string[]>(['Order 1005']);
  protected readonly availablePick = signal<string | readonly string[] | null>(null);
  protected readonly plannedPick = signal<string | readonly string[] | null>(null);

  /** Moves the order inside one list, or from one list into the other. */
  protected moveOrder(event: StarListboxDropEvent<string>): void {
    const lists = { available: this.availableOrders, planned: this.plannedOrders };
    const from = lists[event.from as keyof typeof lists];
    const to = lists[event.to as keyof typeof lists];
    if (from === to) {
      const items = [...from()];
      moveItemInArray(items, event.previousIndex, event.index);
      from.set(items);
      return;
    }
    const source = [...from()];
    const target = [...to()];
    transferArrayItem(source, target, event.previousIndex, event.index);
    from.set(source);
    to.set(target);
  }

  protected readonly dragScript = `// import { moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
readonly availableOrders = signal<readonly string[]>(['Order 1001', 'Order 1002', 'Order 1003']);
readonly plannedOrders = signal<readonly string[]>(['Order 1005']);

moveOrder(event: StarListboxDropEvent<string>): void {
  const lists = { available: this.availableOrders, planned: this.plannedOrders };
  const from = lists[event.from as keyof typeof lists];
  const to = lists[event.to as keyof typeof lists];
  if (from === to) {
    const items = [...from()];
    moveItemInArray(items, event.previousIndex, event.index);
    from.set(items);
    return;
  }
  const source = [...from()];
  const target = [...to()];
  transferArrayItem(source, target, event.previousIndex, event.index);
  from.set(source);
  to.set(target);
}`;
  protected readonly lazyList = lazyOrders();
  protected readonly lazyOrder = signal<number | readonly number[] | null>(null);
  protected readonly lazyScript = `// A fake order service (no network) and the list state, in lazy-orders.ts:
// fetchOrderPage({ first, last, filter }) waits 400 ms and returns { first, rows, total, filter }.
// lazyLoad asks for each range once, so the requests of one filter collect in a list and
// resource() loads the ranges that are not in the cache yet (an aborted load loses nothing).
export function lazyOrders() {
  const requests = signal<readonly StarListLazyLoadEvent[]>([]);
  const cache = new Map<number, LazyOrder>();
  let cacheFilter: string | null = null;
  let total = 0;
  const loaded = (r: StarListLazyLoadEvent) => {
    if (!total) return false;
    for (let i = r.first; i <= Math.min(r.last, total - 1); i++) if (!cache.has(i)) return false;
    return true;
  };
  const state = resource({
    params: () => (requests().length ? requests() : undefined),
    loader: async ({ params, abortSignal }) => {
      const filter = params[0].filter;
      if (filter !== cacheFilter) {
        cache.clear();
        cacheFilter = filter;
        total = 0;
      }
      const pages = await Promise.all(
        params.filter((r) => !loaded(r)).map((r) => fetchOrderPage(r, abortSignal)),
      );
      for (const page of pages) {
        total = page.total;
        page.rows.forEach((row, i) => cache.set(page.first + i, row));
      }
      return { filter, total, rows: new Map(cache) };
    },
  });
  // The full-length array, with undefined where an order is not loaded yet.
  const options = linkedSignal<LazyOrderState | undefined, readonly (LazyOrder | undefined)[]>({
    source: () => (state.hasValue() ? state.value() : undefined),
    computation: (next, previous) =>
      next ? Array.from({ length: next.total }, (_, i) => next.rows.get(i)) : (previous?.value ?? []),
  });
  const load = (event: StarListLazyLoadEvent) =>
    requests.update((list) =>
      list.length && list[0].filter === event.filter ? [...list, event] : [event],
    );
  // On an error, the page shows a Retry button: (click)="lazyControl.resetLazy()".
  return { options: options.asReadonly(), failed: computed(() => state.status() === 'error'), load };
}

readonly lazyList = lazyOrders();`;
  protected readonly queues: readonly Queue[] = [
    { id: 'intake', name: 'Intake', site: 'Berlin' },
    { id: 'billing', name: 'Billing', site: 'Berlin' },
    { id: 'support', name: 'Support', site: 'Pune' },
    { id: 'returns', name: 'Returns', site: 'Pune', closed: true },
    { id: 'partners', name: 'Partners', site: 'Lisbon' },
  ];

  protected readonly cities: readonly City[] = [
    { code: 'BER', name: 'Berlin', country: 'Germany' },
    { code: 'MUC', name: 'Munich', country: 'Germany' },
    { code: 'PAR', name: 'Paris', country: 'France' },
    { code: 'PUN', name: 'Pune', country: 'India' },
  ];
  protected readonly city = signal<string | readonly string[] | null>(null);
  protected readonly matchedCity = signal<string | readonly string[] | null>(null);

  protected readonly queue = signal<string | readonly string[] | null>(null);
  protected readonly many = signal<string | readonly string[] | null>(['billing']);
  protected readonly grouped = signal<string | readonly string[] | null>(null);
  protected readonly templated = signal<string | readonly string[] | null>(null);

  /** 10,000 invoice numbers, as plain strings: the string is label and value. */
  protected readonly invoiceNumbers: readonly string[] = Array.from(
    { length: 10_000 },
    (_, i) => `ORD-${String(i + 1).padStart(5, '0')}`,
  );
  protected readonly invoice = signal<string | readonly string[] | null>(null);

  /** 10,000 shipments in five regions; every tenth one is held and cannot be chosen. */
  protected readonly shipments: readonly Shipment[] = Array.from({ length: 10_000 }, (_, i) => ({
    id: i + 1,
    name: `Shipment ${i + 1}`,
    region: REGIONS[i % REGIONS.length],
    held: (i + 1) % 10 === 0,
  }));
  protected readonly picked = signal<number | readonly number[] | null>([]);

  protected pickedCount(): number {
    const value = this.picked();
    return Array.isArray(value) ? value.length : 0;
  }

  protected manyText(): string {
    const value = this.many();
    return Array.isArray(value) && value.length ? value.join(', ') : 'none';
  }

  protected readonly alertModel = signal<{ queues: readonly string[] }>({ queues: [] });
  protected readonly alert = form(this.alertModel, (path) => {
    minLength(path.queues, 1, { message: 'Select at least one queue.' });
  });

  protected readonly singleScript = `readonly queues: readonly Queue[] = [
  { id: 'intake', name: 'Intake', site: 'Berlin' },
  { id: 'billing', name: 'Billing', site: 'Berlin' },
  { id: 'support', name: 'Support', site: 'Pune' },
];
readonly queue = signal<string | readonly string[] | null>(null);`;
  protected readonly virtualScript = `readonly invoiceNumbers: readonly string[] = Array.from(
  { length: 10_000 },
  (_, i) => \`ORD-\${String(i + 1).padStart(5, '0')}\`,
);
readonly invoice = signal<string | readonly string[] | null>(null);`;
  protected readonly virtualGroupsScript = `readonly shipments: readonly Shipment[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: i + 1,
  name: \`Shipment \${i + 1}\`,
  region: REGIONS[i % REGIONS.length],
  held: (i + 1) % 10 === 0,
}));
readonly picked = signal<number | readonly number[] | null>([]);`;
  protected readonly slotsScript = `// Import STAR_SLOTS from '@star-ng/ui/core' in the component imports.
readonly cities: readonly City[] = [
  { code: 'BER', name: 'Berlin', country: 'Germany' },
  { code: 'MUC', name: 'Munich', country: 'Germany' },
  { code: 'PAR', name: 'Paris', country: 'France' },
  { code: 'PUN', name: 'Pune', country: 'India' },
];
readonly city = signal<string | readonly string[] | null>(null);`;
  protected readonly formScript = `readonly alertModel = signal<{ queues: readonly string[] }>({ queues: [] });
readonly alert = form(this.alertModel, (path) => {
  minLength(path.queues, 1, { message: 'Select at least one queue.' });
});`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starOption]',
      description:
        'Content child. Draws the text of one option row. The context has $implicit, selected and index.',
    },
    {
      name: 'ng-template[starHeader]',
      description: 'Content child. Content at the top of the listbox, above the filter.',
    },
    {
      name: 'ng-template[starFooter]',
      description: 'Content child. Content at the bottom of the listbox, below the list.',
    },
    {
      name: 'ng-template[starEmpty]',
      description: 'Content child. Replaces the empty message. $implicit is the filter text.',
    },
    {
      name: 'ng-template[starGroup]',
      description:
        'Content child. Replaces the text of a group heading. $implicit is the label and count is the number of options in the group after filtering.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-border', description: 'Border of the box.' },
    { name: '--star-radius-lg', description: 'Corner radius of the box.' },
    { name: '--star-accent', description: 'Border of the box when the list has focus.' },
    { name: '--star-focus-ring', description: 'Focus ring (box-shadow).' },
    { name: '--star-danger', description: 'Border of an invalid box.' },
    {
      name: '--star-item-size',
      description:
        'Row height with virtualScroll. Set by virtualItemSize (in px); do not set it yourself.',
    },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Arrow up / Arrow down',
      description: 'Moves the active option. In single mode it also chooses the option.',
    },
    { name: 'Home / End', description: 'Moves to the first or the last option.' },
    {
      name: 'Page up / Page down',
      description:
        'With virtualScroll only: moves the active option by the lines in view. Without it the browser scrolls the list.',
    },
    {
      name: 'Enter / Space',
      description: 'Chooses the active option, or toggles it in multiple mode.',
    },
    {
      name: 'Letter keys',
      description:
        'Typeahead: moves to the option that starts with the typed text. With virtualScroll it also finds options that are not drawn. Space chooses the active option and is not typed, so type labels without spaces.',
    },
    {
      name: 'Alt + Arrow up / Alt + Arrow down',
      description:
        'With dragdrop: moves the active option one place up or down (the dropped event). A live region tells the new position.',
    },
    {
      name: 'Tab',
      description: 'With checkbox: the Select all box is a tab stop before the list.',
    },
  ];
}
