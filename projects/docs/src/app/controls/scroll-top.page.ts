import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarScrollTop } from '@star-ng/ui/utility';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-scroll-top-page',
  imports: [DOCS, StarScrollTop],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Scroll top"
      lead="A round button that appears after the user scrolled down, and scrolls back to the top. It scrolls the window, or the element in target. The scroll is smooth unless the user prefers reduced motion."
      importFrom="import { StarScrollTop } from '@star-ng/ui/utility';"
    >
      <docs-example
        heading="Scroll container"
        source="scroll-top/target"
        [script]="script"
        note="The button is position: fixed. In this example the box has a transform, so the button stays inside the box. Scroll the box down by 100 px or more and the button appears."
      >
        <div class="docs-scroll-box">
          <div #scroller class="docs-scroll-box__list" tabindex="0" aria-label="Order list">
            @for (row of rows; track row) {
              <p class="docs-output">Order {{ row }}</p>
            }
          </div>
          <star-scroll-top [target]="scroller" [threshold]="100" />
        </div>
      </docs-example>

      <p>
        Without <code>target</code>, the button watches the window. Place one
        <code>&lt;star-scroll-top /&gt;</code> in the root component of the application.
      </p>

      <docs-api [of]="['StarScrollTop']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
  styles: `
    .docs-scroll-box {
      position: relative;
      width: 100%;
      height: 12rem;
      border: 1px solid var(--star-border);
      border-radius: var(--star-radius-md);
      transform: translateZ(0);
    }
    .docs-scroll-box__list {
      height: 100%;
      overflow: auto;
      padding: var(--star-space-3);
    }
    .docs-scroll-box__list p {
      margin: 0 0 var(--star-space-3);
    }
  `,
})
export class ScrollTopPage {
  protected readonly rows = Array.from({ length: 30 }, (_, index) => 1001 + index);

  protected readonly script = `readonly rows = Array.from({ length: 30 }, (_, index) => 1001 + index);`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-text-strong', description: 'Background of the button.' },
    { name: '--star-on-tone', description: 'Color of the arrow.' },
    { name: '--star-shadow-float', description: 'Shadow of the button.' },
    { name: '--star-duration-base', description: 'Duration of the fade in and out.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab',
      description:
        'The button takes focus only while it is visible. Hidden, it is out of the tab order.',
    },
    { name: 'Enter / Space', description: 'Scrolls to the top.' },
  ];
}
