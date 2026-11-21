import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  Directive,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarIconContext,
  StarIconSlotName,
  StarSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { StarDialog } from '@star-ng/ui/dialog';

/** Context of the `starImageTemplate` slots. */
export interface StarImageContext {
  /** The address of the image (`src`, or `previewImageSrc` in the preview). */
  readonly $implicit: string;
  /** The alternative text. */
  readonly alt: string;
  /** Only in the preview: the zoom factor (1 = 100 %). */
  readonly zoom: number;
  /** Only in the preview: the rotation in degrees (0, 90, 180 or 270). */
  readonly rotate: number;
  /** Only in the preview: the CSS `transform` of zoom and rotation. */
  readonly transform: string;
}

/**
 * Replaces the picture of `star-image`: `image` (the thumbnail in the page) or `preview` (the
 * picture in the preview dialog, with the zoom and the rotation in the context). PrimeNG `#image`
 * and `#preview` templates.
 * `<ng-template starImageTemplate="preview" let-src let-transform="transform">…</ng-template>`
 */
@Directive({
  selector: 'ng-template[starImageTemplate]',
  providers: [{ provide: StarSlot, useExisting: StarImageTemplate }],
})
export class StarImageTemplate extends StarSlot<StarImageContext> {
  readonly name = 'image';
  readonly starImageTemplate = input.required<'image' | 'preview'>();

  override slotKey(): string {
    return this.starImageTemplate();
  }

  static ngTemplateContextGuard(_dir: StarImageTemplate, _ctx: unknown): _ctx is StarImageContext {
    return true;
  }
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

/**
 * Image with preview (PrimeNG `p-image [preview]`): lazy-loaded thumbnail; click opens the full
 * image (or `previewImageSrc`) in a modal `star-dialog` with zoom in and out and rotate left and
 * right.
 * `<star-image src="label.png" alt="Product label" width="160" preview />`
 *
 * Slots (content children): `starImageTemplate` with `image` and `preview`; `starIcon` with
 * `preview` (the hint on the thumbnail, PrimeNG `#indicator`), `zoomIn`, `zoomOut`, `rotateLeft`
 * and `rotateRight`.
 *
 * PrimeNG names that star-ng covers in another way: `imageClass` and `imageStyle` = `pt` (part
 * `picture`). Not applicable: `appendTo` (the preview dialog is in the top layer),
 * `modalEnterAnimation`, `modalLeaveAnimation`, `motionOptions` and `maskMotionOptions` (the
 * dialog motion comes from the theme tokens and stops with reduced motion), the `closeicon`
 * template (the dialog has its own close button).
 */
@Component({
  selector: 'star-image',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarDialog, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarImage) }],
  host: { class: 'star-image' },
  template: `
    <ng-template #picture>
      @if (templates().get('image'); as custom) {
        <ng-container *ngTemplateOutlet="custom; context: imageContext()" />
      } @else {
        <img
          data-star-part="picture"
          [src]="src()"
          [alt]="alt()"
          [attr.srcset]="srcSet()"
          [attr.sizes]="sizes()"
          [attr.width]="width()"
          [attr.height]="height()"
          [attr.loading]="loading()"
          (error)="imageError.emit($event)"
        />
      }
    </ng-template>
    <ng-template #iconTpl let-name="name" let-icon="icon">
      @if (icons().get(name); as custom) {
        <span data-star-part="controlIcon" class="star-image__icon" aria-hidden="true">
          <ng-container *ngTemplateOutlet="custom; context: iconContext" />
        </span>
      } @else {
        <i data-star-part="controlIcon" [class]="icon" aria-hidden="true"></i>
      }
    </ng-template>

    @if (preview()) {
      <button
        data-star-part="triggerButton"
        type="button"
        class="star-image__trigger"
        [attr.aria-label]="text.previewImage(alt())"
        (click)="openPreview()"
      >
        <ng-container *ngTemplateOutlet="picture" />
        <span data-star-part="hintPanel" class="star-image__hint" aria-hidden="true">
          @if (icons().get('preview'); as custom) {
            <ng-container *ngTemplateOutlet="custom; context: iconContext" />
          } @else {
            <i data-star-part="hintIcon" class="ph-bold ph-magnifying-glass-plus"></i>
          }
        </span>
      </button>
      <star-dialog
        [visible]="open()"
        (visibleChange)="onVisible($event)"
        [header]="alt()"
        size="xl"
        dismissableMask
      >
        <div data-star-part="zoomPanel" class="star-image__zoom-bar">
          @for (control of controls; track control.id) {
            <button
              data-star-part="controlButton"
              type="button"
              class="star-select__icon-btn"
              [attr.aria-label]="text[control.label]"
              [disabled]="!canDo(control.id)"
              (click)="act(control.id)"
            >
              <ng-container
                *ngTemplateOutlet="iconTpl; context: { name: control.id, icon: control.icon }"
              />
            </button>
            @if (control.id === 'zoomOut') {
              <span data-star-part="zoomBarText" aria-live="polite">{{ zoom() * 100 }}%</span>
            }
          }
        </div>
        <!-- Focusable, so the arrow keys scroll a zoomed image. -->
        <div
          data-star-part="stagePanel"
          class="star-image__stage"
          role="group"
          tabindex="0"
          [attr.aria-label]="alt()"
        >
          @if (templates().get('preview'); as custom) {
            <ng-container *ngTemplateOutlet="custom; context: previewContext()" />
          } @else {
            <img
              data-star-part="picture"
              [src]="previewImageSrc() ?? src()"
              [alt]="alt()"
              [attr.srcset]="previewImageSrcSet()"
              [attr.sizes]="previewImageSizes()"
              [style.transform]="transform()"
            />
          }
        </div>
      </star-dialog>
    } @else {
      <ng-container *ngTemplateOutlet="picture" />
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
  /** Height attribute of the thumbnail. */
  readonly height = input<string | number | null>(null);
  /** `srcset` of the thumbnail (other sizes or densities of the image). */
  readonly srcSet = input<string | null>(null);
  /** `sizes` of the thumbnail, for `srcSet`. */
  readonly sizes = input<string | null>(null);
  /** `loading` of the thumbnail: `'lazy'` (default) or `'eager'`. */
  readonly loading = input<'lazy' | 'eager'>('lazy');
  /** The image opens in a dialog with zoom and rotate buttons when the user activates it. */
  readonly preview = input(false, { transform: booleanAttribute });
  /** Address of the image in the preview, for example a larger file (default: `src`). */
  readonly previewImageSrc = input<string | null>(null);
  /** `srcset` of the image in the preview. */
  readonly previewImageSrcSet = input<string | null>(null);
  /** `sizes` of the image in the preview. */
  readonly previewImageSizes = input<string | null>(null);
  /** Emits when the preview opens. PrimeNG `onShow`. */
  readonly show = output<void>();
  /** Emits when the preview closes. PrimeNG `onHide`. */
  readonly hide = output<void>();
  /** Emits the `error` event of the thumbnail when it cannot load. PrimeNG `onImageError`. */
  readonly imageError = output<Event>();

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly templates = starSlotMap<StarImageContext>(this.slots, this, 'image');
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly iconContext: StarIconContext = {};

  protected readonly controls: readonly {
    id: StarIconSlotName & ('zoomOut' | 'zoomIn' | 'rotateLeft' | 'rotateRight');
    label: 'zoomOut' | 'zoomIn' | 'imageRotateLeft' | 'imageRotateRight';
    icon: string;
  }[] = [
    { id: 'zoomOut', label: 'zoomOut', icon: 'ph-bold ph-magnifying-glass-minus' },
    { id: 'zoomIn', label: 'zoomIn', icon: 'ph-bold ph-magnifying-glass-plus' },
    { id: 'rotateLeft', label: 'imageRotateLeft', icon: 'ph-bold ph-arrow-counter-clockwise' },
    { id: 'rotateRight', label: 'imageRotateRight', icon: 'ph-bold ph-arrow-clockwise' },
  ];

  protected readonly open = signal(false);
  protected readonly zoom = signal(1);
  protected readonly rotate = signal(0);
  protected readonly transform = computed(
    () => `scale(${this.zoom()}) rotate(${this.rotate()}deg)`,
  );
  protected readonly imageContext = computed<StarImageContext>(() => ({
    $implicit: this.src(),
    alt: this.alt(),
    zoom: 1,
    rotate: 0,
    transform: '',
  }));
  protected readonly previewContext = computed<StarImageContext>(() => ({
    $implicit: this.previewImageSrc() ?? this.src(),
    alt: this.alt(),
    zoom: this.zoom(),
    rotate: this.rotate(),
    transform: this.transform(),
  }));

  /** Opens the preview (with the zoom and the rotation of the last time). */
  openPreview(): void {
    this.open.set(true);
    this.show.emit();
  }

  protected onVisible(visible: boolean): void {
    if (visible === this.open()) return;
    this.open.set(visible);
    (visible ? this.show : this.hide).emit();
  }

  protected canDo(id: 'zoomOut' | 'zoomIn' | 'rotateLeft' | 'rotateRight'): boolean {
    if (id === 'zoomOut') return this.zoom() > ZOOM_MIN;
    if (id === 'zoomIn') return this.zoom() < ZOOM_MAX;
    return true;
  }

  protected act(id: 'zoomOut' | 'zoomIn' | 'rotateLeft' | 'rotateRight'): void {
    if (id === 'zoomOut') this.zoom.set(Math.max(ZOOM_MIN, this.zoom() - 0.25));
    else if (id === 'zoomIn') this.zoom.set(Math.min(ZOOM_MAX, this.zoom() + 0.25));
    else this.rotate.set((this.rotate() + (id === 'rotateLeft' ? 270 : 90)) % 360);
  }
}
