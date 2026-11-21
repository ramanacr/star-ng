import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarFooterTemplate } from '@star-ng/ui/core';
import {
  StarGalleria,
  StarGalleriaResponsiveOption,
  StarGalleriaTemplate,
  StarGalleryImage,
} from '@star-ng/ui/media';
import { DOCS, DocsRow } from '../shared/docs';
import { sampleImage, sampleSet } from '../shared/sample-images';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './galleria.page.scss',
  selector: 'docs-galleria-page',
  imports: [DOCS, StarGalleria, StarGalleriaTemplate, StarFooterTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Galleria"
      lead="A large image with a caption, previous and next buttons and a strip of thumbnails."
      importFrom="import { StarGalleria, StarGalleryImage } from '@star-ng/ui/media';"
    >
      <docs-example
        heading="Images and thumbnails"
        source="galleria/basic"
        [script]="basicScript"
        note="Each image has src and alt. The optional caption shows on the image, and the optional thumbnail is a smaller picture for the strip (the strip uses src when there is none). The thumbnail of the active image has aria-current. The count in the corner shows the position."
      >
        <star-galleria
          style="width: 100%; max-width: 40rem"
          [images]="images"
          ariaLabel="Site photos"
        />
      </docs-example>

      <docs-example
        heading="Active image from outside"
        source="galleria/model"
        [script]="modelScript"
        note="activeIndex is a model: bind it with [(activeIndex)] to read or set the image that shows."
      >
        <star-galleria
          style="width: 100%; max-width: 40rem"
          [images]="images"
          [(activeIndex)]="active"
          ariaLabel="Linked photos"
        />
        <p class="docs-output" role="status">Active index: {{ active() }}</p>
      </docs-example>

      <docs-example
        heading="Thumbnails, indicators and autoplay"
        source="galleria/options"
        [script]="optionsScript"
        note="thumbnailsPosition puts the strip at the bottom, the top, the start (left) or the end (right); a side strip is as high as verticalThumbnailViewPortHeight. numVisible shows that many thumbnails, and the strip follows the image; responsiveOptions changes numVisible per window width. showThumbnailNavigators adds buttons at the ends of the strip. showIndicators adds one button per image (showIndicatorsOnItem puts them on the image, indicatorsPosition chooses the side, changeItemOnIndicatorHover changes the image on hover). autoPlay shows the next image every transitionInterval milliseconds, with a pause button; it pauses while the pointer or the focus is on the gallery, does not advance with reduced motion, and a click on a button stops it (shouldStopAutoplayByClick). circular off stops the buttons at the first and the last image."
      >
        <star-galleria
          style="width: 100%; max-width: 40rem"
          [images]="images"
          ariaLabel="Dock photos with indicators"
          thumbnailsPosition="right"
          [numVisible]="3"
          [responsiveOptions]="responsive"
          showThumbnailNavigators
          showIndicators
          showItemNavigatorsOnHover
          autoPlay
          [transitionInterval]="5000"
          [circular]="false"
        />
      </docs-example>

      <docs-example
        heading="Full screen"
        source="galleria/full-screen"
        [script]="fullScreenScript"
        note="fullScreen shows the gallery in a modal dialog that fills the window while visible is true; nothing shows in the page. Open it from your own button or thumbnail and set activeIndex to choose the first image. Escape and the close button close it, and the focus goes back to the button."
      >
        <div class="docs-row">
          @for (image of images; track image.src; let i = $index) {
            <button
              type="button"
              class="star-btn star-btn--secondary star-btn--sm"
              (click)="openAt(i)"
            >
              Open {{ image.alt }}
            </button>
          }
        </div>
        <star-galleria
          [images]="images"
          [(activeIndex)]="fullIndex"
          [(visible)]="fullOpen"
          fullScreen
          ariaLabel="Dock photos"
        />
      </docs-example>

      <docs-example
        heading="Templates"
        source="galleria/templates"
        [script]="templatesScript"
        note="starGalleriaTemplate replaces a part: item (the large image), caption, thumbnail or indicator. Each gets the image, index and active. starHeader and starFooter add content above and below; starIcon replaces the icons previous, next, previousThumbnail and nextThumbnail."
      >
        <star-galleria
          style="width: 100%; max-width: 40rem"
          [images]="images"
          ariaLabel="Dock photos with captions"
          showIndicators
        >
          <ng-template starGalleriaTemplate="caption" let-image let-i="index">
            <strong>{{ i + 1 }}.</strong> {{ image.alt }}
          </ng-template>
          <ng-template starGalleriaTemplate="indicator" let-i="index">{{ i + 1 }}</ng-template>
          <ng-template starFooter>
            <p class="docs-output">Photos of the north loading dock.</p>
          </ng-template>
        </star-galleria>
      </docs-example>

      <h2>Names in PrimeNG</h2>
      <p>
        The PrimeNG p-galleria names that StarNG gives in another way: value is images; id is the id
        attribute of the host; containerClass, containerStyle and maskClass are the pass-through pt
        (parts bodyPanel and stagePanel) and the class and style of the host. Not needed: baseZIndex
        (the full-screen dialog is in the top layer of the browser), motionOptions and
        maskMotionOptions (the motion comes from the theme tokens and stops with reduced motion) and
        the closeicon template (the full-screen dialog has its own close button).
      </p>

      <h2>Right-to-left</h2>
      <p>
        With <code>dir="rtl"</code> the first thumbnail is on the right. Arrow left shows the next
        image and Arrow right the previous one, and the arrows on the image turn around. See the
        Right-to-left guide.
      </p>

      <docs-api
        [of]="['StarGalleria', 'StarGalleriaTemplate']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />

      <h2>Technical notes</h2>
      <p>
        The images load lazily. The component draws the large image of the active entry only, and a
        thumbnail for every entry. Next from the last image goes to the first one, and previous from
        the first image goes to the last one. <code>step(delta)</code> is a public method for your
        own buttons.
      </p>
    </docs-page>
  `,
})
export class GalleriaPage {
  protected readonly images: readonly StarGalleryImage[] = sampleSet('Loading dock', 5).map(
    (item, index) => ({
      src: item.src,
      alt: item.label,
      caption: `${item.label} of 5`,
      thumbnail: index % 2 === 0 ? sampleImage(String(index + 1), '#555555', 96, 64) : undefined,
    }),
  );
  protected readonly active = signal(2);
  protected readonly responsive: readonly StarGalleriaResponsiveOption[] = [
    { breakpoint: '640px', numVisible: 2 },
  ];
  protected readonly fullIndex = signal(0);
  protected readonly fullOpen = signal(false);
  protected openAt(index: number): void {
    this.fullIndex.set(index);
    this.fullOpen.set(true);
  }
  protected readonly optionsScript = `readonly responsive: readonly StarGalleriaResponsiveOption[] = [
  { breakpoint: '640px', numVisible: 2 },
];`;
  protected readonly fullScreenScript = `readonly fullIndex = signal(0);
readonly fullOpen = signal(false);
openAt(index: number): void {
  this.fullIndex.set(index);
  this.fullOpen.set(true);
}`;
  protected readonly templatesScript = `// Import StarGalleriaTemplate from '@star-ng/ui/media'
// and StarFooterTemplate from '@star-ng/ui/core'.`;
  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starGalleriaTemplate]',
      description:
        'Content child. "item", "caption", "thumbnail" or "indicator" replaces that part. The context has $implicit (the image), index and active. Thumbnails and indicators are buttons: no focusable content. PrimeNG item, caption, thumbnail and indicator templates.',
    },
    {
      name: 'ng-template[starHeader] / ng-template[starFooter]',
      description: 'Content child. Content above or below the gallery. PrimeNG header and footer.',
    },
    {
      name: 'ng-template[starIcon]',
      description:
        'Content child. Replaces an icon: previous, next, previousThumbnail or nextThumbnail. PrimeNG itempreviousicon, itemnexticon, previousthumbnailicon and nextthumbnailicon.',
    },
  ];

  protected readonly basicScript = `readonly images: readonly StarGalleryImage[] = [
  { src: dockOne, alt: 'Loading dock 1', caption: 'Loading dock 1 of 5', thumbnail: dockOneSmall },
  { src: dockTwo, alt: 'Loading dock 2', caption: 'Loading dock 2 of 5' },
  // ...
];
// The docs make the sources with sampleImage(label, color): inline SVG data URLs.`;
  protected readonly modelScript = `readonly active = signal(2);`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-radius-lg', description: 'Corner radius of the large image.' },
    { name: '--star-text-strong', description: 'Background behind the large image.' },
    { name: '--star-primary', description: 'Border of the active thumbnail.' },
    { name: '--star-focus-ring', description: 'Focus ring of the large image.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'ArrowLeft', description: 'On the large image: shows the previous image.' },
    { name: 'ArrowRight', description: 'On the large image: shows the next image.' },
    {
      name: 'Tab / Shift+Tab',
      description: 'Moves between the large image, the arrow buttons and the thumbnails.',
    },
    { name: 'Enter / Space', description: 'On a button: shows that image or steps.' },
  ];
}
