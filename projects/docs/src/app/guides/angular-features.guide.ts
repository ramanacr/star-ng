import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FEATURE_COUNTS } from '../generated/feature-counts';
import { DOCS } from '../shared/docs';

/**
 * One row of the feature matrix. Text between backticks shows as code. A token in braces is
 * replaced with a count from `FEATURE_COUNTS` (written by `tools/feature-counts.mjs`, checked by
 * `corepack pnpm lint`): `{lib:<name>}` gives "uses in files" for the library, `{docs:<name>}` the
 * number of uses in the docs, `{pages}` the number of prerendered pages, `{specFiles}` the number
 * of library spec files. `tools/feature-counts.test.mjs` checks that every token exists.
 */
interface FeatureRow {
  readonly feature: string;
  /** Since which Angular version the feature is stable (or its status in Angular 22). */
  readonly since: string;
  readonly library: string;
  readonly docs: string;
}

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
      'Used: `input()` {lib:input}, `input.required()` {lib:inputRequired} (declarations); `booleanAttribute` {lib:booleanAttribute}, `numberAttribute` {lib:numberAttribute}. No `@Input`.',
    docs: 'Used: `input()` {docs:input} times and `input.required()` {docs:inputRequired} times in the shared docs components.',
  },
  {
    feature: 'Two-way signals: `model()`',
    since: '17.2 (stable 19)',
    library:
      'Used: `model()` {lib:model} (declarations), for example `value`, `open`, `page`; `model.required()` {lib:modelRequired}.',
    docs: 'Not applicable: no docs component has a two-way property.',
  },
  {
    feature: 'Function outputs: `output()`, `outputFromObservable()`',
    since: '17.3 (stable 19)',
    library:
      'Used: `output()` {lib:output} (declarations). No `EventEmitter`, no `@Output`. `outputFromObservable` is not needed: no output comes from an observable.',
    docs: 'Not applicable: docs components have no outputs.',
  },
  {
    feature: 'Signal queries: `viewChild`, `viewChildren`, `contentChild`, `contentChildren`',
    since: '17.2 (stable 19)',
    library:
      'Used (declarations): `viewChild` {lib:viewChild}, `viewChildren` {lib:viewChildren}, `contentChild` {lib:contentChild}, `contentChildren` {lib:contentChildren}. No query decorators.',
    docs: 'Used: `viewChild` {docs:viewChild} times (for example the spreadsheet CSV example).',
  },
  {
    feature: '`signal`, `computed`, `linkedSignal`, `untracked`',
    since: '16 / 19 (`linkedSignal` stable 20)',
    library:
      'Used: `computed` {lib:computed}, `linkedSignal` {lib:linkedSignal}, `untracked` {lib:untracked}. State that resets with an input is a `linkedSignal`, not an effect that writes a signal.',
    docs: 'Used: `signal` {docs:signal} times and `computed` {docs:computed} times in the examples.',
  },
  {
    feature: '`effect`, `afterRenderEffect`, `afterNextRender`, `afterEveryRender`',
    since: '16 to 20 (stable 20)',
    library:
      'Used: `effect` {lib:effect}, `afterRenderEffect` {lib:afterRenderEffect}, `afterNextRender` {lib:afterNextRender}, `afterEveryRender` {lib:afterEveryRender}. DOM reads and writes run in the render phases, so the controls are safe on the server.',
    docs: 'Used: `afterNextRender` in the shell (measure the header) and in examples.',
  },
  {
    feature: '`resource`, `rxResource`, `httpResource`',
    since: '19 (experimental) to 22',
    library:
      'Used: `resource()` {lib:resource}: the folders of the file manager provider, the child rows of the hierarchical grid (`childData`) and the opt-in `suggestionLoader` of the autocomplete (with an error state). `rxResource` and `httpResource`: not applicable, the library makes no HTTP request and takes plain promise functions.',
    docs: 'Used: `resource()` {docs:resource} times, for example the lazy autocomplete and listbox examples and the autocomplete loader example. The lazy table example shows the server request as an `httpResource` whose request follows the `lazyLoad` event (code sample).',
  },
  {
    feature: '`debounced()`',
    since: '22.0 (experimental)',
    library:
      'Not adopted ({lib:debounced} uses): `@experimental` in 22.2, and the package uses only stable Angular APIs. The autocomplete debounce stays a timer that also sets when `completeMethod` fires.',
    docs: 'Adopted, experimental: `debounced()` {docs:debounced} time in the shell. The page search filters the navigation at once; its live status ("3 pages match.") waits until typing pauses for 400 ms, so a screen reader reads the result once per pause, not once per key.',
  },
  {
    feature: 'Signal Forms: `FormValueControl`, `FormCheckboxControl`, `[field]`',
    since: '21 (experimental), 22.0 (public)',
    library:
      'Used: `FormValueControl` {lib:formValueControl}, `FormCheckboxControl` {lib:formCheckboxControl}, imports of `@angular/forms/signals` {lib:signalForms}. No `ControlValueAccessor`. The field wrapper (`StarField`) reads `pending()` of a field state: while an async validator runs, the field and the control linked to it (`starInput` and every StarNG form control) are `aria-busy`, and the field shows a busy icon.',
    docs: 'Used: {docs:signalForms} imports of `@angular/forms/signals`; the Forms guide shows Signal Forms and validation, and the Field page an async validator (`validateAsync`).',
  },
  {
    feature: 'Reactive (typed) forms interop',
    since: '14 (typed), 22 (`SignalFormControl`)',
    library:
      'Used: `syncSignalFormControls` in `@star-ng/ui/core` updates the status of a `FormGroup` when a Signal Forms rule changes a child status; no value accessor is needed.',
    docs: 'Used: the Forms guide puts the controls in a `FormGroup` through `SignalFormControl` (`@angular/forms/signals/compat`).',
  },
  {
    feature: '`@angular/core/rxjs-interop`',
    since: '16 (stable 19/20)',
    library:
      'Used where RxJS remains: `takeUntilDestroyed` {lib:takeUntilDestroyed} (CDK and router streams), `toSignal` {lib:toSignal} (the Transloco text). Outputs are not observables, so `outputFromObservable` and `outputToObservable` are not needed.',
    docs: 'Used: `takeUntilDestroyed` once (file upload example).',
  },
  {
    feature: 'Built-in control flow: `@if`, `@for`, `@switch`',
    since: '17',
    library:
      'Used: `@if` {lib:if}, `@for` {lib:for}, `@switch` {lib:switch}. No `*ngIf`, `*ngFor` or `ngSwitch`. A list whose items the user removes or repeats tracks a stable key, not `$index`: the chips of the tags field, autocomplete and multi-select (a repeated value gets its own key), the rules of the query builder and the table filter menu (an edited rule keeps its key), and the sheet tabs of the spreadsheet. `track $index` stays for static lists.',
    docs: 'Used: `@if` {docs:if} times, `@for` {docs:for} times; no structural directives of `CommonModule`.',
  },
  {
    feature: 'Template variables: `@let`',
    since: '18.1 (stable 19)',
    library: 'Used: {lib:let}.',
    docs: 'Used: {docs:let} times.',
  },
  {
    feature: 'Deferrable views: `@defer`',
    since: '17',
    library:
      'Not applicable: a control does not decide when the application loads code. An application can wrap any StarNG control in `@defer`.',
    docs: 'Tried and not kept: `@defer (hydrate on viewport)` around the examples of eight heavy pages made the initial bundle 12.8 kB larger and no route chunk smaller (measured on bundle size only).',
  },
  {
    feature: 'Incremental hydration and event replay',
    since: '19 (stable 20, default 22)',
    library:
      'Compatible: the controls render on the server and hydrate without a mismatch (`isPlatformBrowser` {lib:isPlatformBrowser}, DOM work in render hooks).',
    docs: 'Adopted: `provideClientHydration(withIncrementalHydration())`. A click before the application starts runs after hydration.',
  },
  {
    feature: 'Server rendering, prerendering, hydration',
    since: '17 (`@angular/ssr`)',
    library: 'Compatible: no browser global during render; the e2e tests check every docs page.',
    docs: 'Used: every page is prerendered (`outputMode: "static"`, {pages} pages) and hydrated.',
  },
  {
    feature: 'Zoneless change detection',
    since: '18 (experimental), 20.2 (stable), 21 (default)',
    library:
      'Used: no `zone.js` dependency; the unit tests run zoneless. `NgZone` appears once (`StarClock`) so that a zone-based application does not run change detection on every tick. Zone-based applications are supported but not tested in CI.',
    docs: 'Used: no `zone.js`, no polyfills.',
  },
  {
    feature: '`OnPush` by default, `ChangeDetectionStrategy.Eager`',
    since: '22.0 (`OnPush` is the default; `Default` is deprecated for `Eager`)',
    library:
      'Used: `OnPush` is set explicitly, {lib:onPush}. The flag stays: it gives the same result for every Angular 22 application, states the intent next to the signal code, and removing it would touch every component file with no effect. No component uses `Eager`.',
    docs: 'Used: `OnPush` explicitly, {docs:onPush} times (the component schematic of `angular.json` writes it).',
  },
  {
    feature: 'Host bindings object (`host: {}`)',
    since: '2 (the style guide prefers it to decorators)',
    library:
      'Used: {lib:host}. No `@HostBinding` or `@HostListener`. Components use `ViewEncapsulation.None` (kept): the theme is global CSS with design tokens, so an application can restyle a control with its own classes and the unstyled mode works. The pass-through (`pt`) sets classes, styles and safe attributes on the parts with `Renderer2` (kept: it is the renderer API for elements that the template does not bind).',
    docs: 'Used: {docs:host} times (for example `(document:keydown)` in the shell).',
  },
  {
    feature: '`inject()`',
    since: '14',
    library:
      'Used: `inject()` {lib:inject}. Constructor parameters appear only in plain helper classes that Angular does not create (dialog refs, the diagram history).',
    docs: 'Used: `inject()` {docs:inject} times.',
  },
  {
    feature: '`@Service()` decorator',
    since: '22.0',
    library:
      "Used: every root service of the package is a `@Service()`: the dialog, window, bottom sheet, confirm and toast services, the clock, announcer, clipboard, configuration, direction, filter and theme services, and the drag-and-drop registries. Injection is the same as with `@Injectable({ providedIn: 'root' })`; an application can still provide its own instance.",
    docs: 'Not applicable: the one docs service is provided by a component (`@Injectable()` in the i18n guide).',
  },
  {
    feature: '`DOCUMENT` from `@angular/core`',
    since: '20 (`@angular/common` re-exports it)',
    library: 'Used: every file imports `DOCUMENT` from `@angular/core`.',
    docs: 'Used: the same.',
  },
  {
    feature: '`injectAsync`, `onIdle`, `provideIdleServiceWith`',
    since: '22.0 (stable)',
    library:
      'Not adopted: `injectAsync` loads an injectable on demand, but the table loads a component (the query builder of the advanced filter) and creates it in a view container. Prefetching that chunk with `onIdle` would download it on every table page, also when the filter is never opened.',
    docs: 'Not applicable: the docs load no services on demand.',
  },
  {
    feature: 'Dynamic component bindings: `inputBinding`, `outputBinding`, `twoWayBinding`',
    since: '20',
    library:
      'Adopted for the table query builder: `createComponent(builder, { bindings: [inputBinding(...), twoWayBinding(...)] })` replaced one effect and one subscription. The dialog, window and bottom sheet services keep `setInput`: they set each input once from a plain value at creation, so a binding would add a getter per input and no less code.',
    docs: 'Not applicable: the docs create no components in code.',
  },
  {
    feature: '`DestroyRef`, lifecycle hooks',
    since: '16',
    library:
      'Used: `DestroyRef` {lib:destroyRef}. Lifecycle hooks: one `ngOnInit` and one `ngOnDestroy` (the menu list, which reports its opening once, at the first point where its input is set), no `ngOnChanges`.',
    docs: 'Used: `DestroyRef` {docs:destroyRef} times.',
  },
  {
    feature: '`PendingTasks`',
    since: '19 (stable)',
    library:
      'Used: the table marks the application as busy while it loads the query builder on demand; `resource()` registers its own pending task.',
    docs: 'Not applicable: the docs load no data.',
  },
  {
    feature: 'Animations: `animate.enter`, `animate.leave`',
    since: '20.2',
    library:
      '`animate.leave` adopted for elements that leave the DOM: the toast, the banner content, the overlay panels (select, multi-select, autocomplete, multi-column combobox, date, time and color pickers, tree select, dropdown, mention, popover, tooltip, popup and mega menus; an overlay that opens again during the fade ends the old panel at once), the removed chips of the tags field, autocomplete and multi-select, and a closed tab. The CDK keeps an overlay until its panel has left. The reduced-motion rules turn each enter and leave motion off (they carry `:root`, so they win whatever the order of the partials), so Angular then removes the element at once; on the server and in jsdom `animate.leave` does nothing. The service-opened dialog, window and bottom sheet keep their CSS exit transition: the service removes the host only after the running transitions end (at once under reduced motion, 4 s at most). The message is hidden, not removed: it fades with an `allow-discrete` transition. `animate.enter` is not adopted: enter motion stays CSS (`@starting-style`, keyframes); it needs no script, runs on first paint after hydration, and the reduced-motion mixin turns it off. Not adopted for rows (tree, table, tree table, data view, list, virtual scroller) and kanban cards: rows live in virtual windows and drag and drop moves the nodes, so a leave animation would show stale rows during a scroll or a copy during a drop. Not needed for the accordion, panel, fieldset, tab panels and template dialogs: the element stays in the DOM and CSS animates both ways (`grid-template-rows`, `allow-discrete`); tab panels switch at once (WAI-ARIA). No `@angular/animations`.',
    docs: 'Not applicable: the pages use the router view transitions.',
  },
  {
    feature: 'Router view transitions (`withViewTransitions`)',
    since: '17',
    library: 'Not applicable: the router configuration belongs to the application.',
    docs: 'Adopted: pages cross-fade; not on the first page, not with reduced motion, and not when only the query or the fragment changes.',
  },
  {
    feature: 'Router input binding (`withComponentInputBinding`)',
    since: '16',
    library: 'Not applicable: controls are not route components.',
    docs: 'Adopted: the Tabs page reads the query parameter `view` as an input.',
  },
  {
    feature: 'Router `isActive()` signal',
    since: '21.1',
    library:
      "Not adopted: the tab link follows `RouterLinkActive`, so the application's `routerLinkActiveOptions` still apply.",
    docs: 'Not applicable.',
  },
  {
    feature: 'Route injector clean-up (`withAutoCleanupInjectors`)',
    since: '22.2',
    library: 'Not applicable: the router configuration belongs to the application.',
    docs: 'Not applicable: no docs route has providers.',
  },
  {
    feature: 'Router resources (`withRouterResources`)',
    since: '22.2 (developer preview)',
    library: 'Not applicable.',
    docs: 'Not applicable: no route loads data.',
  },
  {
    feature:
      '`provideAppInitializer`, `provideEnvironmentInitializer`, `provideBrowserGlobalErrorListeners`',
    since: '19 / 19 / 20',
    library:
      'Used: `provideEnvironmentInitializer` in `provideStarNg` and the direction provider. `provideAppInitializer` is not needed: nothing waits before the start.',
    docs: 'Used: `provideBrowserGlobalErrorListeners` in the application config.',
  },
  {
    feature: 'Automatic strict CSP (`security.autoCsp`)',
    since: '19 (experimental)',
    library:
      'Not applicable. For a strict policy the theme package ships the first-paint script as a file and its hash (`STAR_THEME_FIRST_PAINT_HASH`).',
    docs: 'Not applicable: the builder refuses `autoCsp` together with prerendering. The build step `tools/csp-hashes.mjs` adds the hashes of the two event replay scripts to each page and fails on any other inline script; the policy has no `unsafe-inline` for scripts.',
  },
  {
    feature: 'WebMCP tools (`provideExperimentalWebMcpTools`, `declareExperimentalWebMcpTool`)',
    since: '22.0 (experimental)',
    library:
      'Not adopted: experimental. Coding agents use the package `@star-ng/mcp`, a stable MCP server with the component data.',
    docs: 'Adopted, experimental: the tools `star_ng_search_docs` and `star_ng_open_docs_page`. Angular registers them only in a browser with the WebMCP API, and never on the server.',
  },
  {
    feature: 'Unit test runner (`@angular/build:unit-test`, Vitest)',
    since: '20 (experimental), 21 (default)',
    library: 'Used: Vitest with jsdom, {specFiles} spec files.',
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
    feature: 'Error boundaries: `@boundary`, `@error`',
    since: 'Not public in 22.2 (the compiler parses the blocks; no public API)',
    library: 'Not adopted: no stable public API in 22.2.',
    docs: 'Not adopted.',
  },
  {
    feature: 'Timers, `NgZone`, `detectChanges`, RxJS subjects',
    since: 'n/a (kept on purpose)',
    library:
      'Kept: the `setTimeout` calls of the library are timers (debounce, message and toast life, long press) and checks after a focus move; `afterNextRender` needs a render, which a blur does not schedule. The editor calls `detectChanges` once to focus its find field in the same key event, `StarClock` ticks outside the zone of a zone-based application, and the menu list uses `ngOnInit` once (reasons in the code). The `Subject` of `StarToastService.closed` is a public event stream, `toSignal` bridges the Transloco text, and the hierarchical grid loader stops an Observable with its abort signal; signals do not replace them. `requestAnimationFrame` drives animation loops only.',
    docs: 'Not applicable.',
  },
  {
    feature: 'Selectorless components',
    since: 'Not public in 22.2 (an internal compiler option only)',
    library: 'Not applicable: a library must give each control a selector for its users.',
    docs: 'Not applicable.',
  },
];

type CountKey = keyof typeof FEATURE_COUNTS.lib;

/** Replaces the count tokens of a row text (see `FeatureRow`). */
export function fillCounts(text: string): string {
  return text.replace(/\{(lib|docs):(\w+)\}|\{(pages|specFiles)\}/g, (token, side, key, total) => {
    if (total) return String(FEATURE_COUNTS[total as 'pages' | 'specFiles']);
    const count = FEATURE_COUNTS[side as 'lib' | 'docs'][key as CountKey];
    if (!count) return token;
    if (side === 'docs') return String(count.uses);
    return count.files === 1 ? `${count.uses} in 1 file` : `${count.uses} in ${count.files} files`;
  });
}

/** Splits a text at backticks: odd parts are code. */
function parts(text: string): readonly { readonly code: boolean; readonly text: string }[] {
  return fillCounts(text)
    .split('`')
    .map((part, index) => ({ code: index % 2 === 1, text: part }));
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
        The numbers are counted from the source at build time (library without spec files; docs
        without generated files): declarations such as <code>= input(</code>, calls such as
        <code>effect(</code>, and names. "in N files" counts the files with at least one use.
      </p>

      <!-- The wide table can scroll sideways: the region takes the focus, so a keyboard user can
           scroll it too. -->
      <div class="docs-table-wrap" tabindex="0" role="region" aria-label="Angular features table">
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
            @for (row of rows; track row.key) {
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
        in a zoneless application (the Angular default). An application that still uses
        <code>provideZoneChangeDetection</code> is supported, but the tests of the library run
        zoneless only.
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
    key: row.feature,
    feature: parts(row.feature),
    since: row.since,
    library: parts(row.library),
    docs: parts(row.docs),
  }));
}
