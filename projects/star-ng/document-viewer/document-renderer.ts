import { InjectionToken } from '@angular/core';

/** Size of a page at 100 % (scale 1), in CSS pixels (for a PDF: points). */
export interface StarDocumentPageSize {
  readonly width: number;
  readonly height: number;
}

/** What `StarDocumentRenderer.load` reports about a document. */
export interface StarDocumentInfo {
  readonly pageCount: number;
  /** Size of the page with the zero-based `index` at scale 1. */
  pageSize(index: number): StarDocumentPageSize;
}

/**
 * The renderer behind `star-document-viewer`. The viewer is a shell: it lays the pages out, keeps
 * only the visible ones in canvases and runs the toolbar, while the renderer reads the document
 * and draws pages. StarNG ships no PDF engine (no dependency).
 *
 * Recommended engine: PDF Viewer Native (`pdfviewer-embed`, https://github.com/ramanacr/pdf-viewer).
 * An adapter becomes possible when its headless rendering API ships
 * (https://github.com/ramanacr/pdf-viewer/issues/185); today its web SDK offers a complete iframe viewer
 * (`View.previewFile`), which an application can embed directly instead of this viewer when it
 * wants annotations and forms. Interim alternative: PDF.js (`pdfjs-dist`) in your own application:
 *
 * ```ts
 * import * as pdfjs from 'pdfjs-dist';
 *
 * export class PdfJsRenderer implements StarDocumentRenderer {
 *   private doc: pdfjs.PDFDocumentProxy | null = null;
 *   private sizes: StarDocumentPageSize[] = [];
 *
 *   async load(source: unknown, signal?: AbortSignal) {
 *     this.sizes = [];
 *     const task = pdfjs.getDocument(source as string);
 *     signal?.addEventListener('abort', () => void task.destroy());
 *     const doc = await task.promise;
 *     const sizes: StarDocumentPageSize[] = [];
 *     for (let i = 1; i <= doc.numPages; i++) {
 *       const { width, height } = (await doc.getPage(i)).getViewport({ scale: 1 });
 *       sizes.push({ width, height });
 *     }
 *     if (signal?.aborted) {
 *       // A newer source replaced this one: free it and keep the state of the newer load.
 *       void doc.destroy();
 *       throw new DOMException('Aborted', 'AbortError');
 *     }
 *     this.doc = doc;
 *     this.sizes = sizes;
 *     return { pageCount: doc.numPages, pageSize: (i: number) => sizes[i] };
 *   }
 *   async renderPage(index: number, canvas: HTMLCanvasElement, scale: number, signal?: AbortSignal) {
 *     const page = await this.doc!.getPage(index + 1);
 *     const viewport = page.getViewport({ scale });
 *     const renderTask = page.render({ canvasContext: canvas.getContext('2d')!, viewport });
 *     signal?.addEventListener('abort', () => renderTask.cancel());
 *     await renderTask.promise;
 *   }
 *   async textContent(index: number) {
 *     const content = await (await this.doc!.getPage(index + 1)).getTextContent();
 *     return content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
 *   }
 *   dispose() {
 *     void this.doc?.destroy();
 *     this.doc = null;
 *     this.sizes = [];
 *   }
 * }
 * ```
 *
 * Indexes are zero-based. `renderPage` gets a canvas that the viewer already sized to the page
 * at `scale` (device pixels: the viewer multiplies by `devicePixelRatio`); draw the page
 * unrotated, the viewer rotates the canvas. Implement `textContent` to enable the search and the
 * text layer that screen readers read.
 *
 * Cancellation: the viewer passes an `AbortSignal`. It aborts the signal of `load` when the
 * source changes, when the source becomes null and when the viewer is destroyed; it aborts the
 * signal of `renderPage` when a newer draw of the same page starts and when the page leaves the
 * view. After an abort, do not change the state of the renderer (a newer load owns it), free what
 * the aborted call created, and reject or resolve; the viewer ignores the result. The viewer
 * draws one page at a time per canvas: a newer draw of a page starts after the older one settled.
 */
export interface StarDocumentRenderer {
  /** Reads the document. Reject to show the error state of the viewer. */
  load(source: unknown, signal?: AbortSignal): Promise<StarDocumentInfo>;
  /** Draws page `index` into `canvas` at `scale` (1 = 100 %, device pixels included). */
  renderPage(
    index: number,
    canvas: HTMLCanvasElement,
    scale: number,
    signal?: AbortSignal,
  ): Promise<void>;
  /** The text of page `index`, for the search and the screen-reader text layer. Optional. */
  textContent?(index: number): Promise<string>;
  /**
   * Frees the document. The viewer calls it before it loads another source, when the source
   * becomes null and when it is destroyed.
   */
  dispose(): void;
}

/**
 * Provides the renderer of `star-document-viewer`. A renderer holds one document, so each viewer
 * needs its own instance: provide it in the `providers` of the component that hosts the viewer
 * (`useFactory` or `useClass`; one instance per host component), and give a second viewer in
 * the same template its own renderer through the `renderer` input, which wins over the token.
 * The recommended engine is PDF Viewer Native (`pdfviewer-embed`) once its headless rendering API
 * ships (see `StarDocumentRenderer`); the example uses the interim PDF.js adapter.
 *
 * ```ts
 * providers: [{ provide: STAR_DOCUMENT_RENDERER, useFactory: () => new PdfJsRenderer() }]
 * ```
 */
export const STAR_DOCUMENT_RENDERER = new InjectionToken<StarDocumentRenderer>(
  'STAR_DOCUMENT_RENDERER',
);
