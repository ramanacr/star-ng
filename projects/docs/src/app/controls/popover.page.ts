import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarField, StarInput } from '@star-ng/ui/field';
import { StarPopover } from '@star-ng/ui/popover';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './popover.page.scss',
  selector: 'docs-popover-page',
  imports: [DOCS, StarButton, StarField, StarInput, StarPopover],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Popover"
      lead="A floating panel with rich content, anchored to an element (PrimeNG Popover, formerly OverlayPanel). It closes on a click outside and on Escape, moves the focus in, and gives the focus back to the anchor."
      importFrom="import { StarPopover } from '@star-ng/ui/popover';"
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

      <docs-example
        heading="Open at the end edge"
        source="popover/position"
        [script]="savedScript"
        note="position sets where the panel opens: below-start (the default), below-end, above-start or above-end. Here the Saved button is at the end of a toolbar, so the panel opens below-end: its end edge lines up with the end edge of the button. Start and end follow the reading direction. When there is no room below, the panel opens above; near the edge of the window it is pushed in. A popover (not a menu) fits here because each row has two buttons."
      >
        <div class="docs-row" style="width: 100%; justify-content: space-between">
          <span class="docs-output">{{ savedViews().length }} saved views</span>
          <star-button
            variant="secondary"
            leadingIcon="ph-bold ph-bookmark-simple"
            (pressed)="saved.toggle($event)"
          >
            Saved
          </star-button>
        </div>
        <star-popover #saved position="below-end" ariaLabel="Saved views">
          <div #savedList class="docs-stack" style="gap: var(--star-space-2); min-width: 16rem">
            @for (view of savedViews(); track view) {
              <div class="docs-row" style="justify-content: space-between; flex-wrap: nowrap">
                <star-button appearance="text" size="sm" (pressed)="saved.hide()">
                  {{ view }}
                </star-button>
                <star-button
                  appearance="text"
                  size="sm"
                  iconOnly
                  leadingIcon="ph-bold ph-trash"
                  [ariaLabel]="'Delete ' + view"
                  data-delete
                  (pressed)="deleteView(view, savedList)"
                />
              </div>
            } @empty {
              <p class="docs-output">No saved views.</p>
            }
            <star-button
              data-save
              variant="secondary"
              size="sm"
              leadingIcon="ph-bold ph-plus"
              (pressed)="saveView()"
            >
              Save current view
            </star-button>
          </div>
        </star-popover>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        The popover is aligned with the start edge of its anchor (or the end edge with a position
        that ends in end): the start edge is the right edge in a right-to-left page. When there is
        no room, it moves to the other edge. See the Right-to-left guide.
      </p>

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
        positioned with the Angular CDK overlay at the side and edge that position names, at the
        other edge or the other side when there is no room, and it is pushed inside the window.
      </p>
    </docs-page>
  `,
})
export class PopoverPage {
  protected readonly renameState = signal('closed');
  protected readonly savedViews = signal(['Open orders', 'Late shipments', 'This week']);
  private viewCount = 0;

  protected readonly savedScript = `readonly savedViews = signal(['Open orders', 'Late shipments', 'This week']);
private viewCount = 0;

private readonly injector = inject(Injector);

// The deleted button leaves the DOM, so move the focus to the next delete
// button, else the previous one, else to "Save current view".
deleteView(view: string, list: HTMLElement): void {
  const index = this.savedViews().indexOf(view);
  this.savedViews.update((views) => views.filter((v) => v !== view));
  afterNextRender(
    () => {
      const buttons = list.querySelectorAll<HTMLElement>('[data-delete] button');
      const next = buttons[Math.min(index, buttons.length - 1)];
      (next ?? list.querySelector<HTMLElement>('[data-save] button'))?.focus();
    },
    { injector: this.injector },
  );
}

saveView(): void {
  this.savedViews.update((views) => [...views, \`View \${++this.viewCount}\`]);
}`;

  private readonly injector = inject(Injector);

  protected deleteView(view: string, list: HTMLElement): void {
    const index = this.savedViews().indexOf(view);
    this.savedViews.update((views) => views.filter((v) => v !== view));
    afterNextRender(
      () => {
        const buttons = list.querySelectorAll<HTMLElement>('[data-delete] button');
        const next = buttons[Math.min(index, buttons.length - 1)];
        (next ?? list.querySelector<HTMLElement>('[data-save] button'))?.focus();
      },
      { injector: this.injector },
    );
  }

  protected saveView(): void {
    this.savedViews.update((views) => [...views, `View ${++this.viewCount}`]);
  }

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
    {
      name: 'ng-template[starHeader]',
      description:
        'Content child. A header above the content. closeOnEscape off keeps the popover open on Escape; dismissable off keeps it open on an outside click.',
    },
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
