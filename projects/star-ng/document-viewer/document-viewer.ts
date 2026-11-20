import { _IdGenerator } from '@angular/cdk/a11y';
import { DOCUMENT, isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  PLATFORM_ID,
  signal,
  TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import { STAR_UI_TEXT, StarAnnouncer, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { StarToolbar } from '@star-ng/ui/layout';
import {
  STAR_DOCUMENT_RENDERER,
  StarDocumentInfo,
  StarDocumentPageSize,
  StarDocumentRenderer,
} from './document-renderer';
import {
  STAR_DOCUMENT_ZOOM_STEPS,
  starCountMatches,
  starDocumentLayout,
  starDocumentPageAt,
  StarDocumentRotation,
  starDocumentScale,
  starDocumentWindow,
  StarDocumentZoom,
  starDocumentZoomStep,
  starRotatedSize,
} from './viewer-model';

/** Context of the error template (`ng-template[starDocumentError]`). */
export interface StarDocumentErrorContext {
  /** What `load` rejected with. */
  readonly $implicit: unknown;
  readonly error: unknown;
}

/** Content of the error state. Context: the error (`let-error`). */
@Directive({ selector: 'ng-template[starDocumentError]' })
export class StarDocumentError {
  readonly template = inject<TemplateRef<StarDocumentErrorContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _dir: StarDocumentError,
    _ctx: unknown,
  ): _ctx is StarDocumentErrorContext {
    return true;
  }
}

/** One search result: a page (one-based) and the number of matches on it. */
export interface StarDocumentSearchResult {
  readonly page: number;
  readonly count: number;
}

/**
 * One page canvas (internal). It sizes the canvas to the page at the scale times
 * `devicePixelRatio`, asks the renderer to draw it, shows a skeleton until then, and frees the
 * canvas memory when it leaves the DOM.
 */
@Component({
  selector: 'star-document-page',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-document-page',
    '[style.width.px]': 'box().width',
    '[style.height.px]': 'box().height',
  },
  template: `
    <canvas
      data-star-part="canvas"
      #canvas
      class="star-document-page__canvas"
      aria-hidden="true"
      [style.width.px]="cssSize().width"
      [style.height.px]="cssSize().height"
      [style.transform]="'translate(-50%, -50%) rotate(' + rotation() + 'deg)'"
    ></canvas>
    @if (failed()) {
      <span data-star-part="failed" class="star-document-page__failed">
        <i data-star-part="failedIcon" class="ph-bold ph-warning-circle" aria-hidden="true"></i>
        {{ text.documentPageError }}
      </span>
    } @else if (!rendered()) {
      <span
        data-star-part="skeleton"
        class="star-document-page__skeleton"
        aria-hidden="true"
      ></span>
    }
  `,
})
export class StarDocumentPage {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly renderer = input.required<StarDocumentRenderer>();
  /** Zero-based page index. */
  readonly index = input.required<number>();
  /** Page size at scale 1, not rotated. */
  readonly size = input.required<StarDocumentPageSize>();
  readonly scale = input.required<number>();
  readonly rotation = input<number>(0);

  /** True once the renderer drew the page. */
  readonly rendered = signal(false);
  /** True when the latest draw failed twice. */
  readonly failed = signal(false);
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private token = 0;
  private controller: AbortController | null = null;
  /** The draws of this page, one after the other. */
  private queue: Promise<void> = Promise.resolve();

  protected readonly cssSize = computed(() => ({
    width: this.size().width * this.scale(),
    height: this.size().height * this.scale(),
  }));
  protected readonly box = computed(() => starRotatedSize(this.cssSize(), this.rotation()));

  constructor() {
    effect(() => {
      const renderer = this.renderer();
      const index = this.index();
      const size = this.size();
      const scale = this.scale();
      if (!this.browser) return;
      untracked(() => this.draw(renderer, index, size, scale));
    });
    inject(DestroyRef).onDestroy(() => {
      // Cancel a pending draw and give the canvas memory back.
      this.token++;
      this.controller?.abort();
      const canvas = this.canvas().nativeElement;
      canvas.width = 0;
      canvas.height = 0;
    });
  }

  /**
   * Starts a draw: aborts the older one and queues this one after it, so two draws never paint
   * one canvas at the same time.
   */
  private draw(
    renderer: StarDocumentRenderer,
    index: number,
    size: StarDocumentPageSize,
    scale: number,
  ): void {
    const token = ++this.token;
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.rendered.set(false);
    this.failed.set(false);
    this.queue = this.queue.then(() =>
      this.run(token, controller.signal, renderer, index, size, scale),
    );
  }

  /** Draws once and retries once; after that the page shows that it failed. */
  private async run(
    token: number,
    signal: AbortSignal,
    renderer: StarDocumentRenderer,
    index: number,
    size: StarDocumentPageSize,
    scale: number,
  ): Promise<void> {
    const pixels = scale * (this.document.defaultView?.devicePixelRatio || 1);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (token !== this.token || signal.aborted) return;
      const canvas = this.canvas().nativeElement;
      canvas.width = Math.max(1, Math.round(size.width * pixels));
      canvas.height = Math.max(1, Math.round(size.height * pixels));
      try {
        await renderer.renderPage(index, canvas, pixels, signal);
        if (token === this.token && !signal.aborted) this.rendered.set(true);
        return;
      } catch {
        if (token !== this.token || signal.aborted) return;
      }
    }
    this.failed.set(true);
  }
}

/** Space around the pages and between them, in pixels. */
const PADDING = 16;
const GAP = 12;
/** Thumbnail box and the height of one thumbnail slot in the sidebar. */
const THUMB_WIDTH = 120;
const THUMB_HEIGHT = 156;
const THUMB_SLOT = THUMB_HEIGHT + 36;
/** Wheel movement (pixels) of one Control+wheel zoom step. */
const WHEEL_STEP = 50;

/**
 * Document viewer (PDF.js viewer, Syncfusion `ejs-pdfviewer`, Kendo UI `kendo-pdfviewer`,
 * DevExtreme has none, Ignite UI has none): a shell that shows the pages of any document through
 * a `StarDocumentRenderer` (`STAR_DOCUMENT_RENDERER` or the `renderer` input). StarNG ships no
 * PDF engine; see `StarDocumentRenderer` for a PDF.js adapter of a few lines.
 *
 * - Toolbar: page navigation (previous, next, a page number "3 of 12"), zoom (fit width, fit page,
 *   presets, Control and the mouse wheel, Control+plus and Control+minus), rotation, a lazy
 *   thumbnails sidebar, continuous or single-page mode, full screen, and the `download` and
 *   `print` outputs (the owner decides what they do).
 * - Search (Control+F) when the renderer has `textContent`: result counts per page and jumps to
 *   the pages (the result count is announced once); highlighting is up to the renderer and not
 *   part of the shell.
 * - Only the visible pages plus one on each side have a canvas, sized by `devicePixelRatio`;
 *   pages that leave the view free their canvas. Each page shows a skeleton until it is drawn.
 * - The page area is a region named with `title`; each page is an image ("Page 3 of 12"), or a
 *   document with a visually hidden text layer when the renderer gives text. Page changes are
 *   announced. PageUp and PageDown change the page; Home and End go to the first and last page.
 * - The renderer gets an `AbortSignal` for `load` and `renderPage` (see `StarDocumentRenderer`).
 * - Known limit: the thumbnails sidebar renders a button per page (the canvases are lazy), so a
 *   document of many thousand pages makes a long list.
 *
 * ```html
 * <star-document-viewer [source]="url" title="Invoice 1042" [(page)]="page" (download)="save()" />
 * ```
 */
@Component({
  selector: 'star-document-viewer',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarToolbar, StarDocumentPage, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-document-viewer',
    '[class.star-document-viewer--fullscreen]': 'fullscreen()',
    '(keydown)': 'onKeydown($event)',
  },
  template: `
    <star-toolbar class="star-document-viewer__toolbar" [ariaLabel]="text.documentToolbar">
      <ng-container starToolbarStart>
        <button
          data-star-part="documentThumbnailsButton"
          type="button"
          class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
          [attr.aria-label]="text.documentThumbnails"
          [attr.aria-pressed]="thumbnails()"
          (click)="thumbnails.set(!thumbnails())"
        >
          <i
            data-star-part="documentThumbnailsIcon"
            class="ph-bold ph-sidebar-simple"
            aria-hidden="true"
          ></i>
        </button>
        <button
          data-star-part="previousPageButton"
          type="button"
          class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
          [attr.aria-label]="text.previousPage"
          [disabled]="page() <= 1 || !pageCount()"
          (click)="goTo(page() - 1)"
        >
          <i data-star-part="previousPageIcon" class="ph-bold ph-caret-up" aria-hidden="true"></i>
        </button>
        <button
          data-star-part="nextPageButton"
          type="button"
          class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
          [attr.aria-label]="text.nextPage"
          [disabled]="page() >= pageCount()"
          (click)="goTo(page() + 1)"
        >
          <i data-star-part="nextPageIcon" class="ph-bold ph-caret-down" aria-hidden="true"></i>
        </button>
        <input
          data-star-part="pageInput"
          class="star-document-viewer__page-input"
          type="text"
          inputmode="numeric"
          [attr.aria-label]="text.documentPageInput"
          [attr.aria-describedby]="countId"
          [value]="pageCount() ? page() : ''"
          [disabled]="!pageCount()"
          (change)="onPageInput($event)"
          (keydown.enter)="onPageInput($event)"
        />
        <span data-star-part="count" class="star-document-viewer__count" [id]="countId">
          {{ text.documentPageCount(pageCount()) }}
        </span>
      </ng-container>
      <ng-container starToolbarCenter>
        <button
          data-star-part="zoomOutButton"
          type="button"
          class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
          [attr.aria-label]="text.zoomOut"
          (click)="zoomBy(-1)"
        >
          <i
            data-star-part="zoomOutIcon"
            class="ph-bold ph-magnifying-glass-minus"
            aria-hidden="true"
          ></i>
        </button>
        <select
          data-star-part="zoom"
          class="star-document-viewer__zoom"
          [attr.aria-label]="text.documentZoom"
          (change)="onZoomSelect($event)"
        >
          <option
            data-star-part="documentFitWidthOption"
            value="fit-width"
            [selected]="zoom() === 'fit-width'"
          >
            {{ text.documentFitWidth }}
          </option>
          <option
            data-star-part="documentFitPageOption"
            value="fit-page"
            [selected]="zoom() === 'fit-page'"
          >
            {{ text.documentFitPage }}
          </option>
          @if (customZoom(); as custom) {
            <option
              data-star-part="zoomOption"
              class="star-document-viewer__zoom-option"
              [value]="custom"
              selected
            >
              {{ percent(custom) }}
            </option>
          }
          @for (step of zoomSteps; track step) {
            <option
              data-star-part="zoomOption"
              class="star-document-viewer__zoom-option"
              [value]="step"
              [selected]="zoom() === step"
            >
              {{ percent(step) }}
            </option>
          }
        </select>
        <button
          data-star-part="zoomInButton"
          type="button"
          class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
          [attr.aria-label]="text.zoomIn"
          (click)="zoomBy(1)"
        >
          <i
            data-star-part="zoomInIcon"
            class="ph-bold ph-magnifying-glass-plus"
            aria-hidden="true"
          ></i>
        </button>
        <button
          data-star-part="documentRotateButton"
          type="button"
          class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
          [attr.aria-label]="text.documentRotate"
          (click)="rotate()"
        >
          <i
            data-star-part="documentRotateIcon"
            class="ph-bold ph-arrow-clockwise"
            aria-hidden="true"
          ></i>
        </button>
      </ng-container>
      <ng-container starToolbarEnd>
        <button
          data-star-part="documentSinglePageButton"
          type="button"
          class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
          [attr.aria-label]="text.documentSinglePage"
          [attr.aria-pressed]="mode() === 'single'"
          (click)="setMode(mode() === 'single' ? 'continuous' : 'single')"
        >
          <i data-star-part="documentSinglePageIcon" class="ph-bold ph-file" aria-hidden="true"></i>
        </button>
        @if (hasText()) {
          <button
            data-star-part="documentSearchButton"
            type="button"
            class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
            [attr.aria-label]="text.documentSearch"
            [attr.aria-expanded]="searchOpen()"
            [attr.aria-controls]="searchId"
            (click)="searchOpen() ? closeSearch() : openSearch()"
          >
            <i
              data-star-part="documentSearchIcon"
              class="ph-bold ph-magnifying-glass"
              aria-hidden="true"
            ></i>
          </button>
        }
        <button
          data-star-part="fullScreenButton"
          type="button"
          class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
          [attr.aria-label]="text.fullScreen"
          [attr.aria-pressed]="fullscreen()"
          (click)="toggleFullscreen()"
        >
          <i
            data-star-part="fullScreenIcon"
            [class]="fullscreen() ? 'ph-bold ph-corners-in' : 'ph-bold ph-corners-out'"
            aria-hidden="true"
          ></i>
        </button>
        @if (showDownload()) {
          <button
            data-star-part="downloadButton"
            type="button"
            class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
            [attr.aria-label]="text.download"
            (click)="download.emit()"
          >
            <i
              data-star-part="downloadIcon"
              class="ph-bold ph-download-simple"
              aria-hidden="true"
            ></i>
          </button>
        }
        @if (showPrint()) {
          <button
            data-star-part="documentPrintButton"
            type="button"
            class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
            [attr.aria-label]="text.documentPrint"
            (click)="print.emit()"
          >
            <i data-star-part="documentPrintIcon" class="ph-bold ph-printer" aria-hidden="true"></i>
          </button>
        }
      </ng-container>
    </star-toolbar>
    @if (searchOpen()) {
      <div
        data-star-part="search"
        class="star-document-viewer__search"
        role="search"
        [id]="searchId"
      >
        <input
          data-star-part="searchInput"
          #searchInput
          class="star-document-viewer__search-input"
          type="search"
          [attr.aria-label]="text.documentSearch"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
          (keydown)="onSearchKeydown($event)"
        />
        <button
          data-star-part="previousResultButton"
          type="button"
          class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
          [attr.aria-label]="text.previousResult"
          [disabled]="!results()?.length"
          (click)="jumpToResult(-1)"
        >
          <i data-star-part="previousResultIcon" class="ph-bold ph-caret-up" aria-hidden="true"></i>
        </button>
        <button
          data-star-part="nextResultButton"
          type="button"
          class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
          [attr.aria-label]="text.nextResult"
          [disabled]="!results()?.length"
          (click)="jumpToResult(1)"
        >
          <i data-star-part="nextResultIcon" class="ph-bold ph-caret-down" aria-hidden="true"></i>
        </button>
        <!-- Not a live region: StarAnnouncer announces the result once. -->
        <span data-star-part="searchStatus" class="star-document-viewer__search-status">{{
          searchStatus()
        }}</span>
      </div>
    }
    <div data-star-part="body" class="star-document-viewer__body">
      @if (thumbnails() && pageCount()) {
        <nav
          data-star-part="thumbs"
          #thumbs
          class="star-document-viewer__thumbs"
          [attr.aria-label]="text.documentThumbnails"
          (scroll)="onThumbsScroll()"
        >
          <ul
            data-star-part="thumbList"
            class="star-document-viewer__thumb-list"
            [style.height.px]="pageCount() * thumbSlot"
          >
            @for (index of allPages(); track index) {
              <li
                data-star-part="thumbItem"
                class="star-document-viewer__thumb-item"
                [style.top.px]="index * thumbSlot"
              >
                <button
                  data-star-part="thumb"
                  type="button"
                  class="star-document-viewer__thumb"
                  [attr.aria-current]="index + 1 === page() ? 'page' : null"
                  (click)="goTo(index + 1)"
                >
                  @if (thumbRendered(index)) {
                    <star-document-page
                      [renderer]="activeRenderer()!"
                      [index]="index"
                      [size]="sizes()[index]"
                      [scale]="thumbScale(index)"
                      [rotation]="rotation()"
                    />
                  }
                  <span data-star-part="thumbLabel" class="star-document-viewer__thumb-label">{{
                    text.page(index + 1)
                  }}</span>
                </button>
              </li>
            }
          </ul>
        </nav>
      }
      <div
        data-star-part="pages"
        #scroller
        class="star-document-viewer__pages"
        role="region"
        tabindex="0"
        [attr.aria-label]="title() || text.documentDefaultTitle"
        [attr.aria-busy]="status() === 'loading' || null"
        [style.height]="height()"
        (scroll)="onScroll()"
        (wheel)="onWheel($event)"
      >
        @switch (status()) {
          @case ('error') {
            <div data-star-part="error" class="star-document-viewer__error" role="alert">
              @if (errorTpl(); as tpl) {
                <ng-container
                  [ngTemplateOutlet]="tpl.template"
                  [ngTemplateOutletContext]="{ $implicit: error(), error: error() }"
                />
              } @else {
                <i
                  data-star-part="errorIcon"
                  class="ph-bold ph-warning-circle"
                  aria-hidden="true"
                ></i>
                {{ text.documentLoadError }}
              }
            </div>
          }
          @case ('ready') {
            <div
              data-star-part="stack"
              class="star-document-viewer__stack"
              [style.height.px]="contentHeight()"
              [style.min-width.px]="contentWidth()"
            >
              @for (index of renderedPages(); track index) {
                <div
                  data-star-part="page"
                  class="star-document-viewer__page"
                  [attr.role]="hasText() ? 'document' : 'img'"
                  [attr.aria-label]="text.documentPageOf(index + 1, pageCount())"
                  [attr.data-page]="index + 1"
                  [style.top.px]="pageTop(index)"
                >
                  <star-document-page
                    [renderer]="activeRenderer()!"
                    [index]="index"
                    [size]="sizes()[index]"
                    [scale]="scale()"
                    [rotation]="rotation()"
                  />
                  @if (hasText()) {
                    <div class="star-sr-only">{{ texts().get(index) ?? '' }}</div>
                  }
                </div>
              }
            </div>
          }
          @case ('loading') {
            <div data-star-part="loading" class="star-document-viewer__loading">
              <span
                data-star-part="skeleton"
                class="star-document-page__skeleton"
                aria-hidden="true"
              ></span>
              <span class="star-sr-only">{{ text.loading }}</span>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class StarDocumentViewer {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly announcer = inject(StarAnnouncer);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly injected = inject(STAR_DOCUMENT_RENDERER, { optional: true });
  private readonly ids = inject(_IdGenerator);

  /** What the renderer loads: a URL, bytes, a Blob, or any value your renderer understands. */
  readonly source = input<unknown>(null);
  /** Title of the document: the name of the page area (default: the UI text `documentDefaultTitle`). */
  readonly title = input('');
  /** Renderer of this viewer; wins over `STAR_DOCUMENT_RENDERER`. */
  readonly renderer = input<StarDocumentRenderer | null>(null);
  /** The page in view, one-based. */
  readonly page = model(1);
  /** `fit-width` (default), `fit-page`, or a scale factor (1 = 100 %). */
  readonly zoom = model<StarDocumentZoom>('fit-width');
  /** Clockwise rotation of all pages. */
  readonly rotation = model<StarDocumentRotation>(0);
  /** `continuous`: all pages one below the other (default). `single`: one page at a time. */
  readonly mode = model<'continuous' | 'single'>('continuous');
  /** Shows the thumbnails sidebar. */
  readonly thumbnails = model(false);
  /** CSS height of the page area. */
  readonly height = input('32rem');
  /** Shows the download button, which emits `download`. */
  readonly showDownload = input(true, { transform: booleanAttribute });
  /** Shows the print button, which emits `print`. */
  readonly showPrint = input(true, { transform: booleanAttribute });

  /** The document loaded: page count and sizes. */
  readonly loaded = output<StarDocumentInfo>();
  /** The renderer could not load the source. */
  readonly loadError = output<unknown>();
  /** The download button was pressed; the owner downloads the file. */
  readonly download = output<void>();
  /** The print button was pressed; the owner prints. */
  readonly print = output<void>();

  protected readonly errorTpl = contentChild(StarDocumentError);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly thumbsElement = viewChild<ElementRef<HTMLElement>>('thumbs');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  /** @internal */
  readonly countId = this.ids.getId('star-document-count-');
  /** @internal */
  readonly searchId = this.ids.getId('star-document-search-');
  protected readonly zoomSteps = STAR_DOCUMENT_ZOOM_STEPS;
  protected readonly thumbSlot = THUMB_SLOT;

  protected readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  protected readonly error = signal<unknown>(null);
  protected readonly info = signal<StarDocumentInfo | null>(null);
  protected readonly texts = signal<ReadonlyMap<number, string>>(new Map());
  protected readonly fullscreen = signal(false);
  protected readonly searchOpen = signal(false);
  protected readonly query = signal('');
  protected readonly results = signal<readonly StarDocumentSearchResult[] | null>(null);
  protected readonly searching = signal(false);
  private readonly scrollTop = signal(0);
  private readonly viewWidth = signal(0);
  private readonly viewHeight = signal(0);
  private readonly thumbScroll = signal(0);
  private readonly thumbHeight = signal(0);
  private loadToken = 0;
  private searchToken = 0;
  private loadedWith: StarDocumentRenderer | null = null;
  private loadController: AbortController | null = null;
  /** Sum of the Control+wheel deltas since the last zoom step. */
  private wheelSum = 0;
  /** Scroll position that the viewer set itself; its scroll event does not change the page. */
  private ownScroll: number | null = null;

  protected readonly activeRenderer = computed(() => this.renderer() ?? this.injected);
  protected readonly hasText = computed(
    () => typeof this.activeRenderer()?.textContent === 'function',
  );
  protected readonly pageCount = computed(() => this.info()?.pageCount ?? 0);
  protected readonly sizes = computed<readonly StarDocumentPageSize[]>(() => {
    const info = this.info();
    if (!info) return [];
    return Array.from({ length: info.pageCount }, (_, i) => info.pageSize(i));
  });
  protected readonly allPages = computed(() => this.sizes().map((_, i) => i));

  /**
   * Scale factor of the pages. Fit width uses the widest page. Fit page uses the largest page
   * (widest and tallest) in continuous mode, so the scale does not change while scrolling, and
   * the current page in single-page mode.
   */
  readonly scale = computed(() => {
    const sizes = this.sizes();
    if (!sizes.length) return 1;
    const rotation = this.rotation();
    const zoom = this.zoom();
    const view = { width: this.viewWidth(), height: this.viewHeight() };
    if (zoom === 'fit-page' && this.mode() === 'single') {
      const current = starRotatedSize(sizes[this.currentIndex()] ?? sizes[0], rotation);
      return starDocumentScale(zoom, current, view, PADDING);
    }
    let width = 0;
    let height = 0;
    for (const size of sizes) {
      const rotated = starRotatedSize(size, rotation);
      width = Math.max(width, rotated.width);
      height = Math.max(height, rotated.height);
    }
    return starDocumentScale(zoom, { width, height }, view, PADDING);
  });

  private readonly currentIndex = computed(() =>
    Math.min(Math.max(0, this.page() - 1), Math.max(0, this.pageCount() - 1)),
  );
  private readonly boxes = computed(() =>
    this.sizes().map((s) => {
      const r = starRotatedSize(s, this.rotation());
      return { width: r.width * this.scale(), height: r.height * this.scale() };
    }),
  );
  private readonly offsets = computed(() =>
    starDocumentLayout(
      this.boxes().map((b) => b.height),
      GAP,
      PADDING,
    ),
  );
  private readonly window = computed(() => {
    if (this.mode() === 'single') {
      const i = this.currentIndex();
      return this.pageCount() ? { start: i, end: i + 1 } : { start: 0, end: 0 };
    }
    return starDocumentWindow(this.offsets(), this.scrollTop(), this.viewHeight() || 800, 1);
  });
  /** Zero-based indexes of the pages that have a canvas now. */
  readonly renderedPages = computed(() => {
    const { start, end } = this.window();
    const out: number[] = [];
    for (let i = start; i < end; i++) out.push(i);
    return out;
  });
  protected readonly contentHeight = computed(() => {
    const boxes = this.boxes();
    if (!boxes.length) return 0;
    if (this.mode() === 'single') return (boxes[this.currentIndex()]?.height ?? 0) + 2 * PADDING;
    return this.offsets()[boxes.length] - GAP + PADDING;
  });
  protected readonly contentWidth = computed(
    () => Math.max(0, ...this.boxes().map((b) => b.width)) + 2 * PADDING,
  );
  protected readonly customZoom = computed(() => {
    const zoom = this.zoom();
    return typeof zoom === 'number' && !STAR_DOCUMENT_ZOOM_STEPS.includes(zoom) ? zoom : null;
  });
  protected readonly searchStatus = computed(() => {
    if (this.searching()) return this.text.searching;
    const results = this.results();
    if (!results) return '';
    if (!results.length) return this.text.noResults;
    const total = results.reduce((sum, r) => sum + r.count, 0);
    return this.text.documentSearchResults(total, results.length);
  });
  private readonly thumbWindow = computed(() => {
    const first = Math.floor(this.thumbScroll() / THUMB_SLOT);
    const count = Math.ceil((this.thumbHeight() || 600) / THUMB_SLOT);
    return { start: Math.max(0, first - 1), end: first + count + 1 };
  });

  constructor() {
    effect(() => {
      const source = this.source();
      const renderer = this.activeRenderer();
      if (!this.browser) return;
      untracked(() => {
        if (!renderer || source === null || source === undefined) this.unload();
        else void this.load(renderer, source);
      });
    });
    // Text layer: fetch the text of the rendered pages once.
    effect(() => {
      const pages = this.renderedPages();
      if (!this.hasText() || this.status() !== 'ready') return;
      untracked(() => {
        for (const index of pages) if (!this.texts().has(index)) void this.textOf(index);
      });
    });
    afterNextRender(() => {
      const view = this.document.defaultView;
      const measure = (): void => {
        const element = this.scroller()?.nativeElement;
        if (element) {
          this.viewWidth.set(element.clientWidth);
          this.viewHeight.set(element.clientHeight);
        }
        const thumbs = this.thumbsElement()?.nativeElement;
        if (thumbs) this.thumbHeight.set(thumbs.clientHeight);
      };
      measure();
      const onFullscreen = (): void =>
        this.fullscreen.set(this.document.fullscreenElement === this.host);
      this.document.addEventListener('fullscreenchange', onFullscreen);
      let observer: ResizeObserver | null = null;
      if (view && 'ResizeObserver' in view) {
        observer = new view.ResizeObserver(measure);
        observer.observe(this.host);
      }
      this.injector.get(DestroyRef).onDestroy(() => {
        observer?.disconnect();
        this.document.removeEventListener('fullscreenchange', onFullscreen);
      });
    });
    inject(DestroyRef).onDestroy(() => this.release());
  }

  // Loading ----------------------------------------------------------------------------------

  /**
   * Ends the current document: stale loads, texts and searches are dropped (tokens), the load
   * signal is aborted and the renderer disposes its document.
   */
  private release(): void {
    this.loadToken++;
    this.searchToken++;
    this.searching.set(false);
    this.loadController?.abort();
    this.loadController = null;
    this.loadedWith?.dispose();
    this.loadedWith = null;
  }

  /** No source (null) or no renderer: dispose the document and show the empty state. */
  private unload(): void {
    if (!this.loadedWith && this.status() === 'idle') return;
    this.release();
    this.status.set('idle');
    this.info.set(null);
    this.error.set(null);
    this.texts.set(new Map());
    this.results.set(null);
  }

  private async load(renderer: StarDocumentRenderer, source: unknown): Promise<void> {
    this.release();
    const token = this.loadToken;
    const controller = new AbortController();
    this.loadController = controller;
    this.loadedWith = renderer;
    this.status.set('loading');
    this.info.set(null);
    this.texts.set(new Map());
    this.results.set(null);
    try {
      const info = await renderer.load(source, controller.signal);
      if (token !== this.loadToken) return;
      this.info.set(info);
      this.status.set('ready');
      this.page.set(Math.min(Math.max(1, this.page()), Math.max(1, info.pageCount)));
      this.loaded.emit(info);
      afterNextRender(() => this.scrollToPage(this.page()), { injector: this.injector });
    } catch (error) {
      if (token !== this.loadToken) return;
      this.error.set(error);
      this.status.set('error');
      this.loadError.emit(error);
    }
  }

  /** The text of a page, cached per load. Resolves with null when a newer load started. */
  private async textOf(index: number): Promise<string | null> {
    const cached = this.texts().get(index);
    if (cached !== undefined) return cached;
    const token = this.loadToken;
    const renderer = this.loadedWith;
    let text = '';
    try {
      text = (await renderer?.textContent?.(index)) ?? '';
    } catch {
      text = '';
    }
    if (token !== this.loadToken) return null;
    this.texts.update((map) => new Map(map).set(index, text));
    return text;
  }

  // Navigation -------------------------------------------------------------------------------

  /** Shows page `page` (one-based) and announces it. */
  goTo(page: number, announce = true): void {
    const count = this.pageCount();
    if (!count) return;
    const target = Math.min(Math.max(1, Math.round(page)), count);
    this.page.set(target);
    this.scrollToPage(target);
    if (announce) this.announcer.announce(this.text.documentPageOf(target, count), 'polite');
  }

  private scrollToPage(page: number): void {
    const element = this.scroller()?.nativeElement;
    if (!element) return;
    const top = this.mode() === 'single' ? 0 : Math.max(0, this.offsets()[page - 1] - PADDING);
    element.scrollTop = top;
    // The browser limits the position (the last pages may not reach the top): keep what it set.
    const actual = element.scrollTop || top;
    this.ownScroll = actual;
    this.scrollTop.set(actual);
    const thumbs = this.thumbsElement()?.nativeElement;
    if (thumbs) {
      const thumbTop = (page - 1) * THUMB_SLOT;
      if (
        thumbTop < thumbs.scrollTop ||
        thumbTop + THUMB_SLOT > thumbs.scrollTop + thumbs.clientHeight
      ) {
        thumbs.scrollTop = thumbTop;
        this.thumbScroll.set(thumbTop);
      }
    }
  }

  protected onScroll(): void {
    const element = this.scroller()?.nativeElement;
    if (!element) return;
    const top = element.scrollTop;
    this.scrollTop.set(top);
    if (this.ownScroll !== null && Math.abs(top - this.ownScroll) < 2) {
      this.ownScroll = null;
      return;
    }
    this.ownScroll = null;
    if (this.mode() !== 'continuous' || !this.pageCount()) return;
    const probe = top + Math.min(element.clientHeight / 3, 200);
    // At the end of the scroll range the last page counts, even when it does not reach the probe.
    const atEnd =
      element.scrollHeight > element.clientHeight &&
      top + element.clientHeight >= element.scrollHeight - 1;
    const page = atEnd ? this.pageCount() : starDocumentPageAt(this.offsets(), probe) + 1;
    if (page !== this.page()) this.page.set(page);
  }

  protected onThumbsScroll(): void {
    const element = this.thumbsElement()?.nativeElement;
    if (element) this.thumbScroll.set(element.scrollTop);
  }

  protected onPageInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    if (event.type === 'change' && value === this.page()) return;
    if (Number.isFinite(value) && value >= 1) this.goTo(value);
    else input.value = String(this.page());
    if (event.type === 'keydown') event.preventDefault();
  }

  protected setMode(mode: 'continuous' | 'single'): void {
    this.mode.set(mode);
    afterNextRender(() => this.scrollToPage(this.page()), { injector: this.injector });
  }

  // Zoom and rotation ------------------------------------------------------------------------

  /** Sets the zoom and keeps the current page in view. */
  setZoom(zoom: StarDocumentZoom): void {
    this.zoom.set(zoom);
    afterNextRender(() => this.scrollToPage(this.page()), { injector: this.injector });
  }

  /** One preset step in (1) or out (-1) from the current scale. */
  zoomBy(direction: 1 | -1): void {
    this.setZoom(starDocumentZoomStep(this.scale(), direction));
  }

  protected onZoomSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.setZoom(value === 'fit-width' || value === 'fit-page' ? value : Number(value));
  }

  protected rotate(): void {
    this.rotation.set(((this.rotation() + 90) % 360) as StarDocumentRotation);
    afterNextRender(() => this.scrollToPage(this.page()), { injector: this.injector });
  }

  protected percent(scale: number): string {
    return `${Math.round(scale * 100)}%`;
  }

  /**
   * Control+wheel zooms one step per 50 pixels of wheel movement: a mouse notch (about 100)
   * is one step, and the many small deltas of a touchpad pinch add up instead of racing.
   */
  protected onWheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    // A change of direction starts a new sum.
    if (Math.sign(delta) !== Math.sign(this.wheelSum)) this.wheelSum = 0;
    this.wheelSum += delta;
    if (Math.abs(this.wheelSum) < WHEEL_STEP) return;
    this.zoomBy(this.wheelSum < 0 ? 1 : -1);
    this.wheelSum = 0;
  }

  // Thumbnails -------------------------------------------------------------------------------

  protected thumbRendered(index: number): boolean {
    const { start, end } = this.thumbWindow();
    return index >= start && index < end;
  }

  protected thumbScale(index: number): number {
    const size = starRotatedSize(this.sizes()[index], this.rotation());
    return Math.min(THUMB_WIDTH / size.width, THUMB_HEIGHT / size.height);
  }

  // Search -----------------------------------------------------------------------------------

  /** Opens the search bar and focuses its field. */
  openSearch(): void {
    if (!this.hasText()) return;
    this.searchOpen.set(true);
    afterNextRender(() => this.searchInput()?.nativeElement.focus(), { injector: this.injector });
  }

  protected closeSearch(): void {
    this.searchOpen.set(false);
    this.searchToken++;
    this.searching.set(false);
    this.scroller()?.nativeElement.focus({ preventScroll: true });
  }

  /** Searches every page for `query` (without case); resolves with the pages that match. */
  async search(query = this.query()): Promise<readonly StarDocumentSearchResult[]> {
    const token = ++this.searchToken;
    this.query.set(query);
    if (!query.trim()) {
      this.results.set(null);
      return [];
    }
    this.searching.set(true);
    const results: StarDocumentSearchResult[] = [];
    const load = this.loadToken;
    for (let i = 0; i < this.pageCount(); i++) {
      const text = await this.textOf(i);
      // A newer search or a newer document: drop what this search found.
      if (token !== this.searchToken || load !== this.loadToken || text === null) return [];
      const count = starCountMatches(text, query);
      if (count) results.push({ page: i + 1, count });
    }
    this.searching.set(false);
    this.results.set(results);
    this.announcer.announce(this.searchStatus(), 'polite');
    if (results.length && !results.some((r) => r.page === this.page())) {
      this.goTo(results.find((r) => r.page > this.page())?.page ?? results[0].page);
    }
    return results;
  }

  /** Goes to the next (1) or previous (-1) page with results, wrapping around. */
  jumpToResult(direction: 1 | -1): void {
    const pages = (this.results() ?? []).map((r) => r.page);
    if (!pages.length) return;
    const current = this.page();
    const target =
      direction > 0
        ? (pages.find((p) => p > current) ?? pages[0])
        : ([...pages].reverse().find((p) => p < current) ?? pages[pages.length - 1]);
    this.goTo(target);
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.results() && !this.searching()) this.jumpToResult(event.shiftKey ? -1 : 1);
      else void this.search();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeSearch();
    }
  }

  // Full screen and keyboard -----------------------------------------------------------------

  protected toggleFullscreen(): void {
    if (this.document.fullscreenElement === this.host) void this.document.exitFullscreen?.();
    else void this.host.requestFullscreen?.()?.catch(() => undefined);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const ctrl = event.ctrlKey || event.metaKey;
    const key = event.key;
    if (ctrl && !event.altKey) {
      if (key.toLowerCase() === 'f' && this.hasText()) {
        event.preventDefault();
        this.openSearch();
      } else if (key === '+' || key === '=') {
        event.preventDefault();
        this.zoomBy(1);
      } else if (key === '-') {
        event.preventDefault();
        this.zoomBy(-1);
      } else if (key === '0') {
        event.preventDefault();
        this.setZoom(1);
      }
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest('input, select, textarea') || event.altKey) return;
    const inPages = !!target.closest('.star-document-viewer__pages');
    switch (key) {
      case 'PageDown':
        event.preventDefault();
        this.goTo(this.page() + 1);
        break;
      case 'PageUp':
        event.preventDefault();
        this.goTo(this.page() - 1);
        break;
      case 'Home':
        if (!inPages) return;
        event.preventDefault();
        this.goTo(1);
        break;
      case 'End':
        if (!inPages) return;
        event.preventDefault();
        this.goTo(this.pageCount());
        break;
    }
  }

  /** @internal Top of a page in the stack, in pixels. */
  protected pageTop(index: number): number {
    return this.mode() === 'single' ? PADDING : this.offsets()[index];
  }
}
