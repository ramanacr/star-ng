import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarAnimateOnScroll } from '@star-ng/ui/utility';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-animate-on-scroll-page',
  imports: [DOCS, StarAnimateOnScroll],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Animate on scroll"
      lead="A directive that fades an element in and moves it up the first time it comes into view. The content is visible at once when the user asks for reduced motion or the browser has no IntersectionObserver."
      importFrom="import { StarAnimateOnScroll } from '@star-ng/ui/utility';"
    >
      <docs-example
        heading="Reveal while scrolling"
        source="animate-on-scroll/basic"
        note="Scroll the box. Each block appears when 15 % of it is in view. threshold changes that share (0 to 1). The block stays visible after it appeared."
      >
        <div class="docs-reveal-box" tabindex="0" aria-label="Scrollable list of blocks">
          @for (block of blocks; track block) {
            <div class="docs-reveal-box__item" starAnimateOnScroll>Block {{ block }}</div>
          }
        </div>
      </docs-example>

      <docs-api [of]="['StarAnimateOnScroll']" [cssVars]="cssVars" />
    </docs-page>
  `,
  styles: `
    .docs-reveal-box {
      display: grid;
      gap: var(--star-space-4);
      width: 100%;
      max-width: 24rem;
      height: 10rem;
      overflow: auto;
      padding: var(--star-space-3);
      border: 1px solid var(--star-border);
      border-radius: var(--star-radius-md);
    }
    .docs-reveal-box__item {
      display: grid;
      place-items: center;
      min-height: 5rem;
      border-radius: var(--star-radius-md);
      background: var(--star-surface-muted);
      color: var(--star-text-strong);
    }
  `,
})
export class AnimateOnScrollPage {
  protected readonly blocks = [1, 2, 3, 4, 5, 6];

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-duration-slow', description: 'Duration of the fade and the move.' },
  ];
}
