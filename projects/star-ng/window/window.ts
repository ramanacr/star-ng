import { _IdGenerator } from '@angular/cdk/a11y';
import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  numberAttribute,
  output,
  Service,
  signal,
  viewChild,
} from '@angular/core';
import { STAR_UI_TEXT, starIsRtl, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';

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
const CASCADE = 32;

/**
 * Stacking order of the open windows of the application, back to front. `StarWindow` uses it; the
 * service also opens windows from code (`StarWindowService.open`). The orders are renumbered
 * 1..n on every change, so they stay small: the CSS adds them to `--star-window-z` (default: the
 * overlay base `--star-z-index-base` minus 100) and caps the result one below the CDK overlay
 * container, so it follows `provideStarNg({ overlay: { zIndexBase } })`.
 */
@Service()
export class StarWindowStack {
  private readonly windows: StarWindow[] = [];

  /** @internal Puts the window in front, or adds it. */
  raise(window: StarWindow): void {
    if (this.windows[this.windows.length - 1] === window) return;
    this.remove(window, false);
    this.windows.push(window);
    this.renumber();
  }

  /** @internal Takes a closed window out of the stack. */
  remove(window: StarWindow, renumber = true): void {
    const index = this.windows.indexOf(window);
    if (index < 0) return;
    this.windows.splice(index, 1);
    window.order.set(0);
    if (renumber) this.renumber();
  }

  /** Number of open windows. */
  openCount(): number {
    return this.windows.length;
  }

  private renumber(): void {
    this.windows.forEach((window, index) => window.order.set(index + 1));
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
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Keys and pointer presses from inside the window: Escape and bringing it to the front. -->
    <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
    <dialog
      data-star-part="surface"
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
        data-star-part="titlebar"
        class="star-window__titlebar"
        tabindex="0"
        role="group"
        [attr.aria-labelledby]="header() ? titleId : null"
        [attr.aria-label]="header() ? null : ariaLabel()"
        [attr.aria-describedby]="hintId"
        (keydown)="onTitleKeydown($event)"
        (pointerdown)="onDragStart($event)"
        (dblclick)="onTitleDoubleClick($event)"
      >
        @if (header()) {
          <h2 data-star-part="titleText" class="star-window__title" [id]="titleId">
            {{ header() }}
          </h2>
        } @else {
          <!-- Keeps the buttons at the inline end without a title. -->
          <span data-star-part="titleText" class="star-window__title" aria-hidden="true"></span>
        }
        <ng-content select="[starWindowHeader]" />
        <div data-star-part="actionList" class="star-window__actions">
          <!-- Stable toggles: the focused button stays when the state changes. A window that is
               minimized or maximized from code always shows its restore button, also when that
               action is off; after the restore the button goes, and the focus goes to the title bar. -->
          @if (minimizable() || state() === 'minimized') {
            <button
              data-star-part="restoreButton"
              type="button"
              class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
              [attr.aria-label]="state() === 'minimized' ? text.restore : text.minimize"
              (click)="toggleMinimized()"
            >
              <i
                data-star-part="restoreIcon"
                [class]="state() === 'minimized' ? 'ph-bold ph-copy-simple' : 'ph-bold ph-minus'"
                aria-hidden="true"
              ></i>
            </button>
          }
          @if (maximizable() || state() === 'maximized') {
            <button
              data-star-part="restoreButton"
              type="button"
              class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
              [attr.aria-label]="state() === 'maximized' ? text.restore : text.maximize"
              (click)="toggleMaximized()"
            >
              <i
                data-star-part="restoreIcon"
                [class]="state() === 'maximized' ? 'ph-bold ph-copy-simple' : 'ph-bold ph-square'"
                aria-hidden="true"
              ></i>
            </button>
          }
          @if (closable()) {
            <button
              data-star-part="closeButton"
              type="button"
              class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
              [attr.aria-label]="text.close"
              (click)="close()"
            >
              <i data-star-part="closeIcon" class="ph-bold ph-x" aria-hidden="true"></i>
            </button>
          }
        </div>
      </div>
      <div data-star-part="content" class="star-window__content" [hidden]="state() === 'minimized'">
        <div data-star-part="body" class="star-window__body"><ng-content /></div>
        <ng-content select="[starWindowFooter]" />
      </div>
      @if (resizable() && state() === 'normal') {
        <span
          data-star-part="resize"
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
  private readonly injector = inject(Injector);

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
  /**
   * The title bar has a minimize button. A window that is minimized from code still shows its
   * restore button when this is off.
   */
  readonly minimizable = input(true, { transform: booleanAttribute });
  /**
   * The title bar has a maximize button (and a double click maximizes). A window that is maximized
   * from code still shows its restore button when this is off.
   */
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
    // When a state change hides the focused element (for example the content of a window that
    // is minimized), the focus would fall to <body>: it goes to the title bar instead.
    let previous: StarWindowState | null = null;
    effect(() => {
      const state = this.state();
      if (previous !== null && state !== previous) {
        const element = this.dialog().nativeElement;
        const active = this.document.activeElement;
        const hadFocus = !!active && element.contains(active);
        afterNextRender(
          () => {
            const now = this.document.activeElement;
            const lost =
              !now ||
              now === this.document.body ||
              !element.contains(now) ||
              !!(now as HTMLElement).closest?.('[hidden]');
            if (hadFocus && lost) {
              element.querySelector<HTMLElement>('.star-window__titlebar')?.focus();
            }
          },
          { injector: this.injector },
        );
      }
      previous = state;
    });
    // Destroyed while open (for example its page went away): leave the stack, so the order and
    // the cascade of the other windows stay right. No `closed` output from a destroyed component.
    inject(DestroyRef).onDestroy(() => this.markClosed(false));
    afterRenderEffect({
      write: () => {
        const element = this.dialog().nativeElement;
        const visible = this.visible();
        if (visible && !this.isOpen) {
          this.isOpen = true;
          const index = this.stack.openCount();
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
    if (this.isOpen) this.stack.raise(this);
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

  /** Minimizes, or restores a minimized window (the first title bar toggle). */
  protected toggleMinimized(): void {
    this.state.set(this.state() === 'minimized' ? 'normal' : 'minimized');
  }

  /** Maximizes, or restores a maximized window (the second title bar toggle). */
  protected toggleMaximized(): void {
    this.state.set(this.state() === 'maximized' ? 'normal' : 'maximized');
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
    // An Escape that a control inside already used (for example to close its popup) is not ours.
    if (event.defaultPrevented) return;
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
        // The same top for every height, so the title bars of a cascade do not cover each other.
        y: Math.round(viewport.height * 0.12) + shift,
      }),
    );
  }

  /** Leaves the stack once per open; emits `closed` unless the window is being destroyed. */
  private markClosed(emit = true): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.stack.remove(this);
    if (emit) this.closed.emit();
  }
}
