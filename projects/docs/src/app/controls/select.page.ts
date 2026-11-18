import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { STAR_SLOTS } from '@star-ng/ui/core';
import { StarField } from '@star-ng/ui/field';
import {
  StarOptionTemplate,
  StarSelect,
  StarSelectedTemplate,
  StarSelectionChangingEvent,
} from '@star-ng/ui/select';
import { DOCS, DocsRow } from '../shared/docs';
import { lazyOrders } from '../shared/lazy-orders';

interface Country {
  readonly code: string;
  readonly name: string;
  readonly region: string;
  readonly closed?: boolean;
}

interface City {
  readonly code: string;
  readonly name: string;
  readonly country: string;
}

interface Shipment {
  readonly id: number;
  readonly name: string;
  readonly region: string;
}

@Component({
  selector: 'docs-select-page',
  imports: [
    DOCS,
    StarSelect,
    StarOptionTemplate,
    StarSelectedTemplate,
    STAR_SLOTS,
    StarField,
    FormField,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Select"
      lead="A dropdown for one choice. It is a select-only combobox (WAI-ARIA) with a listbox panel: typed options, filter, groups, option templates, a clear button, a loading state and virtual scroll for long lists."
      importFrom="import { StarSelect, StarOptionTemplate } from '@star-ng/ui/select';"
    >
      <docs-example
        heading="Objects as options"
        source="select/basic"
        [script]="basicScript"
        note="optionLabel and optionValue take a property name or a function. Without optionValue the value is the whole option. Without optionLabel the option itself is the text."
      >
        <div class="docs-stack">
          <star-select
            [options]="countries"
            optionLabel="name"
            optionValue="code"
            [(value)]="country"
            placeholder="Select a country"
            ariaLabel="Country"
          />
          <p class="docs-output" role="status">Country: {{ country() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Filter and clear button"
        source="select/filter"
        note="filter adds a search field at the top of the panel. showClear adds a button that sets the value to null."
      >
        <div class="docs-stack">
          <star-select
            [options]="countries"
            optionLabel="name"
            optionValue="code"
            [(value)]="filtered"
            placeholder="Search a country"
            ariaLabel="Country with filter"
            filter
            showClear
          />
          <p class="docs-output" role="status">Filtered: {{ filtered() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Filter fields and match mode"
        source="select/filter-match"
        note="filterBy names the fields that the filter searches (here the code and the name). filterMatchMode sets how the text must match: contains (default), startsWith, endsWith, equals or notContains. filterLocale compares with the rules of a language (Intl.Collator, sensitivity base): case and accents do not count. With resetFilterOnHide off, the filter text stays for the next opening."
      >
        <div class="docs-stack">
          <star-select
            [options]="cities"
            optionLabel="name"
            optionValue="code"
            [filterBy]="['code', 'name']"
            filterMatchMode="startsWith"
            filterLocale="de"
            [resetFilterOnHide]="false"
            [(value)]="matchedCity"
            placeholder="Type a code or a name"
            ariaLabel="City by code or name"
            filter
          />
          <p class="docs-output" role="status">City: {{ matchedCity() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Groups"
        source="select/groups"
        note="optionGroup is the property (or function) with the group heading. Options of one group show together, in the order in which the headings first appear."
      >
        <star-select
          [options]="countries"
          optionLabel="name"
          optionValue="code"
          optionGroup="region"
          [(value)]="grouped"
          placeholder="Grouped by region"
          ariaLabel="Country by region"
        />
      </docs-example>

      <docs-example
        heading="Disabled options"
        source="select/disabled-options"
        note="optionDisabled marks options that the user cannot choose. The keyboard skips them."
      >
        <star-select
          [options]="countries"
          optionLabel="name"
          optionValue="code"
          optionDisabled="closed"
          [(value)]="open"
          placeholder="Offices (one is closed)"
          ariaLabel="Office"
        />
      </docs-example>

      <docs-example
        heading="Option template"
        source="select/template"
        [script]="templateScript"
        note="A star-select content child ng-template with starOption draws each row. The context has the option, selected and index. Pass starOptionOf to type the option."
      >
        <star-select
          [options]="countries"
          optionLabel="name"
          optionValue="code"
          [(value)]="templated"
          placeholder="Select a country"
          ariaLabel="Country with template"
        >
          <ng-template starOption [starOptionOf]="countries" let-item>
            <span>
              {{ item.name }}
              <small>{{ item.region }}</small>
            </span>
          </ng-template>
        </star-select>
      </docs-example>

      <docs-example
        heading="Virtual scroll"
        source="select/virtual"
        [script]="virtualScript"
        note="virtualScroll renders only the lines in view. Every line has the height virtualItemSize (40 px by default) and the text stays on one line. End goes to the last of 5,000 options."
      >
        <star-select
          [options]="orders"
          [(value)]="order"
          placeholder="5,000 orders"
          ariaLabel="Order"
          virtualScroll
          filter
        />
      </docs-example>

      <docs-example
        heading="Large list with groups"
        source="select/large"
        [script]="largeScript"
        note="virtualScroll also works with optionGroup and filter. Headings are lines of the same height. Arrow keys, Home, End, Page up, Page down and type-ahead reach all 10,000 options, also those that are not in the DOM. The selected option is in view when the panel opens."
      >
        <div class="docs-stack">
          <star-select
            [options]="shipments"
            optionLabel="name"
            optionValue="id"
            optionGroup="region"
            [(value)]="shipment"
            placeholder="10,000 shipments"
            ariaLabel="Shipment"
            virtualScroll
            filter
          />
          <p class="docs-output" role="status">Shipment: {{ shipment() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Sizes and states"
        source="select/states"
        note="loading shows a spinner in place of the caret. A disabled select takes no focus. A read-only select keeps its value and does not open."
      >
        <div class="docs-stack">
          <star-select [options]="regions" size="sm" placeholder="Small" ariaLabel="Small select" />
          <star-select [options]="regions" disabled placeholder="Disabled" ariaLabel="Disabled" />
          <star-select [options]="regions" [value]="'EMEA'" readonly ariaLabel="Read-only" />
          <star-select [options]="[]" loading placeholder="Loading options" ariaLabel="Loading" />
        </div>
      </docs-example>

      <docs-example
        heading="Slots"
        source="select/slots"
        [script]="slotsScript"
        note="Content child templates change parts of the control. starHeader and starFooter add content to the panel. Buttons and links there are in the tab order of the open panel. starEmpty gets the filter text. starGroup gets the label and the count. starSelected draws the chosen value in the trigger. starIcon replaces one icon."
      >
        <star-select
          [options]="cities"
          optionLabel="name"
          optionValue="code"
          optionGroup="country"
          [(value)]="city"
          placeholder="Select a city"
          ariaLabel="City"
          filter
          showClear
        >
          <ng-template starHeader>
            <p class="docs-output">Cities with an office</p>
          </ng-template>
          <ng-template starGroup let-country let-count="count">
            {{ country }} ({{ count }})
          </ng-template>
          <ng-template starEmpty let-text>No city matches {{ text }}.</ng-template>
          <ng-template starSelected [starSelectedOf]="cities" let-item>
            {{ item.code }} · {{ item.name }}
          </ng-template>
          <ng-template starFooter>
            <p class="docs-output">{{ cities.length }} cities</p>
          </ng-template>
        </star-select>
      </docs-example>

      <docs-example
        heading="Signal Forms"
        source="select/form"
        [script]="formScript"
        note="star-select is a Signal Forms control: bind it with formField. Pass the field state to star-field and the error shows after the user leaves the control."
      >
        <div class="docs-stack">
          <star-field label="Office country" for="select-form-country" [state]="office.country()">
            <star-select
              inputId="select-form-country"
              [formField]="office.country"
              [options]="countries"
              optionLabel="name"
              optionValue="code"
              placeholder="Select a country"
              ariaLabel="Office country"
              showClear
            />
          </star-field>
          <p class="docs-output" role="status">Valid: {{ office().valid() }}</p>
        </div>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        The panel is aligned with the start edge of the field: the right edge in a right-to-left
        page. See the Right-to-left guide.
      </p>

      <docs-example
        heading="Editable"
        source="select/editable"
        note="editable makes the trigger a text field (a combobox with list autocomplete). The typed text filters the options; Enter or leaving the field chooses the option with that exact label. With allowCustomValue other text becomes the value and customValue fires; without it, the text goes back to the label of the value."
      >
        <div class="docs-stack">
          <star-select
            [options]="cities"
            optionLabel="name"
            optionValue="code"
            [(value)]="editedCity"
            editable
            allowCustomValue
            showClear
            placeholder="Type or choose a city"
            ariaLabel="City, editable"
            (customValue)="lastCustom.set($event)"
          />
          <p class="docs-output" role="status">
            Value: {{ editedCity() ?? 'none' }}. Last custom text: {{ lastCustom() ?? 'none' }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Cancelable selection"
        source="select/selection-changing"
        note="selectionChanging fires before the value changes, with previous and next. Call cancel() on the event to keep the old value. Here the handler refuses Paris."
      >
        <div class="docs-stack">
          <star-select
            [options]="cities"
            optionLabel="name"
            optionValue="code"
            [(value)]="guardedCity"
            placeholder="Select a city (not Paris)"
            ariaLabel="City, Paris refused"
            (selectionChanging)="guardCity($event)"
          />
          <p class="docs-output" role="status">
            City: {{ guardedCity() ?? 'none' }}. {{ guardMessage() }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Lazy loading"
        source="select/lazy"
        [script]="lazyScript"
        note="lazy with virtualScroll loads the options page by page. The options array has the full length and holds undefined for the options that are not loaded: they show as loading rows, and the keyboard skips them. lazyLoad gives first, last and the filter text; here an Angular resource() loads the page from a fake service. The filter does not filter in the browser: the service gets the text."
      >
        <div class="docs-stack">
          <star-select
            [options]="lazyList.options()"
            optionLabel="name"
            optionValue="id"
            [(value)]="lazyOrder"
            lazy
            virtualScroll
            filter
            placeholder="Select an order"
            ariaLabel="Order, loaded on demand"
            (lazyLoad)="lazyList.load($event)"
          />
          <p class="docs-output" role="status">Order: {{ lazyOrder() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarSelect', 'StarOptionListBase', 'StarOptionTemplate', 'StarSelectedTemplate']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />

      <h2>Technical notes</h2>
      <p>
        The panel is a native popover placed by the Angular CDK overlay, so it also works inside a
        modal dialog. The select is the PrimeNG <code>p-select</code> equivalent. The focus stays on
        the combobox: the active option is named by <code>aria-activedescendant</code>.
      </p>
    </docs-page>
  `,
})
export class SelectPage {
  protected readonly guardedCity = signal<string | null>(null);
  protected readonly guardMessage = signal('');

  protected guardCity(event: StarSelectionChangingEvent<string | null>): void {
    if (event.next === 'PAR') {
      event.cancel();
      this.guardMessage.set('Paris was refused.');
    } else {
      this.guardMessage.set('');
    }
  }
  protected readonly editedCity = signal<string | null>(null);
  protected readonly lastCustom = signal<string | null>(null);
  protected readonly lazyList = lazyOrders();
  protected readonly lazyOrder = signal<number | null>(null);
  protected readonly lazyScript = `// A fake order service (no network) and the list state, in lazy-orders.ts:
// fetchOrderPage({ first, last, filter }) waits 400 ms and returns { first, rows, total, filter }.
export function lazyOrders() {
  const request = signal<StarLazyLoadEvent | undefined>(undefined);
  const page = resource({
    params: request,
    loader: ({ params, abortSignal }) => fetchOrderPage(params, abortSignal),
  });
  // The full-length array, with undefined where a page is not loaded yet.
  const options = linkedSignal<LazyOrderPage | undefined, readonly (LazyOrder | undefined)[]>({
    source: () => (page.hasValue() ? page.value() : undefined),
    computation: (next, previous) => {
      if (!next) return previous?.value ?? [];
      const keep = previous?.source?.filter === next.filter && previous.value.length === next.total;
      const rows = keep ? [...previous.value] : Array.from<LazyOrder | undefined>({ length: next.total });
      next.rows.forEach((row, i) => (rows[next.first + i] = row));
      return rows;
    },
  });
  return { options: options.asReadonly(), load: (event: StarLazyLoadEvent) => request.set(event) };
}

readonly lazyList = lazyOrders();`;
  protected readonly countries: readonly Country[] = [
    { code: 'DE', name: 'Germany', region: 'Europe' },
    { code: 'FR', name: 'France', region: 'Europe' },
    { code: 'IN', name: 'India', region: 'Asia' },
    { code: 'JP', name: 'Japan', region: 'Asia', closed: true },
    { code: 'BR', name: 'Brazil', region: 'Americas' },
    { code: 'CA', name: 'Canada', region: 'Americas' },
  ];
  protected readonly regions = ['EMEA', 'APAC', 'Americas'];
  protected readonly cities: readonly City[] = [
    { code: 'BER', name: 'Berlin', country: 'Germany' },
    { code: 'MUC', name: 'Munich', country: 'Germany' },
    { code: 'PAR', name: 'Paris', country: 'France' },
    { code: 'LYS', name: 'Lyon', country: 'France' },
    { code: 'PUN', name: 'Pune', country: 'India' },
  ];
  protected readonly orders: readonly string[] = Array.from(
    { length: 5000 },
    (_, index) => `Order ${String(index + 1).padStart(5, '0')}`,
  );

  protected readonly shipments: readonly Shipment[] = Array.from(
    { length: 10_000 },
    (_, index) => ({
      id: index + 1,
      name: `Shipment ${index + 1}`,
      region: ['North', 'South', 'East', 'West', 'Central'][Math.floor(index / 2000)],
    }),
  );

  protected readonly country = signal<string | null>(null);
  protected readonly filtered = signal<string | null>(null);
  protected readonly grouped = signal<string | null>(null);
  protected readonly open = signal<string | null>(null);
  protected readonly templated = signal<string | null>(null);
  protected readonly order = signal<string | null>(null);
  protected readonly city = signal<string | null>(null);
  protected readonly matchedCity = signal<string | null>(null);
  protected readonly shipment = signal<number | null>(null);

  protected readonly officeModel = signal<{ country: string | null }>({ country: null });
  protected readonly office = form(this.officeModel, (path) => {
    required(path.country, { message: 'Select a country.' });
  });

  protected readonly basicScript = `readonly countries: readonly Country[] = [
  { code: 'DE', name: 'Germany', region: 'Europe' },
  { code: 'FR', name: 'France', region: 'Europe' },
  { code: 'IN', name: 'India', region: 'Asia' },
];
readonly country = signal<string | null>(null);`;
  protected readonly templateScript = `// Import StarOptionTemplate in the component imports.
readonly countries: readonly Country[] = [
  { code: 'DE', name: 'Germany', region: 'Europe' },
  { code: 'IN', name: 'India', region: 'Asia' },
];`;
  protected readonly slotsScript = `// Import STAR_SLOTS from '@star-ng/ui/core' and StarSelectedTemplate in the component imports.
readonly cities: readonly City[] = [
  { code: 'BER', name: 'Berlin', country: 'Germany' },
  { code: 'PAR', name: 'Paris', country: 'France' },
  { code: 'PUN', name: 'Pune', country: 'India' },
];
readonly city = signal<string | null>(null);`;
  protected readonly virtualScript = `readonly orders: readonly string[] = Array.from(
  { length: 5000 },
  (_, index) => \`Order \${String(index + 1).padStart(5, '0')}\`,
);`;
  protected readonly largeScript = `readonly shipments: readonly Shipment[] = Array.from({ length: 10_000 }, (_, index) => ({
  id: index + 1,
  name: \`Shipment \${index + 1}\`,
  region: ['North', 'South', 'East', 'West', 'Central'][Math.floor(index / 2000)],
}));
readonly shipment = signal<number | null>(null);`;
  protected readonly formScript = `readonly officeModel = signal<{ country: string | null }>({ country: null });
readonly office = form(this.officeModel, (path) => {
  required(path.country, { message: 'Select a country.' });
});`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starOption]',
      description:
        'Content child. Draws one option row. The context has $implicit (the option), selected and index.',
    },
    {
      name: 'ng-template[starSelected]',
      description:
        'Content child. Replaces the label in the trigger when a value is chosen. $implicit is the chosen option. The placeholder still shows without a value.',
    },
    {
      name: 'ng-template[starHeader]',
      description: 'Content child. Content at the top of the panel, above the filter.',
    },
    {
      name: 'ng-template[starFooter]',
      description: 'Content child. Content at the bottom of the panel, below the list.',
    },
    {
      name: 'ng-template[starEmpty]',
      description: 'Content child. Replaces the empty message. $implicit is the filter text.',
    },
    {
      name: 'ng-template[starLoading]',
      description: 'Content child. A row at the top of the list while loading is on.',
    },
    {
      name: 'ng-template[starGroup]',
      description:
        'Content child. Replaces the text of a group heading. $implicit is the label and count is the number of options in the group after filtering.',
    },
    {
      name: 'ng-template[starIcon]',
      description:
        'Content child. Replaces one icon. Set starIcon to dropdown, clear, filter or check.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-input-radius', description: 'Corner radius of the control.' },
    { name: '--star-border', description: 'Border of the control and the panel.' },
    { name: '--star-surface-muted', description: 'Background of the control at rest.' },
    { name: '--star-accent', description: 'Border of the focused control.' },
    { name: '--star-focus-ring', description: 'Focus ring (box-shadow).' },
    { name: '--star-danger', description: 'Border of an invalid control.' },
    { name: '--star-primary', description: 'Check mark of the chosen option.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Enter / Space / Arrow down', description: 'On the trigger: opens the panel.' },
    {
      name: 'Arrow up / Arrow down',
      description: 'Moves the active option. Disabled options are skipped.',
    },
    { name: 'Home / End', description: 'Moves to the first or the last enabled option.' },
    {
      name: 'Page up / Page down',
      description:
        'With virtualScroll: moves the active option by the lines in view, over all options. Disabled options are skipped.',
    },
    { name: 'Enter / Space', description: 'Chooses the active option and closes the panel.' },
    { name: 'Alt + Arrow up', description: 'Chooses the active option and closes the panel.' },
    {
      name: 'Letter keys',
      description:
        'Typeahead: moves to the option that starts with the typed text. On a closed select it also chooses it. A space in the middle of the typed text belongs to the text.',
    },
    {
      name: 'Escape',
      description:
        'Closes the panel. The focus stays on the trigger, or goes back to it from the panel header or footer.',
    },
    {
      name: 'Tab',
      description:
        'Closes the panel and moves the focus on. When the panel header or footer has buttons or links, Tab moves to them first, and Tab after the last one closes the panel.',
    },
    {
      name: 'Shift + Tab',
      description:
        'In the panel header or footer: moves to the previous button or link. From the first one, the focus goes back to the trigger (or the filter field) and the panel stays open.',
    },
  ];
}
