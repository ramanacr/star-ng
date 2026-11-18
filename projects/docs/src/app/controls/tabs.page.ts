import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarTab, StarTabCloseEvent, StarTabContent, StarTabs } from '@star-ng/ui/tabs';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-tabs-page',
  imports: [DOCS, StarTabs, StarTab, StarTabContent],
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

      <h2>Right-to-left</h2>
      <p>
        With <code>dir="rtl"</code> the first tab is on the right. Arrow left moves to the next tab
        and Arrow right to the previous one: the arrow keys follow the visual direction. Home and
        End keep their meaning. See the Right-to-left guide.
      </p>

      <docs-api
        [of]="['StarTabs', 'StarTab', 'StarTabContent']"
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

  protected readonly slots: readonly DocsRow[] = [
    {
      name: '(default)',
      description: 'Inside star-tab: the panel content. Inside star-tabs: the tabs.',
    },
    {
      name: 'ng-template starTabContent',
      description: 'Lazy panel content. It renders when the tab is first selected and then stays.',
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
    { name: 'Home / End', description: 'Moves to the first or last enabled tab.' },
    {
      name: 'Scroll buttons',
      description:
        'With scrollable: pointer only, not in the tab order and hidden from screen readers. The arrow keys reach every tab.',
    },
    { name: 'Enter / Space', description: 'Selects the focused tab (manual activation).' },
    {
      name: 'Delete',
      description:
        'Closes the focused tab when it is closable (tabClose). The focus moves to the next tab.',
    },
    {
      name: 'Tab',
      description: 'Only the selected tab is in the tab order. The next stop is the panel.',
    },
  ];
}
