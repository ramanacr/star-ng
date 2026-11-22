import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import {
  starBreakpointValue,
  starIsRtl,
  StarStyled,
  starViewportWidth,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { StarDialogBase } from './dialog-base';
import {
  arrowDelta,
  clampToViewport,
  STAR_DIALOG_KEY_STEP,
  StarDialogDimensions,
  StarDialogFrame,
  StarDialogPoint,
  trackPointer,
} from './dialog-drag';
import { resizeFrame } from './dialog-resize';

/**
 * Place of a dialog in the window. `start` and `end` follow the writing direction: `end` is the
 * right edge in left-to-right and the left edge in right-to-left.
 */
export type StarDialogPosition =
  | 'center'
  | 'top'
  | 'bottom'
  | 'start'
  | 'end'
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end';

/**
 * Dialog (PrimeNG `p-dialog`) built on the native `<dialog>` element: top-layer rendering,
 * focus trap, focus restore and Escape handling come from the browser. Entry / exit animate
 * with `@starting-style`; page scroll locks with `:has(dialog[open])` (`blockScroll`).
 *
 * ```html
 * <star-dialog [(visible)]="editOpen" header="Edit order" size="lg">
 *   ...body...
 *   <div starDialogFooter>
 *     <star-button variant="ghost" (pressed)="editOpen.set(false)">Cancel</star-button>
 *     <star-button (pressed)="save()">Save</star-button>
 *   </div>
 * </star-dialog>
 * ```
 * Put `autofocus` (native elements) or `data-autofocus` (components) on the element that
 * should receive focus first.
 *
 * The exit motion must run on the dialog element itself (or its `::backdrop`): an animation
 * on a child of the dialog does not hold the close.
 */
@Component({
  selector: 'star-dialog',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Backdrop click only; keyboard users close with Escape (native cancel event). -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
    <dialog
      data-star-part="frame"
      #dialog
      class="star-dialog"
      [class]="'star-dialog--' + size() + ' star-dialog--at-' + position()"
      [class.star-dialog--modal]="modal()"
      [class.star-dialog--block-scroll]="scrollBlocked()"
      [attr.tabindex]="focusOnShow() ? null : -1"
      [class.star-dialog--placed]="free() && placed() !== null"
      [class.star-dialog--resized]="free() && sized() !== null"
      [class.star-dialog--maximized]="maximized()"
      [class.star-dialog--headless]="headless()"
      [style.width]="cssWidth()"
      [style.height.px]="free() ? sized()?.height : null"
      [style.left.px]="free() ? placed()?.x : null"
      [style.top.px]="free() ? placed()?.y : null"
      [attr.aria-labelledby]="labelledBy()"
      [attr.aria-label]="label()"
      [attr.role]="role()"
      (cancel)="onCancel($event)"
      (close)="onNativeClose()"
      (click)="onDialogClick($event)"
    >
      <div data-star-part="surface" class="star-dialog__surface">
        @if (titleShown()) {
          <!-- Pointer drag on the whole header; the keyboard moves the dialog from the move button. -->
          <header
            data-star-part="header"
            class="star-dialog__header"
            [class.star-dialog__header--draggable]="canDrag()"
            (pointerdown)="onDragStart($event)"
          >
            <div data-star-part="headingPanel" class="star-dialog__heading">
              @if (header()) {
                <h2 data-star-part="titleText" class="star-dialog__title" [id]="headerId">
                  {{ header() }}
                </h2>
              }
              <ng-content select="[starDialogHeader]" />
            </div>
            <div data-star-part="controlsPanel" class="star-dialog__controls">
              @if (canDrag()) {
                <button
                  data-star-part="moveButton"
                  type="button"
                  class="star-btn star-btn--ghost star-btn--icon star-dialog__move"
                  [attr.aria-label]="text.moveDialog"
                  aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight"
                  (keydown)="onDragKey($event)"
                >
                  <i
                    data-star-part="moveIcon"
                    class="ph-bold ph-arrows-out-cardinal"
                    aria-hidden="true"
                  ></i>
                </button>
              }
              @if (maximizable()) {
                <button
                  data-star-part="maximizeButton"
                  type="button"
                  class="star-btn star-btn--ghost star-btn--icon star-dialog__maximize"
                  [attr.aria-label]="maximized() ? text.restore : text.maximize"
                  (click)="toggleMaximize()"
                >
                  <i
                    data-star-part="maximizeIcon"
                    [class]="maximized() ? 'ph-bold ph-corners-in' : 'ph-bold ph-corners-out'"
                    aria-hidden="true"
                  ></i>
                </button>
              }
              @if (closable()) {
                <button
                  data-star-part="closeButton"
                  type="button"
                  class="star-btn star-btn--ghost star-btn--icon star-dialog__close"
                  [attr.aria-label]="text.close"
                  (click)="close()"
                >
                  <i data-star-part="closeIcon" class="ph-bold ph-x" aria-hidden="true"></i>
                </button>
              }
            </div>
          </header>
        }
        <div data-star-part="body" class="star-dialog__body"><ng-content /></div>
        <ng-content select="[starDialogFooter]" />
      </div>
      @if (resizable() && free()) {
        <button
          data-star-part="resizeButton"
          type="button"
          class="star-dialog__resize"
          [attr.aria-label]="text.resizeDialog"
          aria-keyshortcuts="Shift+ArrowUp Shift+ArrowDown Shift+ArrowLeft Shift+ArrowRight"
          (pointerdown)="onResizeStart($event)"
          (keydown)="onResizeKey($event)"
        ></button>
      }
    </dialog>
  `,
})
export class StarDialog extends StarDialogBase {
  private readonly document = inject(DOCUMENT);

  /**
   * Place in the window (PrimeNG `position`): `center` (default), an edge or a corner, 1rem from
   * the window edge. Logical: `start` and `end` change sides in right-to-left.
   */
  readonly position = input<StarDialogPosition>('center');
  /**
   * Widths per window size (PrimeNG `breakpoints`): `{ '<max-width>': '<width>' }`, for example
   * `{ '960px': '75vw', '640px': '100vw' }`. The smallest matching max-width wins over `width`
   * and `size`.
   */
  readonly breakpoints = input<Readonly<Record<string, string>> | null>(null);
  /**
   * The header drags the dialog with the pointer (PrimeNG `draggable`). The move button in the
   * header moves it with Alt + the arrow keys, 10 pixels per press.
   */
  readonly draggable = input(false, { transform: booleanAttribute });
  /** Dragging and resizing keep the dialog inside the window (PrimeNG `keepInViewport`). */
  readonly keepInViewport = input(true, { transform: booleanAttribute });
  /** Keeps the dragged position and the resized size when the dialog opens again. */
  readonly rememberPosition = input(false, { transform: booleanAttribute });

  /**
   * A handle in the bottom end corner resizes the dialog with the pointer, or with Shift + the
   * arrow keys, 10 pixels per press (PrimeNG `resizable`). The smallest size is 240 x 160 pixels.
   */
  readonly resizable = input(false, { transform: booleanAttribute });

  /**
   * A header button fills the window with the dialog and restores it (PrimeNG `maximizable`).
   * Escape still closes a maximized dialog when `closeOnEscape` is on.
   */
  readonly maximizable = input(false, { transform: booleanAttribute });
  /** The dialog fills the window. Two-way bindable. */
  readonly maximized = model(false);

  /**
   * Renders only your content in the dialog box: no header, no title and no close button
   * (PrimeNG `headless` template). Your content must name the dialog (`ariaLabel`, or
   * `ariaLabelledby` with the id of your heading) and give a way to close it; Escape still closes
   * it when `closeOnEscape` is on.
   */
  readonly headless = input(false, { transform: booleanAttribute });

  /** Position of the top left corner after a drag, in pixels from the window (PrimeNG `onDragEnd`). */
  readonly dragEnd = output<StarDialogPoint>();
  /** Size of the dialog after a resize, in pixels (PrimeNG `onResizeEnd`). */
  readonly resizeEnd = output<StarDialogDimensions>();
  /** The maximize button filled the window (PrimeNG `onMaximize`). */
  readonly maximize = output<void>();
  /** The restore button gave the dialog its normal size again (PrimeNG `onMaximize` with false). */
  readonly restore = output<void>();

  /** Position set by a drag or a resize; `null` keeps the CSS position. */
  protected readonly placed = signal<StarDialogPoint | null>(null);
  /** Size set by a resize; `null` keeps the CSS size. */
  protected readonly sized = signal<StarDialogDimensions | null>(null);

  private readonly viewportWidth = starViewportWidth(() => this.breakpoints() !== null);
  /** Not maximized: the drag and resize geometry applies. */
  protected readonly free = computed(() => !this.maximized());
  protected readonly canDrag = computed(() => this.draggable() && this.free());
  protected readonly cssWidth = computed(() => {
    if (!this.free()) return null;
    const sized = this.sized();
    if (sized) return `${sized.width}px`;
    return starBreakpointValue(this.breakpoints(), this.viewportWidth()) ?? this.width();
  });

  constructor() {
    super();
    // A destroy in the middle of a drag must not leave window listeners behind.
    inject(DestroyRef).onDestroy(() => this.stopTracking());
  }

  /** Fills the window with the dialog, or restores its normal size. */
  toggleMaximize(): void {
    const next = !this.maximized();
    this.maximized.set(next);
    if (next) this.maximize.emit();
    else this.restore.emit();
  }

  protected onDragStart(event: PointerEvent): void {
    if (!this.canDrag() || event.button !== 0) return;
    const target = event.target as Element;
    // Buttons and fields in the header keep their own pointer behaviour; the move button drags.
    if (target.closest('button:not(.star-dialog__move), a, input, select, textarea')) return;
    event.preventDefault();
    const start = this.frame();
    this.track(
      event,
      (dx, dy) => this.moveTo(start, start.left + dx, start.top + dy),
      () => this.emitDragEnd(),
    );
  }

  protected onDragKey(event: KeyboardEvent): void {
    if (!this.canDrag() || !event.altKey) return;
    const step = arrowDelta(event.key);
    if (!step) return;
    event.preventDefault();
    const start = this.frame();
    this.moveTo(
      start,
      start.left + step.x * STAR_DIALOG_KEY_STEP,
      start.top + step.y * STAR_DIALOG_KEY_STEP,
    );
    this.emitDragEnd();
  }

  protected onResizeStart(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    const start = this.frame();
    const rtl = this.isRtl();
    this.track(
      event,
      (dx, dy) => this.resizeTo(start, dx, dy, rtl),
      () => this.emitResizeEnd(),
    );
  }

  protected onResizeKey(event: KeyboardEvent): void {
    if (!event.shiftKey) return;
    const step = arrowDelta(event.key);
    if (!step) return;
    event.preventDefault();
    this.resizeTo(
      this.frame(),
      step.x * STAR_DIALOG_KEY_STEP,
      step.y * STAR_DIALOG_KEY_STEP,
      this.isRtl(),
    );
    this.emitResizeEnd();
  }

  protected override titleShown(): boolean {
    return this.showHeader() && !this.headless();
  }

  protected override afterClose(): void {
    this.stopTracking();
    if (this.rememberPosition()) return;
    this.placed.set(null);
    this.sized.set(null);
  }

  /** Starts a pointer drag or resize; a running one stops first. */
  private track(
    event: PointerEvent,
    move: (dx: number, dy: number) => void,
    end: () => void,
  ): void {
    this.stopTracking();
    const stop = trackPointer(event, move, () => {
      this.stopTracking = () => undefined;
      end();
    });
    this.stopTracking = stop;
  }

  /** Stops the running pointer drag or resize, if any. */
  private stopTracking: () => void = () => undefined;

  /** The current box: the set position and size, or the measured ones. */
  protected frame(): StarDialogFrame {
    const rect = this.dialog().nativeElement.getBoundingClientRect();
    const placed = this.placed();
    const sized = this.sized();
    // Whole pixels: the reported position and size stay readable.
    return {
      left: placed?.x ?? Math.round(rect.left),
      top: placed?.y ?? Math.round(rect.top),
      width: sized?.width ?? Math.round(rect.width),
      height: sized?.height ?? Math.round(rect.height),
    };
  }

  /**
   * Visible page area without the scrollbars when `keepInViewport` is on, otherwise `null`.
   * Falls back to the window size when the root element reports no size.
   */
  protected viewport(): StarDialogDimensions | null {
    const view = this.document.defaultView;
    if (!this.keepInViewport() || !view) return null;
    const root = this.document.documentElement;
    return {
      width: root.clientWidth || view.innerWidth,
      height: root.clientHeight || view.innerHeight,
    };
  }

  /** A remembered position and size come back inside the window, which may have shrunk. */
  protected override afterOpen(): void {
    const placed = this.placed();
    const sized = this.sized();
    const viewport = this.viewport();
    if (!viewport || (!placed && !sized)) return;
    const frame = this.frame();
    const size = {
      width: Math.min(frame.width, viewport.width),
      height: Math.min(frame.height, viewport.height),
    };
    if (sized) this.sized.set(size);
    if (placed) this.placed.set(clampToViewport({ x: frame.left, y: frame.top }, size, viewport));
  }

  private moveTo(frame: StarDialogFrame, x: number, y: number): void {
    const viewport = this.viewport();
    this.placed.set(viewport ? clampToViewport({ x, y }, frame, viewport) : { x, y });
  }

  private resizeTo(start: StarDialogFrame, dx: number, dy: number, rtl: boolean): void {
    const frame = resizeFrame(start, dx, dy, rtl, this.viewport());
    this.placed.set({ x: frame.left, y: frame.top });
    this.sized.set({ width: frame.width, height: frame.height });
  }

  private isRtl(): boolean {
    return starIsRtl(this.dialog().nativeElement);
  }

  private emitResizeEnd(): void {
    const sized = this.sized();
    if (sized) this.resizeEnd.emit(sized);
  }

  private emitDragEnd(): void {
    const placed = this.placed();
    if (placed) this.dragEnd.emit(placed);
  }
}
