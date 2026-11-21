import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarIconTemplate } from '@star-ng/ui/core';
import { StarImage } from '@star-ng/ui/media';
import { DOCS, DocsRow } from '../shared/docs';
import { sampleImage } from '../shared/sample-images';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './image.page.scss',
  selector: 'docs-image-page',
  imports: [DOCS, StarImage, StarIconTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Image"
      lead="A lazy image that can open in a dialog with zoom and rotate buttons."
      importFrom="import { StarImage } from '@star-ng/ui/media';"
    >
      <docs-example
        heading="Plain image"
        source="image/basic"
        [script]="script"
        note="Without preview the component is an img element with lazy loading. src and alt are required. width sets the width attribute."
      >
        <star-image [src]="shelf" alt="Shelf photo" [width]="240" />
      </docs-example>

      <docs-example
        heading="Preview"
        source="image/preview"
        [script]="script"
        note="With preview the image is a button. A click, or Enter or Space, opens the full image in a modal dialog. The title of the dialog is the alt text. The zoom buttons scale the image from 50% to 300% in steps of 25%, and the rotate buttons turn it by a quarter. Escape, the close button and a click on the backdrop close the dialog, and the focus goes back to the image button."
      >
        <star-image [src]="shelf" alt="Shelf photo" [width]="240" preview />
      </docs-example>

      <docs-example
        heading="Larger preview, sources and events"
        source="image/sources"
        [script]="sourcesScript"
        note="previewImageSrc shows another file in the preview, for example a larger one (previewImageSrcSet and previewImageSizes give its srcset and sizes). srcSet, sizes, height and loading (lazy or eager) go to the thumbnail. show and hide emit when the preview opens and closes, and imageError when the thumbnail cannot load. starIcon replaces the icons: preview (the hint on the thumbnail), zoomIn, zoomOut, rotateLeft and rotateRight. starImageTemplate replaces the picture: image (the thumbnail) or preview (the picture in the dialog, with zoom, rotate and transform in the context)."
      >
        <div class="docs-stack">
          <star-image
            [src]="shelf"
            [previewImageSrc]="shelfLarge"
            alt="Shelf photo, large"
            [width]="240"
            [height]="135"
            preview
            (show)="previewLog.set('Preview open')"
            (hide)="previewLog.set('Preview closed')"
          >
            <ng-template starIcon="preview"
              ><i class="ph-bold ph-arrows-out" aria-hidden="true"></i
            ></ng-template>
          </star-image>
          <p class="docs-output" role="status">{{ previewLog() || 'Preview not opened yet' }}</p>
        </div>
      </docs-example>

      <h2>Names in PrimeNG</h2>
      <p>
        The PrimeNG p-image names that StarNG gives in another way: imageClass and imageStyle are
        the pass-through pt (part picture). Not needed: appendTo (the preview dialog is in the top
        layer), modalEnterAnimation, modalLeaveAnimation, motionOptions and maskMotionOptions (the
        motion of the dialog comes from the theme tokens and stops with reduced motion) and the
        closeicon template (the dialog has its own close button).
      </p>

      <docs-api
        [of]="['StarImage', 'StarImageTemplate']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />

      <h2>Technical notes</h2>
      <p>
        The preview uses <code>star-dialog</code> (size <code>xl</code>), so it has the focus trap
        and the inert page of that control. The zoom level and the rotation are not reset when the
        dialog closes: the dialog opens again with the last zoom and rotation.
      </p>
    </docs-page>
  `,
})
export class ImagePage {
  protected readonly shelf = sampleImage('Shelf', '#3b6ea5', 960, 540);
  protected readonly shelfLarge = sampleImage('Shelf, large', '#3b6ea5', 1920, 1080);
  protected readonly previewLog = signal('');
  protected readonly sourcesScript = `readonly shelf = sampleImage('Shelf', '#3b6ea5', 960, 540);
readonly shelfLarge = sampleImage('Shelf, large', '#3b6ea5', 1920, 1080);
readonly previewLog = signal('');
// Import StarIconTemplate from '@star-ng/ui/core' for the starIcon slot.`;
  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starImageTemplate]',
      description:
        'Content child. "image" replaces the thumbnail, "preview" the picture in the dialog. The context has $implicit (the address), alt, zoom, rotate and transform (the CSS transform of the preview). PrimeNG image and preview templates.',
    },
    {
      name: 'ng-template[starIcon]',
      description:
        'Content child. Replaces an icon: preview (the hint on the thumbnail, PrimeNG indicator), zoomIn, zoomOut, rotateLeft or rotateRight.',
    },
  ];

  protected readonly script = `readonly shelf = sampleImage('Shelf', '#3b6ea5', 960, 540);
// An inline SVG data URL. In an application use the address of your own image.`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-radius-md', description: 'Corner radius of the preview button.' },
    { name: '--star-accent', description: 'Focus outline of the preview button.' },
    { name: '--star-duration-base', description: 'Time of the zoom transition.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Enter / Space', description: 'On the image button: opens the preview.' },
    {
      name: 'Escape',
      description: 'Closes the preview and returns the focus to the image button.',
    },
    {
      name: 'Tab / Shift+Tab',
      description: 'Moves between the close and zoom buttons inside the preview.',
    },
  ];
}
