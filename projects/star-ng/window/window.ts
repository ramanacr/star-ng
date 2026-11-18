import { _IdGenerator } from '@angular/cdk/a11y';
import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  model,
  numberAttribute,
  output,
  Service,
  signal,
  viewChild,
} from '@angular/core';
import { STAR_UI_TEXT, starIsRtl } from '@star-ng/ui/core';

/** State of a `star-window`. */
export type StarWindowState = 'normal' | 'minimized' | 'maximized';

/** Place of a window: pixels from the left and the top edge of the viewport. */
export interface StarWindowPosition {
  readonly x: number;
  readonly y: number;
}

/** Size of a window in pixels. */
export interface StarWindowSize {
  readonly width: number;
  readonly height: number;
}

/** Pixels per key press of Alt or Shift and an arrow key. */
const KEY_STEP = 16;
/** Pixels between windows that open at the same time without a position. */
const CASCADE = 24;

/**
 * Stacking order of the windows of the application. `StarWindow` uses it; the service also opens
 * windows from code (`StarWindowService.open`).
 */
@Service()
export class StarWindowStack {
  private top = 0;
  private open = 0;

  /** @internal The next, highest stacking order. */
  next(): number {
    return ++this.top;
  }

  /** @internal The highest stacking order given so far. */
  current(): number {
    return this.top;
  }

  /** @internal Counts open windows, for the cascade of new windows. Returns the index. */
  opened(): number {
    return this.open++;
  }

  /** @internal */
  closed(): void {
    this.open = Math.max(0, this.open - 1);
  }
}

/**
 * Floating window (Kendo UI `Window`; the PrimeNG `p-dialog` with `modal=false`, `draggable` and
 * `resizable`): a non-modal window that the user can move, resize, minimize and maximize. Several
 * windows stack; the one that gets the focus or a pointer press comes to the front.
 *
 * Rendering: a native `<dialog>` opened with `show()` (not `showModal()`), so the page behind
 * stays usable, the element has the `dialog` role and the focus moves into it and back when it
 * closes. It is `position: fixed` with a `z-index` from the window stack, not in the top layer:
 * the top layer (`showModal()` or `popover`) orders elements only by the time they were shown,
 * so bringing a window to the front would mean closing and showing it again, which moves the
 * focus. A window from `StarWindowService` is placed at the end of `<body>`, so no ancestor clips it.
 *
 * Keyboard: the title bar is focusable. Alt and an arrow key move the window, Shift and an arrow
 * key resize it. Escape closes the window only with `closeOnEscape`.
 *
 * ```html
 * <star-window [(visible)]="notesOpen" header="Notes" [(position)]="notesAt" [(size)]="notesSize">
 *   …
 * </star-window>
 * ```
 */
@Component({
  selector: 'star-window',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Keys and pointer presses from inside the window: Escape and bringing it to the front. -->
    <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
    <dialog
      #dialog
      class="star-window"
      [class.star-window--minimized]="state() === 'minimized'"
      [class.star-window--maximized]="state() === 'maximized'"
      [class.star-window--moving]="moving()"
      [style.left.px]="state() !== 'maximized' ? position()?.x : null"
      [style.top.px]="state() !== 'maximized' ? position()?.y : null"
      [style.width.px]="state() !== 'maximized' ? size()?.width : null"
      [style.height.px]="state() === 'normal' ? size()?.height : null"
      [style.--star-window-order]="order()"
      [attr.aria-labelledby]="header() ? titleId : null"
      [attr.aria-label]="header() ? null : ariaLabel()"
      (cancel)="onCancel($event)"
      (close)="onNativeClose()"
      (keydown)="onKeydown($event)"
      (focusin)="toFront()"
      (pointerdown)="toFront()"
    >
      <!-- The title bar takes the focus for the move and resize keys; the pointer drags it. -->
      <div
        class="star-window__titlebar"
        tabindex="0"
        [attr.aria-describedby]="hintId"
        (keydown)="onTitleKeydown($event)"
        (pointerdown)="onDragStart($event)"
        (dblclick)="onTitleDoubleClick($event)"
      >
        <h2 class="star-window__title" [id]="titleId">{{ header() }}</h2>
        <ng-content select="[starWindowHeader]" />
        <div class="star-window__actions">
          @if (minimizable() && state() !== 'minimized') {
            <button
              type="button"
              class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
              [attr.aria-label]="text.minimize"
              (click)="minimize()"
            >
              <i class="ph-bold ph-minus" aria-hidden="true"></i>
            </button>
          }
          @if (state() !== 'normal') {
            <button
              type="button"
              class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
              [attr.aria-label]="text.restore"
              (click)="restore()"
            >
              <i class="ph-bold ph-copy-simple" aria-hidden="true"></i>
            </button>
          }
          @if (maximizable() && state() !== 'maximized') {
            <button
              type="button"
              class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
              [attr.aria-label]="text.maximize"
              (click)="maximize()"
            >
              <i class="ph-bold ph-square" aria-hidden="true"></i>
            </button>
          }
          @if (closable()) {
            <button
              type="button"
              class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
              [attr.aria-label]="text.close"
              (click)="close()"
            >
              <i class="ph-bold ph-x" aria-hidden="true"></i>
            </button>
          }
        </div>
      </div>
      <div class="star-window__content" [hidden]="state() === 'minimized'">
        <div class="star-window__body"><ng-content /></div>
        <ng-content select="[starWindowFooter]" />
      </div>
      @if (resizable() && state() === 'normal') {
        <span
          class="star-window__resize"
          aria-hidden="true"
          (pointerdown)="onResizeStart($event)"
        ></span>
      }
      <p class="star-sr-only" [id]="hintId">{{ hint() }}</p>
    </dialog>
  `,
})
export class StarWindow {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly document = inject(DOCUMENT);
  private readonly stack = inject(StarWindowStack);

  /** Open state. */
  readonly visible = model(false);
  /** Title in the title bar; it names the window. */
  readonly header = input('');
  /** Accessible name when there is no `header`. */
  readonly ariaLabel = input<string | null>(null);
  /** Place in the viewport, in pixels. `null` centers the window when it opens. */
  readonly position = model<StarWindowPosition | null>(null);
  /** Size in pixels. `null` uses the CSS size (`--star-window-width`, content height). */
  readonly size = model<StarWindowSize | null>(null);
  /** `normal`, `minimized` (title bar only) or `maximized` (fills the viewport). Emits `stateChange`. */
  readonly state = model<StarWindowState>('normal');
  /** The title bar drags the window; Alt and the arrow keys move it. */
  readonly draggable = input(true, { transform: booleanAttribute });
  /** A corner handle, and Shift and the arrow keys, resize the window. */
  readonly resizable = input(true, { transform: booleanAttribute });
  /** Keeps the whole window in the viewport while it moves and resizes. */
  readonly keepInViewport = input(true, { transform: booleanAttribute });
  /** Escape closes the window. Off by default: a non-modal window stays until the user closes it. */
  readonly closeOnEscape = input(false, { transform: booleanAttribute });
  readonly minimizable = input(true, { transform: booleanAttribute });
  readonly maximizable = input(true, { transform: booleanAttribute });
  readonly closable = input(true, { transform: booleanAttribute });
  /** Smallest width in pixels. */
  readonly minWidth = input(240, { transform: numberAttribute });
  /** Smallest height in pixels. */
  readonly minHeight = input(160, { transform: numberAttribute });

  /** Emits after the window closed (close button, Escape with `closeOnEscape`, or `visible`). */
  readonly closed = output<void>();

  protected readonly titleId = inject(_IdGenerator).getId('star-window-title-');
  protected readonly hintId = inject(_IdGenerator).getId('star-window-hint-');
  /** @internal Stacking order; the highest is in front. */
  readonly order = signal(0);
  protected readonly moving = signal(false);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private isOpen = false;

  constructor() {
    afterRenderEffect({
      write: () => {
        const element = this.dialog().nativeElement;
        const visible = this.visible();
        if (visible && !this.isOpen) {
          this.isOpen = true;
          const index = this.stack.opened();
          this.toFront();
          element.show?.();
          if (!this.position()) this.center(element, index);
        } else if (!visible && this.isOpen) {
          if (element.open) element.close();
          this.markClosed();
        }
      },
    });
  }

  /** Text of the keyboard hint of the title bar, for the move and resize keys that apply. */
  protected hint(): string {
    return this.draggable() || this.resizable() ? this.text.windowHint : '';
  }

  /** Brings the window in front of the other windows. */
  toFront(): void {
    if (this.order() === 0 || this.order() !== this.stack.current()) {
      this.order.set(this.stack.next());
    }
  }

  /** Closes the window. */
  close(): void {
    this.visible.set(false);
  }

  minimize(): void {
    this.state.set('minimized');
  }

  maximize(): void {
    this.state.set('maximized');
  }

  restore(): void {
    this.state.set('normal');
  }

  /** Moves the window by a number of pixels, within the viewport when `keepInViewport` is on. */
  moveBy(dx: number, dy: number): void {
    const start = this.position() ?? this.rectPosition();
    this.position.set(this.clampPosition({ x: start.x + dx, y: start.y + dy }));
  }

  /** Resizes the window by a number of pixels, within `minWidth`, `minHeight` and the viewport. */
  resizeBy(dw: number, dh: number): void {
    const start = this.size() ?? this.rectSize();
    this.size.set(this.clampSize({ width: start.width + dw, height: start.height + dh }));
  }

  protected onTitleKeydown(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget || this.state() !== 'normal') return;
    const step =
      event.key === 'ArrowLeft'
        ? [-1, 0]
        : event.key === 'ArrowRight'
          ? [1, 0]
          : event.key === 'ArrowUp'
            ? [0, -1]
            : event.key === 'ArrowDown'
              ? [0, 1]
              : null;
    if (!step || event.ctrlKey || event.metaKey) return;
    if (event.altKey && !event.shiftKey && this.draggable()) {
      event.preventDefault();
      this.moveBy(step[0] * KEY_STEP, step[1] * KEY_STEP);
    } else if (event.shiftKey && !event.altKey && this.resizable()) {
      event.preventDefault();
      this.resizeBy(step[0] * KEY_STEP, step[1] * KEY_STEP);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.closeOnEscape()) {
      event.preventDefault();
      this.close();
    }
  }

  protected onTitleDoubleClick(event: MouseEvent): void {
    if ((event.target as Element).closest('button') || !this.maximizable()) return;
    this.state.set(this.state() === 'maximized' ? 'normal' : 'maximized');
  }

  protected onCancel(event: Event): void {
    // A browser close request (Escape): we own the state.
    event.preventDefault();
    if (this.closeOnEscape()) this.close();
  }

  /** Browser-initiated close, for example a form with method="dialog". */
  protected onNativeClose(): void {
    if (this.visible()) this.visible.set(false);
    this.markClosed();
  }

  protected onDragStart(event: PointerEvent): void {
    if (
      event.button !== 0 ||
      !this.draggable() ||
      this.state() !== 'normal' ||
      (event.target as Element).closest('button')
    ) {
      return;
    }
    const start = this.position() ?? this.rectPosition();
    const origin = { x: event.clientX, y: event.clientY };
    this.track(event, (move) =>
      this.position.set(
        this.clampPosition({
          x: start.x + move.clientX - origin.x,
          y: start.y + move.clientY - origin.y,
        }),
      ),
    );
  }

  protected onResizeStart(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    const element = this.dialog().nativeElement;
    // The handle is at the inline end: the left corner in right-to-left.
    const fromLeft = starIsRtl(element);
    const size = this.size() ?? this.rectSize();
    const position = this.position() ?? this.rectPosition();
    const origin = { x: event.clientX, y: event.clientY };
    this.track(event, (move) => {
      const dx = move.clientX - origin.x;
      const dy = move.clientY - origin.y;
      const next = this.clampSize({
        width: size.width + (fromLeft ? -dx : dx),
        height: size.height + dy,
      });
      this.size.set(next);
      if (fromLeft) {
        this.position.set({ x: position.x + size.width - next.width, y: position.y });
      }
    });
  }

  /** Follows the pointer until it is released. */
  private track(event: PointerEvent, onMove: (move: PointerEvent) => void): void {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    this.moving.set(true);
    const end = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', end);
      this.moving.set(false);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  }

  private viewport(): { width: number; height: number } {
    const view = this.document.defaultView;
    return {
      width: this.document.documentElement.clientWidth || view?.innerWidth || 0,
      height: this.document.documentElement.clientHeight || view?.innerHeight || 0,
    };
  }

  private rectPosition(): StarWindowPosition {
    const rect = this.dialog().nativeElement.getBoundingClientRect();
    return { x: Math.round(rect.left), y: Math.round(rect.top) };
  }

  private rectSize(): StarWindowSize {
    const rect = this.dialog().nativeElement.getBoundingClientRect();
    return { width: Math.round(rect.width), height: Math.round(rect.height) };
  }

  private clampPosition(next: StarWindowPosition): StarWindowPosition {
    if (!this.keepInViewport()) return next;
    const viewport = this.viewport();
    const size = this.size() ?? this.rectSize();
    const clamp = (value: number, max: number) =>
      Math.round(Math.min(Math.max(value, 0), Math.max(0, max)));
    return {
      x: viewport.width ? clamp(next.x, viewport.width - size.width) : Math.max(0, next.x),
      y: viewport.height ? clamp(next.y, viewport.height - size.height) : Math.max(0, next.y),
    };
  }

  private clampSize(next: StarWindowSize): StarWindowSize {
    let width = Math.max(this.minWidth(), next.width);
    let height = Math.max(this.minHeight(), next.height);
    if (this.keepInViewport()) {
      const viewport = this.viewport();
      const position = this.position() ?? this.rectPosition();
      if (viewport.width)
        width = Math.max(this.minWidth(), Math.min(width, viewport.width - position.x));
      if (viewport.height) {
        height = Math.max(this.minHeight(), Math.min(height, viewport.height - position.y));
      }
    }
    return { width: Math.round(width), height: Math.round(height) };
  }

  /** Centers the window in the viewport, shifted down and to the side for each open window. */
  private center(element: HTMLElement, index: number): void {
    const viewport = this.viewport();
    const rect = element.getBoundingClientRect();
    const shift = (index % 8) * CASCADE;
    this.position.set(
      this.clampPosition({
        x: Math.round((viewport.width - rect.width) / 2) + shift,
        y: Math.round((viewport.height - rect.height) / 3) + shift,
      }),
    );
  }

  private markClosed(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.stack.closed();
    this.closed.emit();
  }
}
