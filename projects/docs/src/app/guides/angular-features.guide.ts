import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { DOCS } from '../shared/docs';

/** One row of the feature matrix. Text between backticks shows as code. */
interface FeatureRow {
  readonly feature: string;
  /** Since which Angular version the feature is stable (or its status in Angular 22). */
  readonly since: string;
  readonly library: string;
  readonly docs: string;
}

/**
 * The Angular 17 to 22 features and where StarNG uses them. The counts come from a search of the
 * source (library without spec files) on the date of the last check; see the wave R report.
 */
const FEATURES: readonly FeatureRow[] = [
  {
    feature: 'Standalone components, directives and pipes',
    since: '14 (default in 19)',
    library: 'Used: every declaration is standalone. No `NgModule`, no `standalone: false`.',
    docs: 'Used: every page and shell component is standalone.',
  },
  {
    feature: 'Signal inputs: `input()`, `input.required()`, input transforms',
    since: '17.1 (stable 19)',
    library:
      'Used: 663 `input()` and 84 `input.required()` in 112 files; `booleanAttribute` 535 times, `numberAttribute` 62 times. No `@Input`.',
    docs: 'Used in the shared docs components (`docs-example`, `docs-api`).',
  },
  {
    feature: 'Two-way signals: `model()`',
    since: '17.2 (stable 19)',
    library: 'Used: 51 `model()` in 35 files, for example `value`, `open`, `page`.',
    docs: 'Not applicable: no docs component has a two-way property.',
  },
  {
    feature: 'Function outputs: `output()`, `outputFromObservable()`',
    since: '17.3 (stable 19)',
    library:
      'Used: 264 `output()` in 90 files. No `EventEmitter`, no `@Output`. `outputFromObservable` is not needed: no output comes from an observable.',
    docs: 'Not applicable: docs components have no outputs.',
  },
  {
    feature: 'Signal queries: `viewChild`, `viewChildren`, `contentChild`, `contentChildren`',
    since: '17.2 (stable 19)',
    library:
      'Used: 145 `viewChild`, 4 `viewChildren`, 168 `contentChild`, 127 `contentChildren`. No query decorators.',
    docs: 'Used: 17 `viewChild` (for example the spreadsheet CSV example).',
  },
  {
    feature: '`signal`, `computed`, `linkedSignal`, `untracked`',
    since: '16 / 19 (`linkedSignal` stable 20)',
    library:
      'Used: 737 `computed`, 54 `linkedSignal` in 20 files, 106 `untracked`. State that resets with an input is a `linkedSignal`, not an effect that writes a signal.',
    docs: 'Used: 409 `signal` and 34 `computed` in the examples.',
  },
  {
    feature: '`effect`, `afterRenderEffect`, `afterNextRender`, `afterEveryRender`',
    since: '16 to 20 (stable 20)',
    library:
      'Used: 69 `effect` in 39 files, 50 `afterRenderEffect` in 21, 148 `afterNextRender` in 53, 13 `afterEveryRender` in 6. DOM reads and writes run in the render phases, so the controls are safe on the server.',
    docs: 'Used: `afterNextRender` in the shell (measure the header) and in examples.',
  },
  {
    feature: '`resource`, `rxResource`, `httpResource`',
    since: '19 (experimental) to 22',
    library:
      'Used: `resource()` loads the folders of the file manager provider, the child rows of the hierarchical grid (`childData`) and, new in this version, the opt-in `suggestionLoader` of the autocomplete. `rxResource` and `httpResource`: not applicable, the library makes no HTTP request and takes plain promise functions.',
    docs: 'Used: the lazy autocomplete and listbox examples load ranges through `resource()`.',
  },
  {
    feature: 'Signal Forms: `FormValueControl`, `FormCheckboxControl`, `[field]`',
    since: '21 (experimental), 22',
    library:
      'Used: 55 `FormValueControl` and 6 `FormCheckboxControl` references in 24 files; 28 files import `@angular/forms/signals`. No `ControlValueAccessor`.',
    docs: 'Used: 18 files; the Forms guide shows Signal Forms and validation.',
  },
  {
    feature: 'Reactive (typed) forms interop',
    since: '14 (typed), 22 (`SignalFormControl`)',
    library:
      'Used: `syncSignalFormControls` in `@star-ng/ui/core` updates the status of a `FormGroup` when a Signal Forms rule changes a child status; no value accessor is needed.',
    docs: 'Used: the Forms guide puts the controls in a `FormGroup` through `SignalFormControl` (`@angular/forms/signals/compat`).',
  },
  {
    feature: 'Built-in control flow: `@if`, `@for`, `@switch`',
    since: '17',
    library: 'Used: 811 `@if`, 236 `@for`, 11 `@switch`. No `*ngIf`, `*ngFor` or `ngSwitch`.',
    docs: 'Used everywhere; no structural directives of `CommonModule`.',
  },
  {
    feature: 'Template variables: `@let`',
    since: '18.1 (stable 19)',
    library: 'Used: 55 times in 25 files.',
    docs: 'Used: 2 times.',
  },
  {
    feature: 'Deferrable views: `@defer`',
    since: '17',
    library:
      'Not applicable: a control does not decide when the application loads code. An application can wrap any StarNG control in `@defer`.',
    docs: 'Tried and not kept: `@defer (hydrate on viewport)` around the examples of eight heavy pages made the initial bundle 12.8 kB larger and no route chunk smaller (the first example of each page is in view on load).',
  },
  {
    feature: 'Incremental hydration and event replay',
    since: '19 (stable 20)',
    library:
      'Compatible: the controls render on the server and hydrate without a mismatch (`isPlatformBrowser` in 21 files, DOM work in render hooks).',
    docs: 'Adopted: `provideClientHydration(withIncrementalHydration())`. A click before the application starts runs after hydration.',
  },
  {
    feature: 'Server rendering, prerendering, hydration',
    since: '17 (`@angular/ssr`)',
    library: 'Compatible: no browser global during render; the e2e tests check every docs page.',
    docs: 'Used: every page is prerendered (`outputMode: "static"`, 143 pages) and hydrated.',
  },
  {
    feature: 'Zoneless change detection',
    since: '18 (experimental), 20.2 (stable), 21 (default)',
    library:
      'Used: no `zone.js` dependency; the unit tests run zoneless. `NgZone` appears once (`StarClock`) so that a zone-based application does not run change detection on every tick. Zone-based applications stay supported.',
    docs: 'Used: no `zone.js`, no polyfills.',
  },
  {
    feature: 'Host bindings object (`host: {}`)',
    since: '2 (the style guide prefers it to decorators)',
    library: 'Used: 165 `host` objects in 119 files. No `@HostBinding` or `@HostListener`.',
    docs: 'Used: 5 times (for example `(document:keydown)` in the shell).',
  },
  {
    feature: '`OnPush` change detection',
    since: '2',
    library: 'Used: 165 components in 121 files.',
    docs: 'Used: 181 components.',
  },
  {
    feature: '`inject()`',
    since: '14',
    library:
      'Used: 476 calls in 129 files. Constructor parameters appear only in plain helper classes that Angular does not create (dialog refs, the diagram history).',
    docs: 'Used: 59 calls.',
  },
  {
    feature: '`DestroyRef`, `takeUntilDestroyed`',
    since: '16',
    library:
      'Used: `DestroyRef` 113 times in 46 files, `takeUntilDestroyed` 13 times in 6 files (the remaining RxJS subscriptions). Lifecycle hooks: one `ngOnInit` and one `ngOnDestroy` (the menu list, which reads its input at the first possible moment), no `ngOnChanges`.',
    docs: 'Used: `takeUntilDestroyed` in the file upload example.',
  },
  {
    feature: '`PendingTasks`',
    since: '19 (stable)',
    library:
      'Used: the table marks the application as busy while it loads the query builder on demand; `resource()` registers its own pending task.',
    docs: 'Not applicable: the docs load no data.',
  },
  {
    feature: 'Router view transitions (`withViewTransitions`)',
    since: '17',
    library: 'Not applicable: the router configuration belongs to the application.',
    docs: 'Adopted: pages cross-fade, not on the first page and not with reduced motion.',
  },
  {
    feature: 'Router input binding (`withComponentInputBinding`)',
    since: '16',
    library: 'Not applicable: controls are not route components.',
    docs: 'Adopted: the Tabs page reads the query parameter `view` as an input.',
  },
  {
    feature: 'Router resources (`withRouterResources`)',
    since: '22.2 (developer preview)',
    library: 'Not applicable.',
    docs: 'Not applicable: no route loads data.',
  },
  {
    feature: 'Automatic strict CSP (`security.autoCsp`)',
    since: '19 (experimental)',
    library:
      'Not applicable. For a strict policy the theme package ships the first-paint script as a file and its hash (`STAR_THEME_FIRST_PAINT_HASH`).',
    docs: 'Not applicable: the builder refuses `autoCsp` together with prerendering. The build step `tools/csp-hashes.mjs` adds the hashes of the event replay scripts to each page instead; the policy has no `unsafe-inline` for scripts.',
  },
  {
    feature: 'Unit test runner (`@angular/build:unit-test`, Vitest)',
    since: '20 (experimental), 21 (default)',
    library: 'Used: Vitest with jsdom, 242 spec files.',
    docs: 'Used: the docs project has its own Vitest run.',
  },
  {
    feature: '`@angular/aria`',
    since: '21 (developer preview), 22',
    library:
      'Not adopted: the controls implement the WAI-ARIA patterns on the Angular CDK (focus, overlays, menus, drag and drop) and are checked with axe in both themes. A move would rewrite released controls and add a peer dependency without a new feature for users.',
    docs: 'Not applicable.',
  },
  {
    feature: 'Selectorless components',
    since: 'Not public in 22.2 (an internal compiler option only)',
    library: 'Not applicable: a library must give each control a selector for its users.',
    docs: 'Not applicable.',
  },
];

/** Splits a text at backticks: odd parts are code. */
function parts(text: string): readonly { readonly code: boolean; readonly text: string }[] {
  return text.split('`').map((part, index) => ({ code: index % 2 === 1, text: part }));
}

@Component({
  encapsulation: ViewEncapsulation.None,
  selector: 'docs-angular-features-guide',
  imports: [DOCS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Angular features"
      lead="StarNG needs Angular 22. This page lists the Angular 17 to 22 features and where the library and this docs site use them: used, adopted, or not applicable, with the reason."
    >
      <p>
        The numbers come from a search of the source (library without spec files). They change with
        each release; the table shows how the code is written, not a promise of exact counts.
      </p>

      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Angular features in StarNG
          </caption>
          <thead>
            <tr>
              <th scope="col">Feature</th>
              <th scope="col">Angular</th>
              <th scope="col">Library</th>
              <th scope="col">Docs site</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows; track row.feature) {
              <tr>
                <th scope="row">
                  @for (part of row.feature; track $index) {
                    @if (part.code) {
                      <code>{{ part.text }}</code>
                    } @else {
                      {{ part.text }}
                    }
                  }
                </th>
                <td>{{ row.since }}</td>
                <td>
                  @for (part of row.library; track $index) {
                    @if (part.code) {
                      <code>{{ part.text }}</code>
                    } @else {
                      {{ part.text }}
                    }
                  }
                </td>
                <td>
                  @for (part of row.docs; track $index) {
                    @if (part.code) {
                      <code>{{ part.text }}</code>
                    } @else {
                      {{ part.text }}
                    }
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <h2>Change detection in your application</h2>
      <p>
        The controls use signals and <code>OnPush</code> and need no <code>zone.js</code>. They work
        in a zoneless application (the Angular default) and in an application that still uses
        <code>provideZoneChangeDetection</code>.
      </p>

      <h2>Server rendering and hydration</h2>
      <p>
        The controls render on the server and hydrate. They read the DOM only in render hooks
        (<code>afterNextRender</code>, <code>afterRenderEffect</code>) or after a browser check, so
        prerendering and incremental hydration work. When the page has a strict Content Security
        Policy, event replay needs the hashes of its two inline scripts in <code>script-src</code>;
        see the <strong>Dark mode</strong> guide for the hash of the theme first-paint script.
      </p>
    </docs-page>
  `,
})
export class AngularFeaturesGuide {
  protected readonly rows = FEATURES.map((row) => ({
    feature: parts(row.feature),
    since: row.since,
    library: parts(row.library),
    docs: parts(row.docs),
  }));
}
