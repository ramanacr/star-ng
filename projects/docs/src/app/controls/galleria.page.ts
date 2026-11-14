import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarGalleria, StarGalleryImage } from 'star-ng/media';
import { DOCS, DocsRow } from '../shared/docs';
import { sampleImage, sampleSet } from '../shared/sample-images';

@Component({
  selector: 'docs-galleria-page',
  imports: [DOCS, StarGalleria],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Galleria"
      lead="A large image with a caption, previous and next buttons and a strip of thumbnails."
      importFrom="import { StarGalleria, StarGalleryImage } from 'star-ng/media';"
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

      <docs-api [of]="['StarGalleria']" [cssVars]="cssVars" [keyboard]="keyboard" />

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
