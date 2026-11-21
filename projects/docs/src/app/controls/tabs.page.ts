import { moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { StarField, StarInput } from '@star-ng/ui/field';
import {
  StarTab,
  StarTabCloseEvent,
  StarTabContent,
  StarTabHeader,
  StarTabLink,
  StarTabNav,
  StarTabNavPanel,
  StarTabReorderEvent,
  StarTabs,
} from '@star-ng/ui/tabs';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-tabs-page',
  imports: [
    DOCS,
    StarTabs,
    StarTab,
    StarTabContent,
    StarTabHeader,
    StarField,
    StarInput,
    StarTabNav,
    StarTabLink,
    StarTabNavPanel,
    RouterLink,
    RouterLinkActive,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Tabs"
      lead="Tabs show one panel at a time. The tab buttons follow the WAI-ARIA tabs pattern. The PrimeNG equivalent is p-tabs."
      importFrom="import { StarTabs, StarTab } from '@star-ng/ui/tabs';"
    >
      <docs-example
        heading="Basic tabs"
        source="tabs/basic"
        [script]="basicScript"
        note="The value model holds the selected tab. While it is null, the first enabled tab is selected. A disabled tab cannot be selected."
      >
        <div class="docs-stack">
          <star-tabs [(value)]="tab" ariaLabel="Order sections">
            <star-tab value="details" label="Details" icon="ph-bold ph-file-text">
              Order ORD-1042 for Orchard Supply.
            </star-tab>
            <star-tab value="items" label="Items" [badge]="12">Twelve items in two boxes.</star-tab>
            <star-tab value="billing" label="Billing" disabled>Billing is not available.</star-tab>
            <star-tab value="history" label="History">Created on Monday.</star-tab>
          </star-tabs>
          <p class="docs-output" role="status">Selected: {{ tab() ?? 'details' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Pill tabs with manual activation"
        source="tabs/pill"
        note="With selectOnFocus off, the arrow keys move only the focus. Enter or Space selects the tab. Content inside ng-template starTabContent renders when the tab is first selected."
      >
        <div class="docs-stack">
          <star-tabs variant="pill" [selectOnFocus]="false" ariaLabel="Report views">
            <star-tab value="daily" label="Daily">Daily totals.</star-tab>
            <star-tab value="weekly" label="Weekly">
              <ng-template starTabContent>Weekly totals, loaded on first use.</ng-template>
            </star-tab>
            <star-tab value="monthly" label="Monthly">Monthly totals.</star-tab>
          </star-tabs>
        </div>
      </docs-example>

      <docs-example
        heading="Scrollable tabs"
        source="tabs/scrollable"
        note="With scrollable, the tabs stay on one line. Scroll buttons show at an end that hides tabs. They are for the pointer only: the arrow keys reach every tab, and the selected tab scrolls into view."
      >
        <div class="docs-stack">
          <star-tabs scrollable ariaLabel="Monthly reports">
            @for (month of months; track month) {
              <star-tab [value]="month" [label]="month">Report for {{ month }}.</star-tab>
            }
          </star-tabs>
        </div>
      </docs-example>

      <docs-example
        heading="Vertical tabs"
        source="tabs/vertical"
        note="With orientation vertical, the tabs form a column at the start of the panels, and Arrow Up and Arrow Down move between them. The tab list has aria-orientation."
      >
        <star-tabs orientation="vertical" ariaLabel="Account settings">
          <star-tab value="profile" label="Profile" icon="ph-bold ph-user"
            >Profile settings.</star-tab
          >
          <star-tab value="billing" label="Billing" icon="ph-bold ph-receipt">
            Billing settings.
          </star-tab>
          <star-tab value="alerts" label="Alerts" icon="ph-bold ph-bell">Alert settings.</star-tab>
        </star-tabs>
      </docs-example>

      <docs-example
        heading="Alignment"
        source="tabs/alignment"
        note="alignment places the tabs at the start (default), the center or the end of the list, or stretches them to fill it."
      >
        <div class="docs-stack">
          <star-tabs alignment="stretch" ariaLabel="Invoice status">
            <star-tab value="open" label="Open">Open invoices.</star-tab>
            <star-tab value="paid" label="Paid">Paid invoices.</star-tab>
            <star-tab value="overdue" label="Overdue">Overdue invoices.</star-tab>
          </star-tabs>
          <star-tabs alignment="center" variant="pill" ariaLabel="Period">
            <star-tab value="week" label="Week">This week.</star-tab>
            <star-tab value="month" label="Month">This month.</star-tab>
          </star-tabs>
        </div>
      </docs-example>

      <docs-example
        heading="Lazy panels without cache"
        source="tabs/cache"
        note="Content inside ng-template starTabContent renders on the first activation of its tab (lazy, the default). By default it then stays, hidden, and keeps its state. With cache off, the content of a tab that is not active is destroyed: type in a note, switch the tab and come back. With lazy off, every template renders at once."
      >
        <div class="docs-stack">
          <star-tabs [cache]="false" ariaLabel="Notes">
            <star-tab value="draft" label="Draft">
              <ng-template starTabContent>
                <star-field label="Draft note"><input starInput /></star-field>
              </ng-template>
            </star-tab>
            <star-tab value="final" label="Final">
              <ng-template starTabContent>The final note is empty.</ng-template>
            </star-tab>
          </star-tabs>
        </div>
      </docs-example>

      <docs-example
        heading="Closable tabs"
        source="tabs/closable"
        [script]="closableScript"
        note="A closable tab has a close button, and the Delete key closes the focused tab. tabClose reports the value and the index; the owner removes the tab, or calls cancel() to keep it. When the selected tab closes, the next one is selected."
      >
        <div class="docs-stack">
          <star-tabs
            scrollable
            [(value)]="openFile"
            ariaLabel="Open files"
            (tabClose)="closeFile($event)"
          >
            @for (file of files(); track file) {
              <star-tab [value]="file" [label]="file" [closable]="file !== 'summary.txt'">
                Content of {{ file }}.
              </star-tab>
            }
          </star-tabs>
          <p class="docs-output" role="status">Open: {{ files().join(', ') }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Reorderable tabs"
        source="tabs/reorderable"
        [script]="reorderScript"
        note="With reorderable, a tab can be dragged to a new place. From the keyboard, Control+Shift and Arrow Right or Arrow Left move the focused tab, and a live message reads the new position. tabReorder reports both indexes; the owner reorders its list."
      >
        <div class="docs-stack">
          <star-tabs reorderable ariaLabel="Project boards" (tabReorder)="moveBoard($event)">
            @for (board of boards(); track board) {
              <star-tab [value]="board" [label]="board">Board {{ board }}.</star-tab>
            }
          </star-tabs>
          <p class="docs-output" role="status">Order: {{ boards().join(', ') }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Custom tab labels"
        source="tabs/header"
        note="ng-template starTabHeader replaces the label of the tabs. Its context has the tab (let-tab), active and index. Written in star-tab, it is the label of that tab only. It renders inside the tab button: use text and icons, not buttons or links."
      >
        <div class="docs-stack">
          <star-tabs ariaLabel="Order queues">
            <ng-template starTabHeader let-tab let-active="active">
              <i
                class="ph-bold"
                [class.ph-folder-open]="active"
                [class.ph-folder]="!active"
                aria-hidden="true"
              ></i>
              <span>{{ tab.label() }}</span>
              <span class="star-badge star-badge--secondary star-badge--sm">{{ tab.badge() }}</span>
            </ng-template>
            <star-tab value="new" label="New" [badge]="4">Four new orders.</star-tab>
            <star-tab value="packed" label="Packed" [badge]="9">Nine packed orders.</star-tab>
            <star-tab value="shipped" label="Shipped" [badge]="27">27 shipped orders.</star-tab>
          </star-tabs>
        </div>
      </docs-example>

      <docs-example
        heading="Router link tabs"
        source="tabs/nav"
        [script]="navScript"
        note="star-tab-nav with a[starTabLink] and routerLinkActive: the router decides the active link. With tabPanel the bar is a tablist of tab links (Arrow keys, Home and End move the focus; Enter or Space follows the link) and star-tab-nav-panel is the tabpanel, usually around a router-outlet. Here the links change a query parameter of this page. dynamicHeight on star-tabs animates the height of the panels, and animationDuration fades the new panel in; both stop with reduced motion."
      >
        <star-tab-nav ariaLabel="Order views" [tabPanel]="orderPanel">
          <a
            starTabLink
            routerLink="."
            [queryParams]="{ view: null }"
            routerLinkActive
            [routerLinkActiveOptions]="exactQuery"
            >Summary</a
          >
          <a
            starTabLink
            routerLink="."
            [queryParams]="{ view: 'lines' }"
            routerLinkActive
            [routerLinkActiveOptions]="exactQuery"
            >Lines</a
          >
          <a
            starTabLink
            routerLink="."
            [queryParams]="{ view: 'notes' }"
            routerLinkActive
            [routerLinkActiveOptions]="exactQuery"
            >Notes</a
          >
        </star-tab-nav>
        <star-tab-nav-panel #orderPanel>
          <p class="docs-output">{{ viewText() }}</p>
        </star-tab-nav-panel>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        With <code>dir="rtl"</code> the first tab is on the right. Arrow left moves to the next tab
        and Arrow right to the previous one: the arrow keys follow the visual direction. Home and
        End keep their meaning. See the Right-to-left guide.
      </p>

      <docs-api
        [of]="[
          'StarTabs',
          'StarTab',
          'StarTabContent',
          'StarTabHeader',
          'StarTabNav',
          'StarTabLink',
          'StarTabNavPanel',
        ]"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class TabsPage {
  protected readonly tab = signal<string | null>(null);

  protected readonly openFile = signal<string | null>('orders.csv');
  protected readonly files = signal(['summary.txt', 'orders.csv', 'invoices.csv', 'cities.csv']);
  protected closeFile(event: StarTabCloseEvent): void {
    this.files.update((files) => files.filter((file) => file !== event.value));
  }
  protected readonly closableScript = `readonly openFile = signal<string | null>('orders.csv');
readonly files = signal(['summary.txt', 'orders.csv', 'invoices.csv', 'cities.csv']);

closeFile(event: StarTabCloseEvent): void {
  // Call event.cancel() instead to keep the tab.
  this.files.update((files) => files.filter((file) => file !== event.value));
}`;
  protected readonly boards = signal(['Backlog', 'In progress', 'Review', 'Done']);
  protected moveBoard(event: StarTabReorderEvent): void {
    this.boards.update((boards) => {
      const next = [...boards];
      moveItemInArray(next, event.previousIndex, event.currentIndex);
      return next;
    });
  }
  protected readonly reorderScript = `readonly boards = signal(['Backlog', 'In progress', 'Review', 'Done']);

moveBoard(event: StarTabReorderEvent): void {
  this.boards.update((boards) => {
    const next = [...boards];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    return next;
  });
}`;
  protected readonly basicScript = `readonly tab = signal<string | null>(null);`;
  protected readonly months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  private readonly view = toSignal(inject(ActivatedRoute).queryParamMap, {
    initialValue: null,
  });
  protected readonly viewText = computed(() => {
    const view = this.view()?.get('view');
    if (view === 'lines') return 'Lines: 3 items, 12 units.';
    if (view === 'notes') return 'Notes: deliver after 10:00.';
    return 'Summary: order 1042, packed.';
  });
  protected readonly exactQuery = {
    paths: 'exact',
    queryParams: 'exact',
    fragment: 'ignored',
    matrixParams: 'ignored',
  } as const;
  protected readonly navScript = `// Links of this page with a query parameter; usually routerLink="details" and a router-outlet.
readonly exactQuery = {
  paths: 'exact',
  queryParams: 'exact',
  fragment: 'ignored',
  matrixParams: 'ignored',
} as const;`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: '(default)',
      description: 'Inside star-tab: the panel content. Inside star-tabs: the tabs.',
    },
    {
      name: 'ng-template starTabHeader',
      description:
        'Custom tab label. Context: $implicit and tab (the StarTab), active, index. In star-tab: for that tab only; in star-tabs: for every tab.',
    },
    {
      name: 'ng-template starTabContent',
      description:
        'Lazy panel content. It renders when the tab is first selected and then stays (see lazy and cache).',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-primary', description: 'Color of the selected tab and its line.' },
    { name: '--star-border', description: 'Line under the tab list.' },
    {
      name: '--star-surface-muted',
      description: 'Background of the tab list in the pill variant.',
    },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Arrow Right / Arrow Left',
      description:
        'Moves to the next or previous enabled tab. It wraps around. The tab is selected too, unless selectOnFocus is false.',
    },
    {
      name: 'Arrow Down / Arrow Up',
      description: 'The same, with orientation vertical (instead of Arrow Right and Arrow Left).',
    },
    { name: 'Home / End', description: 'Moves to the first or last enabled tab.' },
    {
      name: 'Scroll buttons',
      description:
        'With scrollable: pointer only, not in the tab order and hidden from screen readers. The arrow keys reach every tab.',
    },
    { name: 'Enter / Space', description: 'Selects the focused tab (manual activation).' },
    {
      name: 'Control+Shift+Arrow Right / Arrow Left',
      description:
        'With reorderable: moves the focused tab one place (Arrow Down and Arrow Up when vertical). Mirrored in right-to-left.',
    },
    {
      name: 'Delete',
      description:
        'Closes the focused tab when it is closable (tabClose). The focus moves to the next tab.',
    },
    {
      name: 'Tab from the selected tab',
      description:
        'When the selected tab is closable, the next tab stop is its close button ("Close {label}"). It is visually hidden until it has the focus, and it works for screen readers and voice control. The close buttons on the tabs are for the pointer only.',
    },
    {
      name: 'Tab',
      description: 'Only the selected tab is in the tab order. The next stop is the panel.',
    },
  ];
}
