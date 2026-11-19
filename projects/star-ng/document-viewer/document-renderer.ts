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
 * and draws pages. StarNG ships no PDF engine (no dependency); plug one in, for example PDF.js
 * (`pdfjs-dist`) in your own application:
 *
 * ```ts
 * import * as pdfjs from 'pdfjs-dist';
 *
 * export class PdfJsRenderer implements StarDocumentRenderer {
 *   private doc: pdfjs.PDFDocumentProxy | null = null;
 *   private sizes: StarDocumentPageSize[] = [];
 *
 *   async load(source: unknown) {
 *     this.doc = await pdfjs.getDocument(source as string).promise;
 *     for (let i = 1; i <= this.doc.numPages; i++) {
 *       const { width, height } = (await this.doc.getPage(i)).getViewport({ scale: 1 });
 *       this.sizes.push({ width, height });
 *     }
 *     return { pageCount: this.doc.numPages, pageSize: (i: number) => this.sizes[i] };
 *   }
 *   async renderPage(index: number, canvas: HTMLCanvasElement, scale: number) {
 *     const page = await this.doc!.getPage(index + 1);
 *     const viewport = page.getViewport({ scale });
 *     await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
 *   }
 *   async textContent(index: number) {
 *     const content = await (await this.doc!.getPage(index + 1)).getTextContent();
 *     return content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
 *   }
 *   dispose() {
 *     void this.doc?.destroy();
 *     this.doc = null;
 *   }
 * }
 * ```
 *
 * Indexes are zero-based. `renderPage` gets a canvas that the viewer already sized to the page
 * at `scale` (device pixels: the viewer multiplies by `devicePixelRatio`); draw the page
 * unrotated, the viewer rotates the canvas. Implement `textContent` to enable the search and the
 * text layer that screen readers read.
 */
export interface StarDocumentRenderer {
  /** Reads the document. Reject to show the error state of the viewer. */
  load(source: unknown): Promise<StarDocumentInfo>;
  /** Draws page `index` into `canvas` at `scale` (1 = 100 %, device pixels included). */
  renderPage(index: number, canvas: HTMLCanvasElement, scale: number): Promise<void>;
  /** The text of page `index`, for the search and the screen-reader text layer. Optional. */
  textContent?(index: number): Promise<string>;
  /** Frees the document. The viewer calls it when it loads another source and when destroyed. */
  dispose(): void;
}

/**
 * Provides the renderer of `star-document-viewer`. Provide it in the `providers` of the component
 * that hosts the viewer (`useFactory` or `useClass`), so each viewer gets its own instance; the
 * `renderer` input of the viewer wins over the token.
 *
 * ```ts
 * providers: [{ provide: STAR_DOCUMENT_RENDERER, useFactory: () => new PdfJsRenderer() }]
 * ```
 */
export const STAR_DOCUMENT_RENDERER = new InjectionToken<StarDocumentRenderer>(
  'STAR_DOCUMENT_RENDERER',
);
