import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import {
  StarAutoComplete,
  StarAutoCompleteSearch,
  StarMultiAutoComplete,
} from '@star-ng/ui/autocomplete';
import { STAR_SLOTS } from '@star-ng/ui/core';
import { StarField } from '@star-ng/ui/field';
import { StarOptionTemplate } from '@star-ng/ui/select';
import { DOCS, DocsRow } from '../shared/docs';
import { lazyOrders } from '../shared/lazy-orders';

interface Person {
  readonly id: string;
  readonly name: string;
  readonly team: string;
}

interface OfficeCity {
  readonly code: string;
  readonly name: string;
  readonly country: string;
}

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './autocomplete.page.scss',
  selector: 'docs-autocomplete-page',
  imports: [
    DOCS,
    StarAutoComplete,
    StarMultiAutoComplete,
    StarOptionTemplate,
    STAR_SLOTS,
    StarField,
    FormField,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Autocomplete"
      lead="A text field with a list of suggestions (WAI-ARIA combobox with list autocomplete). It filters local options, or it asks a server through completeMethod. Only listed options can be chosen."
      importFrom="import { StarAutoComplete, StarMultiAutoComplete } from '@star-ng/ui/autocomplete';"
    >
      <docs-example
        heading="Local options"
        source="autocomplete/local"
        [script]="localScript"
        note="Type to filter options. The matching text is marked. Arrow down moves into the list, Enter chooses. Text that does not match an option goes back to the chosen label when the field loses focus."
      >
        <div class="docs-stack">
          <star-autocomplete
            [options]="cities"
            [(value)]="city"
            placeholder="Search a city"
            ariaLabel="City"
          />
          <p class="docs-output" role="status">City: {{ city() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Dropdown button and first result"
        source="autocomplete/dropdown"
        note="dropdown adds a button that lists all options. autoHighlight marks the first result, so Enter chooses it. showClear adds a clear button."
      >
        <star-autocomplete
          [options]="cities"
          [(value)]="dropdownCity"
          placeholder="Search a city"
          ariaLabel="City with dropdown"
          dropdown
          autoHighlight
          showClear
        />
      </docs-example>

      <docs-example
        heading="Objects, groups and template"
        source="autocomplete/objects"
        note="optionLabel, optionValue, optionGroup and a starOption template work as in star-select."
      >
        <star-autocomplete
          [options]="people"
          optionLabel="name"
          optionValue="id"
          optionGroup="team"
          [(value)]="person"
          placeholder="Search a person"
          ariaLabel="Person"
        >
          <ng-template starOption [starOptionOf]="people" let-item>
            <span>
              {{ item.name }}
              <small>{{ item.team }}</small>
            </span>
          </ng-template>
        </star-autocomplete>
      </docs-example>

      <docs-example
        heading="Async suggestions"
        source="autocomplete/async"
        [script]="asyncScript"
        note="completeMethod fires after the delay with the typed text. Load the results into suggestions and set loading while you wait. minQueryLength is the shortest text that searches (here 2). The example waits 400 ms to simulate a server."
      >
        <div class="docs-stack">
          <star-autocomplete
            [suggestions]="results()"
            [loading]="searching()"
            [minQueryLength]="2"
            [delay]="150"
            (completeMethod)="search($event)"
            optionLabel="name"
            optionValue="id"
            [(value)]="found"
            placeholder="Type 2 letters of a name"
            ariaLabel="Colleague"
            showClear
          />
          <p class="docs-output" role="status">Colleague: {{ found() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Loader function"
        source="autocomplete/loader"
        [script]="loaderScript"
        note="suggestionLoader takes a function of the typed text and an AbortSignal that returns a promise of the options. The control runs it through Angular resource(): it shows the loading state, aborts an older load when the text changes and shows the result. A failed load shows a message; type again to retry. Type 'zz' to see the failure. The example waits 400 ms to simulate a server."
      >
        <div class="docs-stack">
          <star-autocomplete
            [suggestionLoader]="findPeople"
            [minQueryLength]="2"
            [delay]="150"
            optionLabel="name"
            optionValue="id"
            [(value)]="loaded"
            placeholder="Type 2 letters of a name"
            ariaLabel="Colleague (loader)"
            showClear
          />
          <p class="docs-output" role="status">Colleague: {{ loaded() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Multiple"
        source="autocomplete/multiple"
        note="star-multi-autocomplete turns each choice into a removable chip. Backspace in an empty field removes the last chip. Chosen options leave the list. selectionLimit stops choices at a number."
      >
        <div class="docs-stack">
          <star-multi-autocomplete
            [options]="keywords"
            [(value)]="chosen"
            [selectionLimit]="4"
            placeholder="Add a keyword"
            ariaLabel="Keywords"
            dropdown
            autoHighlight
            showClear
          />
          <p class="docs-output" role="status">Keywords: {{ chosen().join(', ') || 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Large list"
        source="autocomplete/large"
        [script]="largeScript"
        note="virtualScroll renders only the lines in view. The dropdown button lists all 10,000 options. Arrow keys and Page keys reach options that are not in the DOM. Typing filters the list and shows it from the top."
      >
        <div class="docs-stack">
          <star-autocomplete
            [options]="tickets"
            [(value)]="ticket"
            placeholder="Search 10,000 tickets"
            ariaLabel="Ticket"
            virtualScroll
            dropdown
          />
          <p class="docs-output" role="status">Ticket: {{ ticket() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Signal Forms"
        source="autocomplete/form"
        [script]="formScript"
        note="Bind with formField. The value is null until the user chooses an option."
      >
        <div class="docs-stack">
          <star-field label="Assignee" for="autocomplete-form-assignee" [state]="task.assignee()">
            <star-autocomplete
              inputId="autocomplete-form-assignee"
              [formField]="task.assignee"
              [options]="people"
              optionLabel="name"
              optionValue="id"
              placeholder="Search a person"
              showClear
            />
          </star-field>
          <p class="docs-output" role="status">Valid: {{ task().valid() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Slots"
        source="autocomplete/slots"
        [script]="slotsScript"
        note="starHeader and starFooter sit above and below the list. A button there is in the tab order: Tab from the field moves to it. starEmpty gets the typed text. starGroup gets the label and the count. starLoading shows while loading is true: press Reload in the footer."
      >
        <div class="docs-stack">
          <star-autocomplete
            [options]="officeCities"
            [(value)]="officeCity"
            [loading]="officesLoading()"
            optionLabel="name"
            optionValue="code"
            optionGroup="country"
            placeholder="Search a city"
            ariaLabel="Office city"
          >
            <ng-template starHeader> Cities with an office </ng-template>
            <ng-template starGroup let-country let-count="count">
              {{ country }} ({{ count }})
            </ng-template>
            <ng-template starEmpty let-text>No city matches {{ text }}.</ng-template>
            <ng-template starLoading>
              <p class="docs-output">Loading the office list...</p>
            </ng-template>
            <ng-template starFooter>
              {{ officeCities.length }} cities
              <button
                type="button"
                class="star-btn star-btn--sm star-btn--ghost"
                (click)="reloadOffices()"
              >
                Reload
              </button>
            </ng-template>
          </star-autocomplete>
          <p class="docs-output" role="status">City: {{ officeCity() ?? 'none' }}</p>
        </div>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        The suggestion list is aligned with the start edge of the field: the right edge in a
        right-to-left page. See the Right-to-left guide.
      </p>

      <docs-example
        heading="Custom values"
        source="autocomplete/custom-values"
        note="With allowCustomValues the list ends with a row Add “text” when no option has the typed label. Choosing it adds the text as a chip and fires customValueAdd."
      >
        <div class="docs-stack">
          <star-multi-autocomplete
            [options]="keywords"
            [(value)]="customKeywords"
            allowCustomValues
            placeholder="Add a keyword"
            ariaLabel="Keywords with new ones"
            (customValueAdd)="lastKeyword.set($event)"
          />
          <p class="docs-output" role="status">
            Keywords: {{ customKeywords().join(', ') || 'none' }}. New:
            {{ lastKeyword() ?? 'none' }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Force selection"
        source="autocomplete/force-selection"
        note="With forceSelection, text that is no option label clears the field and the value when the field loses focus. Without it (the default) the text goes back to the label of the value. optionSelect and optionUnselect fire when an option is chosen or the value is cleared."
      >
        <div class="docs-stack">
          <star-autocomplete
            [options]="cities"
            [(value)]="forcedCity"
            forceSelection
            showClear
            placeholder="Type a city, then leave the field"
            ariaLabel="City, listed only"
            (optionSelect)="cityEvent.set('Selected ' + $event)"
            (optionUnselect)="cityEvent.set('Removed ' + $event)"
          />
          <p class="docs-output" role="status">
            City: {{ forcedCity() ?? 'none' }}. {{ cityEvent() }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Token entry"
        source="autocomplete/tokens"
        note="In star-multi-autocomplete, separator ends a chip while typing (here a comma or a semicolon), addOnTab makes a chip on Tab and keeps the focus in the field, and addOnBlur makes a chip when the field loses focus. The text must be an option label, or any text with allowCustomValues. unique off lets a keyword be chosen twice."
      >
        <div class="docs-stack">
          <star-multi-autocomplete
            [options]="keywords"
            [(value)]="tokens"
            [separator]="tokenSeparator"
            addOnTab
            addOnBlur
            allowCustomValues
            [unique]="false"
            placeholder="Type keywords, separated by commas"
            ariaLabel="Keywords as tokens"
          />
          <p class="docs-output" role="status">Keywords: {{ tokens().join(', ') || 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Lazy loading"
        source="autocomplete/lazy"
        [script]="lazyScript"
        note="lazy with virtualScroll asks for the suggestions in view through lazyLoad; the filter of the event is the typed text."
      >
        <div class="docs-stack">
          <star-autocomplete
            #lazyControl
            [options]="lazyList.options()"
            optionLabel="name"
            optionValue="id"
            [(value)]="lazyOrder"
            lazy
            virtualScroll
            dropdown
            placeholder="Type an order number"
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
        [of]="['StarAutoComplete', 'StarMultiAutoComplete']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class AutocompletePage {
  protected readonly forcedCity = signal<string | null>(null);
  protected readonly cityEvent = signal('');
  protected readonly tokens = signal<readonly string[]>([]);
  protected readonly tokenSeparator = /[,;]/;
  protected readonly customKeywords = signal<readonly string[]>([]);
  protected readonly lastKeyword = signal<string | null>(null);
  protected readonly lazyList = lazyOrders();
  protected readonly lazyOrder = signal<number | null>(null);
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
  protected readonly cities: readonly string[] = [
    'Amsterdam',
    'Berlin',
    'Bern',
    'Lisbon',
    'Madrid',
    'Mumbai',
    'Munich',
    'Pune',
  ];
  protected readonly keywords: readonly string[] = [
    'angular',
    'accessibility',
    'forms',
    'signals',
    'testing',
    'theming',
  ];
  protected readonly people: readonly Person[] = [
    { id: 'p1', name: 'Maria Lopez', team: 'Finance' },
    { id: 'p2', name: 'Mateo Rossi', team: 'Finance' },
    { id: 'p3', name: 'Priya Nair', team: 'Engineering' },
    { id: 'p4', name: 'Marek Novak', team: 'Engineering' },
    { id: 'p5', name: 'Sven Berg', team: 'Operations' },
  ];

  protected readonly tickets: readonly string[] = Array.from(
    { length: 10_000 },
    (_, index) => `Ticket ${String(index + 1).padStart(5, '0')}`,
  );

  protected readonly officeCities: readonly OfficeCity[] = [
    { code: 'BER', name: 'Berlin', country: 'Germany' },
    { code: 'PAR', name: 'Paris', country: 'France' },
    { code: 'PUN', name: 'Pune', country: 'India' },
  ];

  protected readonly city = signal<string | null>(null);
  protected readonly officeCity = signal<string | null>(null);
  protected readonly officesLoading = signal(false);
  private officesTimer: ReturnType<typeof setTimeout> | undefined;

  protected reloadOffices(): void {
    this.officesLoading.set(true);
    clearTimeout(this.officesTimer);
    this.officesTimer = setTimeout(() => this.officesLoading.set(false), 800);
  }

  protected readonly dropdownCity = signal<string | null>(null);
  protected readonly person = signal<string | null>(null);
  protected readonly chosen = signal<readonly string[]>([]);
  protected readonly ticket = signal<string | null>(null);

  protected readonly results = signal<readonly Person[]>([]);
  protected readonly searching = signal(false);
  protected readonly found = signal<string | null>(null);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected search(event: StarAutoCompleteSearch): void {
    const query = event.query.toLowerCase();
    this.searching.set(true);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.results.set(this.people.filter((item) => item.name.toLowerCase().includes(query)));
      this.searching.set(false);
    }, 400);
  }

  protected readonly loaded = signal<string | null>(null);
  /** Waits 400 ms like a server; the text 'zz' fails, to show the error state. */
  protected readonly findPeople = (query: string, abortSignal: AbortSignal) =>
    new Promise<readonly Person[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (query.toLowerCase() === 'zz') reject(new Error('The directory is not available.'));
        else
          resolve(
            this.people.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())),
          );
      }, 400);
      abortSignal.addEventListener('abort', () => clearTimeout(timer));
    });

  protected readonly taskModel = signal<{ assignee: string | null }>({ assignee: null });
  protected readonly task = form(this.taskModel, (path) => {
    required(path.assignee, { message: 'Choose an assignee.' });
  });

  protected readonly localScript = `readonly cities: readonly string[] = [
  'Amsterdam', 'Berlin', 'Bern', 'Lisbon', 'Madrid', 'Mumbai', 'Munich', 'Pune',
];
readonly city = signal<string | null>(null);`;
  protected readonly asyncScript = `readonly results = signal<readonly Person[]>([]);
readonly searching = signal(false);
readonly found = signal<string | null>(null);

search(event: StarAutoCompleteSearch): void {
  const query = event.query.toLowerCase();
  this.searching.set(true);
  // A real application calls its server here.
  setTimeout(() => {
    this.results.set(this.people.filter((item) => item.name.toLowerCase().includes(query)));
    this.searching.set(false);
  }, 400);
}`;
  protected readonly loaderScript = `readonly loaded = signal<string | null>(null);

// A real application calls its server here, for example with fetch(url, { signal: abortSignal }).
readonly findPeople = (query: string, abortSignal: AbortSignal) =>
  new Promise<readonly Person[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (query.toLowerCase() === 'zz') reject(new Error('The directory is not available.'));
      else resolve(this.people.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())));
    }, 400);
    abortSignal.addEventListener('abort', () => clearTimeout(timer));
  });`;
  protected readonly slotsScript = `// Import STAR_SLOTS from '@star-ng/ui/core' in the component imports.
readonly officeCities: readonly OfficeCity[] = [
  { code: 'BER', name: 'Berlin', country: 'Germany' },
  { code: 'PAR', name: 'Paris', country: 'France' },
  { code: 'PUN', name: 'Pune', country: 'India' },
];
readonly officeCity = signal<string | null>(null);
// starLoading follows this signal through [loading].
readonly officesLoading = signal(false);

reloadOffices(): void {
  this.officesLoading.set(true);
  // A real application loads the list from its server here.
  setTimeout(() => this.officesLoading.set(false), 800);
}`;
  protected readonly largeScript = `readonly tickets: readonly string[] = Array.from(
  { length: 10_000 },
  (_, index) => \`Ticket \${String(index + 1).padStart(5, '0')}\`,
);
readonly ticket = signal<string | null>(null);`;
  protected readonly formScript = `readonly taskModel = signal<{ assignee: string | null }>({ assignee: null });
readonly task = form(this.taskModel, (path) => {
  required(path.assignee, { message: 'Choose an assignee.' });
});`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starOption]',
      description:
        'Content child. Draws the text of one suggestion. The context has $implicit, selected and index. A template replaces the match highlight.',
    },
    {
      name: 'ng-template[starHeader]',
      description: 'Content child. Content at the top of the suggestion panel, above the list.',
    },
    {
      name: 'ng-template[starFooter]',
      description: 'Content child. Content at the bottom of the suggestion panel, below the list.',
    },
    {
      name: 'ng-template[starEmpty]',
      description: 'Content child. Replaces the empty message. $implicit is the typed text.',
    },
    {
      name: 'ng-template[starLoading]',
      description:
        'Content child. Shown while the loading input is true. Set loading while your completeMethod request runs.',
    },
    {
      name: 'ng-template[starGroup]',
      description:
        'Content child. Replaces the text of a group heading. $implicit is the label and count is the number of suggestions in the group.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-input-radius', description: 'Corner radius of the control.' },
    { name: '--star-border', description: 'Border of the control and the panel.' },
    { name: '--star-accent', description: 'Border of the focused control.' },
    { name: '--star-primary', description: 'Color of the marked match.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Letter keys', description: 'Type to search. The list opens at minQueryLength.' },
    {
      name: 'Arrow down / Arrow up',
      description: 'Opens the list, or moves the active suggestion.',
    },
    {
      name: 'Enter',
      description: 'Chooses the active suggestion. With a closed list it does nothing.',
    },
    {
      name: 'Page up / Page down',
      description:
        'With virtualScroll: moves the active suggestion by the lines in view, over all suggestions.',
    },
    {
      name: 'Escape',
      description:
        'Closes the list. From the panel header or footer, the focus goes back to the field.',
    },
    {
      name: 'Tab',
      description:
        'Closes the list and moves on. Text that is not an option is reset. When the panel header or footer has buttons or links, Tab moves to them first, and Tab after the last one closes the list.',
    },
    {
      name: 'Shift + Tab',
      description:
        'In the panel header or footer: moves to the previous button or link. From the first one, the focus goes back to the field and the list stays open.',
    },
    { name: 'Backspace', description: 'Multiple: in an empty field it removes the last chip.' },
    { name: 'Home / End', description: 'Move the caret in the text, as in any text field.' },
    {
      name: 'Tab (star-multi-autocomplete with addOnTab)',
      description: 'Makes a chip from the typed text and keeps the focus in the field.',
    },
  ];
}
