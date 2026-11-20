import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarFooterTemplate, StarHeaderTemplate, StarIconTemplate } from '@star-ng/ui/core';
import {
  StarGalleria,
  StarGalleriaResponsiveOption,
  StarGalleriaTemplate,
  StarGalleryImage,
} from './galleria';

const IMAGES: readonly StarGalleryImage[] = [
  { src: 'a.png', alt: 'Harbor', caption: 'The harbor' },
  { src: 'b.png', alt: 'Bridge' },
  { src: 'c.png', alt: 'Market' },
  { src: 'd.png', alt: 'Station' },
  { src: 'e.png', alt: 'Park' },
];

@Component({
  imports: [
    StarGalleria,
    StarGalleriaTemplate,
    StarHeaderTemplate,
    StarFooterTemplate,
    StarIconTemplate,
  ],
  template: `
    <star-galleria
      [images]="images"
      [(activeIndex)]="index"
      [circular]="circular()"
      [showItemNavigators]="navigators()"
      [showThumbnails]="thumbs()"
      [thumbnailsPosition]="position()"
      [numVisible]="numVisible()"
      [responsiveOptions]="responsive()"
      [showThumbnailNavigators]="thumbNav()"
      [showIndicators]="indicators()"
      [showIndicatorsOnItem]="onItem()"
      [changeItemOnIndicatorHover]="hover()"
      [autoPlay]="autoPlay()"
      [transitionInterval]="1000"
      [fullScreen]="fullScreen()"
      [(visible)]="visible"
    >
      @if (slots()) {
        <ng-template starGalleriaTemplate="item" let-image let-i="index"
          ><b class="item">{{ i }}:{{ image.alt }}</b></ng-template
        >
        <ng-template starGalleriaTemplate="caption" let-image
          ><i class="caption">{{ image.alt }}</i></ng-template
        >
        <ng-template starGalleriaTemplate="thumbnail" let-image let-on="active"
          ><span class="thumb">{{ image.alt }}:{{ on }}</span></ng-template
        >
        <ng-template starGalleriaTemplate="indicator" let-i="index"
          ><span class="dot">{{ i + 1 }}</span></ng-template
        >
        <ng-template starHeader><p class="head">Photos</p></ng-template>
        <ng-template starFooter><p class="foot">End</p></ng-template>
        <ng-template starIcon="next"><b class="next-icon">></b></ng-template>
      }
    </star-galleria>
  `,
})
class Host {
  readonly images = IMAGES;
  readonly index = signal(0);
  readonly circular = signal(true);
  readonly navigators = signal(true);
  readonly thumbs = signal(true);
  readonly position = signal<'bottom' | 'top' | 'left' | 'right'>('bottom');
  readonly numVisible = signal<number | null>(null);
  readonly responsive = signal<readonly StarGalleriaResponsiveOption[] | null>(null);
  readonly thumbNav = signal(false);
  readonly indicators = signal(false);
  readonly onItem = signal(false);
  readonly hover = signal(false);
  readonly autoPlay = signal(false);
  readonly fullScreen = signal(false);
  readonly visible = signal(false);
  readonly slots = signal(false);
}

const realMatchMedia = document.defaultView!.matchMedia;

async function setup(change?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  change?.(fixture.componentInstance);
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const button = (label: string) => el.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  return {
    fixture,
    el,
    host: fixture.componentInstance,
    button,
    stable: () => fixture.whenStable(),
  };
}

describe('StarGalleria depth', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-star-motion');
    const view = document.defaultView!;
    view.matchMedia = ((query: string) =>
      query.includes('reduce')
        ? ({ matches: false } as MediaQueryList)
        : realMatchMedia.call(view, query)) as typeof view.matchMedia;
  });
  afterEach(() => {
    document.defaultView!.matchMedia = realMatchMedia;
    vi.useRealTimers();
  });

  it('stops at the ends without circular and hides the item navigators', async () => {
    const t = await setup((h) => h.circular.set(false));
    expect(t.button('Previous image').disabled).toBe(true);
    t.button('Next image').click();
    await t.stable();
    expect(t.host.index()).toBe(1);
    t.host.navigators.set(false);
    await t.stable();
    expect(t.el.querySelector('.star-galleria__nav')).toBeNull();
  });

  it('shows a window of numVisible thumbnails that follows the image, with navigators', async () => {
    const t = await setup((h) => {
      h.numVisible.set(3);
      h.thumbNav.set(true);
    });
    const thumbs = () =>
      [...t.el.querySelectorAll('.star-galleria__thumb')].map((b) => b.getAttribute('aria-label'));
    expect(thumbs()).toEqual(['Show Harbor', 'Show Bridge', 'Show Market']);
    const navs = t.el.querySelectorAll<HTMLButtonElement>('[data-star-part=thumbnailNavigatorButton]');
    expect(navs.length).toBe(2);
    navs[1].click();
    navs[1].click();
    navs[1].click();
    await t.stable();
    expect(t.host.index()).toBe(3);
    expect(thumbs()).toEqual(['Show Market', 'Show Station', 'Show Park']);
  });

  it('takes numVisible from the responsive options at the window width', async () => {
    const view = document.defaultView!;
    const width = view.innerWidth;
    const t = await setup((h) =>
      h.responsive.set([
        { breakpoint: `${width + 100}px`, numVisible: 2 },
        { breakpoint: `${width + 500}px`, numVisible: 4 },
      ]),
    );
    expect(t.el.querySelectorAll('.star-galleria__thumb').length).toBe(2);
  });

  it('places the thumbnails and can hide them', async () => {
    const t = await setup((h) => h.position.set('left'));
    expect(t.el.querySelector('.star-galleria__body')!.getAttribute('data-thumbs')).toBe('left');
    expect(t.el.querySelector<HTMLElement>('.star-galleria__thumbs')!.style.maxHeight).toBe(
      '20rem',
    );
    t.host.thumbs.set(false);
    await t.stable();
    expect(t.el.querySelector('.star-galleria__thumbs')).toBeNull();
  });

  it('shows indicators that change the image on click or hover', async () => {
    const t = await setup((h) => {
      h.indicators.set(true);
      h.hover.set(true);
    });
    const dots = () => [...t.el.querySelectorAll<HTMLButtonElement>('.star-galleria__indicator')];
    expect(dots().length).toBe(5);
    expect(dots()[0].getAttribute('aria-current')).toBe('true');
    dots()[2].click();
    await t.stable();
    expect(t.host.index()).toBe(2);
    dots()[4].dispatchEvent(new MouseEvent('mouseenter'));
    await t.stable();
    expect(t.host.index()).toBe(4);
    expect(t.el.querySelector('figure .star-galleria__indicators')).toBeNull();
    t.host.onItem.set(true);
    await t.stable();
    expect(t.el.querySelector('figure .star-galleria__indicators')).not.toBeNull();
  });

  it('plays automatically, pauses with the button and stops on a click', async () => {
    vi.useFakeTimers();
    const t = await setup((h) => h.autoPlay.set(true));
    t.fixture.detectChanges();
    vi.advanceTimersByTime(1000);
    t.fixture.detectChanges();
    expect(t.host.index()).toBe(1);
    const play = t.el.querySelector<HTMLButtonElement>('.star-galleria__play')!;
    expect(play.getAttribute('aria-label')).toBe('Pause slides');
    play.click();
    vi.advanceTimersByTime(3000);
    t.fixture.detectChanges();
    expect(t.host.index()).toBe(1);
    expect(play.getAttribute('aria-label')).toBe('Play slides');
    play.click();
    vi.advanceTimersByTime(1000);
    t.fixture.detectChanges();
    expect(t.host.index()).toBe(2);
    t.button('Next image').click();
    vi.advanceTimersByTime(3000);
    t.fixture.detectChanges();
    expect(t.host.index()).toBe(3);
  });

  it('does not advance while motion is reduced', async () => {
    vi.useFakeTimers();
    document.documentElement.setAttribute('data-star-motion', 'reduced');
    const t = await setup((h) => h.autoPlay.set(true));
    vi.advanceTimersByTime(3000);
    t.fixture.detectChanges();
    expect(t.host.index()).toBe(0);
    document.documentElement.removeAttribute('data-star-motion');
  });

  it('shows the gallery in a full-screen dialog while visible', async () => {
    const t = await setup((h) => h.fullScreen.set(true));
    const host = t.el.querySelector('star-galleria')!;
    expect(host.getAttribute('role')).toBeNull();
    expect(t.el.querySelector('.star-galleria__stage')).toBeNull();
    t.host.visible.set(true);
    await t.stable();
    const dialog = document.querySelector('dialog')!;
    expect(dialog.querySelector('.star-galleria__stage')).not.toBeNull();
  });

  it('renders the item, caption, thumbnail, indicator, header, footer and icon slots', async () => {
    const t = await setup((h) => {
      h.slots.set(true);
      h.indicators.set(true);
    });
    expect(t.el.querySelector('.item')!.textContent).toBe('0:Harbor');
    expect(t.el.querySelector('figcaption .caption')!.textContent).toBe('Harbor');
    expect([...t.el.querySelectorAll('.thumb')].map((n) => n.textContent)).toEqual([
      'Harbor:true',
      'Bridge:false',
      'Market:false',
      'Station:false',
      'Park:false',
    ]);
    expect(t.el.querySelectorAll('.dot').length).toBe(5);
    expect(t.el.querySelector('.head')!.textContent).toBe('Photos');
    expect(t.el.querySelector('.foot')!.textContent).toBe('End');
    expect(t.el.querySelector('.next-icon')!.closest('[aria-hidden=true]')).not.toBeNull();
  });
});
