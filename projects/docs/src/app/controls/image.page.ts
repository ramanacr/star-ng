import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarImage } from '@star-ng/ui/media';
import { DOCS, DocsRow } from '../shared/docs';
import { sampleImage } from '../shared/sample-images';

@Component({
  selector: 'docs-image-page',
  imports: [DOCS, StarImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Image"
      lead="A lazy image that can open in a dialog with zoom buttons."
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
        note="With preview the image is a button. A click, or Enter or Space, opens the full image in a modal dialog. The title of the dialog is the alt text. The zoom buttons scale the image from 50% to 300% in steps of 25%. Escape, the close button and a click on the backdrop close the dialog, and the focus goes back to the image button."
      >
        <star-image [src]="shelf" alt="Shelf photo" [width]="240" preview />
      </docs-example>

      <docs-api [of]="['StarImage']" [cssVars]="cssVars" [keyboard]="keyboard" />

      <h2>Technical notes</h2>
      <p>
        The preview uses <code>star-dialog</code> (size <code>xl</code>), so it has the focus trap
        and the inert page of that control. The zoom level is not reset when the dialog closes: the
        dialog opens again with the last zoom.
      </p>
    </docs-page>
  `,
})
export class ImagePage {
  protected readonly shelf = sampleImage('Shelf', '#3b6ea5', 960, 540);

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
