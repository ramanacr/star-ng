import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideStarNg, starPrefersReducedMotion } from '@star-ng/ui/core';
import { StarCarousel, StarCarouselItem } from '@star-ng/ui/media';
import { StarRipple, StarScrollTop } from '@star-ng/ui/utility';

const root = () => document.documentElement;

// The test browser may report the system setting `prefers-reduced-motion: reduce` (CI runners do).
// Every test starts with "no preference" and sets the attribute or the media query itself.
const realMatchMedia = document.defaultView!.matchMedia;

beforeEach(() => {
  const view = document.defaultView!;
  view.matchMedia = ((query: string) =>
    query.includes('reduce')
      ? ({ matches: false } as MediaQueryList)
      : realMatchMedia.call(view, query)) as typeof view.matchMedia;
});

afterEach(() => {
  document.defaultView!.matchMedia = realMatchMedia;
  root().removeAttribute('data-star-motion');
  vi.useRealTimers();
});

describe('starPrefersReducedMotion', () => {
  it('is true with data-star-motion="reduced" or the system setting', () => {
    expect(starPrefersReducedMotion(document)).toBe(false);
    root().setAttribute('data-star-motion', 'reduced');
    expect(starPrefersReducedMotion(document)).toBe(true);
    root().removeAttribute('data-star-motion');
    const view = document.defaultView!;
    const original = view.matchMedia;
    view.matchMedia = ((query: string) =>
      ({ matches: query.includes('reduce') }) as MediaQueryList) as typeof view.matchMedia;
    try {
      expect(starPrefersReducedMotion(document)).toBe(true);
    } finally {
      view.matchMedia = original;
    }
    expect(starPrefersReducedMotion(null)).toBe(false);
  });

  it('follows provideStarNg({ reducedMotion: "always" })', () => {
    TestBed.configureTestingModule({ providers: [provideStarNg({ reducedMotion: 'always' })] });
    TestBed.tick();
    expect(starPrefersReducedMotion(document)).toBe(true);
  });
});

@Component({
  imports: [StarRipple, StarScrollTop, StarCarousel, StarCarouselItem],
  template: `
    <button type="button" class="ink" starRipple>Save</button>
    <star-scroll-top [threshold]="0" />
    <star-carousel [items]="items" [autoplay]="1000" ariaLabel="Slides">
      <ng-template starCarouselItem let-item>{{ item }}</ng-template>
    </star-carousel>
  `,
})
class Host {
  readonly items = ['One', 'Two', 'Three'];
  readonly carousel = viewChild.required(StarCarousel);
}

describe('controls with motion not reduced (control case)', () => {
  it('the ripple adds ink', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.ink') as HTMLElement;
    button.dispatchEvent(new MouseEvent('pointerdown', { clientX: 5, clientY: 5, bubbles: true }));
    expect(button.querySelector('.star-ripple__ink')).not.toBeNull();
  });

  it('the carousel autoplays', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const goTo = vi.spyOn(fixture.componentInstance.carousel(), 'goTo');
    vi.advanceTimersByTime(3500);
    expect(goTo).toHaveBeenCalled();
  });
});

describe('controls with reducedMotion: "always"', () => {
  beforeEach(() => root().setAttribute('data-star-motion', 'reduced'));

  it('the ripple adds no ink', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.ink') as HTMLElement;
    button.dispatchEvent(new MouseEvent('pointerdown', { clientX: 5, clientY: 5, bubbles: true }));
    expect(button.querySelector('.star-ripple__ink')).toBeNull();
  });

  it('the carousel does not autoplay', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const goTo = vi.spyOn(fixture.componentInstance.carousel(), 'goTo');
    vi.advanceTimersByTime(3500);
    expect(goTo).not.toHaveBeenCalled();
  });

  it('scroll to top jumps without smooth scrolling', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const target = document.scrollingElement ?? document.documentElement;
    const calls: ScrollToOptions[] = [];
    const original = target.scrollTo;
    target.scrollTo = ((options: ScrollToOptions) => calls.push(options)) as typeof target.scrollTo;
    try {
      (fixture.nativeElement.querySelector('.star-scroll-top__btn') as HTMLButtonElement).click();
      expect(calls.at(-1)?.behavior).toBe('auto');
    } finally {
      target.scrollTo = original;
    }
  });
});
