import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { StarCarousel, StarCarouselItem } from '@star-ng/ui/media';
import { DOCS, DocsRow } from '../shared/docs';
import { sampleSet } from '../shared/sample-images';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './carousel.page.scss',
  selector: 'docs-carousel-page',
  imports: [DOCS, StarCarousel, StarCarouselItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Carousel"
      lead="A row of slides that scrolls with CSS scroll snap. Swipe and trackpad work as in any scrolling area. Buttons and page dots move by one page."
      importFrom="import { StarCarousel, StarCarouselItem } from '@star-ng/ui/media';"
    >
      <docs-example
        heading="One slide per page"
        source="carousel/basic"
        [script]="basicScript"
        note="Pass the data in items and draw each slide with an ng-template that has the starCarouselItem directive. The template gets the item as the implicit value and the position as index. The previous button is disabled on the first page and the next button on the last page. The page dots show the current page."
      >
        <star-carousel
          style="width: 100%; max-width: 40rem"
          [items]="photos"
          ariaLabel="Warehouse photos"
        >
          <ng-template starCarouselItem [starCarouselItemOf]="photos" let-photo>
            <img
              style="display: block; width: 100%; height: auto"
              [src]="photo.src"
              [alt]="photo.label"
            />
          </ng-template>
        </star-carousel>
      </docs-example>

      <docs-example
        heading="Several slides per page"
        source="carousel/visible"
        [script]="basicScript"
        note="numVisible sets how many slides share one page. Six items with numVisible 3 give two pages."
      >
        <star-carousel
          style="width: 100%; max-width: 40rem"
          [items]="photos"
          [numVisible]="3"
          ariaLabel="Warehouse photo pages"
        >
          <ng-template starCarouselItem [starCarouselItemOf]="photos" let-photo let-index="index">
            <figure style="margin: 0">
              <img
                style="display: block; width: 100%; height: auto"
                [src]="photo.src"
                [alt]="photo.label"
              />
              <figcaption>Slide {{ index + 1 }}</figcaption>
            </figure>
          </ng-template>
        </star-carousel>
      </docs-example>

      <docs-example
        heading="Autoplay"
        source="carousel/autoplay"
        [script]="basicScript"
        note="autoplay is the time in milliseconds between two pages (0 turns it off). The carousel goes back to the first page after the last one. A pause button appears with autoplay, so the user can stop the movement (WCAG 2.2.2). Autoplay also pauses while the pointer or the keyboard focus is inside the carousel."
      >
        <star-carousel
          style="width: 100%; max-width: 40rem"
          [items]="photos"
          [autoplay]="4000"
          ariaLabel="Automatic photos"
        >
          <ng-template starCarouselItem [starCarouselItemOf]="photos" let-photo>
            <img
              style="display: block; width: 100%; height: auto"
              [src]="photo.src"
              [alt]="photo.label"
            />
          </ng-template>
        </star-carousel>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        With <code>dir="rtl"</code> the first slide is on the right and the pages run to the left:
        the scroll offset of the track is zero or negative. The previous and next arrows turn
        around. See the Right-to-left guide.
      </p>

      <docs-api
        [of]="['StarCarousel', 'StarCarouselItem', 'StarCarouselIndicator']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />

      <h2>Technical notes</h2>
      <p>
        All slides are in the page. The carousel does not load slides on demand, so use it for a
        short list. The region has the role <code>region</code> with
        <code>aria-roledescription="carousel"</code>, and each slide is a group with the description
        <code>slide</code> and the name "n of total". The track is a live region
        (<code>polite</code>) while autoplay is off.
      </p>
      <p>
        <code>goTo(page)</code> is a public method. It scrolls smooth, or without animation when the
        user prefers reduced motion.
      </p>
    </docs-page>
  `,
})
export class CarouselPage {
  protected readonly photos = sampleSet('Warehouse', 6, 480, 270);

  protected readonly basicScript = `readonly photos = sampleSet('Warehouse', 6, 480, 270);
// sampleSet makes { label, src } objects. src is an inline SVG data URL.`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starHeader] / ng-template[starFooter]',
      description:
        'Content child. Content above and below the carousel. PrimeNG #header and #footer.',
    },
    {
      name: 'ng-template[starIcon]',
      description:
        'Content child. "previous" or "next" replaces the icon of that button. PrimeNG #previousicon and #nexticon.',
    },
    {
      name: 'ng-template[starCarouselIndicator]',
      description:
        'Content child. The content of each page dot; let-active is true for the current page. The button keeps its name.',
    },
    {
      name: 'ng-template[starCarouselItem]',
      description:
        'Template of one slide. The context has $implicit (the item) and index (its position).',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-visible',
      description: 'Number of slides per page. The component sets it from numVisible.',
    },
    { name: '--star-border-strong', description: 'Color of the inactive page dots.' },
    { name: '--star-primary', description: 'Color of the active page dot.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab / Shift+Tab',
      description: 'Moves between pause, previous, next and the page dots.',
    },
    {
      name: 'Enter / Space',
      description: 'On a button: pauses or plays, goes one page back or forward, or opens a page.',
    },
  ];
}
