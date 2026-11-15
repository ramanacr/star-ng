import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  model,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { STAR_UI_TEXT, starInlineKey, starIsRtl } from '@star-ng/ui/core';
import { StarDialog } from '@star-ng/ui/dialog';

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

/**
 * Carousel (PrimeNG `p-carousel`) on CSS scroll snap: swipe and trackpad work natively,
 * previous / next buttons, page dots, `numVisible` items per page, optional autoplay with a
 * pause button (WCAG 2.2.2) that also pauses on hover and focus.
 *
 * `<star-carousel [items]="news" [numVisible]="3" ariaLabel="News"><ng-template starCarouselItem let-n>…</ng-template></star-carousel>`
 */
@Component({
  selector: 'star-carousel',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-carousel',
    role: 'region',
    'aria-roledescription': 'carousel',
    '[attr.aria-label]': 'ariaLabel()',
    '[style.--star-visible]': 'numVisible()',
    '(mouseenter)': 'hovering.set(true)',
    '(mouseleave)': 'hovering.set(false)',
    '(focusin)': 'hovering.set(true)',
    '(focusout)': 'hovering.set(false)',
  },
  template: `
    <div class="star-carousel__controls">
      @if (autoplay()) {
        <button
          type="button"
          class="star-select__icon-btn"
          [attr.aria-label]="playing() ? text.pauseSlides : text.playSlides"
          (click)="playing.set(!playing())"
        >
          <i
            class="ph-bold"
            [class.ph-pause]="playing()"
            [class.ph-play]="!playing()"
            aria-hidden="true"
          ></i>
        </button>
      }
      <button
        type="button"
        class="star-select__icon-btn"
        [attr.aria-label]="text.previousSlides"
        [disabled]="page() === 0"
        (click)="goTo(page() - 1)"
      >
        <i class="ph-bold ph-caret-left star-icon-mirror" aria-hidden="true"></i>
      </button>
      <button
        type="button"
        class="star-select__icon-btn"
        [attr.aria-label]="text.nextSlides"
        [disabled]="page() >= pages() - 1"
        (click)="goTo(page() + 1)"
      >
        <i class="ph-bold ph-caret-right star-icon-mirror" aria-hidden="true"></i>
      </button>
    </div>
    <div
      #track
      class="star-carousel__track"
      role="group"
      tabindex="0"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-live]="playing() ? 'off' : 'polite'"
      (scrollend)="syncPage()"
    >
      @for (item of items(); track $index; let i = $index) {
        <div
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
    @if (pages() > 1) {
      <div class="star-carousel__dots">
        @for (dot of dots(); track dot) {
          <button
            type="button"
            class="star-carousel__dot"
            [class.star-carousel__dot--on]="dot === page()"
            [attr.aria-label]="text.page(dot + 1)"
            [attr.aria-current]="dot === page() || null"
            (click)="goTo(dot)"
          ></button>
        }
      </div>
    }
  `,
})
export class StarCarousel<T = unknown> {
  protected readonly text = inject(STAR_UI_TEXT);
  /** The slides: one item per slide. The `starCarouselItem` template draws each item. */
  readonly items = input<readonly T[]>([]);
  /** Number of slides in one page. */
  readonly numVisible = input(1);
  /** Autoplay interval in milliseconds (0 = off). */
  readonly autoplay = input(0);
  /** Accessible name of the carousel region. */
  readonly ariaLabel = input<string | null>(null);
  protected readonly itemTemplate = contentChild(StarCarouselItem);
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  protected readonly page = signal(0);
  protected readonly playing = signal(true);
  protected readonly hovering = signal(false);
  protected readonly pages = computed(() =>
    Math.max(1, Math.ceil(this.items().length / this.numVisible())),
  );
  protected readonly dots = computed(() => Array.from({ length: this.pages() }, (_, i) => i));

  constructor() {
    // Autoplay restarts when its interval changes; the callback pauses on hover, focus or Pause.
    effect((onCleanup) => {
      const ms = this.autoplay();
      if (!ms) return;
      const id = setInterval(() => {
        if (!this.playing() || this.hovering()) return;
        this.goTo(this.page() >= this.pages() - 1 ? 0 : this.page() + 1);
      }, ms);
      onCleanup(() => clearInterval(id));
    });
  }

  goTo(page: number): void {
    const target = Math.min(Math.max(page, 0), this.pages() - 1);
    this.page.set(target);
    const track = this.track().nativeElement;
    const slide = track.children[target * this.numVisible()] as HTMLElement | undefined;
    const reduce = matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Scroll by the distance between the slide and the track at their inline-start edge. In
    // right-to-left the scroll offset is negative and the first slide is at the right edge, so a
    // distance (not an absolute `scrollLeft`) works in both directions.
    const distance = slide ? this.distanceToStart(slide, track) : -track.scrollLeft;
    track.scrollBy?.({ left: distance, behavior: reduce ? 'auto' : 'smooth' });
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
    const slideWidth = (track.children[0] as HTMLElement | undefined)?.offsetWidth ?? 1;
    // `scrollLeft` is zero or negative in right-to-left: its size is the distance from the start.
    this.page.set(Math.round(Math.abs(track.scrollLeft) / (slideWidth * this.numVisible())));
  }
}

// ---------------------------------------------------------------- Galleria and image

export interface StarGalleryImage {
  readonly src: string;
  readonly thumbnail?: string;
  readonly alt: string;
  readonly caption?: string;
}

/**
 * Image gallery (PrimeNG `p-galleria`): main image with caption, previous / next, Arrow keys,
 * and a thumbnail strip (`aria-current` on the active one).
 * `<star-galleria [images]="photos" [(activeIndex)]="current" />`
 */
@Component({
  selector: 'star-galleria',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-galleria',
    role: 'region',
    'aria-roledescription': 'gallery',
    '[attr.aria-label]': 'ariaLabel() ?? text.galleryLabel',
  },
  template: `
    @if (current(); as image) {
      <figure class="star-galleria__stage" tabindex="0" (keydown)="onKeydown($event)">
        <img [src]="image.src" [alt]="image.alt" loading="lazy" />
        @if (image.caption) {
          <figcaption class="star-galleria__caption">{{ image.caption }}</figcaption>
        }
        <button
          type="button"
          class="star-galleria__nav star-galleria__nav--prev"
          [attr.aria-label]="text.previousImage"
          (click)="step(-1)"
        >
          <i class="ph-bold ph-caret-left star-icon-mirror" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="star-galleria__nav star-galleria__nav--next"
          [attr.aria-label]="text.nextImage"
          (click)="step(1)"
        >
          <i class="ph-bold ph-caret-right star-icon-mirror" aria-hidden="true"></i>
        </button>
        <span class="star-galleria__count" aria-live="polite"
          >{{ activeIndex() + 1 }} / {{ images().length }}</span
        >
      </figure>
    }
    <div class="star-galleria__thumbs">
      @for (image of images(); track $index; let i = $index) {
        <button
          type="button"
          class="star-galleria__thumb"
          [attr.aria-current]="i === activeIndex() || null"
          [attr.aria-label]="text.showImage(image.alt)"
          (click)="activeIndex.set(i)"
        >
          <img [src]="image.thumbnail ?? image.src" alt="" loading="lazy" />
        </button>
      }
    </div>
  `,
})
export class StarGalleria {
  protected readonly text = inject(STAR_UI_TEXT);
  /** The images: `src`, `alt`, and optional `thumbnail` and `caption`. */
  readonly images = input<readonly StarGalleryImage[]>([]);
  /** Index of the image on show. */
  readonly activeIndex = model(0);
  /** Accessible name of the gallery region (default: the `galleryLabel` text). */
  readonly ariaLabel = input<string | null>(null);
  protected readonly current = computed(() => this.images()[this.activeIndex()] ?? null);

  step(delta: number): void {
    const count = this.images().length;
    if (count) this.activeIndex.set((this.activeIndex() + delta + count) % count);
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Arrow right is the next image in reading order: the left arrow in right-to-left.
    const key = starInlineKey(event);
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      this.step(key === 'ArrowLeft' ? -1 : 1);
    }
  }
}

/**
 * Image with preview (PrimeNG `p-image [preview]`): lazy-loaded thumbnail; click opens the
 * full image in a modal `star-dialog` with zoom in / out.
 * `<star-image src="label.png" alt="Product label" width="160" preview />`
 */
@Component({
  selector: 'star-image',
  imports: [StarDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-image' },
  template: `
    @if (preview()) {
      <button
        type="button"
        class="star-image__trigger"
        [attr.aria-label]="text.previewImage(alt())"
        (click)="open.set(true)"
      >
        <img [src]="src()" [alt]="alt()" [attr.width]="width()" loading="lazy" />
        <span class="star-image__hint" aria-hidden="true"
          ><i class="ph-bold ph-magnifying-glass-plus"></i
        ></span>
      </button>
      <star-dialog [(visible)]="open" [header]="alt()" size="xl" dismissableMask>
        <div class="star-image__zoom-bar">
          <button
            type="button"
            class="star-select__icon-btn"
            [attr.aria-label]="text.zoomOut"
            [disabled]="zoom() <= 0.5"
            (click)="zoom.set(zoom() - 0.25)"
          >
            <i class="ph-bold ph-magnifying-glass-minus" aria-hidden="true"></i>
          </button>
          <span aria-live="polite">{{ zoom() * 100 }}%</span>
          <button
            type="button"
            class="star-select__icon-btn"
            [attr.aria-label]="text.zoomIn"
            [disabled]="zoom() >= 3"
            (click)="zoom.set(zoom() + 0.25)"
          >
            <i class="ph-bold ph-magnifying-glass-plus" aria-hidden="true"></i>
          </button>
        </div>
        <!-- Focusable, so the arrow keys scroll a zoomed image. -->
        <div class="star-image__stage" role="group" tabindex="0" [attr.aria-label]="alt()">
          <img [src]="src()" [alt]="alt()" [style.transform]="'scale(' + zoom() + ')'" />
        </div>
      </star-dialog>
    } @else {
      <img [src]="src()" [alt]="alt()" [attr.width]="width()" loading="lazy" />
    }
  `,
})
export class StarImage {
  protected readonly text = inject(STAR_UI_TEXT);
  /** Image address. */
  readonly src = input.required<string>();
  /** Alternative text. It is also the title of the preview dialog. */
  readonly alt = input.required<string>();
  /** Width attribute of the thumbnail. */
  readonly width = input<string | number | null>(null);
  /** The image opens in a dialog with zoom buttons when the user activates it. */
  readonly preview = input(false, { transform: booleanAttribute });
  protected readonly open = signal(false);
  protected readonly zoom = signal(1);
  protected readonly id = inject(_IdGenerator).getId('star-image-');
}
