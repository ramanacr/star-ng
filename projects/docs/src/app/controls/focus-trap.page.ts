import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarToggleSwitch } from '@star-ng/ui/toggle-switch';
import { StarFocusTrap } from '@star-ng/ui/utility';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-focus-trap-page-content',
  imports: [DOCS, StarFocusTrap, StarButton, StarToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Focus trap"
      lead="A directive that keeps Tab and Shift+Tab inside an element. It builds on the CDK focus trap. star-dialog and star-drawer already trap focus: use this for a custom overlay."
      importFrom="import { StarFocusTrap } from '@star-ng/ui/utility';"
    >
      <docs-example
        heading="Trap Tab in a row"
        source="focus-trap/basic"
        [script]="script"
        note="The directive value turns the trap on or off. autoCapture moves the focus into the element when the trap turns on and returns it when the trap turns off."
      >
        <div class="docs-stack">
          <div class="docs-row docs-trap" [starFocusTrap]="trapOn()">
            <star-toggle-switch [(checked)]="trapOn">Keep Tab in this row</star-toggle-switch>
            <star-button size="sm" variant="secondary">One</star-button>
            <star-button size="sm" variant="secondary">Two</star-button>
          </div>
          <p class="docs-output" role="status">Trap is {{ trapOn() ? 'on' : 'off' }}.</p>
        </div>
      </docs-example>

      <docs-api [of]="['StarFocusTrap']" [keyboard]="keyboard" />
    </docs-page>
  `,
  styles: `
    .docs-trap {
      padding: var(--star-space-3);
      border: 1px dashed var(--star-border-strong);
      border-radius: var(--star-radius-md);
    }
  `,
})
export class FocusTrapPageContent {
  protected readonly trapOn = signal(false);

  protected readonly script = `readonly trapOn = signal(false);`;

  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab',
      description: 'On the last focusable element: moves to the first one inside the trap.',
    },
    {
      name: 'Shift+Tab',
      description: 'On the first focusable element: moves to the last one inside the trap.',
    },
  ];
}

/**
 * Route component of the page. It loads the route styles (`focus-trap.page.scss`): the library
 * partials of the page and the docs layout. The page content is a child, so its own component
 * styles come after them, as they came after the global styles.
 */
@Component({
  selector: 'docs-focus-trap-page',
  imports: [FocusTrapPageContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './focus-trap.page.scss',
  template: '<docs-focus-trap-page-content />',
})
export class FocusTrapPage {}
