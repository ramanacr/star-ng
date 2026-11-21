import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarImageEditor } from '@star-ng/ui/image-editor';
import { DOCS, DocsRow } from '../shared/docs';

/**
 * A neutral landscape as an inline SVG data URL: sky, sun, hills and a lake. The docs need no
 * image file and no network.
 */
function sampleScene(): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">` +
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#7cb8e8"/><stop offset="1" stop-color="#d9ecf7"/></linearGradient></defs>` +
    `<rect width="960" height="600" fill="url(#sky)"/>` +
    `<circle cx="760" cy="140" r="64" fill="#f6c445"/>` +
    `<path d="M0 380 L180 240 L340 360 L520 200 L720 350 L960 260 L960 600 L0 600 Z" fill="#5e8c61"/>` +
    `<path d="M0 450 L260 360 L520 440 L760 380 L960 430 L960 600 L0 600 Z" fill="#3f6b45"/>` +
    `<ellipse cx="420" cy="520" rx="260" ry="46" fill="#4f86b8"/>` +
    `<rect x="120" y="410" width="70" height="60" fill="#b5523b"/>` +
    `<path d="M110 412 L155 372 L200 412 Z" fill="#7a3426"/>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

@Component({
  selector: 'docs-image-editor-page-content',
  imports: [DOCS, StarButton, StarImageEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .preview {
      max-inline-size: 12rem;
      max-block-size: 8rem;
      border: 1px solid var(--star-border);
      border-radius: var(--star-radius-sm);
    }
  `,
  template: `
    <docs-page
      heading="Image editor"
      lead="Crop, rotate, flip, resize, adjust the colors and annotate an image, with undo and redo. The Syncfusion equivalent is ImageEditor, the Kendo UI equivalent is ImageEditor."
      importFrom="import { StarImageEditor } from '@star-ng/ui/image-editor';"
    >
      <docs-example
        heading="Edit an image"
        source="image-editor/basic"
        [script]="script"
        note="The toolbar is one tab stop: the arrow keys move between the tools. Crop opens a crop box with ratios (free, 1:1, 4:3, 16:9); Rotate by angle, Resize and Adjust colors show their change before Apply. Annotate draws a pen line, a rectangle, an ellipse, an arrow or a text in a palette color. Control+Z and Control+Y undo and redo."
      >
        <div class="docs-stack">
          <star-image-editor
            #editor
            [src]="scene"
            [(value)]="edited"
            ariaLabel="Landscape editor"
            imageAlt="Landscape with hills, a lake and a house"
          />
          <div class="docs-row">
            <star-button variant="secondary" (pressed)="exportPng()">Export PNG</star-button>
            <star-button variant="secondary" (pressed)="exportJpeg()">Export JPEG</star-button>
          </div>
          <p class="docs-output" role="status">{{ exported() }}</p>
          @if (edited()) {
            <img class="preview" [src]="edited()" alt="Preview of the edited image" />
          }
          <p class="docs-output">Value: {{ summary() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Edit a file of the user"
        source="image-editor/file"
        [script]="fileScript"
        note="A file from a file input becomes a blob: URL, which the editor may draw. The page frees the old URL when a new file comes."
      >
        <div class="docs-stack">
          <label class="docs-row">
            Image file
            <input type="file" accept="image/*" (change)="openFile($event)" />
          </label>
          <star-image-editor [src]="fileUrl()" ariaLabel="File editor" />
        </div>
      </docs-example>

      <h2>Non-destructive edits</h2>
      <p>
        Every edit is an operation in a list (<code>operations</code>): crop, rotate, flip, resize,
        adjust and annotate. The editor replays the list on the source image for the view and for
        the export, so undo, redo and the deletion of an annotation never lose pixels. The colour
        adjustments use the canvas <code>filter</code>; where a browser has none, the same CSS
        filter formulas run on the pixels. In the browser the view canvas is scaled by
        <code>devicePixelRatio</code>; on the server nothing is drawn and
        <code>exportImage()</code> resolves to <code>null</code>.
      </p>

      <h2>Image sources</h2>
      <p>
        Only <code>data:image/</code>, <code>blob:</code> and same-origin addresses are drawn. An
        image of another origin taints the canvas, and the browser then refuses the export. Such an
        address shows an empty editor and a warning in development mode.
      </p>

      <docs-api [of]="['StarImageEditor']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class ImageEditorPageContent {
  private readonly doc = inject(DOCUMENT);
  private readonly editor = viewChild.required<StarImageEditor>('editor');
  protected readonly scene = sampleScene();
  protected readonly edited = signal('');
  protected readonly exported = signal('Nothing exported yet.');
  protected readonly fileUrl = signal<string | null>(null);
  protected readonly summary = computed(() => {
    const value = this.edited();
    return value ? `${value.slice(0, 22)}… (${value.length} characters)` : '(no edits)';
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revoke());
  }

  protected async exportPng(): Promise<void> {
    const blob = await this.editor().exportImage();
    this.exported.set(blob ? `PNG, ${blob.size} bytes` : 'Export not available.');
  }

  protected async exportJpeg(): Promise<void> {
    const blob = await this.editor().exportImage({ type: 'image/jpeg', quality: 0.85 });
    this.exported.set(blob ? `JPEG, ${blob.size} bytes` : 'Export not available.');
  }

  protected openFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    const url = this.doc.defaultView?.URL;
    if (!file || !url) return;
    this.revoke();
    this.fileUrl.set(url.createObjectURL(file));
  }

  private revoke(): void {
    const old = this.fileUrl();
    if (old) this.doc.defaultView?.URL.revokeObjectURL(old);
  }

  protected readonly script = `readonly scene = sampleScene(); // an inline SVG data URL
readonly edited = signal('');
private readonly editor = viewChild.required<StarImageEditor>('editor');

async exportPng() {
  const blob = await this.editor().exportImage(); // null on the server
}
async exportJpeg() {
  const blob = await this.editor().exportImage({ type: 'image/jpeg', quality: 0.85 });
}`;

  protected readonly fileScript = `readonly fileUrl = signal<string | null>(null);

openFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const old = this.fileUrl();
  if (old) URL.revokeObjectURL(old);
  this.fileUrl.set(URL.createObjectURL(file));
}`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-image-editor-height', description: 'Height of the stage (24rem).' },
    { name: '--star-chart-1 … --star-chart-8', description: 'The annotation colors.' },
    {
      name: '--star-accent',
      description: 'Focus outline and the outline of the chosen annotation.',
    },
    { name: '--star-primary-soft', description: 'Background of a pressed tool.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Arrow left / right, Home, End', description: 'Toolbar: moves between the tools.' },
    { name: 'Enter / Space', description: 'Presses the focused tool or button.' },
    { name: 'Arrow keys', description: 'Crop box: moves it by 1 % of the image.' },
    { name: 'Shift + arrow keys', description: 'Crop box: resizes it; a fixed ratio is kept.' },
    { name: 'Enter / Escape', description: 'Crop box: applies / cancels the crop.' },
    {
      name: 'Arrow up / down, Delete',
      description: 'Annotation list: chooses an annotation / deletes it.',
    },
    { name: 'Control + Z / Control + Y', description: 'Undo / redo (Command on macOS).' },
    { name: 'Escape', description: 'Closes the open tool panel without a change.' },
  ];
}

/**
 * Route component of the page. It loads the route styles (`image-editor.page.scss`): the library
 * partials of the page and the docs layout. The page content is a child, so its own component
 * styles come after them, as they came after the global styles.
 */
@Component({
  selector: 'docs-image-editor-page',
  imports: [ImageEditorPageContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './image-editor.page.scss',
  template: '<docs-image-editor-page-content />',
})
export class ImageEditorPage {}
