import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { StarField } from '@star-ng/ui/field';
import { StarCascadeOptionTemplate, StarCascadeSelect } from '@star-ng/ui/select';
import { DOCS, DocsRow } from '../shared/docs';

interface Place {
  readonly name: string;
  readonly code?: string;
  readonly closed?: boolean;
  readonly children?: readonly Place[];
}

@Component({
  selector: 'docs-cascade-select-page',
  imports: [DOCS, StarCascadeSelect, StarCascadeOptionTemplate, StarField, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Cascade select"
      lead="A dropdown for one leaf of nested options, for example country, state and city. The popup is a menu with submenus. The value is the leaf."
      importFrom="import { StarCascadeSelect } from '@star-ng/ui/select';"
    >
      <docs-example
        heading="Country, state and city"
        source="cascade-select/basic"
        [script]="basicScript"
        note="optionChildren is the property (or function) with the child options; it is children by default. An option without children is a leaf. The value comes from optionValue of the leaf."
      >
        <div class="docs-stack">
          <star-cascade-select
            [options]="places"
            optionLabel="name"
            optionValue="code"
            [(value)]="place"
            placeholder="Choose a city"
            ariaLabel="City"
          />
          <p class="docs-output" role="status">Value: {{ place() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Whole path and clear button"
        source="cascade-select/path"
        note="showPath shows 'Germany / Bavaria / Nuremberg' instead of the leaf label. showClear adds a button that sets the value to null."
      >
        <star-cascade-select
          [options]="places"
          optionLabel="name"
          optionValue="code"
          [(value)]="pathPlace"
          placeholder="Choose a city"
          ariaLabel="City with path"
          showPath
          showClear
        />
      </docs-example>

      <docs-example
        heading="Disabled options and states"
        source="cascade-select/states"
        note="optionDisabled marks an option that the user cannot choose. A disabled or read-only select does not open."
      >
        <div class="docs-stack">
          <star-cascade-select
            [options]="places"
            optionLabel="name"
            optionValue="code"
            optionDisabled="closed"
            placeholder="One city is closed"
            ariaLabel="City with a closed office"
          />
          <star-cascade-select
            [options]="places"
            optionLabel="name"
            optionValue="code"
            size="sm"
            disabled
            placeholder="Disabled"
            ariaLabel="Disabled city"
          />
        </div>
      </docs-example>

      <docs-example
        heading="Option template"
        source="cascade-select/option"
        [script]="optionScript"
        note="starCascadeOption replaces the label of each option, for parents and leaves. The context extends the one of starOption: $implicit, selected and index, plus level (1 for the top level) and hasChildren. Pass starCascadeOptionOf to type the option. The check icon and the submenu arrow stay. Do not put buttons or links in the template: the menu item is the focus target."
      >
        <div class="docs-stack">
          <star-cascade-select
            [options]="places"
            optionLabel="name"
            optionValue="code"
            [(value)]="templated"
            placeholder="Choose a city"
            ariaLabel="City with option template"
          >
            <ng-template
              starCascadeOption
              [starCascadeOptionOf]="places"
              let-place
              let-hasChildren="hasChildren"
            >
              @if (hasChildren) {
                <strong>{{ place.name }}</strong>
              } @else {
                {{ place.name }} ({{ place.code }})
              }
            </ng-template>
          </star-cascade-select>
          <p class="docs-output" role="status">Value: {{ templated() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Signal Forms"
        source="cascade-select/form"
        [script]="formScript"
        note="Bind with formField. Pass the field state to star-field."
      >
        <div class="docs-stack">
          <star-field label="Office city" for="cascade-form-city" [state]="office.city()">
            <star-cascade-select
              inputId="cascade-form-city"
              [formField]="office.city"
              [options]="places"
              optionLabel="name"
              optionValue="code"
              placeholder="Choose a city"
              showPath
            />
          </star-field>
          <p class="docs-output" role="status">Valid: {{ office().valid() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Loading, empty menu and events"
        source="cascade-select/events"
        [script]="eventsScript"
        note="loading shows a turning icon in place of the caret and sets aria-busy; the menu still opens. emptyMessage is the text of the menu when there are no options. optionGroupLabel names the field of a parent label when it differs from optionLabel. beforeShow, show, beforeHide and hide report the menu, and cleared the clear button. fluid fills the width. starSelected replaces the text of the chosen leaf, and starIcon with dropdown, clear or loading replaces that icon."
      >
        <div class="docs-stack">
          <star-cascade-select
            [options]="loadingPlaces() ? [] : places"
            optionLabel="name"
            optionValue="code"
            [(value)]="eventPlace"
            [loading]="loadingPlaces()"
            emptyMessage="The places are loading"
            ariaLabel="City while loading"
            showClear
            fluid
            (show)="menuLog.set('menu open')"
            (hide)="menuLog.set('menu closed')"
            (cleared)="menuLog.set('cleared')"
          />
          <div class="docs-row">
            <button
              type="button"
              class="star-btn star-btn--secondary star-btn--sm"
              (click)="loadingPlaces.set(!loadingPlaces())"
            >
              {{ loadingPlaces() ? 'Finish loading' : 'Load again' }}
            </button>
            <span class="docs-output" role="status">{{ menuLog() || 'No event yet' }}</span>
          </div>
        </div>
      </docs-example>

      <h2>Names in PrimeNG</h2>
      <p>
        The PrimeNG p-cascadeselect names that StarNG gives in another way: optionGroupChildren is
        optionChildren; dataKey is compareWith; id is inputId; onChange is valueChange and
        optionSelect; onGroupChange is groupChange; onClear is cleared; onFocus and onBlur are the
        native focusin and focusout events; variant is inputVariant of provideStarNg; the value
        template is starSelected and the option template starCascadeOption; panelStyle and
        panelStyleClass are the pass-through pt. Not needed: appendTo, overlayOptions and
        motionOptions (the menu is an overlay of the Angular CDK with theme motion) and the search
        options (searchLocale, searchMessage, emptySearchMessage, focusOnHover, selectOnFocus,
        autoOptionFocus: the menu has typeahead and the keyboard model of the CDK menu, not a search
        field).
      </p>

      <h2>Right-to-left</h2>
      <p>
        The list opens aligned with the start edge of the field. In a right-to-left page Arrow left
        opens a submenu and Arrow right returns to the parent option. See the Right-to-left guide.
      </p>

      <docs-api
        [of]="['StarCascadeSelect', 'StarCascadeOptionTemplate']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class CascadeSelectPage {
  protected readonly places: readonly Place[] = [
    {
      name: 'Germany',
      children: [
        {
          name: 'Bavaria',
          children: [
            { name: 'Munich', code: 'DE-MUC' },
            { name: 'Nuremberg', code: 'DE-NUE' },
          ],
        },
        { name: 'Hesse', children: [{ name: 'Frankfurt', code: 'DE-FRA' }] },
      ],
    },
    {
      name: 'India',
      children: [
        { name: 'Maharashtra', children: [{ name: 'Pune', code: 'IN-PNQ' }] },
        { name: 'Telangana', children: [{ name: 'Hyderabad', code: 'IN-HYD', closed: true }] },
      ],
    },
    { name: 'Remote', code: 'REMOTE' },
  ];

  protected readonly place = signal<string | null>(null);
  protected readonly pathPlace = signal<string | null>(null);
  protected readonly templated = signal<string | null>(null);
  protected readonly eventPlace = signal<string | null>(null);
  protected readonly loadingPlaces = signal(true);
  protected readonly menuLog = signal('');
  protected readonly eventsScript = `readonly eventPlace = signal<string | null>(null);
readonly loadingPlaces = signal(true);
readonly menuLog = signal('');`;

  protected readonly officeModel = signal<{ city: string | null }>({ city: null });
  protected readonly office = form(this.officeModel, (path) => {
    required(path.city, { message: 'Choose a city.' });
  });

  protected readonly basicScript = `readonly places: readonly Place[] = [
  {
    name: 'Germany',
    children: [
      {
        name: 'Bavaria',
        children: [
          { name: 'Munich', code: 'DE-MUC' },
          { name: 'Nuremberg', code: 'DE-NUE' },
        ],
      },
    ],
  },
  { name: 'Remote', code: 'REMOTE' },
];
readonly place = signal<string | null>(null);`;
  protected readonly optionScript = `// Import StarCascadeOptionTemplate in the component imports.
readonly places: readonly Place[] = [
  {
    name: 'Germany',
    children: [{ name: 'Bavaria', children: [{ name: 'Munich', code: 'DE-MUC' }] }],
  },
  { name: 'Remote', code: 'REMOTE' },
];
readonly templated = signal<string | null>(null);`;
  protected readonly formScript = `readonly officeModel = signal<{ city: string | null }>({ city: null });
readonly office = form(this.officeModel, (path) => {
  required(path.city, { message: 'Choose a city.' });
});`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starCascadeOption]',
      description:
        'Content child. Replaces the label of each option (PrimeNG #option template). The context has $implicit (the option), selected, index, level and hasChildren. No focusable elements. The check icon and the submenu arrow stay.',
    },
    {
      name: 'ng-template[starSelected]',
      description:
        'Content child. Replaces the text of the chosen leaf in the trigger; $implicit is the leaf option. PrimeNG value template.',
    },
    {
      name: 'ng-template[starIcon]',
      description:
        'Content child. "dropdown", "clear", "loading" or "group" (the submenu arrow) replaces that icon. PrimeNG triggericon, clearicon, loadingicon and groupicon.',
    },
    {
      name: 'ng-template[starHeader] / ng-template[starFooter]',
      description:
        'Content child. Content above or below the options in the menu, outside the menu role. No focusable elements: the menu owns the keyboard. PrimeNG header and footer templates.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-input-radius', description: 'Corner radius of the control.' },
    { name: '--star-border', description: 'Border of the control.' },
    { name: '--star-accent', description: 'Border of the focused control.' },
    { name: '--star-danger', description: 'Border of an invalid control.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Enter / Space / Arrow down', description: 'On the trigger: opens the menu.' },
    { name: 'Arrow up / Arrow down', description: 'Moves between the options of one level.' },
    { name: 'Arrow right', description: 'Opens the submenu of the focused option.' },
    { name: 'Arrow left', description: 'Closes a submenu and returns to its parent option.' },
    { name: 'Enter / Space', description: 'Chooses the focused leaf and closes the menu.' },
    {
      name: 'Letter keys',
      description: 'Typeahead: moves to the option that starts with the typed text.',
    },
    { name: 'Escape', description: 'Closes the menu. The focus returns to the trigger.' },
  ];
}
