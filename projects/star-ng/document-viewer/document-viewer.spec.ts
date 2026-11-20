import { Component, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAnnouncer } from '@star-ng/ui/core';
import {
  STAR_DOCUMENT_RENDERER,
  StarDocumentError,
  StarDocumentInfo,
  StarDocumentRenderer,
  StarDocumentViewer,
  StarDocumentZoom,
} from '@star-ng/ui/document-viewer';

/** A renderer that records its calls. Page text: every fifth page mentions an invoice. */
class FakeRenderer implements StarDocumentRenderer {
  loads: unknown[] = [];
  disposed = 0;
  readonly draws: { index: number; canvas: HTMLCanvasElement; scale: number }[] = [];
  fail = false;

  constructor(private readonly pages = 12) {}

  async load(source: unknown): Promise<StarDocumentInfo> {
    this.loads.push(source);
    if (this.fail) throw new Error('broken file');
    return { pageCount: this.pages, pageSize: () => ({ width: 600, height: 800 }) };
  }

  async renderPage(index: number, canvas: HTMLCanvasElement, scale: number): Promise<void> {
    this.draws.push({ index, canvas, scale });
  }

  async textContent(index: number): Promise<string> {
    return index % 5 === 0 ? `Invoice ${index + 1}, invoice total` : `Page ${index + 1} lines`;
  }

  dispose(): void {
    this.disposed++;
  }
}

/** The same renderer without text: no search, pages are images. */
function imageRenderer(): FakeRenderer {
  const renderer = new FakeRenderer();
  Object.defineProperty(renderer, 'textContent', { value: undefined });
  return renderer;
}

@Component({
  imports: [StarDocumentViewer, StarDocumentError],
  template: `
    <star-document-viewer
      [source]="source()"
      [renderer]="renderer"
      title="Invoice pack"
      [(page)]="page"
      [(zoom)]="zoom"
      [(mode)]="mode"
      (download)="downloads = downloads + 1"
      (print)="prints = prints + 1"
      (loadError)="failed = $event"
    >
      @if (customError()) {
        <ng-template starDocumentError let-error
          >Could not open: {{ $any(error).message }}</ng-template
        >
      }
    </star-document-viewer>
  `,
})
class Host {
  readonly viewer = viewChild.required(StarDocumentViewer);
  renderer: StarDocumentRenderer = new FakeRenderer();
  readonly source = signal<unknown>('invoices.pdf');
  readonly page = signal(1);
  readonly zoom = signal<StarDocumentZoom>('fit-width');
  readonly mode = signal<'continuous' | 'single'>('continuous');
  readonly customError = signal(false);
  downloads = 0;
  prints = 0;
  failed: unknown = null;
}

function key(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

/** A promise with its resolve and reject functions. */
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A renderer whose calls wait until the test settles them. */
class ManualRenderer implements StarDocumentRenderer {
  readonly loads: { source: unknown; signal?: AbortSignal; d: Deferred<StarDocumentInfo> }[] = [];
  readonly draws: { index: number; signal?: AbortSignal; d: Deferred<void> }[] = [];
  readonly texts: { index: number; d: Deferred<string> }[] = [];
  disposed = 0;

  load(source: unknown, signal?: AbortSignal): Promise<StarDocumentInfo> {
    const d = deferred<StarDocumentInfo>();
    this.loads.push({ source, signal, d });
    return d.promise;
  }

  renderPage(
    index: number,
    _canvas: HTMLCanvasElement,
    _scale: number,
    signal?: AbortSignal,
  ): Promise<void> {
    const d = deferred<void>();
    this.draws.push({ index, signal, d });
    return d.promise;
  }

  textContent(index: number): Promise<string> {
    const d = deferred<string>();
    this.texts.push({ index, d });
    return d.promise;
  }

  dispose(): void {
    this.disposed++;
  }
}

function info(pages: number): StarDocumentInfo {
  return { pageCount: pages, pageSize: () => ({ width: 600, height: 800 }) };
}

/** Lets pending promise callbacks run, then waits for the render. */
async function flush(fixture: { whenStable(): Promise<unknown> }): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await fixture.whenStable();
}

describe('StarDocumentViewer review fixes', () => {
  async function manual(prepare?: (host: Host) => void) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: StarAnnouncer,
          useValue: { announce: vi.fn(() => Promise.resolve()), clear: vi.fn() },
        },
      ],
    });
    const fixture = TestBed.createComponent(Host);
    const renderer = new ManualRenderer();
    fixture.componentInstance.renderer = renderer;
    prepare?.(fixture.componentInstance);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, renderer, host: fixture.componentInstance, el };
  }

  it('aborts a stale load and keeps the newest document when loads resolve out of order', async () => {
    const { fixture, renderer, host, el } = await manual();
    host.source.set('b.pdf');
    await fixture.whenStable();
    expect(renderer.loads.map((l) => l.source)).toEqual(['invoices.pdf', 'b.pdf']);
    expect(renderer.loads[0].signal?.aborted).toBe(true);
    expect(renderer.loads[1].signal?.aborted).toBe(false);
    renderer.loads[1].d.resolve(info(3));
    await flush(fixture);
    renderer.loads[0].d.resolve(info(9));
    await flush(fixture);
    expect(el.querySelector('.star-document-viewer__count')!.textContent!.trim()).toBe('of 3');
  });

  it('disposes and resets when the source becomes null', async () => {
    const { fixture, renderer, host, el } = await manual();
    renderer.loads[0].d.resolve(info(4));
    await flush(fixture);
    expect(el.querySelectorAll('.star-document-viewer__page').length).toBeGreaterThan(0);
    host.source.set(null);
    await flush(fixture);
    expect(renderer.disposed).toBe(1);
    expect(renderer.loads[0].signal?.aborted).toBe(true);
    expect(el.querySelectorAll('.star-document-viewer__page')).toHaveLength(0);
    expect(el.querySelector('.star-document-viewer__count')!.textContent!.trim()).toBe('of 0');
  });

  it('drops text and search results of an older load', async () => {
    const { fixture, renderer, host } = await manual();
    renderer.loads[0].d.resolve(info(2));
    await flush(fixture);
    const searching = host.viewer().search('total');
    await flush(fixture);
    host.source.set('next.pdf');
    await flush(fixture);
    // The old text arrives after the new load started.
    for (const t of renderer.texts) t.d.resolve('total total');
    await flush(fixture);
    expect(await searching).toEqual([]);
    renderer.loads[1].d.resolve(info(2));
    await flush(fixture);
    const viewer = host.viewer() as unknown as {
      texts(): ReadonlyMap<number, string>;
      searching(): boolean;
      results(): unknown;
    };
    expect(viewer.searching()).toBe(false);
    expect(viewer.results()).toBeNull();
    expect([...viewer.texts().values()]).not.toContain('total total');
  });

  it('serializes the draws of a page, aborts the older one, and shows a failed page', async () => {
    const { fixture, renderer, host, el } = await manual((h) => h.zoom.set(1));
    renderer.loads[0].d.resolve(info(1));
    await flush(fixture);
    expect(renderer.draws).toHaveLength(1);
    host.zoom.set(2);
    await flush(fixture);
    // The second draw waits until the first one settles.
    expect(renderer.draws).toHaveLength(1);
    expect(renderer.draws[0].signal?.aborted).toBe(true);
    renderer.draws[0].d.resolve();
    await flush(fixture);
    expect(renderer.draws).toHaveLength(2);
    expect(el.querySelector('.star-document-page__skeleton')).not.toBeNull();
    // The latest draw fails twice (one retry): an error, not a skeleton forever.
    renderer.draws[1].d.reject(new Error('draw failed'));
    await flush(fixture);
    expect(renderer.draws).toHaveLength(3);
    renderer.draws[2].d.reject(new Error('draw failed'));
    await flush(fixture);
    expect(el.querySelector('.star-document-page__skeleton')).toBeNull();
    expect(el.querySelector('.star-document-page__failed')!.textContent).toContain(
      'This page could not be shown.',
    );
  });

  it('fits the largest page in continuous mode and the current page in single mode', async () => {
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(500);
    try {
      const { fixture, renderer, host } = await manual((h) => h.zoom.set('fit-page'));
      renderer.loads[0].d.resolve({
        pageCount: 2,
        pageSize: (i) => (i === 0 ? { width: 600, height: 800 } : { width: 600, height: 1600 }),
      });
      await flush(fixture);
      expect(host.viewer().scale()).toBeCloseTo(468 / 1600);
      host.mode.set('single');
      await flush(fixture);
      expect(host.viewer().scale()).toBeCloseTo(468 / 800);
    } finally {
      width.mockRestore();
      height.mockRestore();
    }
  });

  it('accumulates small Control+wheel deltas into one zoom step', async () => {
    const { fixture, renderer, host, el } = await manual((h) => h.zoom.set(1));
    renderer.loads[0].d.resolve(info(1));
    await flush(fixture);
    const region = el.querySelector('[role=region]')!;
    const wheel = (deltaY: number) =>
      region.dispatchEvent(new WheelEvent('wheel', { deltaY, ctrlKey: true, cancelable: true }));
    wheel(-20);
    wheel(-20);
    expect(host.zoom()).toBe(1);
    wheel(-20);
    expect(host.zoom()).toBe(1.25);
  });
});

describe('StarDocumentViewer', () => {
  let announce: ReturnType<typeof vi.fn>;

  async function setup(prepare?: (host: Host) => void) {
    announce = vi.fn(() => Promise.resolve());
    TestBed.configureTestingModule({
      providers: [{ provide: StarAnnouncer, useValue: { announce, clear: vi.fn() } }],
    });
    const fixture = TestBed.createComponent(Host);
    prepare?.(fixture.componentInstance);
    await fixture.whenStable();
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const region = el.querySelector<HTMLElement>('[role=region]')!;
    const button = (name: string) =>
      el.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
    return { fixture, el, region, button, host: fixture.componentInstance };
  }

  afterEach(() => {
    delete (document.defaultView as { devicePixelRatio?: number }).devicePixelRatio;
  });

  it('loads through the renderer and names the page area with the title', async () => {
    const { el, region, host } = await setup();
    expect((host.renderer as FakeRenderer).loads).toEqual(['invoices.pdf']);
    expect(region.getAttribute('aria-label')).toBe('Invoice pack');
    expect(el.querySelector('.star-document-viewer__count')!.textContent!.trim()).toBe('of 12');
    expect(el.querySelector<HTMLInputElement>('[aria-label="Page number"]')!.value).toBe('1');
  });

  it('renders only the visible pages plus one, as documents with a text layer', async () => {
    const { fixture, el } = await setup();
    await fixture.whenStable();
    const pages = el.querySelectorAll('.star-document-viewer__page');
    expect(pages.length).toBeGreaterThan(0);
    expect(pages.length).toBeLessThanOrEqual(3);
    expect(pages[0].getAttribute('role')).toBe('document');
    expect(pages[0].getAttribute('aria-label')).toBe('Page 1 of 12');
    expect(pages[0].querySelector('.star-sr-only')!.textContent).toContain('Invoice 1');
  });

  it('shows pages as images when the renderer has no text, and hides the search', async () => {
    const { el, button } = await setup((host) => (host.renderer = imageRenderer()));
    expect(el.querySelector('.star-document-viewer__page')!.getAttribute('role')).toBe('img');
    expect(button('Search in document')).toBeNull();
  });

  it('sizes the canvas by devicePixelRatio and the scale', async () => {
    Object.defineProperty(document.defaultView!, 'devicePixelRatio', {
      value: 2,
      configurable: true,
    });
    const { host } = await setup((h) => h.zoom.set(1.5));
    const draw = (host.renderer as FakeRenderer).draws.find((d) => d.index === 0)!;
    expect(draw.scale).toBe(3);
    expect(draw.canvas.width).toBe(1800);
    expect(draw.canvas.height).toBe(2400);
    expect(draw.canvas.style.width).toBe('900px');
  });

  it('frees the canvas of a page that leaves the view', async () => {
    const { fixture, region, host } = await setup((h) => h.zoom.set(1));
    const first = (host.renderer as FakeRenderer).draws.find((d) => d.index === 0)!.canvas;
    expect(first.width).toBeGreaterThan(0);
    region.scrollTop = 16 + 812 * 8;
    region.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    expect(first.width).toBe(0);
    expect(host.page()).toBe(9);
    expect(host.viewer().renderedPages()).toContain(8);
  });

  it('takes the last page at the end of the scroll range', async () => {
    const { fixture, region, host } = await setup((h) => h.zoom.set(1));
    Object.defineProperty(region, 'clientHeight', { value: 1000, configurable: true });
    Object.defineProperty(region, 'scrollHeight', { value: 9760, configurable: true });
    region.scrollTop = 8760;
    region.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    expect(host.page()).toBe(12);
  });

  it('navigates with the buttons, the page field and the keyboard, and announces it', async () => {
    const { fixture, el, region, button, host } = await setup();
    button('Next page').click();
    await fixture.whenStable();
    expect(host.page()).toBe(2);
    expect(announce).toHaveBeenLastCalledWith('Page 2 of 12', 'polite');
    const field = el.querySelector<HTMLInputElement>('[aria-label="Page number"]')!;
    field.value = '7';
    key(field, 'Enter');
    await fixture.whenStable();
    expect(host.page()).toBe(7);
    key(region, 'PageDown');
    expect(host.page()).toBe(8);
    key(region, 'PageUp');
    expect(host.page()).toBe(7);
    key(region, 'End');
    expect(host.page()).toBe(12);
    key(region, 'Home');
    expect(host.page()).toBe(1);
    field.value = 'x';
    key(field, 'Enter');
    expect(field.value).toBe('1');
  });

  it('zooms with the buttons, the select, Control+plus and minus, and Control+wheel', async () => {
    const { fixture, el, region, button, host } = await setup((h) => h.zoom.set(1));
    button('Zoom in').click();
    expect(host.zoom()).toBe(1.25);
    key(region, '+', { ctrlKey: true });
    expect(host.zoom()).toBe(1.5);
    key(region, '-', { ctrlKey: true });
    expect(host.zoom()).toBe(1.25);
    const wheel = new WheelEvent('wheel', { deltaY: 100, ctrlKey: true, cancelable: true });
    region.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(host.zoom()).toBe(1);
    const select = el.querySelector<HTMLSelectElement>('[aria-label=Zoom]')!;
    select.value = 'fit-page';
    select.dispatchEvent(new Event('change'));
    expect(host.zoom()).toBe('fit-page');
    key(region, '0', { ctrlKey: true });
    expect(host.zoom()).toBe(1);
    await fixture.whenStable();
  });

  it('rotates the pages', async () => {
    const { fixture, el, button, host } = await setup((h) => h.zoom.set(1));
    button('Rotate clockwise').click();
    await fixture.whenStable();
    expect(host.viewer().rotation()).toBe(90);
    const page = el.querySelector<HTMLElement>('star-document-page')!;
    expect(page.style.width).toBe('800px');
    expect(page.style.height).toBe('600px');
  });

  it('shows one page in single-page mode', async () => {
    const { fixture, el, button, host } = await setup();
    button('Single page').click();
    await fixture.whenStable();
    expect(host.mode()).toBe('single');
    expect(el.querySelectorAll('.star-document-viewer__page')).toHaveLength(1);
    button('Next page').click();
    await fixture.whenStable();
    expect(el.querySelector('.star-document-viewer__page')!.getAttribute('aria-label')).toBe(
      'Page 2 of 12',
    );
  });

  it('shows a thumbnails sidebar with lazy canvases', async () => {
    const { fixture, el, button, host } = await setup();
    button('Page thumbnails').click();
    await fixture.whenStable();
    const nav = el.querySelector('nav[aria-label="Page thumbnails"]')!;
    const thumbs = nav.querySelectorAll('button');
    expect(thumbs).toHaveLength(12);
    expect(nav.querySelectorAll('star-document-page').length).toBeLessThan(12);
    expect(thumbs[0].getAttribute('aria-current')).toBe('page');
    thumbs[3].click();
    await fixture.whenStable();
    expect(host.page()).toBe(4);
  });

  it('searches the text with Control+F and jumps between result pages', async () => {
    const { fixture, el, region, host } = await setup();
    key(region, 'f', { ctrlKey: true });
    await fixture.whenStable();
    const field = el.querySelector<HTMLInputElement>('input[type=search]')!;
    expect(document.activeElement).toBe(field);
    const results = await host.viewer().search('invoice');
    await fixture.whenStable();
    expect(results).toEqual([
      { page: 1, count: 2 },
      { page: 6, count: 2 },
      { page: 11, count: 2 },
    ]);
    expect(el.querySelector('.star-document-viewer__search [role=status]')!.textContent).toBe(
      '6 results on 3 pages',
    );
    key(field, 'Enter');
    expect(host.page()).toBe(6);
    key(field, 'Enter', { shiftKey: true });
    expect(host.page()).toBe(1);
    key(field, 'Escape');
    await fixture.whenStable();
    expect(el.querySelector('input[type=search]')).toBeNull();
  });

  it('shows the error state, with a custom template', async () => {
    const renderer = new FakeRenderer();
    renderer.fail = true;
    const { fixture, el, host } = await setup((h) => (h.renderer = renderer));
    expect(el.querySelector('[role=alert]')!.textContent).toContain(
      'The document could not be loaded.',
    );
    expect((host.failed as Error).message).toBe('broken file');
    host.customError.set(true);
    host.source.set('other.pdf');
    await fixture.whenStable();
    await fixture.whenStable();
    expect(el.querySelector('[role=alert]')!.textContent).toContain('Could not open: broken file');
    expect(renderer.disposed).toBe(1);
  });

  it('emits download and print, and disposes the renderer when destroyed', async () => {
    const { fixture, button, host } = await setup();
    button('Download').click();
    button('Print').click();
    expect(host.downloads).toBe(1);
    expect(host.prints).toBe(1);
    const renderer = host.renderer as FakeRenderer;
    fixture.destroy();
    expect(renderer.disposed).toBe(1);
  });
});

describe('StarDocumentViewer renderer token', () => {
  @Component({
    imports: [StarDocumentViewer],
    providers: [{ provide: STAR_DOCUMENT_RENDERER, useFactory: () => new FakeRenderer(3) }],
    template: `<star-document-viewer source="a.pdf" />`,
  })
  class TokenHost {}

  it('uses the renderer from STAR_DOCUMENT_RENDERER', async () => {
    const fixture = TestBed.createComponent(TokenHost);
    await fixture.whenStable();
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('.star-document-viewer__count').textContent.trim(),
    ).toBe('of 3');
    expect(fixture.nativeElement.querySelector('[role=region]').getAttribute('aria-label')).toBe(
      'Document',
    );
  });

  it('renders on the server without loading the document', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const renderer = fixture.componentInstance.renderer as FakeRenderer;
    expect(renderer.loads).toEqual([]);
    expect(fixture.nativeElement.querySelector('[role=region]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role=toolbar]')).not.toBeNull();
  });
});
