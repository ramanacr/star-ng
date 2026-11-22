import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  DestroyRef,
  Directive,
  DOCUMENT,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  PLATFORM_ID,
  signal,
  TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarIconContext,
  starIsRtl,
  starPrefersReducedMotion,
  StarSlot,
  starSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';

// ---------------------------------------------------------------- Carousel

/** Slide template: `<ng-template starCarouselItem let-item>`. */
@Directive({ selector: 'ng-template[starCarouselItem]' })
export class StarCarouselItem<T = unknown> {
  readonly starCarouselItemOf = input<readonly T[] | null>(null);
  readonly template = inject<TemplateRef<{ $implicit: T; index: number }>>(TemplateRef);
  static ngTemplateContextGuard<T>(
    _dir: StarCarouselItem<T>,
    _ctx: unknown,
  ): _ctx is { $implicit: T; index: number } {
    return true;
  }
}

/** Context of the `starCarouselIndicator` slot. */
export interface StarCarouselIndicatorContext {
  /** The page of this indicator, from `0`. */
  readonly $implicit: number;
  /** The page is the current one. */
  readonly active: boolean;
}

/**
 * Content of each page indicator (dot) of `star-carousel`: the button, its name and
 * `aria-current` stay. PrimeNG indicator template. The content is decorative (`aria-hidden`).
 */
@Directive({
  selector: 'ng-template[starCarouselIndicator]',
  providers: [{ provide: StarSlot, useExisting: StarCarouselIndicator }],
})
export class StarCarouselIndicator extends StarSlot<StarCarouselIndicatorContext> {
  readonly name = 'carouselIndicator';

  static ngTemplateContextGuard(
    _dir: StarCarouselIndicator,
    _ctx: unknown,
  ): _ctx is StarCarouselIndicatorContext {
    return true;
  }
}

/**
 * One responsive option of `star-carousel`: below or at `breakpoint` (a pixel width, for example
 * `'768px'`), the carousel shows `numVisible` slides and moves `numScroll` per page.
 */
export interface StarCarouselResponsiveOption {
  readonly breakpoint: string;
  readonly numVisible: number;
  readonly numScroll?: number;
}

/**
 * Carousel (PrimeNG `p-carousel`) on CSS scroll snap: swipe and trackpad work natively,
 * previous / next buttons, page dots, `numVisible` items per page, optional autoplay with a
 * pause button (WCAG 2.2.2) that also pauses on hover and focus.
 *
 * `<star-carousel [items]="news" [numVisible]="3" ariaLabel="News"><ng-template starCarouselItem let-n>…</ng-template></star-carousel>`
 *
 * Slots (content children): `starCarouselItem` (each slide, PrimeNG `#item`), `starHeader` and
 * `starFooter` (above and below, `#header`, `#footer`), `starIcon` with `previous` and `next`
 * (`#previousicon`, `#nexticon`), `starCarouselIndicator` (the content of each dot).
 *
 * PrimeNG names that star-ng covers in another way: `value` = `items`, `autoplayInterval` =
 * `autoplay`, `onPage` = `pageChange` (of the `page` model), `contentClass`,
 * `indicatorsContentClass`, `indicatorStyleClass`, `prevButtonProps` and `nextButtonProps` = `pt`.
 */
@Component({
  selector: 'star-carousel',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarCarousel) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-carousel',
    role: 'region',
    'aria-roledescription': 'carousel',
    '[attr.aria-label]': 'ariaLabel()',
    '[class.star-carousel--vertical]': "orientation() === 'vertical'",
    '[style.--star-visible]': 'visible()',
    '(mouseenter)': 'hovered.set(true)',
    '(mouseleave)': 'hovered.set(false)',
    '(focusin)': 'focused.set(true)',
    '(focusout)': 'onFocusOut($event)',
  },
  template: `
    @if (headerSlot(); as custom) {
      <div data-star-part="headerPanel" class="star-carousel__header">
        <ng-container *ngTemplateOutlet="custom" />
      </div>
    }
    @if (showNavigators() || autoplay()) {
      <div data-star-part="controlsPanel" class="star-carousel__controls">
        @if (autoplay()) {
          <button
            data-star-part="controlButton"
            type="button"
            class="star-select__icon-btn"
            [attr.aria-label]="playing() ? text.pauseSlides : text.playSlides"
            (click)="playing.set(!playing())"
          >
            <i
              data-star-part="controlIcon"
              class="ph-bold"
              [class.ph-pause]="playing()"
              [class.ph-play]="!playing()"
              aria-hidden="true"
            ></i>
          </button>
        }
        @if (showNavigators()) {
          <button
            data-star-part="controlButton"
            type="button"
            class="star-select__icon-btn"
            [attr.aria-label]="text.previousSlides"
            [disabled]="!circular() && page() === 0"
            (click)="previous()"
          >
            @if (icons().get('previous'); as custom) {
              <span data-star-part="previousIcon" aria-hidden="true">
                <ng-container *ngTemplateOutlet="custom; context: iconContext" />
              </span>
            } @else {
              <i
                data-star-part="previousIcon"
                class="ph-bold star-icon-mirror"
                [class.ph-caret-left]="orientation() !== 'vertical'"
                [class.ph-caret-up]="orientation() === 'vertical'"
                aria-hidden="true"
              ></i>
            }
          </button>
          <button
            data-star-part="controlButton"
            type="button"
            class="star-select__icon-btn"
            [attr.aria-label]="text.nextSlides"
            [disabled]="!circular() && page() >= pages() - 1"
            (click)="next()"
          >
            @if (icons().get('next'); as custom) {
              <span data-star-part="nextIcon" aria-hidden="true">
                <ng-container *ngTemplateOutlet="custom; context: iconContext" />
              </span>
            } @else {
              <i
                data-star-part="nextIcon"
                class="ph-bold star-icon-mirror"
                [class.ph-caret-right]="orientation() !== 'vertical'"
                [class.ph-caret-down]="orientation() === 'vertical'"
                aria-hidden="true"
              ></i>
            }
          </button>
        }
      </div>
    }
    <div
      data-star-part="track"
      #track
      class="star-carousel__track"
      role="group"
      tabindex="0"
      [style.height]="orientation() === 'vertical' ? verticalViewPortHeight() : null"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-live]="autoplay() && playing() ? 'off' : 'polite'"
      (scrollend)="syncPage()"
    >
      @for (item of items(); track $index; let i = $index) {
        <div
          data-star-part="slidePanel"
          class="star-carousel__slide"
          role="group"
          aria-roledescription="slide"
          [attr.aria-label]="text.ofTotal(i + 1, items().length)"
        >
          @if (itemTemplate(); as custom) {
            <ng-container
              *ngTemplateOutlet="custom.template; context: { $implicit: item, index: i }"
            />
          }
        </div>
      }
    </div>
    @if (showIndicators() && pages() > 1) {
      <div data-star-part="indicatorList" class="star-carousel__dots">
        @for (dot of dots(); track dot) {
          <button
            data-star-part="indicatorButton"
            type="button"
            class="star-carousel__dot"
            [class.star-carousel__dot--on]="dot === page()"
            [class.star-carousel__dot--custom]="!!indicatorSlot()"
            [attr.aria-label]="text.page(dot + 1)"
            [attr.aria-current]="dot === page() || null"
            (click)="goTo(dot)"
          >
            @if (indicatorSlot(); as custom) {
              <span data-star-part="indicatorText" aria-hidden="true">
                <ng-container
                  *ngTemplateOutlet="custom; context: { $implicit: dot, active: dot === page() }"
                />
              </span>
            }
          </button>
        }
      </div>
    }
    @if (footerSlot(); as custom) {
      <div data-star-part="footerPanel" class="star-carousel__footer">
        <ng-container *ngTemplateOutlet="custom" />
      </div>
    }
  `,
})
export class StarCarousel<T = unknown> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly doc = inject(DOCUMENT);
  /** The slides: one item per slide. The `starCarouselItem` template draws each item. */
  readonly items = input<readonly T[]>([]);
  /** Number of slides in one page. */
  readonly numVisible = input(1);
  /**
   * Number of slides that one step moves. Default: `numVisible` (a full page). PrimeNG
   * `numScroll`.
   */
  readonly numScroll = input<number | null>(null);
  /**
   * `numVisible` and `numScroll` per screen width: the option with the smallest `breakpoint` that
   * is not below the window width wins. `breakpoint` is a pixel width (`'768px'`); other units
   * are not converted. The width is read after the first render. PrimeNG `responsiveOptions`.
   */
  readonly responsiveOptions = input<readonly StarCarouselResponsiveOption[]>([]);
  /** `'horizontal'` (default) or `'vertical'` (set `verticalViewPortHeight`). PrimeNG `orientation`. */
  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
  /** CSS height of the track in the vertical orientation (default `'300px'`). */
  readonly verticalViewPortHeight = input('300px');
  /** Next on the last page goes to the first, previous on the first to the last. PrimeNG `circular`. */
  readonly circular = input(false, { transform: booleanAttribute });
  /** Shows the page dots (default `true`). PrimeNG `showIndicators`. */
  readonly showIndicators = input(true, { transform: booleanAttribute });
  /** Shows the previous and next buttons (default `true`). PrimeNG `showNavigators`. */
  readonly showNavigators = input(true, { transform: booleanAttribute });
  /** Autoplay interval in milliseconds (0 = off). It does not advance while motion is reduced (system setting or `reducedMotion: 'always'`). */
  readonly autoplay = input(0);
  /** Accessible name of the carousel region. */
  readonly ariaLabel = input<string | null>(null);
  /** The current page, from `0`. Two-way. PrimeNG `page` and `onPage`. */
  readonly page = model(0);
  protected readonly itemTemplate = contentChild(StarCarouselItem);
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly headerSlot = starSlot<object>(this.slots, this, 'header');
  protected readonly footerSlot = starSlot<object>(this.slots, this, 'footer');
  protected readonly indicatorSlot = starSlot<StarCarouselIndicatorContext>(
    this.slots,
    this,
    'carouselIndicator',
  );
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly iconContext: StarIconContext = {};

  protected readonly playing = signal(true);
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly hovered = signal(false);
  protected readonly focused = signal(false);
  /** Autoplay waits while the pointer is over the carousel or the focus is inside it. */
  protected readonly paused = computed(() => this.hovered() || this.focused());
  /** Window width for `responsiveOptions` (`Infinity` on the server: no option applies). */
  private readonly width = signal(Number.POSITIVE_INFINITY);
  private readonly active = computed(() => {
    const width = this.width();
    return (
      [...this.responsiveOptions()]
        .map((option) => ({ option, px: parseFloat(option.breakpoint) }))
        .filter(({ px }) => Number.isFinite(px) && width <= px)
        .sort((a, b) => a.px - b.px)[0]?.option ?? null
    );
  });
  /** Slides per page, after the responsive options. */
  protected readonly visible = computed(() =>
    Math.max(1, this.active()?.numVisible ?? this.numVisible()),
  );
  /** Slides per step, after the responsive options. */
  private readonly scroll = computed(() =>
    Math.max(1, this.active()?.numScroll ?? this.numScroll() ?? this.visible()),
  );
  protected readonly pages = computed(() => {
    const count = this.items().length;
    const visible = this.visible();
    if (count <= visible) return 1;
    return Math.ceil((count - visible) / this.scroll()) + 1;
  });
  protected readonly dots = computed(() => Array.from({ length: this.pages() }, (_, i) => i));
  /** The page that the track shows now; a new `page` from outside scrolls to it. */
  private shown = 0;

  constructor() {
    // Autoplay restarts when its interval changes; the callback pauses on hover, focus or Pause.
    effect((onCleanup) => {
      const ms = this.autoplay();
      if (!ms) return;
      const id = setInterval(() => {
        if (!this.playing() || this.paused() || starPrefersReducedMotion(this.doc)) return;
        this.goTo(this.page() >= this.pages() - 1 ? 0 : this.page() + 1);
      }, ms);
      onCleanup(() => clearInterval(id));
    });
    // A page set from outside (the `page` model) moves the track, after the render.
    afterRenderEffect(() => {
      const page = this.page();
      if (page !== this.shown) untracked(() => this.goTo(page));
    });
    const view = this.doc.defaultView;
    if (isPlatformBrowser(inject(PLATFORM_ID)) && view) {
      const onResize = () => this.width.set(view.innerWidth);
      // After the first render, so the client starts with the prerendered markup.
      afterNextRender(() => {
        onResize();
        view.addEventListener('resize', onResize, { passive: true });
      });
      inject(DestroyRef).onDestroy(() => view.removeEventListener('resize', onResize));
    }
  }

  /** The focus left the carousel (not only one of its buttons). */
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!next || !this.hostElement.contains(next)) this.focused.set(false);
  }

  /** Goes to the previous page (to the last one from the first with `circular`). */
  previous(): void {
    const page = this.page();
    this.goTo(page === 0 && this.circular() ? this.pages() - 1 : page - 1);
  }

  /** Goes to the next page (to the first one from the last with `circular`). */
  next(): void {
    const page = this.page();
    this.goTo(page >= this.pages() - 1 && this.circular() ? 0 : page + 1);
  }

  goTo(page: number): void {
    const target = Math.min(Math.max(page, 0), this.pages() - 1);
    this.shown = target;
    this.page.set(target);
    const track = this.track().nativeElement;
    const first = Math.min(
      target * this.scroll(),
      Math.max(0, this.items().length - this.visible()),
    );
    const slide = track.children[first] as HTMLElement | undefined;
    const behavior = starPrefersReducedMotion(this.doc) ? 'auto' : 'smooth';
    if (this.orientation() === 'vertical') {
      const distance = slide
        ? slide.getBoundingClientRect().top - track.getBoundingClientRect().top
        : -track.scrollTop;
      track.scrollBy?.({ top: distance, behavior });
      return;
    }
    // Scroll by the distance between the slide and the track at their inline-start edge. In
    // right-to-left the scroll offset is negative and the first slide is at the right edge, so a
    // distance (not an absolute `scrollLeft`) works in both directions.
    const distance = slide ? this.distanceToStart(slide, track) : -track.scrollLeft;
    track.scrollBy?.({ left: distance, behavior });
  }

  /** Pixels to scroll so that the inline-start edge of the slide meets the one of the track. */
  private distanceToStart(slide: HTMLElement, track: HTMLElement): number {
    const slideBox = slide.getBoundingClientRect();
    const trackBox = track.getBoundingClientRect();
    return starIsRtl(track) ? slideBox.right - trackBox.right : slideBox.left - trackBox.left;
  }

  /** Keeps dots in sync after a swipe. */
  protected syncPage(): void {
    const track = this.track().nativeElement;
    const slide = track.children[0] as HTMLElement | undefined;
    const vertical = this.orientation() === 'vertical';
    const size = (vertical ? slide?.offsetHeight : slide?.offsetWidth) || 1;
    // `scrollLeft` is zero or negative in right-to-left: its size is the distance from the start.
    const offset = vertical ? track.scrollTop : Math.abs(track.scrollLeft);
    const page = Math.min(this.pages() - 1, Math.round(offset / (size * this.scroll())));
    this.shown = page;
    this.page.set(page);
  }
}

// ---------------------------------------------------------------- Galleria and image

export * from './galleria';

export * from './image';
