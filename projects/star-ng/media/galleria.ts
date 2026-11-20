import { DOCUMENT, isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  Directive,
  effect,
  forwardRef,
  inject,
  input,
  model,
  numberAttribute,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  starBreakpointValue,
  StarIconContext,
  starInlineKey,
  starPrefersReducedMotion,
  starSlot,
  StarSlot,
  starSlotMap,
  StarStyled,
  starViewportWidth,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { StarDialog } from '@star-ng/ui/dialog';

export interface StarGalleryImage {
  readonly src: string;
  readonly thumbnail?: string;
  readonly alt: string;
  readonly caption?: string;
}

/** A `responsiveOptions` entry: at a window width up to `breakpoint`, show `numVisible` thumbnails. */
export interface StarGalleriaResponsiveOption {
  /** Largest window width of the entry, for example `'768px'` or `'48rem'`. */
  readonly breakpoint: string;
  readonly numVisible: number;
}

/** Context of the `starGalleriaTemplate` slots. */
export interface StarGalleriaContext {
  /** The image. */
  readonly $implicit: StarGalleryImage;
  /** Its index. */
  readonly index: number;
  /** It is the image on show. */
  readonly active: boolean;
}

/** The parts of `star-galleria` that a `starGalleriaTemplate` slot replaces. */
export type StarGalleriaTemplateName = 'item' | 'thumbnail' | 'caption' | 'indicator';

/**
 * Replaces a part of `star-galleria`: `item` (the main image), `thumbnail`, `caption` or
 * `indicator` (the content of an indicator button). PrimeNG `#item`, `#thumbnail`, `#caption` and
 * `#indicator` templates. The context has the image (`let-image`), `index` and `active`.
 * `<ng-template starGalleriaTemplate="caption" let-image>{{ image.alt }}</ng-template>`
 *
 * Thumbnails and indicators are buttons: do not put focusable elements in their templates.
 */
@Directive({
  selector: 'ng-template[starGalleriaTemplate]',
  providers: [{ provide: StarSlot, useExisting: StarGalleriaTemplate }],
})
export class StarGalleriaTemplate extends StarSlot<StarGalleriaContext> {
  readonly name = 'galleria';
  readonly starGalleriaTemplate = input.required<StarGalleriaTemplateName>();

  override slotKey(): string {
    return this.starGalleriaTemplate();
  }

  static ngTemplateContextGuard(
    _dir: StarGalleriaTemplate,
    _ctx: unknown,
  ): _ctx is StarGalleriaContext {
    return true;
  }
}

type Position = 'bottom' | 'top' | 'left' | 'right';

/**
 * Image gallery (PrimeNG `p-galleria`): main image with caption, previous and next buttons, Arrow
 * keys, a thumbnail strip (`aria-current` on the active one), optional indicators, autoplay with a
 * pause button and a full-screen mode in a modal dialog.
 * `<star-galleria [images]="photos" [(activeIndex)]="current" />`
 *
 * Slots (content children): `starGalleriaTemplate` with `item`, `thumbnail`, `caption` and
 * `indicator`; `starHeader` and `starFooter` (content above and below); `starIcon` with
 * `previous`, `next`, `previousThumbnail` and `nextThumbnail`.
 *
 * PrimeNG names that star-ng covers in another way: `value` = `images`; `id` = the `id`
 * attribute of the host; `containerClass`, `containerStyle` and `maskClass` = `pt` (parts
 * `bodyPanel`, `stagePanel`) and the `class` and `style` of the host. Not applicable: `baseZIndex`
 * (the full-screen dialog is in the top layer), `motionOptions` and `maskMotionOptions` (the
 * motion comes from the theme tokens and stops with reduced motion), the `closeicon` template (the
 * full-screen dialog has its own close button).
 */
@Component({
  selector: 'star-galleria',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet, StarDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarGalleria) }],
  host: {
    class: 'star-galleria',
    '[class.star-galleria--full-screen]': 'fullScreen()',
    '[attr.role]': "fullScreen() ? null : 'region'",
    '[attr.aria-roledescription]': "fullScreen() ? null : 'gallery'",
    '[attr.aria-label]': 'fullScreen() ? null : label()',
    '(mouseenter)': 'hovering.set(true)',
    '(mouseleave)': 'hovering.set(false)',
    '(focusin)': 'hovering.set(true)',
    '(focusout)': 'hovering.set(false)',
  },
  template: `
    @if (fullScreen()) {
      <star-dialog
        [(visible)]="visible"
        [header]="label()"
        [maximized]="true"
        size="xl"
        dismissableMask
      >
        @if (visible()) {
          <ng-container *ngTemplateOutlet="body" />
        }
      </star-dialog>
    } @else {
      <ng-container *ngTemplateOutlet="body" />
    }

    <ng-template #body>
      <div
        data-star-part="bodyPanel"
        class="star-galleria__body"
        [attr.data-thumbs]="showThumbnails() ? thumbnailsPosition() : null"
        [class.star-galleria__body--nav-hover]="showItemNavigatorsOnHover()"
      >
        @if (headerSlot(); as header) {
          <div data-star-part="header" class="star-galleria__header">
            <ng-container *ngTemplateOutlet="header" />
          </div>
        }
        <div
          data-star-part="itemPanel"
          class="star-galleria__main"
          [attr.data-indicators]="showIndicators() ? indicatorsPosition() : null"
        >
          @if (current(); as image) {
            <figure
              data-star-part="stagePanel"
              class="star-galleria__stage"
              tabindex="0"
              (keydown)="onKeydown($event)"
            >
              @if (templates().get('item'); as custom) {
                <ng-container *ngTemplateOutlet="custom; context: context(image, activeIndex())" />
              } @else {
                <img data-star-part="picture" [src]="image.src" [alt]="image.alt" loading="lazy" />
              }
              @if (templates().get('caption'); as custom) {
                <figcaption data-star-part="caption" class="star-galleria__caption">
                  <ng-container
                    *ngTemplateOutlet="custom; context: context(image, activeIndex())"
                  />
                </figcaption>
              } @else if (image.caption) {
                <figcaption data-star-part="caption" class="star-galleria__caption">
                  {{ image.caption }}
                </figcaption>
              }
              @if (showItemNavigators()) {
                <button
                  data-star-part="navigation"
                  type="button"
                  class="star-galleria__nav star-galleria__nav--prev"
                  [attr.aria-label]="text.previousImage"
                  [disabled]="!canStep(-1)"
                  (click)="userStep(-1)"
                >
                  <ng-container
                    *ngTemplateOutlet="
                      iconTpl;
                      context: { name: 'previous', icon: 'ph-bold ph-caret-left star-icon-mirror' }
                    "
                  />
                </button>
                <button
                  data-star-part="navigation"
                  type="button"
                  class="star-galleria__nav star-galleria__nav--next"
                  [attr.aria-label]="text.nextImage"
                  [disabled]="!canStep(1)"
                  (click)="userStep(1)"
                >
                  <ng-container
                    *ngTemplateOutlet="
                      iconTpl;
                      context: { name: 'next', icon: 'ph-bold ph-caret-right star-icon-mirror' }
                    "
                  />
                </button>
              }
              <span data-star-part="countText" class="star-galleria__count" aria-live="polite"
                >{{ activeIndex() + 1 }} / {{ images().length }}</span
              >
              @if (autoPlay()) {
                <button
                  data-star-part="playButton"
                  type="button"
                  class="star-galleria__play"
                  [attr.aria-label]="playing() ? text.pauseSlides : text.playSlides"
                  (click)="playing.set(!playing())"
                >
                  <i
                    data-star-part="playIcon"
                    class="ph-bold"
                    [class.ph-pause]="playing()"
                    [class.ph-play]="!playing()"
                    aria-hidden="true"
                  ></i>
                </button>
              }
              @if (showIndicators() && showIndicatorsOnItem()) {
                <ng-container *ngTemplateOutlet="indicatorsTpl" />
              }
            </figure>
          }
          @if (showIndicators() && !showIndicatorsOnItem()) {
            <ng-container *ngTemplateOutlet="indicatorsTpl" />
          }
        </div>
        @if (showThumbnails()) {
          <div
            data-star-part="thumbsPanel"
            class="star-galleria__thumbs"
            [style.max-height]="vertical() ? verticalThumbnailViewPortHeight() : null"
          >
            @if (showThumbnailNavigators()) {
              <button
                data-star-part="thumbnailNavigatorButton"
                type="button"
                class="star-select__icon-btn star-galleria__thumb-nav"
                [attr.aria-label]="text.previousImage"
                [disabled]="!canStep(-1)"
                (click)="userStep(-1)"
              >
                <ng-container
                  *ngTemplateOutlet="
                    iconTpl;
                    context: {
                      name: 'previousThumbnail',
                      icon: vertical()
                        ? 'ph-bold ph-caret-up'
                        : 'ph-bold ph-caret-left star-icon-mirror',
                    }
                  "
                />
              </button>
            }
            <div data-star-part="thumbnailList" class="star-galleria__thumb-list">
              @for (entry of thumbnails(); track entry.index) {
                <button
                  data-star-part="thumbnailButton"
                  type="button"
                  class="star-galleria__thumb"
                  [attr.aria-current]="entry.index === activeIndex() || null"
                  [attr.aria-label]="text.showImage(entry.image.alt)"
                  (click)="userGo(entry.index)"
                >
                  @if (templates().get('thumbnail'); as custom) {
                    <ng-container
                      *ngTemplateOutlet="custom; context: context(entry.image, entry.index)"
                    />
                  } @else {
                    <img
                      data-star-part="thumbnail"
                      [src]="entry.image.thumbnail ?? entry.image.src"
                      alt=""
                      loading="lazy"
                    />
                  }
                </button>
              }
            </div>
            @if (showThumbnailNavigators()) {
              <button
                data-star-part="thumbnailNavigatorButton"
                type="button"
                class="star-select__icon-btn star-galleria__thumb-nav"
                [attr.aria-label]="text.nextImage"
                [disabled]="!canStep(1)"
                (click)="userStep(1)"
              >
                <ng-container
                  *ngTemplateOutlet="
                    iconTpl;
                    context: {
                      name: 'nextThumbnail',
                      icon: vertical()
                        ? 'ph-bold ph-caret-down'
                        : 'ph-bold ph-caret-right star-icon-mirror',
                    }
                  "
                />
              </button>
            }
          </div>
        }
        @if (footerSlot(); as footer) {
          <div data-star-part="footer" class="star-galleria__footer">
            <ng-container *ngTemplateOutlet="footer" />
          </div>
        }
      </div>
    </ng-template>

    <ng-template #indicatorsTpl>
      <div
        data-star-part="indicatorList"
        class="star-galleria__indicators"
        [class.star-galleria__indicators--on-item]="showIndicatorsOnItem()"
        role="group"
        [attr.aria-label]="label()"
      >
        @for (image of images(); track $index; let i = $index) {
          <button
            data-star-part="indicatorButton"
            type="button"
            class="star-galleria__indicator"
            [attr.aria-current]="i === activeIndex() || null"
            [attr.aria-label]="text.showImage(image.alt)"
            (click)="userGo(i)"
            (mouseenter)="onIndicatorHover(i)"
          >
            @if (templates().get('indicator'); as custom) {
              <ng-container *ngTemplateOutlet="custom; context: context(image, i)" />
            }
          </button>
        }
      </div>
    </ng-template>

    <ng-template #iconTpl let-name="name" let-icon="icon">
      @if (icons().get(name); as custom) {
        <span data-star-part="navigationIcon" class="star-galleria__icon" aria-hidden="true">
          <ng-container *ngTemplateOutlet="custom; context: iconContext" />
        </span>
      } @else {
        <i data-star-part="navigationIcon" [class]="icon" aria-hidden="true"></i>
      }
    </ng-template>
  `,
})
export class StarGalleria {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly doc = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  /** The images: `src`, `alt`, and optional `thumbnail` and `caption`. PrimeNG `value`. */
  readonly images = input<readonly StarGalleryImage[]>([]);
  /** Index of the image on show. */
  readonly activeIndex = model(0);
  /** Accessible name of the gallery region (default: the `galleryLabel` text). */
  readonly ariaLabel = input<string | null>(null);
  /** The previous and next buttons on the image (default `true`). */
  readonly showItemNavigators = input(true, { transform: booleanAttribute });
  /** The previous and next buttons show only while the pointer or the focus is on the gallery. */
  readonly showItemNavigatorsOnHover = input(false, { transform: booleanAttribute });
  /** After the last image comes the first (default `true`); without it the buttons stop at the ends. */
  readonly circular = input(true, { transform: booleanAttribute });
  /** The thumbnail strip (default `true`). */
  readonly showThumbnails = input(true, { transform: booleanAttribute });
  /** Side of the thumbnails: `'bottom'` (default), `'top'`, `'left'` or `'right'` (logical). */
  readonly thumbnailsPosition = input<Position>('bottom');
  /** Number of thumbnails shown at once; the strip follows the image on show. Default: all. */
  readonly numVisible = input<number | null, unknown>(null, {
    transform: (value: unknown) =>
      value === null || value === undefined || value === '' ? null : numberAttribute(value),
  });
  /** `numVisible` per window width (the entry with the smallest fitting `breakpoint` wins). */
  readonly responsiveOptions = input<readonly StarGalleriaResponsiveOption[] | null>(null);
  /** Previous and next buttons at the ends of the thumbnail strip. */
  readonly showThumbnailNavigators = input(false, { transform: booleanAttribute });
  /** CSS `max-height` of a `left` or `right` thumbnail strip (default `'20rem'`). */
  readonly verticalThumbnailViewPortHeight = input('20rem');
  /** A row of indicator buttons, one per image. */
  readonly showIndicators = input(false, { transform: booleanAttribute });
  /** The indicators lie on the image. */
  readonly showIndicatorsOnItem = input(false, { transform: booleanAttribute });
  /** Side of the indicators: `'bottom'` (default), `'top'`, `'left'` or `'right'`. */
  readonly indicatorsPosition = input<Position>('bottom');
  /** Pointing at an indicator shows its image. */
  readonly changeItemOnIndicatorHover = input(false, { transform: booleanAttribute });
  /**
   * Shows the next image every `transitionInterval` milliseconds, with a pause button. It pauses
   * while the pointer or the focus is on the gallery and does not advance while motion is reduced.
   */
  readonly autoPlay = input(false, { transform: booleanAttribute });
  /** Time between two images of the autoplay, in milliseconds (default 4000). */
  readonly transitionInterval = input(4000, { transform: numberAttribute });
  /** A click on a button, a thumbnail or an indicator stops the autoplay (default `true`). */
  readonly shouldStopAutoplayByClick = input(true, { transform: booleanAttribute });
  /**
   * Full-screen mode: the gallery shows in a modal dialog that fills the window while `visible` is
   * true, and nothing shows in the page.
   */
  readonly fullScreen = input(false, { transform: booleanAttribute });
  /** With `fullScreen`: the dialog is open. */
  readonly visible = model(false);

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly templates = starSlotMap<StarGalleriaContext>(this.slots, this, 'galleria');
  protected readonly headerSlot = starSlot<object>(this.slots, this, 'header');
  protected readonly footerSlot = starSlot<object>(this.slots, this, 'footer');
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly iconContext: StarIconContext = {};

  protected readonly playing = signal(true);
  protected readonly hovering = signal(false);
  protected readonly label = computed(() => this.ariaLabel() ?? this.text.galleryLabel);
  protected readonly current = computed(() => this.images()[this.activeIndex()] ?? null);
  protected readonly vertical = computed(
    () => this.thumbnailsPosition() === 'left' || this.thumbnailsPosition() === 'right',
  );
  private readonly width = starViewportWidth(() => !!this.responsiveOptions()?.length);
  /** Thumbnails shown at once, after the responsive options. `null`: all. */
  protected readonly visibleCount = computed(() => {
    const options = this.responsiveOptions();
    const map = options
      ? Object.fromEntries(options.map((option) => [option.breakpoint, option.numVisible]))
      : null;
    return starBreakpointValue(map, this.width()) ?? this.numVisible();
  });
  /** The thumbnails of the strip: a window of `visibleCount` around the image on show. */
  protected readonly thumbnails = computed(() => {
    const all = this.images().map((image, index) => ({ image, index }));
    const count = this.visibleCount();
    if (!count || count >= all.length) return all;
    const start = Math.min(
      Math.max(this.activeIndex() - Math.floor(count / 2), 0),
      all.length - count,
    );
    return all.slice(start, start + count);
  });

  constructor() {
    // Autoplay restarts when its interval changes; the callback pauses on hover, focus or Pause.
    effect((onCleanup) => {
      if (!this.browser || !this.autoPlay()) return;
      const ms = Math.max(this.transitionInterval(), 500);
      const id = setInterval(() => {
        if (!this.playing() || this.hovering() || starPrefersReducedMotion(this.doc)) return;
        if (!this.circular() && this.activeIndex() >= this.images().length - 1) {
          this.playing.set(false);
          return;
        }
        this.step(1);
      }, ms);
      onCleanup(() => clearInterval(id));
    });
  }

  protected context(image: StarGalleryImage, index: number): StarGalleriaContext {
    return { $implicit: image, index, active: index === this.activeIndex() };
  }

  protected canStep(delta: number): boolean {
    const count = this.images().length;
    if (count < 2) return false;
    if (this.circular()) return true;
    const next = this.activeIndex() + delta;
    return next >= 0 && next < count;
  }

  /** Shows the image `delta` places away (wraps around with `circular`). */
  step(delta: number): void {
    const count = this.images().length;
    if (!count || !this.canStep(delta)) return;
    this.activeIndex.set((this.activeIndex() + delta + count) % count);
  }

  protected userStep(delta: number): void {
    this.stopByClick();
    this.step(delta);
  }

  protected userGo(index: number): void {
    this.stopByClick();
    this.activeIndex.set(index);
  }

  protected onIndicatorHover(index: number): void {
    if (this.changeItemOnIndicatorHover()) this.activeIndex.set(index);
  }

  private stopByClick(): void {
    if (this.autoPlay() && this.shouldStopAutoplayByClick()) this.playing.set(false);
  }

  protected onKeydown(event: KeyboardEvent): void {
    // Arrow right is the next image in reading order: the left arrow in right-to-left.
    const key = starInlineKey(event);
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      this.userStep(key === 'ArrowLeft' ? -1 : 1);
    }
  }
}
