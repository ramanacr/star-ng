import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DOCS_API, DOCS_EXAMPLES, DocsApiMember } from '../generated/docs-data';
import { DOCS_NAV } from '../nav';

/** One row of a hand-written reference table (slots, CSS variables, keyboard). */
export interface DocsRow {
  readonly name: string;
  readonly description: string;
}

/** Code block with a copy button. */
@Component({
  selector: 'docs-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'docs-code' },
  template: `
    <button
      type="button"
      class="docs-code__copy"
      [class.docs-code__copy--done]="copied()"
      (click)="copy()"
    >
      <i [class]="copied() ? 'ph-bold ph-check' : 'ph-bold ph-copy'" aria-hidden="true"></i>
      <span class="star-sr-only">{{ copied() ? 'Copied' : 'Copy ' + label() }}</span>
    </button>
    <pre tabindex="0" translate="no" [attr.aria-label]="label()"><code>{{ code() }}</code></pre>
  `,
})
export class DocsCode {
  readonly code = input.required<string>();
  /** Accessible name of the block, for example "Example source". */
  readonly label = input('Code');
  protected readonly copied = signal(false);
  private readonly announcer = inject(LiveAnnouncer);

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code());
      this.copied.set(true);
      // The icon change is visual only: a screen reader hears the result.
      void this.announcer.announce('Copied to the clipboard', 'polite');
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // Clipboard access can be blocked: the text stays selectable.
      void this.announcer.announce('Copy failed. Select the code and copy it.', 'polite');
    }
  }
}

/**
 * Page frame: navigation group, title, lead text and the import statement of the control. The
 * group is the label of the navigation group of the current route (for example "Selection").
 */
@Component({
  selector: 'docs-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="docs-page__header">
      @if (group) {
        <nav class="docs-page__trail" aria-label="Breadcrumb">
          <ol>
            <li><a routerLink="/">Docs</a></li>
            <li aria-current="location">{{ group }}</li>
          </ol>
        </nav>
      }
      <h1>{{ heading() }}</h1>
      @if (lead()) {
        <p class="docs-page__lead">{{ lead() }}</p>
      }
      @if (importFrom()) {
        <docs-code [code]="importFrom()" label="Import" />
      }
    </header>
    <ng-content />
  `,
  imports: [DocsCode, RouterLink],
  host: { class: 'docs-page' },
})
export class DocsPage {
  readonly heading = input.required<string>();
  readonly lead = input('');
  /** Import statement shown under the title. */
  readonly importFrom = input('');

  private readonly path = inject(ActivatedRoute).snapshot.routeConfig?.path ?? '';
  protected readonly group =
    DOCS_NAV.find((group) => group.items.some((item) => item.path === this.path))?.label ?? '';
}

/**
 * A live example with its source. The markup between the tags runs as written; the build
 * tool `tools/gen-docs-data.mjs` copies the same markup into `DOCS_EXAMPLES` under the
 * `source` key, so the code shown is the code that runs.
 */
@Component({
  selector: 'docs-example',
  imports: [DocsCode, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'docs-example' },
  template: `
    <div class="docs-example__head">
      <h2 class="docs-example__title" [id]="anchor()">{{ heading() }}</h2>
      <a
        class="docs-example__anchor"
        [routerLink]="[]"
        [fragment]="anchor()"
        [attr.aria-label]="'Link to ' + heading()"
      >
        <i class="ph-bold ph-link-simple" aria-hidden="true"></i>
      </a>
    </div>
    @if (note()) {
      <p class="docs-example__note">{{ note() }}</p>
    }
    <div class="docs-example__frame">
      <div class="docs-example__live"><ng-content /></div>
      <details class="docs-example__source">
        <summary>
          <i class="ph-bold ph-code docs-example__source-icon" aria-hidden="true"></i>
          <span>Source</span>
          <i class="ph-bold ph-caret-down docs-example__source-caret" aria-hidden="true"></i>
        </summary>
        <docs-code [code]="code()" [label]="heading() + ' source'" />
        @if (script()) {
          <docs-code [code]="script()" [label]="heading() + ' component code'" />
        }
      </details>
    </div>
  `,
})
export class DocsExample {
  readonly heading = input.required<string>();
  /** Key of the example source: `<page>/<example>`, unique in the docs application. */
  readonly source = input.required<string>();
  readonly note = input('');
  /** Component code that the markup needs (signals, handlers). */
  readonly script = input('');

  protected readonly code = computed(() => DOCS_EXAMPLES[this.source()] ?? '');
  protected readonly anchor = computed(() => this.source().replace('/', '-'));
}

/**
 * API reference of one or more components or directives. Inputs, models and outputs come
 * from the library source (`DOCS_API`); slots, CSS variables and keyboard keys are passed in.
 */
@Component({
  selector: 'docs-api',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'docs-api' },
  template: `
    <h2 id="api">API</h2>
    @for (item of entries(); track item.name) {
      <section class="docs-api__entry">
        <h3>
          {{ item.name }}
          @if (item.entry.selector) {
            <code>{{ item.entry.selector }}</code>
          }
        </h3>
        @if (item.entry.description) {
          <p>{{ item.entry.description }}</p>
        }
        @for (table of item.tables; track table.title) {
          <div class="docs-table-wrap">
            <table class="docs-table docs-table--api">
              <caption>
                {{
                  table.title
                }}
              </caption>
              <thead>
                <tr>
                  <th scope="col" class="docs-table__name">Name</th>
                  <th scope="col" class="docs-table__type">Type</th>
                  @if (table.defaults) {
                    <th scope="col" class="docs-table__default">Default</th>
                  }
                  <th scope="col" class="docs-table__description">Description</th>
                </tr>
              </thead>
              <tbody>
                @for (member of table.members; track member.name) {
                  <tr>
                    <th scope="row">
                      <code>{{ member.name }}</code>
                      @if (member.required) {
                        <span class="docs-table__required">required</span>
                      }
                      @if (member.inheritedFrom) {
                        <span class="docs-table__inherited"
                          >inherited from <code>{{ member.inheritedFrom }}</code></span
                        >
                      }
                    </th>
                    <td class="docs-table__type">
                      <code>{{ member.type }}</code>
                    </td>
                    @if (table.defaults) {
                      <td class="docs-table__default">
                        @if (member.default !== null) {
                          <code>{{ member.default }}</code>
                        }
                      </td>
                    }
                    <td>{{ member.description }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @if (item.entry.parts?.length) {
          <p class="docs-api__parts">
            Parts (keys of <code>pt</code>, attribute <code>data-star-part</code>, see
            <a routerLink="/guides/styling-hooks">Styling hooks</a>):
            @for (part of item.entry.parts; track part; let last = $last) {
              <code>{{ part }}</code>{{ last ? '.' : ', ' }}
            }
          </p>
        }
      </section>
    }
    @for (table of extras(); track table.title) {
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            {{
              table.title
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">{{ table.column }}</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.rows; track row.name) {
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
    }
  `,
})
export class DocsApi {
  /** Class names of the components and directives, for example `['StarButton']`. */
  readonly of = input.required<readonly string[]>();
  /** Content projection slots and template inputs. */
  readonly slots = input<readonly DocsRow[]>([]);
  /** CSS custom properties that change this control. */
  readonly cssVars = input<readonly DocsRow[]>([]);
  readonly keyboard = input<readonly DocsRow[]>([]);

  protected readonly entries = computed(() =>
    this.of().flatMap((name) => {
      const entry = DOCS_API[name];
      if (!entry) return [];
      const table = (title: string, members: readonly DocsApiMember[], defaults: boolean) =>
        members.length ? [{ title, members, defaults }] : [];
      return [
        {
          name,
          entry,
          tables: [
            ...table('Inputs', entry.inputs, true),
            ...table('Models (two-way binding)', entry.models, true),
            ...table('Outputs', entry.outputs, false),
          ],
        },
      ];
    }),
  );

  protected readonly extras = computed(() =>
    [
      { title: 'Slots and templates', column: 'Slot', rows: this.slots() },
      { title: 'CSS variables', column: 'Variable', rows: this.cssVars() },
      { title: 'Keyboard', column: 'Key', rows: this.keyboard() },
    ].filter((table) => table.rows.length),
  );
}

/** Everything a docs page needs in `imports`. */
export const DOCS = [DocsPage, DocsExample, DocsApi, DocsCode] as const;
