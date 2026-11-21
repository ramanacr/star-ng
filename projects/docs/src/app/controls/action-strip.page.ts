import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarActionStrip } from '@star-ng/ui/action-strip';
import { StarMenuItem } from '@star-ng/ui/menu';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-action-strip-page-content',
  imports: [DOCS, StarActionStrip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .orders {
      display: grid;
      gap: 0.5rem;
      width: min(100%, 32rem);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .invoices {
      width: min(100%, 32rem);
      border-collapse: collapse;
    }
    .invoices th,
    .invoices td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--star-border);
      text-align: start;
    }
    .invoices .actions-cell {
      width: 1%;
      padding: 0;
    }
    .orders li {
      padding: 0.875rem 1rem;
      border: 1px solid var(--star-border);
      border-radius: var(--star-radius-md);
      background: var(--star-surface);
    }
  `,
  template: `
    <docs-page
      heading="Action strip"
      lead="A small toolbar of icon actions on top of its container, for example a list row or a card. It shows while the pointer is over the container or the focus is in it, so keyboard users reach it with Tab. The Ignite UI equivalent is igx-action-strip."
      importFrom="import { StarActionStrip } from '@star-ng/ui/action-strip';"
    >
      <docs-example
        heading="Row actions"
        source="action-strip/rows"
        [script]="rowsScript"
        note="Point at a row or press Tab to reach its strip. The arrow keys move between the actions."
      >
        <div class="docs-stack">
          <ul class="orders">
            @for (order of orders; track order) {
              <li>
                {{ order }}
                <star-action-strip
                  [actions]="actions"
                  [ariaLabel]="order + ' actions'"
                  (actionClick)="last.set(($event.label ?? '') + ' ' + order)"
                />
              </li>
            }
          </ul>
          <p class="docs-output" role="status">Last action: {{ last() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="More actions in a menu"
        source="action-strip/menu"
        [script]="menuScript"
        note="With max, the actions over the limit go into a menu. The strip stays visible while the menu is open. The persistent input shows the strip at all times."
      >
        <ul class="orders">
          <li>
            Invoice 2042
            <star-action-strip
              persistent
              [actions]="moreActions"
              [max]="2"
              ariaLabel="Invoice 2042 actions"
            />
          </li>
        </ul>
      </docs-example>

      <docs-example
        heading="In a table row"
        source="action-strip/table"
        [script]="tableScript"
        note="Put the strip in a cell. The whole row (tr or role row) reveals it, not only its cell. Another ancestor can do the same with the class star-action-strip-host."
      >
        <table class="invoices">
          <thead>
            <tr>
              <th scope="col">Invoice</th>
              <th scope="col">City</th>
              <th scope="col"><span class="star-sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (invoice of invoices; track invoice.id) {
              <tr>
                <td>{{ invoice.id }}</td>
                <td>{{ invoice.city }}</td>
                <td class="actions-cell">
                  <star-action-strip [actions]="actions" [ariaLabel]="invoice.id + ' actions'" />
                </td>
              </tr>
            }
          </tbody>
        </table>
      </docs-example>

      <docs-api
        [of]="['StarActionStrip']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class ActionStripPageContent {
  protected readonly last = signal('none');
  protected readonly orders: readonly string[] = ['Order 1001', 'Order 1002', 'Order 1003'];

  protected readonly invoices = [
    { id: 'Invoice 3001', city: 'Lisbon' },
    { id: 'Invoice 3002', city: 'Oslo' },
  ];

  protected readonly actions: readonly StarMenuItem[] = [
    { label: 'Edit', icon: 'ph-bold ph-pencil-simple' },
    { label: 'Copy', icon: 'ph-bold ph-copy' },
    { label: 'Delete', icon: 'ph-bold ph-trash', danger: true },
  ];

  protected readonly moreActions: readonly StarMenuItem[] = [
    { label: 'Edit', icon: 'ph-bold ph-pencil-simple' },
    { label: 'Download', icon: 'ph-bold ph-download-simple' },
    { label: 'Send by email', icon: 'ph-bold ph-envelope-simple' },
    { label: 'Archive', icon: 'ph-bold ph-archive' },
    { label: 'Delete', icon: 'ph-bold ph-trash', danger: true },
  ];

  protected readonly rowsScript = `readonly last = signal('none');
readonly orders = ['Order 1001', 'Order 1002', 'Order 1003'];

readonly actions: readonly StarMenuItem[] = [
  { label: 'Edit', icon: 'ph-bold ph-pencil-simple' },
  { label: 'Copy', icon: 'ph-bold ph-copy' },
  { label: 'Delete', icon: 'ph-bold ph-trash', danger: true },
];`;
  protected readonly tableScript = `readonly invoices = [
  { id: 'Invoice 3001', city: 'Lisbon' },
  { id: 'Invoice 3002', city: 'Oslo' },
];`;
  protected readonly menuScript = `readonly moreActions: readonly StarMenuItem[] = [
  { label: 'Edit', icon: 'ph-bold ph-pencil-simple' },
  { label: 'Download', icon: 'ph-bold ph-download-simple' },
  { label: 'Send by email', icon: 'ph-bold ph-envelope-simple' },
  { label: 'Archive', icon: 'ph-bold ph-archive' },
  { label: 'Delete', icon: 'ph-bold ph-trash', danger: true },
];`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(none)', description: 'The actions come from the actions input.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of the strip.' },
    { name: '--star-border', description: 'Border of the strip.' },
    { name: '--star-shadow-md', description: 'Shadow of the strip.' },
    { name: '--star-danger', description: 'Icon color of a danger action.' },
    { name: '--star-duration-fast', description: 'Duration of the fade in and out.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Moves into the strip (one tab stop) and out of it.' },
    {
      name: 'Arrow right / Arrow left',
      description:
        'Moves to the next or the previous action, in reading order. Disabled actions are skipped.',
    },
    { name: 'Home / End', description: 'Moves to the first or the last action.' },
    { name: 'Enter / Space', description: 'Runs the focused action.' },
    {
      name: 'Enter / Space / Arrow down',
      description: 'On the "More actions" button: opens the menu.',
    },
  ];
}

/**
 * Route component of the page. It loads the route styles (`action-strip.page.scss`): the library
 * partials of the page and the docs layout. The page content is a child, so its own component
 * styles come after them, as they came after the global styles.
 */
@Component({
  selector: 'docs-action-strip-page',
  imports: [ActionStripPageContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './action-strip.page.scss',
  template: '<docs-action-strip-page-content />',
})
export class ActionStripPage {}
