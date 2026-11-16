import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import {
  StarAutoComplete,
  StarAutoCompleteSearch,
  StarMultiAutoComplete,
} from '@star-ng/ui/autocomplete';
import { StarField } from '@star-ng/ui/field';
import { StarOptionTemplate } from '@star-ng/ui/select';
import { DOCS, DocsRow } from '../shared/docs';

interface Person {
  readonly id: string;
  readonly name: string;
  readonly team: string;
}

@Component({
  selector: 'docs-autocomplete-page',
  imports: [
    DOCS,
    StarAutoComplete,
    StarMultiAutoComplete,
    StarOptionTemplate,
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

      <h2>Right-to-left</h2>
      <p>
        The suggestion list is aligned with the start edge of the field: the right edge in a
        right-to-left page. See the Right-to-left guide.
      </p>

      <docs-api
        [of]="[
          'StarAutoComplete',
          'StarMultiAutoComplete',
          'StarAutoCompleteBase',
          'StarOptionListBase',
        ]"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class AutocompletePage {
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

  protected readonly city = signal<string | null>(null);
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
    { name: 'Escape', description: 'Closes the list.' },
    {
      name: 'Tab',
      description: 'Closes the list and moves on. Text that is not an option is reset.',
    },
    { name: 'Backspace', description: 'Multiple: in an empty field it removes the last chip.' },
    { name: 'Home / End', description: 'Move the caret in the text, as in any text field.' },
  ];
}
