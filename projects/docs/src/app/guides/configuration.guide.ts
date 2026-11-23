import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarClock, StarFluid } from '@star-ng/ui/core';
import { StarField, StarInput } from '@star-ng/ui/field';
import { StarInputNumber } from '@star-ng/ui/input-number';
import { provideStarSelectDefaults, StarCascadeSelect, StarSelect } from '@star-ng/ui/select';
import { StarSelectButton } from '@star-ng/ui/select-button';
import { STAR_PIPES, StarCopy, StarKeyFilter } from '@star-ng/ui/utility';
import { DOCS, DocsRow } from '../shared/docs';

/** A select whose defaults come from `provideStarSelectDefaults` on this component. */
@Component({
  selector: 'docs-compact-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideStarSelectDefaults({ size: 'sm', filterMatchMode: 'startsWith' })],
  imports: [StarSelect, StarField],
  template: `
    <star-field label="City (starts with)">
      <star-select [options]="cities" [(value)]="city" filter placeholder="Choose a city" />
    </star-field>
  `,
})
export class DocsCompactSelect {
  protected readonly cities = ['Berlin', 'Bern', 'Lisbon', 'Madrid', 'Málaga', 'Oslo', 'Paris'];
  protected readonly city = signal<string | null>(null);
}

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './configuration.guide.scss',
  selector: 'docs-configuration-guide',
  imports: [
    DOCS,
    DocsCompactSelect,
    StarButton,
    StarField,
    StarInput,
    StarCopy,
    StarKeyFilter,
    STAR_PIPES,
    StarFluid,
    StarCascadeSelect,
    StarInputNumber,
    StarSelectButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Configuration"
      lead="Set the defaults of the controls once, for the whole application: provideStarNg for the common options, and a default token per control for the options of one control family. This page also shows the shared services, pipes and directives of the core and utility entry points."
      importFrom="import { provideStarNg } from '@star-ng/ui/core';"
    >
      <h2>Global configuration</h2>
      <p>
        Call <code>provideStarNg()</code> in the providers of the application. Every option is
        optional. It also sets up the UI texts (<code>uiText</code>), the direction service
        (<code>direction</code>) and the storage key of the theme (<code>themeStorageKey</code>), so
        the existing provider functions are not needed next to it. They stay public and keep
        working.
      </p>
      <docs-code [code]="setupCode" label="provideStarNg" />
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Options of provideStarNg
          </caption>
          <thead>
            <tr>
              <th scope="col">Option</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            @for (row of options; track row.name) {
              <tr>
                <th scope="row">
                  <code>{{ row.name }}</code>
                </th>
                <td>{{ row.description }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <h2>Precedence</h2>
      <ol>
        <li>An input that the template sets on a control wins.</li>
        <li>
          Then the default token of the control, for example <code>provideStarSelectDefaults</code>.
        </li>
        <li>Then <code>provideStarNg</code>.</li>
        <li>Then the built-in default of the control (the Default column of each API table).</li>
      </ol>
      <p>
        A control reads its defaults when it is created. <code>StarConfigService.update()</code>
        changes the configuration at run time: the motion switch and the z-index base follow at
        once, and controls that are created after the change use the new defaults.
      </p>
      <docs-code [code]="updateCode" label="StarConfigService" />

      <docs-example
        heading="Filled input"
        source="configuration/filled"
        note="inputVariant: 'filled' in provideStarNg gives every starInput and star-input-number this look. Here the variant input sets it on one field."
      >
        <div class="docs-stack docs-stack--narrow">
          <star-field label="Project name">
            <input starInput variant="filled" placeholder="North depot" />
          </star-field>
        </div>
      </docs-example>

      <h2>Default tokens per control</h2>
      <p>
        The default tokens follow the Material pattern (<code>MAT_SELECT_CONFIG</code>,
        <code>MAT_DIALOG_DEFAULT_OPTIONS</code>). Each token has only the inputs that applications
        commonly set once. Provide a token in the application config, or on one component to change
        only the controls inside it.
      </p>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Default tokens
          </caption>
          <thead>
            <tr>
              <th scope="col">Token and provider</th>
              <th scope="col">Entries</th>
            </tr>
          </thead>
          <tbody>
            @for (row of tokens; track row.name) {
              <tr>
                <th scope="row">
                  <code>{{ row.name }}</code>
                </th>
                <td>{{ row.description }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <docs-example
        heading="Defaults for one part of the page"
        source="configuration/select-defaults"
        [script]="selectDefaultsScript"
        note="The component provides provideStarSelectDefaults({ size: 'sm', filterMatchMode: 'startsWith' }). The select inside it is small, and its filter finds the cities that start with the typed text."
      >
        <div class="docs-stack docs-stack--narrow">
          <docs-compact-select />
        </div>
      </docs-example>

      <h2>Overlays and stacking</h2>
      <p>
        StarNG opens its popups in the top layer of the browser. The panels of the select family,
        the autocompletes, the date and time pickers, the dropdowns, the menus and context menus,
        the popover, the tooltip, the mention list and the color panel are native popovers (the CDK
        overlay with <code>usePopover</code>). The toast outlet is a manual popover. Modal dialogs,
        drawers and bottom sheets use <code>showModal()</code>. A top-layer element is above every
        <code>z-index</code> of the page and is not clipped by an ancestor with
        <code>overflow: hidden</code> or a <code>transform</code>. So StarNG needs no
        <code>appendTo="body"</code> and no <code>zIndex</code> option to keep a popup on top
        (PrimeNG needs them for that).
      </p>
      <p>
        <code>overlay.appendTo</code> (and the <code>appendTo</code> input of the select family)
        only chooses where the popover element is in the DOM. <code>self</code> (default) keeps it
        next to the control: it inherits the custom properties and the theme of its container, and
        its events bubble through the control. <code>body</code> puts it in the overlay container.
        The stacking is the same in both cases. Inside a modal <code>star-dialog</code>, menus go
        into the dialog, so they stay usable while the rest of the page is inert.
      </p>
      <p>
        <code>overlay.zIndexBase</code> (default 1000, the CSS variable
        <code>--star-z-index-base</code>) applies only to the surfaces that are not in the top
        layer: the CDK overlay container (used when the browser has no popover support), windows
        (<code>star-window</code>), non-modal dialogs, drawers and bottom sheets (one below the
        base, so a popup that they open stays on top), and the full-screen editor and the touch copy
        of <code>starDraggable</code> (above the base). Raise it when your own fixed header or side
        bar has a <code>z-index</code> above 1000.
      </p>

      <p>
        PrimeNG has an overlay primitive (<code>p-overlay</code>, with its own z-index and append
        options) under its popups. StarNG has none, on purpose: every popup is a native top-layer
        popover or a modal dialog, so the stacking needs no extra element.
      </p>

      <h2>Fluid layout</h2>
      <p>
        Under a fluid root, the form controls fill the inline size of their container (PrimeNG
        <code>p-fluid</code> and <code>fluid</code>). A fluid root is an element with the
        <code>starFluid</code> directive (from <code>@star-ng/ui/core</code>), or the whole page
        with <code>fluid: true</code> in <code>provideStarNg</code> (the attribute
        <code>data-star-fluid</code> on <code>&lt;html&gt;</code>). One shared style rule applies it
        to:
      </p>
      <ul>
        <li>
          the input fields (<code>starInput</code>), the select family (select, multi-select,
          autocomplete, cascade select, tree select, multi-column combobox, listbox), the date and
          time pickers, the color picker, input number, input mask, input tags and password;
        </li>
        <li>
          inside a <code>form</code> only: <code>star-button</code>,
          <code>star-select-button</code> and <code>star-toggle-button</code> (their items share the
          line).
        </li>
      </ul>
      <p>
        <code>starFluid="false"</code> (or <code>data-star-fluid="false"</code>) on a nearer element
        turns it off for all content below that element. Most field controls are block controls and
        fill their container also without a fluid root; the fluid root changes the compact ones,
        such as the cascade select and the buttons. <code>fluid: true</code> is also the default of
        the <code>fluid</code> input of the cascade select.
      </p>

      <docs-example
        heading="Fluid form"
        source="configuration/fluid"
        note='The form has starFluid: the cascade select, the input number, the select button and the button fill the line. The last row has starFluid="false": its button keeps its own width.'
      >
        <form
          starFluid
          class="docs-stack"
          aria-label="Fluid form"
          (submit)="$event.preventDefault()"
        >
          <star-cascade-select ariaLabel="Region" [options]="regions" optionLabel="name" />
          <star-input-number ariaLabel="Quantity" [value]="3" />
          <star-select-button ariaLabel="Delivery" [options]="deliveries" [value]="'Standard'" />
          <star-button type="submit">Save order</star-button>
          <div starFluid="false">
            <star-button variant="secondary" type="button">Cancel</star-button>
            <star-cascade-select
              fluid
              ariaLabel="Warehouse"
              [options]="regions"
              optionLabel="name"
            />
          </div>
        </form>
      </docs-example>

      <h2>Copy to the clipboard</h2>
      <p>
        <code>StarClipboard</code> copies text with <code>navigator.clipboard</code> and falls back
        to the CDK copy. On the server it does nothing. The <code>starCopy</code> directive copies
        on click, emits <code>copied</code> with true or false, and announces "Copied" (the
        <code>copied</code> UI text) through <code>StarAnnouncer</code>.
      </p>
      <docs-example
        heading="Copy button"
        source="configuration/copy"
        note="The result also goes to screen readers, so the status text below is only for sighted users."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button
              variant="secondary"
              leadingIcon="ph-bold ph-copy"
              starCopy="ORD-1042"
              (copied)="copied.set($event ? 'copied' : 'failed')"
            >
              Copy order id
            </star-button>
          </div>
          <p class="docs-output">Copy: {{ copied() }}</p>
        </div>
      </docs-example>

      <h2>Announcements</h2>
      <p>
        <code>StarAnnouncer</code> sends a message to screen readers through the CDK
        <code>LiveAnnouncer</code>. It announces the same message once when several parts of the
        page report it within one second. Use it for messages that have no visible place; a control
        with its own live region keeps it.
      </p>
      <docs-code [code]="announceCode" label="StarAnnouncer" />

      <h2>Pipes</h2>
      <p>
        The pipes are pure and run on the server. They take the locale from their argument, else
        from
        <code>locale</code> of <code>provideStarNg</code>, else the browser locale. Import them one
        by one or all with <code>STAR_PIPES</code> from <code>&#64;star-ng/ui/utility</code>.
      </p>
      <p>
        A pure pipe runs again only when its input or an argument changes. After
        <code>StarConfigService.update(&#123; locale &#125;)</code> a text that is already shown
        keeps the old locale until its value changes. To switch the language at run time, pass the
        locale as an argument from a signal:
        <code ngNonBindable>{{ size | starFileSize: locale() }}</code>.
      </p>
      <docs-example
        heading="File size, relative time, highlight and initials"
        source="configuration/pipes"
        [script]="pipesScript"
        note="starRelativeTime is pure: it gets the time from StarClock, a signal that moves every minute (provideStarClock changes the tick). starHighlight returns escaped text with mark elements, for [innerHTML]."
      >
        <div class="docs-stack">
          <ul class="docs-output">
            @for (file of files; track file.name) {
              <li>
                <span [innerHTML]="file.name | starHighlight: 'report'"></span>,
                {{ file.bytes | starFileSize: 'en-US' }}, changed
                {{ file.changed | starRelativeTime: clock.now() : 'en-US' }} by
                <abbr [title]="file.owner">{{ file.owner | starInitials }}</abbr>
              </li>
            }
          </ul>
        </div>
      </docs-example>

      <h2>Key filter</h2>
      <p>
        <code>starKeyFilter</code> lets the user type only some characters (PrimeNG
        <code>pKeyFilter</code>). Use a preset (<code>int</code>, <code>num</code>,
        <code>money</code>, <code>hex</code>, <code>alpha</code>, <code>alphanum</code>,
        <code>email</code>) or a regular expression for one character. A paste inserts only the
        allowed characters. An input method (IME) composition is never interrupted. With
        <code>validateOnly</code> nothing is blocked: the field gets an error instead.
      </p>
      <docs-example
        heading="Filtered fields"
        source="configuration/key-filter"
        note="The quantity takes digits and the minus sign, the color code takes 0-9 and a-f. The reference field only checks: type a space to see the error."
      >
        <div class="docs-stack docs-stack--narrow">
          <star-field label="Quantity">
            <input starInput starKeyFilter="int" inputmode="numeric" />
          </star-field>
          <star-field label="Color code (hex)">
            <input starInput starKeyFilter="hex" maxlength="6" />
          </star-field>
          <star-field
            label="Reference"
            [error]="referenceValid() ? '' : 'Use letters, digits and the underscore only.'"
          >
            <input
              starInput
              starKeyFilter="alphanum"
              validateOnly
              (validChange)="referenceValid.set($event)"
            />
          </star-field>
        </div>
      </docs-example>

      <h2>Accessibility</h2>
      <p>
        PrimeNG <code>p-motion</code> (enter and leave motion of an element) is covered by the
        <code>starAnimateOnScroll</code> directive and the reduced-motion helper
        <code>starPrefersReducedMotion</code>; both stop the motion for users who ask for less.
        <code>reducedMotion: 'always'</code> turns the StarNG transitions off for every user, as the
        <code>prefers-reduced-motion</code> setting does for one user. A filled input keeps the
        visible focus ring and the error border. The copy result and the key filter error reach
        screen readers: the first through the announcer, the second through the error of the field.
      </p>
    </docs-page>
  `,
})
export class ConfigurationGuide {
  protected readonly regions = [
    { name: 'North', children: [{ name: 'Harbour' }, { name: 'Hills' }] },
    { name: 'South', children: [{ name: 'Coast' }] },
  ];
  protected readonly deliveries = ['Standard', 'Express'];
  protected readonly clock = inject(StarClock);
  protected readonly copied = signal('none');
  protected readonly referenceValid = signal(true);

  private readonly minute = 60_000;
  protected readonly files = [
    {
      name: 'Quarterly report.pdf',
      bytes: 1_258_291,
      changed: this.clock.now() - 5 * this.minute,
      owner: 'Ana Ruiz',
    },
    {
      name: 'Invoice INV-2041.csv',
      bytes: 18_400,
      changed: this.clock.now() - 26 * 60 * this.minute,
      owner: 'Jonas Weber',
    },
    {
      name: 'Site photos.zip',
      bytes: 3_400_000_000,
      changed: this.clock.now() - 12 * 24 * 60 * this.minute,
      owner: 'Lea Martin',
    },
  ];

  protected readonly setupCode = `import { provideStarNg } from '@star-ng/ui/core';
import { STAR_UI_TEXT_DE } from '@star-ng/ui/i18n/de';

bootstrapApplication(App, {
  providers: [
    provideStarNg({
      inputVariant: 'filled',
      size: 'small',
      overlay: { appendTo: 'body', zIndexBase: 2000 },
      filterMatchMode: 'startsWith',
      reducedMotion: 'system',
      locale: 'de-DE',
      uiText: STAR_UI_TEXT_DE,
      direction: true,
      themeStorageKey: 'orders-theme',
    }),
  ],
});`;

  protected readonly updateCode = `const config = inject(StarConfigService);
config.config().locale;                      // a signal
config.update({ reducedMotion: 'always' });  // merges; overlay merges one level deeper`;

  protected readonly announceCode = `inject(StarAnnouncer).announce('Order ORD-1042 saved');
inject(StarAnnouncer).announce('The upload failed', 'assertive');`;

  protected readonly selectDefaultsScript = `@Component({
  selector: 'docs-compact-select',
  providers: [provideStarSelectDefaults({ size: 'sm', filterMatchMode: 'startsWith' })],
  imports: [StarSelect, StarField],
  template: \`
    <star-field label="City (starts with)">
      <star-select [options]="cities" [(value)]="city" filter placeholder="Choose a city" />
    </star-field>
  \`,
})
export class DocsCompactSelect {
  readonly cities = ['Berlin', 'Bern', 'Lisbon', 'Madrid', 'Málaga', 'Oslo', 'Paris'];
  readonly city = signal<string | null>(null);
}`;

  protected readonly pipesScript = `imports: [STAR_PIPES],

readonly clock = inject(StarClock);
readonly files = [
  { name: 'Quarterly report.pdf', bytes: 1_258_291, changed: Date.now() - 5 * 60_000, owner: 'Ana Ruiz' },
  // ...
];`;

  protected readonly options: readonly DocsRow[] = [
    {
      name: 'inputVariant',
      description:
        "'outlined' (default) or 'filled'. The default variant of starInput and star-input-number.",
    },
    {
      name: 'size',
      description:
        "'small', 'medium' or 'large'. Default size of the input, select family, date and time pickers and table. A control without that size keeps its own default.",
    },
    {
      name: 'overlay.appendTo',
      description:
        "'self' or 'body'. Default appendTo of the select family: where the popover element is in the DOM. Popups are in the top layer either way (see Overlays and stacking).",
    },
    {
      name: 'overlay.zIndexBase',
      description:
        'Base z-index of the overlay container (default 1000), as --star-z-index-base on the html element. Non-modal dialogs, drawers and sheets stay one below it.',
    },
    {
      name: 'filterMatchMode',
      description:
        'Default filterMatchMode of the select family and the listbox: contains, startsWith, endsWith, equals or notContains.',
    },
    {
      name: 'fluid',
      description:
        'true: form controls fill the width of their container (data-star-fluid on the html element), and the default of the fluid input. PrimeNG p-fluid. For one area, use the starFluid directive.',
    },
    {
      name: 'reducedMotion',
      description:
        "'system' (default) follows prefers-reduced-motion. 'always' turns the StarNG transitions and animations off.",
    },
    {
      name: 'locale',
      description:
        'Default locale of the date pickers, calendar, input number, chart, list and tree filters, and the pipes.',
    },
    { name: 'uiText', description: 'Overrides of the control texts, as provideStarUiText.' },
    {
      name: 'direction',
      description: 'true starts StarDirectionService, as provideStarDirection.',
    },
    {
      name: 'themeStorageKey',
      description: 'localStorage key of the theme choice, as STAR_THEME_STORAGE_KEY.',
    },
  ];

  protected readonly tokens: readonly DocsRow[] = [
    {
      name: 'STAR_SELECT_DEFAULTS, provideStarSelectDefaults',
      description:
        'appendTo, size, filterMatchMode, filterLocale, scrollHeight, showClear. Select, multi-select, autocompletes, cascade select (size, showClear) and listbox (filter, scrollHeight).',
    },
    {
      name: 'STAR_DATE_PICKER_DEFAULTS, provideStarDatePickerDefaults',
      description: 'locale, size, firstDayOfWeek, hourFormat, showButtonBar, showWeek.',
    },
    {
      name: 'STAR_TABLE_DEFAULTS, provideStarTableDefaults',
      description: 'size, striped, stickyHeader, rowsPerPageOptions.',
    },
    {
      name: 'STAR_DIALOG_DEFAULTS, provideStarDialogDefaults',
      description:
        'size, closable, closeOnEscape, dismissableMask. Dialog and drawer. confirmButtonOrder: order of the confirm buttons.',
    },
    {
      name: 'STAR_TOAST_DEFAULTS, provideStarToastDefaults',
      description: 'position, stackLimit, life (when show() sets no life).',
    },
  ];
}
