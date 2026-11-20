import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  STAR_DOCUMENT_RENDERER,
  StarDocumentError,
  StarDocumentViewer,
} from '@star-ng/ui/document-viewer';
import { DOCS, DocsRow } from '../shared/docs';
import { sampleSet } from '../shared/sample-images';
import { ImagePagesRenderer, SampleReportRenderer } from '../shared/sample-renderers';

@Component({
  selector: 'docs-document-viewer-page',
  imports: [DOCS, StarDocumentViewer, StarDocumentError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // One renderer per providing component: only the first example uses it; the others pass their own.
  providers: [{ provide: STAR_DOCUMENT_RENDERER, useFactory: () => new SampleReportRenderer() }],
  template: `
    <docs-page
      heading="Document viewer"
      lead="A viewer shell for paged documents: page navigation, zoom, rotation, thumbnails, search, full screen, and download and print outputs. A renderer reads the document and draws the pages; StarNG ships no PDF engine: the recommended engine is PDF Viewer Native (pdfviewer-embed), and PDF.js or your own engine works as well. The PDF.js viewer, Syncfusion ejs-pdfviewer and Kendo UI PDFViewer are the equivalents; DevExtreme and Ignite UI have none."
      importFrom="import { StarDocumentViewer, STAR_DOCUMENT_RENDERER } from '@star-ng/ui/document-viewer';"
    >
      <docs-example
        heading="Generated report"
        source="document-viewer/report"
        [script]="reportScript"
        note="The renderer comes from STAR_DOCUMENT_RENDERER. It gives text, so Control+F searches and screen readers read each page. Only the pages in view plus one have a canvas. Page Up and Page Down change the page; Control and the mouse wheel zoom."
      >
        <div class="docs-stack">
          <star-document-viewer
            [source]="12"
            title="Quarterly report"
            height="28rem"
            [(page)]="page"
            [(thumbnails)]="thumbnails"
            (download)="action.set('download pressed: save the file here.')"
            (print)="action.set('print pressed: print the file here.')"
          />
          <p class="docs-output" role="status">Page {{ page() }}. {{ action() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Image pages"
        source="document-viewer/images"
        [script]="imagesScript"
        note="The renderer input wins over the token. This renderer shows a list of image URLs as pages (scans or slides); it has no text, so there is no search and each page is an image."
      >
        <star-document-viewer
          [source]="images"
          [renderer]="imageRenderer"
          title="Warehouse scans"
          height="22rem"
          zoom="fit-page"
          mode="single"
          [showPrint]="false"
        />
      </docs-example>

      <docs-example
        heading="Error state"
        source="document-viewer/error"
        [script]="errorScript"
        note="When load() rejects, the page area shows an alert. ng-template[starDocumentError] replaces the default text; loadError reports the error."
      >
        <star-document-viewer
          source="missing.pdf"
          [renderer]="errorRenderer"
          title="Missing file"
          height="12rem"
        >
          <ng-template starDocumentError let-error>
            {{ $any(error).message }} Check the link and try again.
          </ng-template>
        </star-document-viewer>
      </docs-example>

      <h2>Choose a PDF engine</h2>
      <p>
        The recommended engine is PDF Viewer Native (<code>pdfviewer-embed</code>,
        <a href="https://github.com/ramanacr/pdf-viewer">github.com/ramanacr/pdf-viewer</a>). Its
        web SDK offers a complete iframe viewer today; a <code>StarDocumentRenderer</code> adapter
        becomes possible when its headless rendering API ships (<a
          href="https://github.com/ramanacr/pdf-viewer/issues/185"
          >issue #185</a
        >).
      </p>
      <p>
        An application that wants a complete ready-made viewer, with annotations and forms, can
        embed <code>View.previewFile</code> of <code>pdfviewer-embed</code> directly instead of
        <code>star-document-viewer</code>.
      </p>
      <h3>Interim alternative: PDF.js</h3>
      <p>
        StarNG adds no PDF dependency. Install <code>pdfjs-dist</code> in your application, write a
        renderer of a few lines, and provide it. Page indexes of the renderer are zero-based; the
        viewer sizes the canvas and rotates it. The viewer passes an <code>AbortSignal</code> to
        <code>load</code> and <code>renderPage</code>: when a newer source or a newer draw replaces
        a call, cancel the PDF.js task and leave the state of the newer call alone.
      </p>
      <docs-code [code]="pdfJsCode" label="PDF.js renderer (interim alternative)" />

      <docs-api
        [of]="['StarDocumentViewer', 'StarDocumentError']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class DocumentViewerPage {
  protected readonly page = signal(1);
  protected readonly thumbnails = signal(true);
  protected readonly action = signal('');
  protected readonly images = sampleSet('Scan', 5, 800, 1100).map((image) => image.src);
  protected readonly imageRenderer = new ImagePagesRenderer();
  // A renderer holds one document: every viewer needs its own instance.
  protected readonly errorRenderer = new SampleReportRenderer();

  protected readonly reportScript = `// The component provides one renderer instance; it serves one viewer.
providers: [{ provide: STAR_DOCUMENT_RENDERER, useFactory: () => new SampleReportRenderer() }]

readonly page = signal(1);
readonly thumbnails = signal(true);
readonly action = signal('');`;
  protected readonly imagesScript = `readonly images = ['/scans/1.png', '/scans/2.png' /* … */];
readonly imageRenderer = new ImagePagesRenderer();

export class ImagePagesRenderer implements StarDocumentRenderer {
  private images: readonly HTMLImageElement[] = [];
  private generation = 0;

  async load(source: unknown, signal?: AbortSignal) {
    const generation = ++this.generation;
    const images = await Promise.all((source as string[]).map((url) => loadImage(url, signal)));
    // A load that finishes after a newer one started must not replace its images.
    if (signal?.aborted || generation !== this.generation) throw new DOMException('', 'AbortError');
    this.images = images;
    return {
      pageCount: images.length,
      pageSize: (i: number) => ({ width: images[i].naturalWidth, height: images[i].naturalHeight }),
    };
  }
  async renderPage(index: number, canvas: HTMLCanvasElement, _scale: number, signal?: AbortSignal) {
    const context = canvas.getContext('2d')!;
    if (signal?.aborted) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(this.images[index], 0, 0, canvas.width, canvas.height);
  }
  dispose() {
    this.generation++;
    this.images = [];
  }
}`;
  protected readonly errorScript = `// The renderer rejects: load('missing.pdf') throws an Error.
<star-document-viewer source="missing.pdf" [renderer]="errorRenderer" (loadError)="log($event)">
  <ng-template starDocumentError let-error>{{ error.message }} Check the link and try again.</ng-template>
</star-document-viewer>`;
  protected readonly pdfJsCode = `import { Component } from '@angular/core';
import * as pdfjs from 'pdfjs-dist';
import {
  STAR_DOCUMENT_RENDERER,
  StarDocumentPageSize,
  StarDocumentRenderer,
  StarDocumentViewer,
} from '@star-ng/ui/document-viewer';

pdfjs.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';

export class PdfJsRenderer implements StarDocumentRenderer {
  private doc: pdfjs.PDFDocumentProxy | null = null;
  private sizes: StarDocumentPageSize[] = [];

  async load(source: unknown, signal?: AbortSignal) {
    this.sizes = [];
    const task = pdfjs.getDocument(source as string);
    signal?.addEventListener('abort', () => void task.destroy());
    const doc = await task.promise;
    const sizes: StarDocumentPageSize[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const { width, height } = (await doc.getPage(i)).getViewport({ scale: 1 });
      sizes.push({ width, height });
    }
    if (signal?.aborted) {
      // A newer source replaced this one: free it and leave the newer state alone.
      void doc.destroy();
      throw new DOMException('Aborted', 'AbortError');
    }
    this.doc = doc;
    this.sizes = sizes;
    return { pageCount: doc.numPages, pageSize: (i: number) => sizes[i] };
  }

  async renderPage(index: number, canvas: HTMLCanvasElement, scale: number, signal?: AbortSignal) {
    const page = await this.doc!.getPage(index + 1);
    const viewport = page.getViewport({ scale });
    const renderTask = page.render({ canvasContext: canvas.getContext('2d')!, viewport });
    signal?.addEventListener('abort', () => renderTask.cancel());
    await renderTask.promise;
  }

  async textContent(index: number) {
    const content = await (await this.doc!.getPage(index + 1)).getTextContent();
    return content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
  }

  dispose() {
    void this.doc?.destroy();
    this.doc = null;
    this.sizes = [];
  }
}

@Component({
  selector: 'app-invoice',
  imports: [StarDocumentViewer],
  providers: [{ provide: STAR_DOCUMENT_RENDERER, useFactory: () => new PdfJsRenderer() }],
  template: '<star-document-viewer source="/files/invoice-1042.pdf" title="Invoice 1042" />',
})
export class InvoiceComponent {}`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starDocumentError]',
      description:
        'Content of the error state. Context: $implicit and error (what load rejected with).',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-surface-muted',
      description: 'Background of the page area and the thumbnails.',
    },
    { name: '--star-surface', description: 'Background of a page before it is drawn.' },
    { name: '--star-shadow-sm', description: 'Shadow of a page.' },
    { name: '--star-accent', description: 'Focus rings and the outline of the current thumbnail.' },
    { name: '--star-danger', description: 'Text of the error state.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Page down, Page up', description: 'Next or previous page.' },
    { name: 'Home, End (page area)', description: 'First or last page.' },
    { name: 'Control + F', description: 'Opens the search (when the renderer gives text).' },
    {
      name: 'Enter, Shift + Enter (search)',
      description: 'Search, then next or previous page with results.',
    },
    { name: 'Escape (search)', description: 'Closes the search.' },
    { name: 'Control + plus, Control + minus', description: 'Zoom in or out.' },
    { name: 'Control + 0', description: 'Zoom to 100 %.' },
    { name: 'Arrow keys (toolbar)', description: 'Move between the toolbar controls.' },
  ];
}
