import { _IdGenerator } from '@angular/cdk/a11y';
import { DOCUMENT, isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  isDevMode,
  model,
  numberAttribute,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { STAR_UI_TEXT, StarAnnouncer, starInlineKey } from '@star-ng/ui/core';
import { StarSlider } from '@star-ng/ui/slider';
import {
  STAR_IMAGE_NO_ADJUSTMENTS,
  StarImageAdjustments,
  starImageAdjustmentsOf,
  StarImageAnnotation,
  starImageAnnotationBox,
  StarImageAnnotationKind,
  starImageAspectCrop,
  starImageClampCrop,
  StarImageCropHandle,
  starImageFilter,
  starImageFitScale,
  starImageHistoryPush,
  starImageHistoryRedo,
  starImageHistoryStart,
  starImageHistoryUndo,
  starImageIsNeutral,
  starImageIsSafeSource,
  starImageNudgeCrop,
  StarImageOperation,
  starImageOutputSize,
  StarImagePoint,
  StarImageRect,
  starImageResizeCrop,
  StarImageSize,
} from './image-editor-model';
import { starImageRender, starImageRenderBase, starImageReplay } from './image-editor-render';

/** A tool of `star-image-editor` that opens a panel. */
export type StarImageTool = 'crop' | 'rotate' | 'resize' | 'adjust' | 'annotate';

/** A fixed crop ratio of the crop panel. `ratio`: width / height; `null`: free. */
export interface StarImageAspectRatio {
  readonly label: string;
  readonly ratio: number | null;
}

/** Options of `StarImageEditor.exportImage`. */
export interface StarImageExportOptions {
  /** `image/png` (default) or `image/jpeg`. A JPEG gets a white background. */
  readonly type?: 'image/png' | 'image/jpeg';
  /** JPEG quality from 0 to 1. */
  readonly quality?: number;
}

/** The crop ratios of the crop panel: free, 1:1, 4:3 and 16:9. The free label is UI text. */
export const STAR_IMAGE_ASPECT_RATIOS: readonly StarImageAspectRatio[] = [
  { label: '', ratio: null },
  { label: '1:1', ratio: 1 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '16:9', ratio: 16 / 9 },
];

/** The annotation colours: the chart palette tokens, so they follow the theme of the page. */
export const STAR_IMAGE_COLORS: readonly string[] = Array.from(
  { length: 8 },
  (_, i) => `var(--star-chart-${i + 1})`,
);

/** The light-theme values of the palette tokens, for a page without the StarNG styles. */
const FALLBACK_COLORS = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
];

/** Milliseconds that `value` waits after the last edit before it is encoded. */
export const STAR_IMAGE_VALUE_DELAY = 150;

/** A blob as a base64 data URL, without `FileReader` (works in every engine and in tests). */
async function starBlobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${blob.type || 'image/png'};base64,${btoa(binary)}`;
}

/** View size before the stage is measured (and on the server). */
const FALLBACK_STAGE: StarImageSize = { width: 640, height: 400 };

const KINDS: readonly { kind: StarImageAnnotationKind; icon: string }[] = [
  { kind: 'pen', icon: 'ph-scribble' },
  { kind: 'rectangle', icon: 'ph-rectangle' },
  { kind: 'ellipse', icon: 'ph-circle' },
  { kind: 'arrow', icon: 'ph-arrow-up-right' },
  { kind: 'text', icon: 'ph-text-t' },
];

/** Tools that change the geometry (size, turn, mirror) of the image. */
const GEOMETRY_TOOLS: ReadonlySet<string> = new Set([
  'crop',
  'rotate',
  'rotateLeft',
  'rotateRight',
  'flipHorizontal',
  'flipVertical',
  'resize',
]);

const HANDLES: readonly StarImageCropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

type ToolbarId =
  | StarImageTool
  | 'rotateLeft'
  | 'rotateRight'
  | 'flipHorizontal'
  | 'flipVertical'
  | 'undo'
  | 'redo'
  | 'reset'
  | 'zoomFit'
  | 'zoomActual';

interface ToolbarItem {
  readonly id: ToolbarId;
  readonly icon: string;
  readonly label: string;
  /** `aria-pressed` of a toggle; `null` for a plain button. */
  readonly pressed: boolean | null;
  readonly disabled: boolean;
  /** Starts a new group (a separator before it). */
  readonly group?: boolean;
}

interface CropDrag {
  readonly handle: StarImageCropHandle | 'move';
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly rect: StarImageRect;
}

const percent = (value: number, total: number) => (total ? (value / total) * 100 : 0);
const normalizeAngle = (angle: number) => {
  const turned = (((angle + 180) % 360) + 360) % 360;
  return turned - 180;
};

/**
 * Image editor (Syncfusion `ejs-imageeditor`, Kendo UI ImageEditor; DevExtreme and Ignite UI have
 * none): crop with free or fixed ratios, rotate by 90° or by any angle, flip, resize, colour
 * adjustments (brightness, contrast, saturation, grayscale, sepia) and annotations (pen,
 * rectangle, ellipse, arrow, text), with undo and redo.
 *
 * Non-destructive: every edit is an operation in a list (`operations`); the list is replayed on
 * the source image for the view and for the export. Only `data:image/`, `blob:` and same-origin
 * addresses are drawn: any other image would taint the canvas and break the export (a warning in
 * development, an empty editor).
 *
 * Output: `exportImage({ type, quality })` resolves to a `Blob` (`null` on the server or when the
 * browser refuses), `toDataUrl()` gives a data URL, and the `value` model holds a PNG data URL
 * after each edit (`''` without edits), for forms.
 *
 * Accessibility: the tools are a WAI-ARIA toolbar (arrow keys, Home, End). The image is a named
 * `img` with a text description of the edits. The crop box is focusable: arrow keys move it,
 * Shift and arrow keys resize it, and its size is announced. Every slider has a name, and the
 * annotations are a list box (select, Delete). Control+Z and Control+Y undo and redo.
 *
 * ```html
 * <star-image-editor [src]="photoUrl" [(value)]="edited" />
 * ```
 */
@Component({
  selector: 'star-image-editor',
  imports: [NgTemplateOutlet, StarSlider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-image-editor',
    role: 'group',
    '[attr.aria-label]': 'ariaLabel() ?? text.imageEditor',
    '[class.star-image-editor--empty]': '!loaded()',
    '(keydown)': 'onHostKeydown($event)',
  },
  template: `
    <!-- The keys come from the focused tool button (roving tab index). -->
    <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
    <div
      class="star-image-editor__toolbar"
      role="toolbar"
      [attr.aria-label]="text.imageTools"
      [attr.aria-controls]="stageId"
      (keydown)="onToolbarKeydown($event)"
    >
      @for (item of toolbar(); track item.id; let i = $index) {
        @if (item.group) {
          <span class="star-image-editor__separator" role="separator"></span>
        }
        <button
          type="button"
          class="star-btn star-btn--ghost star-btn--sm star-btn--icon star-image-editor__tool"
          [attr.data-tool]="item.id"
          [attr.tabindex]="i === toolbarIndex() ? 0 : -1"
          [attr.aria-label]="item.label"
          [attr.title]="item.label"
          [attr.aria-pressed]="item.pressed"
          [attr.aria-disabled]="item.disabled || null"
          (focus)="toolbarFocus.set(i)"
          (click)="run(item)"
        >
          <i class="ph-bold {{ item.icon }}" aria-hidden="true"></i>
        </button>
      }
    </div>

    @switch (tool()) {
      @case ('crop') {
        <div class="star-image-editor__panel" role="group" [attr.aria-label]="text.imageCrop">
          <div
            class="star-image-editor__choices"
            role="group"
            [attr.aria-label]="text.imageAspectRatio"
          >
            @for (choice of aspectRatios(); track $index) {
              <button
                type="button"
                class="star-btn star-btn--ghost star-btn--sm"
                [attr.aria-pressed]="choice.ratio === cropRatio()"
                (click)="setCropRatio(choice.ratio)"
              >
                {{ choice.label || text.imageAspectFree }}
              </button>
            }
          </div>
          <ng-container *ngTemplateOutlet="actions" />
        </div>
      }
      @case ('rotate') {
        <div class="star-image-editor__panel" role="group" [attr.aria-label]="text.imageRotate">
          <star-slider
            class="star-image-editor__slider"
            [ariaLabel]="text.imageAngle"
            [min]="-180"
            [max]="180"
            [format]="degrees"
            showValue
            [(value)]="angle"
          />
          <ng-container *ngTemplateOutlet="actions" />
        </div>
      }
      @case ('resize') {
        <div class="star-image-editor__panel" role="group" [attr.aria-label]="text.imageResize">
          <label class="star-image-editor__number">
            <span>{{ text.imageWidth }}</span>
            <input
              type="number"
              class="star-input star-input--sm"
              min="1"
              [max]="maxSide"
              [value]="resizeWidth()"
              (input)="setResize('width', $event)"
            />
          </label>
          <label class="star-image-editor__number">
            <span>{{ text.imageHeight }}</span>
            <input
              type="number"
              class="star-input star-input--sm"
              min="1"
              [max]="maxSide"
              [value]="resizeHeight()"
              (input)="setResize('height', $event)"
            />
          </label>
          <button
            type="button"
            class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
            [attr.aria-label]="text.imageKeepRatio"
            [attr.title]="text.imageKeepRatio"
            [attr.aria-pressed]="keepRatio()"
            (click)="keepRatio.set(!keepRatio())"
          >
            <i
              class="ph-bold"
              [class.ph-lock-simple]="keepRatio()"
              [class.ph-lock-simple-open]="!keepRatio()"
              aria-hidden="true"
            ></i>
          </button>
          <ng-container *ngTemplateOutlet="actions" />
        </div>
      }
      @case ('adjust') {
        <div class="star-image-editor__panel" role="group" [attr.aria-label]="text.imageAdjust">
          @for (slider of adjustSliders(); track slider.name) {
            <div class="star-image-editor__adjust">
              <span class="star-image-editor__adjust-label" aria-hidden="true">{{
                slider.label
              }}</span>
              <star-slider
                class="star-image-editor__slider"
                [ariaLabel]="slider.label"
                [min]="0"
                [max]="slider.max"
                [format]="percentText"
                showValue
                [value]="adjustments()[slider.name]"
                (valueChange)="setAdjustment(slider.name, $event)"
              />
            </div>
          }
          <ng-container *ngTemplateOutlet="actions" />
        </div>
      }
      @case ('annotate') {
        <div
          class="star-image-editor__panel star-image-editor__panel--annotate"
          role="group"
          [attr.aria-label]="text.imageAnnotate"
        >
          <div class="star-image-editor__choices" role="group" [attr.aria-label]="text.imageShape">
            @for (entry of kinds; track entry.kind) {
              <button
                type="button"
                class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
                [attr.aria-label]="kindLabel(entry.kind)"
                [attr.title]="kindLabel(entry.kind)"
                [attr.aria-pressed]="kind() === entry.kind"
                (click)="kind.set(entry.kind)"
              >
                <i class="ph-bold {{ entry.icon }}" aria-hidden="true"></i>
              </button>
            }
          </div>
          <div class="star-image-editor__choices" role="group" [attr.aria-label]="text.colorLabel">
            @for (color of colors(); track $index; let i = $index) {
              <button
                type="button"
                class="star-image-editor__swatch"
                [style.background]="color"
                [attr.aria-label]="text.imageColor(i + 1)"
                [attr.title]="text.imageColor(i + 1)"
                [attr.aria-pressed]="colorIndex() === i"
                (click)="colorIndex.set(i)"
              ></button>
            }
          </div>
          <star-slider
            class="star-image-editor__slider"
            [ariaLabel]="text.imageStrokeWidth"
            [min]="1"
            [max]="24"
            showValue
            [(value)]="strokeWidth"
          />
          @if (kind() === 'text') {
            <input
              type="text"
              class="star-input star-input--sm star-image-editor__text"
              [attr.aria-label]="text.imageAnnotationText"
              [attr.placeholder]="text.imageAnnotationText"
              [value]="annotationText()"
              (input)="annotationText.set($any($event.target).value)"
            />
          }
          <button
            type="button"
            class="star-btn star-btn--secondary star-btn--sm star-image-editor__add"
            [disabled]="!canAddAnnotation()"
            (click)="addAnnotation()"
          >
            <i class="ph-bold ph-plus" aria-hidden="true"></i>{{ text.imageAddAnnotation }}
          </button>
          <div class="star-image-editor__annotations">
            <span class="star-image-editor__list-label" [id]="listLabelId">{{
              text.imageAnnotations
            }}</span>
            @if (annotations().length) {
              <div
                class="star-image-editor__list"
                role="listbox"
                tabindex="0"
                [attr.aria-labelledby]="listLabelId"
                [attr.aria-activedescendant]="selectedOptionId()"
                (keydown)="onListKeydown($event)"
              >
                @for (entry of annotations(); track entry.index) {
                  <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
                  <div
                    class="star-image-editor__option"
                    role="option"
                    [id]="listLabelId + '-' + entry.index"
                    [attr.aria-selected]="entry.index === selected()"
                    (click)="selected.set(entry.index)"
                  >
                    <span
                      class="star-image-editor__dot"
                      [style.background]="entry.color"
                      aria-hidden="true"
                    ></span>
                    {{ entry.label }}
                  </div>
                }
              </div>
              <button
                type="button"
                class="star-btn star-btn--ghost star-btn--sm"
                [disabled]="selected() === null"
                (click)="deleteSelected()"
              >
                <i class="ph-bold ph-trash" aria-hidden="true"></i>{{ text.imageDeleteAnnotation }}
              </button>
            } @else {
              <p class="star-image-editor__empty-list">{{ text.imageAnnotationsEmpty }}</p>
            }
          </div>
          <p class="star-image-editor__hint">{{ text.imageAnnotateHint }}</p>
          <button type="button" class="star-btn star-btn--ghost star-btn--sm" (click)="closeTool()">
            {{ text.close }}
          </button>
        </div>
      }
    }

    <ng-template #actions>
      <span class="star-image-editor__actions">
        <button type="button" class="star-btn star-btn--primary star-btn--sm" (click)="applyTool()">
          {{ text.apply }}
        </button>
        <button type="button" class="star-btn star-btn--ghost star-btn--sm" (click)="closeTool()">
          {{ text.cancel }}
        </button>
      </span>
    </ng-template>

    <div
      #stage
      class="star-image-editor__stage"
      [class.star-image-editor__stage--fit]="zoom() === 'fit'"
      [id]="stageId"
      [attr.tabindex]="zoom() === 'actual' ? 0 : null"
    >
      <div
        class="star-image-editor__frame"
        [style.width.px]="view().width"
        [style.height.px]="view().height"
      >
        <canvas
          #canvas
          class="star-image-editor__canvas"
          role="img"
          [class.star-image-editor__canvas--draw]="tool() === 'annotate'"
          [attr.aria-label]="imageAlt() ?? text.imageCanvas"
          [attr.aria-describedby]="descriptionId"
          (pointerdown)="onCanvasDown($event)"
          (pointermove)="onCanvasMove($event)"
          (pointerup)="onCanvasUp($event)"
          (pointercancel)="drawing.set(null)"
        ></canvas>
        @if (tool() === 'crop' && cropRect(); as rect) {
          <div
            class="star-image-editor__crop"
            role="group"
            tabindex="0"
            [attr.aria-label]="cropName()"
            [attr.aria-describedby]="cropHintId"
            [style.left.%]="pct(rect.x, 'width')"
            [style.top.%]="pct(rect.y, 'height')"
            [style.width.%]="pct(rect.width, 'width')"
            [style.height.%]="pct(rect.height, 'height')"
            (keydown)="onCropKeydown($event)"
            (pointerdown)="onCropDown($event, 'move')"
            (pointermove)="onCropMove($event)"
            (pointerup)="cropDrag = null"
            (pointercancel)="cropDrag = null"
          >
            @for (handle of handles; track handle) {
              <span
                class="star-image-editor__handle star-image-editor__handle--{{ handle }}"
                aria-hidden="true"
                (pointerdown)="onCropDown($event, handle)"
              ></span>
            }
          </div>
        }
        @if (tool() === 'annotate' && selectedBox(); as box) {
          <div
            class="star-image-editor__selection"
            aria-hidden="true"
            [style.left.%]="pct(box.x, 'width')"
            [style.top.%]="pct(box.y, 'height')"
            [style.width.%]="pct(box.width, 'width')"
            [style.height.%]="pct(box.height, 'height')"
          ></div>
        }
      </div>
    </div>
    <p class="star-sr-only" [id]="descriptionId">{{ description() }}</p>
    <p class="star-sr-only" [id]="cropHintId">{{ text.imageCropHint }}</p>
  `,
})
export class StarImageEditor {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly announcer = inject(StarAnnouncer);
  private readonly doc = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  /** Canvas work runs in the browser only: the server DOM has no 2D context. */
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * The image to edit: a `data:image/` URL, a `blob:` URL (for example from a file input) or an
   * address of the same origin. Any other address is not drawn (canvas taint rule).
   */
  readonly src = input<string | null>(null);
  /**
   * The edited image as a PNG data URL, `''` while there is no edit. It is encoded
   * asynchronously after each commit (operation, undo, redo, reset), once the edits settle.
   */
  readonly value = model('');
  /** Name of the editor group. Defaults to the `imageEditor` text. */
  readonly ariaLabel = input<string | null>(null);
  /** Name of the image. Defaults to the `imageCanvas` text. */
  readonly imageAlt = input<string | null>(null);
  /** Ratios of the crop panel. A `null` ratio is free; an empty label shows the `imageAspectFree` text. */
  readonly aspectRatios = input<readonly StarImageAspectRatio[]>(STAR_IMAGE_ASPECT_RATIOS);
  /** Annotation colours (CSS colours or `var()` of tokens). Defaults to `--star-chart-1…8`. */
  readonly colors = input<readonly string[]>(STAR_IMAGE_COLORS);
  /** Most undo steps kept. */
  readonly historyLimit = input(100, { transform: numberAttribute });

  protected readonly stageId = inject(_IdGenerator).getId('star-image-editor-stage-');
  protected readonly descriptionId = `${this.stageId}-description`;
  protected readonly cropHintId = `${this.stageId}-crop-hint`;
  protected readonly listLabelId = `${this.stageId}-annotations`;
  protected readonly handles = HANDLES;
  protected readonly kinds = KINDS;
  protected readonly maxSide = 10000;
  protected readonly degrees = (value: number) => `${value}°`;
  protected readonly percentText = (value: number) => `${value}%`;

  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  private image: HTMLImageElement | null = null;
  /** Size of the source image; zero until it is loaded. */
  readonly naturalSize = signal<StarImageSize>({ width: 0, height: 0 });
  /** True once the source image is loaded and drawn. */
  readonly loaded = signal(false);
  private readonly history = signal(starImageHistoryStart());
  /** The operation list of the current state, oldest first. */
  readonly operations = computed(() => this.history().present);
  readonly canUndo = computed(() => this.history().past.length > 0);
  readonly canRedo = computed(() => this.history().future.length > 0);
  /** The open tool panel, or `null`. */
  readonly tool = signal<StarImageTool | null>(null);
  /** `fit`: the whole image in the view (never enlarged); `actual`: 100 %. */
  readonly zoom = signal<'fit' | 'actual'>('fit');

  // Tool state.
  readonly cropRect = signal<StarImageRect | null>(null);
  protected readonly cropRatio = signal<number | null>(null);
  protected cropDrag: CropDrag | null = null;
  protected readonly angle = signal(0);
  protected readonly resizeWidth = signal(0);
  protected readonly resizeHeight = signal(0);
  protected readonly keepRatio = signal(true);
  protected readonly adjustments = signal<StarImageAdjustments>(STAR_IMAGE_NO_ADJUSTMENTS);
  protected readonly kind = signal<StarImageAnnotationKind>('rectangle');
  protected readonly colorIndex = signal(0);
  protected readonly strokeWidth = signal(4);
  protected readonly annotationText = signal('');
  /** The annotation being drawn with a pointer. */
  protected readonly drawing = signal<StarImageAnnotation | null>(null);
  private drawPointer: number | null = null;
  /** Index in `operations` of the chosen annotation. */
  protected readonly selected = signal<number | null>(null);

  private readonly stageSize = signal<StarImageSize | null>(null);
  /** Device pixel ratio of the screen (browser only). */
  private readonly ratio = signal(1);
  /** The pending encoding of `value`. */
  private valueTimer: ReturnType<typeof setTimeout> | null = null;
  /** Counts the scheduled encodings; only the latest one writes `value`. */
  private valueGeneration = 0;
  /** The pending animation frame of the view. */
  private frame: number | null = null;
  /** The adjusted source at view resolution, kept while the scale and the colours stay. */
  private baseCache: { readonly key: string; readonly canvas: HTMLCanvasElement } | null = null;
  protected readonly toolbarFocus = signal(0);

  /** The operation that the open panel shows before it is applied. */
  private readonly pending = computed<StarImageOperation | null>(() => {
    const drawing = this.drawing();
    if (drawing) return { type: 'annotate', annotation: drawing };
    switch (this.tool()) {
      case 'rotate':
        return this.angle() ? { type: 'rotate', angle: this.angle() } : null;
      case 'resize': {
        const size = this.outputSize();
        const width = this.resizeWidth();
        const height = this.resizeHeight();
        return width > 0 && height > 0 && (width !== size.width || height !== size.height)
          ? { type: 'resize', width, height }
          : null;
      }
      case 'adjust': {
        const adjustments = this.adjustments();
        const current = starImageAdjustmentsOf(this.operations());
        return (Object.keys(adjustments) as (keyof StarImageAdjustments)[]).some(
          (name) => adjustments[name] !== current[name],
        )
          ? { type: 'adjust', adjustments }
          : null;
      }
      default:
        return null;
    }
  });
  private readonly previewOps = computed(() => {
    const pending = this.pending();
    return pending ? [...this.operations(), pending] : this.operations();
  });
  /** Size of the edited image (committed operations). */
  readonly outputSize = computed(() => starImageOutputSize(this.naturalSize(), this.operations()));
  private readonly previewSize = computed(() =>
    starImageOutputSize(this.naturalSize(), this.previewOps()),
  );
  /** CSS size of the shown image. */
  protected readonly view = computed<StarImageSize>(() => {
    const size = this.previewSize();
    if (!size.width || !size.height) return { width: 0, height: 0 };
    const stage = this.stageSize() ?? FALLBACK_STAGE;
    const scale = this.zoom() === 'fit' ? starImageFitScale(size, stage) : 1;
    return { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
  });

  /** True while the crop or the resize panel is open: no other geometry edit then. */
  private readonly geometryLocked = computed(() => {
    const tool = this.tool();
    return tool === 'crop' || tool === 'resize';
  });

  protected readonly toolbar = computed<readonly ToolbarItem[]>(() => {
    const t = this.text;
    const none = !this.loaded();
    const tool = this.tool();
    // While the crop or resize panel is open, its values belong to the current geometry: the
    // other geometry tools wait until Apply or Cancel.
    const locked = this.geometryLocked();
    const geometry = (id: ToolbarId) => none || (locked && id !== tool);
    const toggle = (id: StarImageTool, icon: string, label: string, group = false) => ({
      id,
      icon,
      label,
      pressed: tool === id,
      disabled: GEOMETRY_TOOLS.has(id) ? geometry(id) : none,
      group,
    });
    const action = (
      id: ToolbarId,
      icon: string,
      label: string,
      disabled: boolean,
      group = false,
    ) => ({
      id,
      icon,
      label,
      pressed: null,
      disabled,
      group,
    });
    return [
      toggle('crop', 'ph-crop', t.imageCrop),
      toggle('rotate', 'ph-angle', t.imageRotate),
      action('rotateLeft', 'ph-arrow-counter-clockwise', t.imageRotateLeft, geometry('rotateLeft')),
      action('rotateRight', 'ph-arrow-clockwise', t.imageRotateRight, geometry('rotateRight')),
      action(
        'flipHorizontal',
        'ph-flip-horizontal',
        t.imageFlipHorizontal,
        geometry('flipHorizontal'),
      ),
      action('flipVertical', 'ph-flip-vertical', t.imageFlipVertical, geometry('flipVertical')),
      toggle('resize', 'ph-arrows-out', t.imageResize, true),
      toggle('adjust', 'ph-sliders-horizontal', t.imageAdjust),
      toggle('annotate', 'ph-pencil-simple', t.imageAnnotate),
      action('undo', 'ph-arrow-u-up-left', t.undo, !this.canUndo(), true),
      action('redo', 'ph-arrow-u-up-right', t.editorRedo, !this.canRedo()),
      action('reset', 'ph-clock-counter-clockwise', t.imageReset, !this.operations().length),
      {
        ...action('zoomFit', 'ph-corners-in', t.imageZoomFit, none, true),
        pressed: this.zoom() === 'fit',
      },
      {
        ...action('zoomActual', 'ph-frame-corners', t.imageZoomActual, none),
        pressed: this.zoom() === 'actual',
      },
    ];
  });
  /** The one toolbar button in the tab order. */
  protected readonly toolbarIndex = computed(() =>
    Math.min(this.toolbarFocus(), this.toolbar().length - 1),
  );

  protected readonly adjustSliders = computed(() => {
    const t = this.text;
    return [
      { name: 'brightness' as const, label: t.imageBrightness, max: 200 },
      { name: 'contrast' as const, label: t.imageContrast, max: 200 },
      { name: 'saturation' as const, label: t.imageSaturation, max: 200 },
      { name: 'grayscale' as const, label: t.imageGrayscale, max: 100 },
      { name: 'sepia' as const, label: t.imageSepia, max: 100 },
    ];
  });

  /** The annotations of the list, with their index in `operations`. */
  protected readonly annotations = computed(() => {
    const counts = new Map<StarImageAnnotationKind, number>();
    const list: { index: number; label: string; color: string }[] = [];
    this.operations().forEach((op, index) => {
      if (op.type !== 'annotate') return;
      const kind = op.annotation.kind;
      const count = (counts.get(kind) ?? 0) + 1;
      counts.set(kind, count);
      list.push({
        index,
        label: this.text.imageAnnotationItem(this.kindLabel(kind), count),
        color: op.annotation.color,
      });
    });
    return list;
  });
  protected readonly selectedOptionId = computed(() => {
    const index = this.selected();
    return index === null ? null : `${this.listLabelId}-${index}`;
  });
  protected readonly selectedBox = computed(() => {
    const index = this.selected();
    return index === null
      ? null
      : starImageAnnotationBox(this.naturalSize(), this.operations(), index);
  });
  protected readonly canAddAnnotation = computed(() => {
    if (!this.loaded()) return false;
    if (this.kind() === 'pen') return false;
    return this.kind() !== 'text' || !!this.annotationText().trim();
  });

  protected readonly cropName = computed(() => {
    const rect = this.cropRect();
    return rect ? this.text.imageCropArea(rect.width, rect.height, rect.x, rect.y) : '';
  });

  /** Text description of the image and its edits (the description of the canvas). */
  readonly description = computed(() => {
    const t = this.text;
    if (!this.loaded()) return t.imageEmpty;
    const parts: string[] = [];
    let annotations = 0;
    for (const op of this.operations()) {
      switch (op.type) {
        case 'crop':
          parts.push(t.imageEditCrop(op.rect.width, op.rect.height));
          break;
        case 'rotate':
          parts.push(t.imageEditRotate(Math.round(normalizeAngle(op.angle))));
          break;
        case 'flip':
          parts.push(
            op.axis === 'horizontal' ? t.imageEditFlipHorizontal : t.imageEditFlipVertical,
          );
          break;
        case 'resize':
          parts.push(t.imageEditResize(op.width, op.height));
          break;
        case 'annotate':
          annotations++;
          break;
      }
    }
    if (!starImageIsNeutral(starImageAdjustmentsOf(this.operations())))
      parts.push(t.imageEditAdjust);
    if (annotations) parts.push(t.imageEditAnnotations(annotations));
    const size = this.outputSize();
    return t.imageDescription(
      size.width,
      size.height,
      parts.length ? t.imageEditList(parts.join(', ')) : t.imageNoEdits,
    );
  });

  constructor() {
    effect(() => {
      const src = this.src();
      untracked(() => this.load(src));
    });
    afterNextRender(() => this.watchStage());
    // Browser only: afterRenderEffect does not run on the server.
    afterRenderEffect({
      write: () => {
        // Track what the picture depends on; the drawing itself waits for the next frame.
        this.previewOps();
        this.view();
        this.loaded();
        this.ratio();
        this.scheduleDraw();
      },
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.frame !== null) this.doc.defaultView?.cancelAnimationFrame?.(this.frame);
      if (this.valueTimer !== null) clearTimeout(this.valueTimer);
      this.valueGeneration++;
    });
  }

  // ---------- Public API ----------

  /** Undoes the last edit. Announces it. */
  undo(): void {
    if (!this.canUndo()) return;
    this.leavePanelForHistory();
    this.history.update(starImageHistoryUndo);
    this.afterChange(this.text.editUndone);
  }

  /** Redoes the last undone edit. Announces it. */
  redo(): void {
    if (!this.canRedo()) return;
    this.leavePanelForHistory();
    this.history.update(starImageHistoryRedo);
    this.afterChange(this.text.editRedone);
  }

  /**
   * Before undo or redo: a panel with a pending change (crop, rotate, resize, adjust) closes,
   * because its values belong to the old image. The annotation panel stays open; its choice is
   * cleared, because the indexes change.
   */
  private leavePanelForHistory(): void {
    if (this.tool() === 'annotate') {
      this.selected.set(null);
      this.drawing.set(null);
    } else {
      this.closeTool(false);
    }
  }

  /** Removes every edit (an undoable step). */
  reset(): void {
    if (!this.operations().length) return;
    this.closeTool(false);
    this.commit([], this.text.imageResetDone);
  }

  /** Rotates by `angle` degrees, clockwise (for example 90 or -90). Ignored while the crop or resize panel is open. */
  rotate(angle: number): void {
    if (this.loaded() && !this.geometryLocked() && angle % 360)
      this.push({ type: 'rotate', angle });
  }

  /** Mirrors the image. Ignored while the crop or resize panel is open. */
  flip(axis: 'horizontal' | 'vertical'): void {
    if (this.loaded() && !this.geometryLocked()) this.push({ type: 'flip', axis });
  }

  /** Adds any operation (for example a crop from code). */
  apply(op: StarImageOperation): void {
    if (this.loaded()) this.push(op);
  }

  /** Shows the whole image in the view. */
  zoomToFit(): void {
    this.zoom.set('fit');
  }

  /** Shows the image at 100 %. The stage scrolls. */
  zoomToActual(): void {
    this.zoom.set('actual');
  }

  /** Opens a tool panel with the values of the current image. */
  openTool(tool: StarImageTool): void {
    if (!this.loaded()) return;
    this.drawing.set(null);
    const size = this.outputSize();
    switch (tool) {
      case 'crop':
        this.cropRect.set(starImageAspectCrop(size, this.cropRatio()));
        break;
      case 'rotate':
        this.angle.set(0);
        break;
      case 'resize':
        this.resizeWidth.set(size.width);
        this.resizeHeight.set(size.height);
        break;
      case 'adjust':
        this.adjustments.set(starImageAdjustmentsOf(this.operations()));
        break;
      case 'annotate':
        this.selected.set(null);
        break;
    }
    this.tool.set(tool);
  }

  /** Applies the open panel (crop, rotation, size or adjustments) and closes it. */
  applyTool(): void {
    const tool = this.tool();
    if (!tool) return;
    let op: StarImageOperation | null = null;
    if (tool === 'crop') {
      const rect = this.cropRect();
      const size = this.outputSize();
      if (rect && (rect.width !== size.width || rect.height !== size.height)) {
        op = { type: 'crop', rect };
      }
    } else if (tool !== 'annotate') {
      op = this.pending();
    }
    const name = this.toolLabel(tool);
    this.closeTool();
    if (op) this.push(op, this.text.imageApplied(name));
  }

  /** Closes the open panel without a change. */
  closeTool(restoreFocus = true): void {
    const tool = this.tool();
    if (!tool) return;
    this.tool.set(null);
    this.cropRect.set(null);
    this.drawing.set(null);
    this.selected.set(null);
    this.cropDrag = null;
    if (restoreFocus) this.focusTool(tool);
  }

  /**
   * The edited image as a `Blob`. `null` on the server, without an image, or when the browser
   * refuses to read the canvas.
   */
  exportImage(options: StarImageExportOptions = {}): Promise<Blob | null> {
    const type = options.type ?? 'image/png';
    const canvas = this.renderOutput(type === 'image/jpeg');
    if (!canvas || typeof canvas.toBlob !== 'function') return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        canvas.toBlob((blob) => resolve(blob), type, options.quality);
      } catch {
        // A tainted canvas throws a SecurityError.
        resolve(null);
      }
    });
  }

  /** The edited image as a data URL; `''` on the server, without an image, or when refused. */
  toDataUrl(type: 'image/png' | 'image/jpeg' = 'image/png', quality?: number): string {
    const canvas = this.renderOutput(type === 'image/jpeg');
    if (!canvas) return '';
    try {
      return canvas.toDataURL(type, quality);
    } catch {
      return '';
    }
  }

  // ---------- Toolbar ----------

  protected run(item: ToolbarItem): void {
    if (item.disabled) return;
    switch (item.id) {
      case 'crop':
      case 'rotate':
      case 'resize':
      case 'adjust':
      case 'annotate':
        if (this.tool() === item.id) this.closeTool(false);
        else this.openTool(item.id);
        break;
      case 'rotateLeft':
        this.rotate(-90);
        break;
      case 'rotateRight':
        this.rotate(90);
        break;
      case 'flipHorizontal':
        this.flip('horizontal');
        break;
      case 'flipVertical':
        this.flip('vertical');
        break;
      case 'undo':
        this.undo();
        break;
      case 'redo':
        this.redo();
        break;
      case 'reset':
        this.reset();
        break;
      case 'zoomFit':
        this.zoomToFit();
        break;
      case 'zoomActual':
        this.zoomToActual();
        break;
    }
  }

  protected onToolbarKeydown(event: KeyboardEvent): void {
    const count = this.toolbar().length;
    const index = this.toolbarIndex();
    let next: number | null = null;
    switch (starInlineKey(event, this.host)) {
      case 'ArrowRight':
        next = (index + 1) % count;
        break;
      case 'ArrowLeft':
        next = (index - 1 + count) % count;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
    }
    if (next === null) return;
    event.preventDefault();
    this.toolbarFocus.set(next);
    this.toolButtons()[next]?.focus();
  }

  private toolButtons(): HTMLButtonElement[] {
    return [...this.host.querySelectorAll<HTMLButtonElement>('.star-image-editor__tool')];
  }

  private focusTool(id: ToolbarId): void {
    const index = this.toolbar().findIndex((item) => item.id === id);
    if (index < 0) return;
    this.toolbarFocus.set(index);
    afterNextRender(() => this.toolButtons()[index]?.focus(), { injector: this.injector });
  }

  protected onHostKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing =
      target?.tagName === 'INPUT' &&
      !['range', 'button'].includes((target as HTMLInputElement).type);
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && !typing && key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.undo();
    } else if (mod && !typing && (key === 'y' || (key === 'z' && event.shiftKey))) {
      event.preventDefault();
      this.redo();
    } else if (event.key === 'Escape' && this.tool() && !event.defaultPrevented) {
      event.preventDefault();
      this.closeTool();
    }
  }

  // ---------- Panels ----------

  protected toolLabel(tool: StarImageTool): string {
    const t = this.text;
    return {
      crop: t.imageCrop,
      rotate: t.imageRotate,
      resize: t.imageResize,
      adjust: t.imageAdjust,
      annotate: t.imageAnnotate,
    }[tool];
  }

  protected kindLabel(kind: StarImageAnnotationKind): string {
    const t = this.text;
    return {
      pen: t.imagePen,
      rectangle: t.imageRectangle,
      ellipse: t.imageEllipse,
      arrow: t.imageArrow,
      text: t.imageText,
    }[kind];
  }

  protected setCropRatio(ratio: number | null): void {
    this.cropRatio.set(ratio);
    this.cropRect.set(starImageAspectCrop(this.outputSize(), ratio));
    this.announceCrop();
  }

  protected setResize(side: 'width' | 'height', event: Event): void {
    const value = Math.max(
      0,
      Math.min(this.maxSide, Math.round(+(event.target as HTMLInputElement).value || 0)),
    );
    const size = this.outputSize();
    if (side === 'width') {
      this.resizeWidth.set(value);
      if (this.keepRatio() && size.width) {
        this.resizeHeight.set(Math.max(1, Math.round((value * size.height) / size.width)));
      }
    } else {
      this.resizeHeight.set(value);
      if (this.keepRatio() && size.height) {
        this.resizeWidth.set(Math.max(1, Math.round((value * size.width) / size.height)));
      }
    }
  }

  protected setAdjustment(name: keyof StarImageAdjustments, value: number): void {
    this.adjustments.update((current) => ({ ...current, [name]: value }));
  }

  // ---------- Crop box ----------

  protected pct(value: number, side: 'width' | 'height'): number {
    return percent(value, this.previewSize()[side]);
  }

  protected onCropKeydown(event: KeyboardEvent): void {
    const rect = this.cropRect();
    if (!rect) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.applyTool();
      return;
    }
    const size = this.outputSize();
    const step = Math.max(1, Math.round(Math.max(size.width, size.height) / 100));
    const next = starImageNudgeCrop(rect, event.key, event.shiftKey, step, this.cropRatio(), size);
    if (next === rect) return;
    event.preventDefault();
    this.cropRect.set(next);
    this.announceCrop();
  }

  private announceCrop(): void {
    const name = this.cropName();
    if (name) void this.announcer.announce(name);
  }

  protected onCropDown(event: PointerEvent, handle: StarImageCropHandle | 'move'): void {
    const rect = this.cropRect();
    if (!rect || event.button > 0 || (this.cropDrag && handle === 'move')) return;
    event.preventDefault();
    event.stopPropagation();
    const box = (event.currentTarget as HTMLElement).closest<HTMLElement>(
      '.star-image-editor__crop',
    );
    try {
      box?.setPointerCapture?.(event.pointerId);
    } catch {
      // A synthetic pointer cannot be captured.
    }
    box?.focus();
    this.cropDrag = {
      handle,
      pointerId: event.pointerId ?? 0,
      x: event.clientX,
      y: event.clientY,
      rect,
    };
  }

  protected onCropMove(event: PointerEvent): void {
    const drag = this.cropDrag;
    if (!drag || (event.pointerId ?? 0) !== drag.pointerId) return;
    const scale = this.imageScale();
    const dx = (event.clientX - drag.x) / scale.x;
    const dy = (event.clientY - drag.y) / scale.y;
    const size = this.outputSize();
    this.cropRect.set(
      drag.handle === 'move'
        ? starImageClampCrop({ ...drag.rect, x: drag.rect.x + dx, y: drag.rect.y + dy }, size)
        : starImageResizeCrop(drag.rect, drag.handle, dx, dy, this.cropRatio(), size),
    );
  }

  /** CSS pixels per image pixel of the shown image. */
  private imageScale(): { x: number; y: number } {
    const rect = this.canvas()?.nativeElement.getBoundingClientRect();
    const size = this.previewSize();
    return {
      x: rect?.width && size.width ? rect.width / size.width : 1,
      y: rect?.height && size.height ? rect.height / size.height : 1,
    };
  }

  // ---------- Annotations ----------

  private pointOf(event: PointerEvent): StarImagePoint {
    const rect = this.canvas()?.nativeElement.getBoundingClientRect();
    const scale = this.imageScale();
    const round = (value: number) => Math.round(value * 10) / 10;
    return {
      x: round((event.clientX - (rect?.left ?? 0)) / scale.x),
      y: round((event.clientY - (rect?.top ?? 0)) / scale.y),
    };
  }

  /** The colour of a swatch as a concrete colour: a `var()` token is read from the host. */
  private resolvedColor(): string {
    const index = this.colorIndex();
    const color = this.colors()[index] ?? FALLBACK_COLORS[0];
    const token = /^var\(\s*(--[\w-]+)\s*\)$/.exec(color)?.[1];
    if (!token) return color;
    const value = this.doc.defaultView
      ?.getComputedStyle?.(this.host)
      .getPropertyValue(token)
      .trim();
    return value || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  }

  private newAnnotation(points: StarImagePoint[]): StarImageAnnotation {
    const kind = this.kind();
    const strokeWidth = this.strokeWidth();
    return {
      kind,
      points,
      color: this.resolvedColor(),
      strokeWidth,
      ...(kind === 'text'
        ? { text: this.annotationText().trim(), fontSize: Math.max(12, strokeWidth * 6) }
        : {}),
    };
  }

  protected onCanvasDown(event: PointerEvent): void {
    if (this.tool() !== 'annotate' || event.button > 0) return;
    event.preventDefault();
    const point = this.pointOf(event);
    if (this.kind() === 'text') {
      if (this.annotationText().trim()) this.addAnnotationOp(this.newAnnotation([point]));
      return;
    }
    this.drawPointer = event.pointerId ?? 0;
    try {
      this.canvas()?.nativeElement.setPointerCapture?.(event.pointerId);
    } catch {
      // A synthetic pointer cannot be captured.
    }
    this.drawing.set(this.newAnnotation(this.kind() === 'pen' ? [point] : [point, point]));
  }

  protected onCanvasMove(event: PointerEvent): void {
    const drawing = this.drawing();
    if (!drawing || (event.pointerId ?? 0) !== this.drawPointer) return;
    const point = this.pointOf(event);
    this.drawing.set({
      ...drawing,
      points: drawing.kind === 'pen' ? [...drawing.points, point] : [drawing.points[0], point],
    });
  }

  protected onCanvasUp(event: PointerEvent): void {
    const drawing = this.drawing();
    if (!drawing || (event.pointerId ?? 0) !== this.drawPointer) return;
    this.onCanvasMove(event);
    const done = this.drawing() ?? drawing;
    this.drawing.set(null);
    this.drawPointer = null;
    const [start, end] = done.points;
    const tiny = done.kind !== 'pen' && Math.hypot(end.x - start.x, end.y - start.y) < 2;
    if (!tiny) this.addAnnotationOp(done);
  }

  /** Adds the chosen shape in the middle of the image (keyboard access to annotations). */
  protected addAnnotation(): void {
    if (!this.canAddAnnotation()) return;
    const { width, height } = this.outputSize();
    const points =
      this.kind() === 'text'
        ? [{ x: Math.round(width * 0.1), y: Math.round(height * 0.1) }]
        : [
            { x: Math.round(width * 0.35), y: Math.round(height * 0.35) },
            { x: Math.round(width * 0.65), y: Math.round(height * 0.65) },
          ];
    this.addAnnotationOp(this.newAnnotation(points));
  }

  private addAnnotationOp(annotation: StarImageAnnotation): void {
    this.push({ type: 'annotate', annotation });
    this.selected.set(this.operations().length - 1);
  }

  protected onListKeydown(event: KeyboardEvent): void {
    const list = this.annotations();
    if (!list.length) return;
    const at = list.findIndex((entry) => entry.index === this.selected());
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowDown':
        next = at < 0 ? 0 : Math.min(list.length - 1, at + 1);
        break;
      case 'ArrowUp':
        next = at < 0 ? 0 : Math.max(0, at - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = list.length - 1;
        break;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        this.deleteSelected();
        return;
    }
    if (next === null) return;
    event.preventDefault();
    this.selected.set(list[next].index);
  }

  /** Deletes the chosen annotation (an undoable step). */
  protected deleteSelected(): void {
    const index = this.selected();
    const entry = this.annotations().find((item) => item.index === index);
    if (index === null || !entry) return;
    const ops = this.operations().filter((_, i) => i !== index);
    this.commit(ops, this.text.imageAnnotationDeleted(entry.label));
    const rest = this.annotations();
    const nextEntry = rest.find((item) => item.index >= index) ?? rest.at(-1);
    this.selected.set(nextEntry?.index ?? null);
    if (!nextEntry) {
      // The list is gone: the focus goes to the Add button, so the keys stay in the editor.
      afterNextRender(
        () => {
          const add = this.host.querySelector<HTMLElement>(
            '.star-image-editor__add:not([disabled])',
          );
          if (add) add.focus();
          else this.focusTool('annotate');
        },
        { injector: this.injector },
      );
    }
  }

  // ---------- Model ----------

  private push(op: StarImageOperation, message?: string): void {
    this.commit([...this.operations(), op], message);
  }

  private commit(ops: readonly StarImageOperation[], message?: string): void {
    this.history.update((state) => starImageHistoryPush(state, ops, this.historyLimit()));
    this.afterChange(message);
  }

  private afterChange(message?: string): void {
    if (message) void this.announcer.announce(message);
    this.scheduleValue();
  }

  /**
   * Encodes `value` after the edits settle: only at commit points (an operation added, undo,
   * redo, reset), coalesced over `STAR_IMAGE_VALUE_DELAY` milliseconds, asynchronously
   * (`toBlob`), latest wins. A drag or a slider tick never encodes.
   */
  private scheduleValue(): void {
    if (!this.browser || !this.loaded()) return;
    if (this.valueTimer !== null) clearTimeout(this.valueTimer);
    const generation = ++this.valueGeneration;
    this.valueTimer = setTimeout(() => {
      this.valueTimer = null;
      void this.encodeValue(generation);
    }, STAR_IMAGE_VALUE_DELAY);
  }

  private async encodeValue(generation: number): Promise<void> {
    let value = '';
    if (this.operations().length) {
      const blob = await this.exportImage();
      value = blob ? await starBlobToDataUrl(blob) : '';
    }
    if (generation === this.valueGeneration) this.value.set(value);
  }

  private load(src: string | null): void {
    this.image = null;
    this.loaded.set(false);
    this.naturalSize.set({ width: 0, height: 0 });
    this.history.set(starImageHistoryStart());
    this.closeTool(false);
    // Nothing is loaded or drawn on the server (no canvas, and often no base address to check).
    if (!src || !this.browser) return;
    if (!starImageIsSafeSource(src, this.doc.baseURI || this.doc.location?.href || '')) {
      if (isDevMode()) {
        // Only the scheme: the address itself may hold private data.
        const scheme = /^([a-z][a-z\d+.-]*):/i.exec(src.trim())?.[1]?.toLowerCase();
        console.warn(
          `star-image-editor: only data:image/, blob: and same-origin images can be edited; a ${scheme ? `${scheme}: address` : 'value'} of another origin is not drawn (canvas taint rule).`,
        );
      }
      return;
    }
    const view = this.doc.defaultView;
    if (!view || typeof view.Image !== 'function') return;
    const image = new view.Image();
    image.onload = () => {
      if (this.src() !== src) return;
      this.image = image;
      this.baseCache = null;
      this.naturalSize.set({ width: image.naturalWidth, height: image.naturalHeight });
      this.loaded.set(true);
    };
    image.src = src;
  }

  private watchStage(): void {
    const stage = this.stage()?.nativeElement;
    const view = this.doc.defaultView;
    if (view) this.ratio.set(view.devicePixelRatio || 1);
    if (!stage || !view || typeof view.ResizeObserver !== 'function') return;
    // The content box (without the padding), so a fitted image never makes the stage scroll.
    const observer = new view.ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box?.width && box.height) {
        this.stageSize.set({ width: Math.floor(box.width), height: Math.floor(box.height) });
      }
    });
    observer.observe(stage);
    this.injector.get(DestroyRef).onDestroy(() => observer.disconnect());
  }

  private renderOutput(jpeg: boolean): HTMLCanvasElement | null {
    if (!this.browser || !this.image || !this.loaded()) return null;
    return starImageRender(this.doc, this.image, this.naturalSize(), this.operations(), {
      background: jpeg ? '#ffffff' : null,
    });
  }

  /** Draws the preview on the view canvas, scaled by the device pixel ratio. Browser only. */
  /** Draws on the next animation frame; several changes in one frame draw once. */
  private scheduleDraw(): void {
    const view = this.doc.defaultView;
    if (typeof view?.requestAnimationFrame !== 'function') {
      this.draw();
      return;
    }
    if (this.frame !== null) return;
    this.frame = view.requestAnimationFrame(() => {
      this.frame = null;
      this.draw();
    });
  }

  /**
   * Draws the preview on the view canvas at the resolution of the screen (CSS size times the
   * device pixel ratio). The adjusted source is cached at that scale; a drag or a slider only
   * replays the geometry on top. The export renders at the natural size instead.
   */
  private draw(): void {
    const ops = this.previewOps();
    const view = this.view();
    const size = this.previewSize();
    const canvas = this.canvas()?.nativeElement;
    if (!canvas || !this.image || !this.loaded() || !view.width || !size.width) return;
    const ratio = this.ratio();
    canvas.width = Math.max(1, Math.round(view.width * ratio));
    canvas.height = Math.max(1, Math.round(view.height * ratio));
    const context = canvas.getContext('2d');
    if (!context) return;
    const scale = Math.min(1, canvas.width / size.width);
    const key = `${scale}|${starImageFilter(starImageAdjustmentsOf(ops))}`;
    if (this.baseCache?.key !== key) {
      const base = starImageRenderBase(this.doc, this.image, this.naturalSize(), ops, { scale });
      this.baseCache = base ? { key, canvas: base } : null;
    }
    const result = this.baseCache
      ? starImageReplay(this.doc, this.baseCache.canvas, ops, { scale })
      : null;
    if (!result) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.drawImage(result, 0, 0, canvas.width, canvas.height);
  }
}
