import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarFooterTemplate, StarHeaderTemplate, StarIconTemplate } from '@star-ng/ui/core';
import {
  StarCarousel,
  StarCarouselIndicator,
  StarCarouselItem,
  StarCarouselResponsiveOption,
} from './media';

const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

@Component({
  imports: [
    StarCarousel,
    StarCarouselItem,
    StarCarouselIndicator,
    StarHeaderTemplate,
    StarFooterTemplate,
    StarIconTemplate,
  ],
  template: `
    <star-carousel
      ariaLabel="News"
      [items]="items"
      [numVisible]="3"
      [numScroll]="numScroll()"
      [circular]="circular()"
      [orientation]="orientation()"
      verticalViewPortHeight="300px"
      [responsiveOptions]="responsive()"
      [(page)]="page"
    >
      <ng-template starCarouselItem let-n
        ><b class="slide">{{ n }}</b></ng-template
      >
      <ng-template starHeader><b class="own-header">Top news</b></ng-template>
      <ng-template starFooter><b class="own-footer">More</b></ng-template>
      <ng-template starIcon="previous"><b class="own-prev">p</b></ng-template>
      <ng-template starIcon="next"><b class="own-next">n</b></ng-template>
      <ng-template starCarouselIndicator let-p let-active="active"
        ><b class="own-dot">{{ p + 1 }}{{ active ? '*' : '' }}</b></ng-template
      >
    </star-carousel>
  `,
})
class Host {
  readonly items = [1, 2, 3, 4, 5, 6, 7];
  readonly numScroll = signal<number | null>(1);
  readonly circular = signal(false);
  readonly orientation = signal<'horizontal' | 'vertical'>('horizontal');
  readonly responsive = signal<readonly StarCarouselResponsiveOption[]>([]);
  readonly page = signal(0);
}

async function setup(change?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  change?.(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const buttons = () => [
    ...el.querySelectorAll<HTMLButtonElement>('.star-carousel__controls button'),
  ];
  return { fixture, el, host: fixture.componentInstance, buttons };
}

describe('StarCarousel depth', () => {
  it('renders the header, footer, navigator icons and indicator slots', async () => {
    const t = await setup();
    expect(text(t.el.querySelector('.own-header'))).toBe('Top news');
    expect(text(t.el.querySelector('.own-footer'))).toBe('More');
    expect(t.el.querySelector('.own-prev')!.closest('[aria-hidden=true]')).not.toBeNull();
    expect(t.el.querySelector('.own-next')).not.toBeNull();
    // numScroll 1 with 7 items and 3 visible: 5 pages.
    expect([...t.el.querySelectorAll('.own-dot')].map((d) => d.textContent)).toEqual([
      '1*',
      '2',
      '3',
      '4',
      '5',
    ]);
  });

  it('moves by numScroll and keeps the page model in step', async () => {
    const t = await setup();
    t.buttons()[1].click();
    await t.fixture.whenStable();
    expect(t.host.page()).toBe(1);
    t.host.page.set(4);
    await t.fixture.whenStable();
    expect(t.buttons()[1].disabled).toBe(true);
  });

  it('wraps around with circular', async () => {
    const t = await setup((h) => h.circular.set(true));
    expect(t.buttons()[0].disabled).toBe(false);
    t.buttons()[0].click();
    await t.fixture.whenStable();
    expect(t.host.page()).toBe(4);
    t.buttons()[1].click();
    await t.fixture.whenStable();
    expect(t.host.page()).toBe(0);
  });

  it('takes numVisible and numScroll from the matching responsive option', async () => {
    const t = await setup((h) => {
      h.numScroll.set(null);
      h.responsive.set([
        { breakpoint: '4000px', numVisible: 2, numScroll: 2 },
        { breakpoint: '100px', numVisible: 1 },
      ]);
    });
    const host = t.el.querySelector<HTMLElement>('star-carousel')!;
    expect(host.style.getPropertyValue('--star-visible')).toBe('2');
    // 7 items, 2 visible, 2 per scroll: 4 pages.
    expect(t.el.querySelectorAll('.own-dot').length).toBe(4);
  });

  it('is a live region without autoplay', async () => {
    const t = await setup();
    expect(t.el.querySelector('.star-carousel__track')!.getAttribute('aria-live')).toBe('polite');
  });

  it('keeps the pause while the focus stays inside after the pointer leaves', async () => {
    const t = await setup();
    const host = t.el.querySelector<HTMLElement>('star-carousel')!;
    const carousel = t.fixture.debugElement.query((d) => d.name === 'star-carousel')
      .componentInstance as unknown as { paused: () => boolean };
    host.dispatchEvent(new MouseEvent('mouseenter'));
    t.buttons()[1].dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    host.dispatchEvent(new MouseEvent('mouseleave'));
    expect(carousel.paused()).toBe(true);
    t.buttons()[1].dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: t.buttons()[0] }),
    );
    expect(carousel.paused()).toBe(true);
    t.buttons()[1].dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }),
    );
    expect(carousel.paused()).toBe(false);
  });

  it('switches to a vertical track', async () => {
    const t = await setup((h) => h.orientation.set('vertical'));
    const host = t.el.querySelector<HTMLElement>('star-carousel')!;
    expect(host.classList).toContain('star-carousel--vertical');
    expect(t.el.querySelector<HTMLElement>('.star-carousel__track')!.style.height).toBe('300px');
  });
});
