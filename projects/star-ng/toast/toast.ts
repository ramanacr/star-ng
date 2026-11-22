import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  ElementRef,
  forwardRef,
  inject,
  input,
  output,
  Service,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  starBreakpointValue,
  StarSlot,
  starSlot,
  StarStyled,
  starViewportWidth,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { Observable, Subject } from 'rxjs';
import { STAR_TOAST_DEFAULTS, StarToastPosition } from './toast-defaults';
import { StarToastOutletPolicy, toastSignature } from './toast-duplicates';
import type { StarToastMessageContext } from './toast-slots';

export type StarToastSeverity = 'success' | 'info' | 'warn' | 'error';

export interface StarToastOptions {
  readonly severity?: StarToastSeverity;
  readonly summary: string;
  readonly detail?: string;
  /** Milliseconds before auto close (default 5000). */
  readonly life?: number;
  /** Stays until the user closes it. */
  readonly sticky?: boolean;
  /** Targets a specific `<star-toast key="...">`. */
  readonly key?: string;
}

export interface StarToastMessage extends Required<Omit<StarToastOptions, 'detail' | 'key'>> {
  readonly id: number;
  readonly detail?: string;
  readonly key?: string;
}

/** Why a toast closed: its timer ran out, a close action, or `clear()`. */
export type StarToastCloseReason = 'timeout' | 'close' | 'clear';

/** A toast that closed (PrimeNG `onClose`). */
export interface StarToastCloseEvent {
  readonly message: StarToastMessage;
  readonly reason: StarToastCloseReason;
}

interface Timer {
  handle: ReturnType<typeof setTimeout> | undefined;
  remaining: number;
  startedAt: number;
}

/**
 * Toast notifications (PrimeNG `MessageService` + `p-toast`): severities, auto-close with
 * pause on hover / focus, sticky messages, duplicate suppression and a visible-stack limit.
 *
 * `inject(StarToastService).success('Saved', 'Order ORD-102 was updated.')`
 */
@Service()
export class StarToastService {
  private readonly defaults = inject(STAR_TOAST_DEFAULTS);
  private readonly items = signal<readonly StarToastMessage[]>([]);
  private readonly timers = new Map<number, Timer>();
  private readonly outlets = new Set<StarToastOutletPolicy>();
  /** Signatures of the messages shown per key, for outlets with `preventDuplicates`. */
  private readonly archive = new Map<string | undefined, Set<string>>();
  private readonly closedEvents = new Subject<StarToastCloseEvent>();
  private nextId = 1;

  readonly messages = this.items.asReadonly();
  /** Every toast that closes, with the reason (timeout, close or clear). */
  readonly closed: Observable<StarToastCloseEvent> = this.closedEvents.asObservable();
  /**
   * Identical severity, summary, detail and key while still visible is ignored (default true),
   * for every outlet. Not the same as the outlet input `star-toast` `preventDuplicates`, which
   * ignores a message that the outlet has ever shown (PrimeNG meaning). Set this to false to
   * allow copies; an outlet with `preventOpenDuplicates` still ignores visible copies.
   */
  preventDuplicates = true;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  /**
   * Shows a message and returns its id. An ignored duplicate returns the id of the visible copy,
   * or 0 when the copy has closed (outlet with `preventDuplicates`).
   */
  show(options: StarToastOptions): number {
    const severity = options.severity ?? 'info';
    const signature = toastSignature(severity, options.summary, options.detail);
    const outlet = [...this.outlets].find((policy) => policy.key() === options.key);
    if (this.preventDuplicates || outlet?.preventOpenDuplicates()) {
      const duplicate = this.items().find(
        (item) =>
          item.key === options.key &&
          toastSignature(item.severity, item.summary, item.detail) === signature,
      );
      if (duplicate) return duplicate.id;
    }
    if (outlet?.preventDuplicates()) {
      const shown = this.archive.get(options.key) ?? new Set<string>();
      if (shown.has(signature)) return 0;
      this.archive.set(options.key, shown.add(signature));
    }
    const message: StarToastMessage = {
      id: this.nextId++,
      severity,
      summary: options.summary,
      detail: options.detail,
      life: options.life ?? this.defaults.life ?? 5000,
      sticky: options.sticky ?? false,
      key: options.key,
    };
    this.items.update((items) => [...items, message]);
    if (!message.sticky) this.startTimer(message.id, message.life);
    return message.id;
  }

  success(summary: string, detail?: string): number {
    return this.show({ severity: 'success', summary, detail });
  }
  info(summary: string, detail?: string): number {
    return this.show({ severity: 'info', summary, detail });
  }
  warn(summary: string, detail?: string): number {
    return this.show({ severity: 'warn', summary, detail });
  }
  error(summary: string, detail?: string): number {
    return this.show({ severity: 'error', summary, detail, life: 8000 });
  }

  /** Removes one message (reason `close`). */
  remove(id: number): void {
    this.dismiss(id, 'close');
  }

  /** Removes all messages, or only those of one `key` (reason `clear`). */
  clear(key?: string): void {
    for (const item of this.items()) {
      if (key === undefined || item.key === key) this.dismiss(item.id, 'clear');
    }
  }

  /**
   * Connects the duplicate rules of an outlet to `show()`. Returns the function that disconnects
   * it. Called by `star-toast`.
   */
  registerOutlet(policy: StarToastOutletPolicy): () => void {
    this.outlets.add(policy);
    return () => {
      this.outlets.delete(policy);
      this.archive.delete(policy.key());
    };
  }

  private dismiss(id: number, reason: StarToastCloseReason): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer.handle);
    this.timers.delete(id);
    const message = this.items().find((item) => item.id === id);
    if (!message) return;
    this.items.update((items) => items.filter((item) => item.id !== id));
    this.closedEvents.next({ message, reason });
  }

  pause(id: number): void {
    const timer = this.timers.get(id);
    if (!timer?.handle) return;
    clearTimeout(timer.handle);
    timer.handle = undefined;
    timer.remaining -= Date.now() - timer.startedAt;
  }

  resume(id: number): void {
    const timer = this.timers.get(id);
    if (!timer || timer.handle) return;
    this.startTimer(id, Math.max(timer.remaining, 1000));
  }

  private startTimer(id: number, ms: number): void {
    this.timers.set(id, {
      handle: setTimeout(() => this.dismiss(id, 'timeout'), ms),
      remaining: ms,
      startedAt: Date.now(),
    });
  }
}

const ICONS: Record<StarToastSeverity, string> = {
  success: 'ph-fill ph-check-circle',
  info: 'ph-fill ph-info',
  warn: 'ph-fill ph-warning',
  error: 'ph-fill ph-x-circle',
};

/**
 * Toast outlet. Place once in the app shell. It renders as a manual popover, so toasts stay
 * above open modal dialogs (top layer).
 *
 * Slot: `ng-template[starToastMessage]` replaces the summary and the detail of each toast
 * (`StarToastMessageTemplate`).
 */
@Component({
  selector: 'star-toast',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarToast) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-toast-stack',
    popover: 'manual',
    '[class]': "'star-toast-stack star-toast-stack--' + position()",
    '[class.star-toast-stack--narrow]': 'narrowStyle() !== undefined',
    '[style]': 'narrowStyle() ?? null',
    '[attr.aria-label]': 'text.notifications',
    role: 'region',
  },
  template: `
    @for (message of visible(); track message.id) {
      <div
        data-star-part="surface"
        class="star-toast"
        [class]="'star-toast star-toast--' + message.severity"
        animate.leave="star-toast--leaving"
        [attr.role]="message.severity === 'error' ? 'alert' : 'status'"
        (mouseenter)="toasts.pause(message.id)"
        (mouseleave)="toasts.resume(message.id)"
        (focusin)="toasts.pause(message.id)"
        (focusout)="toasts.resume(message.id)"
      >
        <i
          data-star-part="icon"
          class="star-toast__icon"
          [class]="icon(message.severity)"
          aria-hidden="true"
        ></i>
        <div data-star-part="copyButton" class="star-toast__copy">
          @if (messageSlot(); as slot) {
            <ng-container *ngTemplateOutlet="slot; context: messageContext(message)" />
          } @else {
            <p data-star-part="summaryText" class="star-toast__summary">{{ message.summary }}</p>
            @if (message.detail) {
              <p data-star-part="detailText" class="star-toast__detail">{{ message.detail }}</p>
            }
          }
        </div>
        <button
          data-star-part="closeButton"
          type="button"
          class="star-toast__close"
          [attr.aria-label]="text.close"
          (click)="toasts.remove(message.id)"
        >
          <i data-star-part="closeIcon" class="ph-bold ph-x" aria-hidden="true"></i>
        </button>
      </div>
    }
  `,
})
export class StarToast {
  protected readonly toasts = inject(StarToastService);
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly defaults = inject(STAR_TOAST_DEFAULTS);

  /**
   * Corner of the screen. `-left` and `-right` are physical; `-start` and `-end` follow the
   * writing direction (the start corner is on the right in right-to-left).
   */
  readonly position = input<StarToastPosition>(this.defaults.position ?? 'top-right');
  readonly key = input<string | undefined>(undefined);
  /** Newest messages beyond this count wait until older ones close. */
  readonly stackLimit = input(this.defaults.stackLimit ?? 5);
  /**
   * Ignores a message with the same severity, summary and detail as one that this outlet has
   * ever shown, also after it closed (PrimeNG `preventDuplicates`). Not the same as the service
   * flag `StarToastService.preventDuplicates`, which only ignores a copy while visible.
   */
  readonly preventDuplicates = input(false, { transform: booleanAttribute });
  /**
   * Ignores a message with the same severity, summary and detail as one that this outlet shows
   * now (PrimeNG `preventOpenDuplicates`). The service does this for every outlet by default
   * (`StarToastService.preventDuplicates`); this input keeps it for one outlet when that is off.
   */
  readonly preventOpenDuplicates = input(false, { transform: booleanAttribute });
  /**
   * Narrow windows (PrimeNG `breakpoints`): `{ '<max-width>': { ...styles } }`. When a key
   * matches, the stack goes full width at the bottom of the window, and the style object of the
   * smallest matching key applies on top, for example `{ '640px': {} }` or
   * `{ '640px': { 'inset-block-end': '4rem' } }`.
   */
  readonly breakpoints = input<Readonly<Record<string, Readonly<Record<string, string>>>> | null>(
    null,
  );

  /** A toast of this outlet closed: the message and the reason (PrimeNG `onClose`). */
  readonly closed = output<StarToastCloseEvent>();

  private readonly viewportWidth = starViewportWidth(() => this.breakpoints() !== null);
  /** Style object of the matching breakpoint; `undefined` on a wide window. */
  protected readonly narrowStyle = computed(() =>
    starBreakpointValue(this.breakpoints(), this.viewportWidth()),
  );

  protected readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly messageSlot = starSlot<StarToastMessageContext>(this.slots, this, 'message');

  protected readonly visible = computed(() =>
    this.toasts
      .messages()
      .filter((message) => message.key === this.key())
      .slice(0, this.stackLimit()),
  );

  constructor() {
    const unregister = this.toasts.registerOutlet(this);
    inject(DestroyRef).onDestroy(() => {
      unregister();
      this.emptyWatch?.disconnect();
    });
    this.toasts.closed.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event.message.key === this.key()) this.closed.emit(event);
    });
    afterRenderEffect({
      write: () => {
        const element = this.host.nativeElement;
        const count = this.visible().length;
        if (typeof element.showPopover !== 'function') return;
        this.emptyWatch?.disconnect();
        if (count === 0) {
          this.hideWhenEmpty(element);
          return;
        }
        // Re-open to move the stack above any dialog opened after it.
        if (element.matches(':popover-open')) element.hidePopover();
        element.showPopover();
      },
    });
  }

  /** Watches the stack while the last toasts leave (`animate.leave`). */
  private emptyWatch: MutationObserver | null = null;

  /**
   * Hides the stack once no toast element is left in it. A closed toast stays in the DOM for
   * its leave motion, and the stack must stay open until it is gone.
   */
  private hideWhenEmpty(element: HTMLElement): void {
    const settled = (): boolean => {
      if (this.visible().length || !element.matches(':popover-open')) return true;
      if (element.querySelector('.star-toast')) return false;
      element.hidePopover();
      return true;
    };
    if (settled() || typeof MutationObserver === 'undefined') return;
    const watch = new MutationObserver(() => {
      if (settled()) watch.disconnect();
    });
    watch.observe(element, { childList: true });
    this.emptyWatch = watch;
  }

  protected messageContext(message: StarToastMessage): StarToastMessageContext {
    return { $implicit: message, close: () => this.toasts.remove(message.id) };
  }

  protected icon(severity: StarToastSeverity): string {
    return ICONS[severity];
  }
}
