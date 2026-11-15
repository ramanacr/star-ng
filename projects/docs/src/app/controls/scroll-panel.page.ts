import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarScrollPanel } from '@star-ng/ui/utility';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-scroll-panel-page',
  imports: [DOCS, StarScrollPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Scroll panel"
      lead="A region with a fixed height and a thin scrollbar in the StarNG colors. It takes keyboard focus, so a keyboard user can scroll it. Give it a name with ariaLabel."
      importFrom="import { StarScrollPanel } from '@star-ng/ui/utility';"
    >
      <docs-example
        heading="Fixed height"
        source="scroll-panel/basic"
        note="height sets a fixed height. The region has role region and tabindex 0: focus it and use the arrow keys to scroll."
      >
        <star-scroll-panel class="docs-panel" height="8rem" ariaLabel="Order notes">
          <p class="docs-output">
            The order was placed on 2 November. The customer asked for delivery to the second
            address. The warehouse packed the order on 3 November. The carrier picked it up on 4
            November. The customer asked for a delivery window in the afternoon. The carrier
            confirmed the window. The order stays open until the customer confirms receipt. All data
            in this text is fictional.
          </p>
        </star-scroll-panel>
      </docs-example>

      <docs-example
        heading="Maximum height"
        source="scroll-panel/max"
        note="maxHeight lets a short content stay short and scrolls only a long one."
      >
        <star-scroll-panel class="docs-panel" maxHeight="5rem" ariaLabel="Short notes">
          <p class="docs-output">Two short lines of text.<br />The panel does not scroll.</p>
        </star-scroll-panel>
      </docs-example>

      <docs-api
        [of]="['StarScrollPanel']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
  styles: `
    .docs-panel {
      width: 100%;
      max-width: 32rem;
      padding: var(--star-space-3);
      border: 1px solid var(--star-border);
    }
  `,
})
export class ScrollPanelPage {
  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'The content that scrolls.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-border-strong', description: 'Color of the scrollbar thumb.' },
    { name: '--star-accent', description: 'Focus ring of the panel.' },
    { name: '--star-radius-sm', description: 'Corner radius of the panel.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Moves the focus to the panel.' },
    { name: 'Arrow up / Arrow down', description: 'Scrolls the panel (native browser behavior).' },
    { name: 'Page up / Page down / Home / End', description: 'Scrolls by a page or to the ends.' },
  ];
}
