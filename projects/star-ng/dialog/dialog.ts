import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
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
import { ɵStarDialogHeaderTemplates } from './dialog-header-actions';
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

/** Color of the icon tile in the dialog header. */
export type StarDialogIconTone = 'primary' | 'info' | 'warn' | 'danger' | 'success';

/**
 * Class of a header icon: a full class (with a space) stays as it is; a name gets the bold
 * weight. `null` for an empty value.
 */
function starDialogIconClass(icon: string | null | undefined): string | null {
  const value = icon?.trim();
  if (!value) return null;
  if (/\s/.test(value)) return value;
  return `ph-bold ph-${value.replace(/^ph-/, '')}`;
}

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
 * Header: `icon` and `iconTone` put a decorative icon tile before the title, `subheader` adds a
 * text after it, and `headerDivider` draws a line under the header. Content with
 * `starDialogHeader` goes under the title; content with `starDialogHeaderActions` (for example a
 * button) goes before the header buttons, and so does the content of an
 * `<ng-template starDialogHeaderActions>` (after the projected elements).
 *
 * `sheet` turns the dialog into a full-height side sheet at the end edge (or the start edge with
 * `position="start"`): the body fills the height and scrolls.
 *
 * The exit motion must run on the dialog element itself (or its `::backdrop`): an animation
 * on a child of the dialog does not hold the close.
 */
@Component({
  selector: 'star-dialog',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  providers: [ɵStarDialogHeaderTemplates],
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Backdrop click only; keyboard users close with Escape (native cancel event). -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
    <dialog
      data-star-part="frame"
      #dialog
      class="star-dialog"
      [class]="'star-dialog--' + size() + ' star-dialog--at-' + placement()"
      [class.star-dialog--sheet]="sheet()"
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
            [class.star-dialog__header--divided]="headerDivider()"
            (pointerdown)="onDragStart($event)"
          >
            <div
              data-star-part="headingPanel"
              class="star-dialog__heading"
              [class.star-dialog__heading--icon]="iconClass()"
            >
              @if (iconClass(); as glyph) {
                <span
                  data-star-part="iconPanel"
                  aria-hidden="true"
                  [class]="'star-dialog__icon star-dialog__icon--' + iconTone()"
                >
                  <i data-star-part="headerIcon" [class]="glyph"></i>
                </span>
              }
              <div data-star-part="headingContentPanel" class="star-dialog__heading-text">
                @if (header() || subheader()) {
                  <div data-star-part="titleLinePanel" class="star-dialog__title-line">
                    @if (header()) {
                      <h2 data-star-part="titleText" class="star-dialog__title" [id]="headerId">
                        {{ header() }}
                      </h2>
                    }
                    @if (subheader()) {
                      <span
                        data-star-part="subheaderText"
                        class="star-dialog__subheader"
                        [id]="subheaderId"
                        >{{ subheader() }}</span
                      >
                    }
                  </div>
                }
                <ng-content select="[starDialogHeader]" />
              </div>
            </div>
            <div data-star-part="controlsPanel" class="star-dialog__controls">
              <ng-content select="[starDialogHeaderActions]" />
              @for (actions of headerTemplates.templates(); track actions) {
                <ng-container [ngTemplateOutlet]="actions" />
              }
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
  /** Content of `<ng-template starDialogHeaderActions>` inside this dialog. */
  protected readonly headerTemplates = inject(ɵStarDialogHeaderTemplates, { self: true });

  /**
   * Icon in a tinted tile before the title. A Phosphor icon name (`file-text` or
   * `ph-file-text`, bold weight) or a full icon class (`ph-fill ph-info`). Decorative: it is
   * hidden from assistive technology. Empty or `null` shows no tile.
   */
  readonly icon = input<string | null>(null);
  /** Color of the icon tile: `primary` (default), `info`, `warn`, `danger` or `success`. */
  readonly iconTone = input<StarDialogIconTone>('primary');
  /**
   * Text after the title on the same line, for example a record number. It is part of the
   * accessible name of the dialog, after the title.
   */
  readonly subheader = input('');
  /** A line under the header separates it from the body, like the line above the footer. */
  readonly headerDivider = input(false, { transform: booleanAttribute });

  /**
   * Place in the window (PrimeNG `position`): `center` (default), an edge or a corner, 1rem from
   * the window edge. Logical: `start` and `end` change sides in right-to-left.
   */
  readonly position = input<StarDialogPosition>('center');
  /**
   * Full-height side sheet: the dialog sits at the end edge, a small gap from the top, the end and
   * the bottom of the window, and slides in from that edge. `position="start"` puts it at the start
   * edge; other positions are ignored. Both follow the writing direction. `width` and `size` set
   * the width, up to the window width minus a gap. The body fills the height and scrolls, so the
   * content can grow with `flex: 1`. Tokens: `--star-dialog-sheet-gap`,
   * `--star-dialog-sheet-reserve` and `--star-dialog-sheet-radius`.
   */
  readonly sheet = input(false, { transform: booleanAttribute });
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
  protected readonly subheaderId = inject(_IdGenerator).getId('star-dialog-subtitle-');
  /** Class of the icon in the header tile, or `null` without an icon. */
  protected readonly iconClass = computed(() => starDialogIconClass(this.icon()));

  /** Position class: a sheet is at the start or the end edge only. */
  protected readonly placement = computed<StarDialogPosition>(() => {
    if (!this.sheet()) return this.position();
    return this.position() === 'start' ? 'start' : 'end';
  });

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

  /** The title, then the subheader, name the dialog. */
  protected override titleIds(): string {
    return this.subheader() ? `${this.headerId} ${this.subheaderId}` : this.headerId;
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
