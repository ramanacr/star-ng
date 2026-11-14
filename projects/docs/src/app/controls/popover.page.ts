import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarButton } from 'star-ng/button';
import { StarField, StarInput } from 'star-ng/field';
import { StarPopover } from 'star-ng/popover';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-popover-page',
  imports: [DOCS, StarButton, StarField, StarInput, StarPopover],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Popover"
      lead="A floating panel with rich content, anchored to an element (PrimeNG Popover, formerly OverlayPanel). It closes on a click outside and on Escape, moves the focus in, and gives the focus back to the anchor."
      importFrom="import { StarPopover } from 'star-ng/popover';"
    >
      <docs-example
        heading="Details popover"
        source="popover/basic"
        note="Call toggle with the click event: the popover opens next to the element that got the click. The focus moves to the first focusable element inside. Escape closes the popover and the focus returns to the button. The button gets aria-expanded and aria-controls."
      >
        <star-button
          variant="secondary"
          leadingIcon="ph-bold ph-info"
          (pressed)="details.toggle($event)"
        >
          Details
        </star-button>
        <star-popover #details ariaLabel="Order details">
          <div class="docs-stack">
            <p class="docs-output"><strong>ORD-1042</strong></p>
            <p class="docs-output">Orchard Supply, 12 items, ships on Friday.</p>
            <star-button size="sm" (pressed)="details.hide()">Close</star-button>
          </div>
        </star-popover>
      </docs-example>

      <docs-example
        heading="Field in a popover"
        source="popover/field"
        [script]="fieldScript"
        note="The first focusable element gets the focus. Here it is the input, so the user can type at once. The shown and hidden outputs tell the page when the popover opens and closes."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button variant="secondary" (pressed)="rename.toggle($event)">
              Rename order
            </star-button>
          </div>
          <star-popover
            #rename
            ariaLabel="Rename order"
            (shown)="renameState.set('open')"
            (hidden)="renameState.set('closed')"
          >
            <star-field label="Order name">
              <input starInput value="Spring restock" />
            </star-field>
          </star-popover>
          <p class="docs-output" role="status">Popover: {{ renameState() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Keep it open"
        source="popover/pinned"
        note="dismissable=false turns off the close on a click outside, so the popover stays until your code closes it. focusOnShow=false leaves the focus on the button. Escape still closes the popover when the focus is inside it."
      >
        <star-button variant="secondary" (pressed)="pinned.toggle($event)">Toggle tip</star-button>
        <star-popover #pinned ariaLabel="Tip" [dismissable]="false" [focusOnShow]="false">
          <p class="docs-output">This tip stays open until you press the button again.</p>
        </star-popover>
      </docs-example>

      <docs-api [of]="['StarPopover']" [slots]="slots" [cssVars]="cssVars" [keyboard]="keyboard" />

      <h2>Methods</h2>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            StarPopover methods
          </caption>
          <thead>
            <tr>
              <th scope="col">Method</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            @for (row of methods; track row.name) {
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

      <h2>Technical notes</h2>
      <p>
        The panel is a native popover in the top layer, so it is shown above a modal dialog. It is
        positioned with the Angular CDK overlay below the anchor, and above the anchor when there is
        no room below.
      </p>
    </docs-page>
  `,
})
export class PopoverPage {
  protected readonly renameState = signal('closed');

  protected readonly fieldScript = `readonly renameState = signal('closed');`;

  protected readonly methods: readonly DocsRow[] = [
    {
      name: 'toggle(target)',
      description:
        'Opens on the target, or closes when it is open. The target is a click event or an element.',
    },
    { name: 'show(target)', description: 'Opens on the target: a click event or an element.' },
    {
      name: 'hide(restoreFocus = true)',
      description: 'Closes. The focus returns to the anchor when it was inside the popover.',
    },
    { name: 'align()', description: 'Positions the panel again after its content changed size.' },
    { name: 'visible', description: 'Read-only signal: true while the popover is open.' },
  ];

  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'The content of the panel.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of the panel.' },
    { name: '--star-border', description: 'Border of the panel.' },
    { name: '--star-radius-lg', description: 'Corner radius of the panel.' },
    { name: '--star-shadow-lg', description: 'Shadow of the panel.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Escape',
      description: 'Closes the popover. The focus returns to the anchor when it was inside.',
    },
    { name: 'Tab / Shift+Tab', description: 'Moves between the elements inside the popover.' },
  ];
}
