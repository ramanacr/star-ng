import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  Service,
  signal,
} from '@angular/core';
import { STAR_UI_TEXT } from 'star-ng/core';

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
  private readonly items = signal<readonly StarToastMessage[]>([]);
  private readonly timers = new Map<number, Timer>();
  private nextId = 1;

  readonly messages = this.items.asReadonly();
  /** Identical summary + detail while still visible is ignored. */
  preventDuplicates = true;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  show(options: StarToastOptions): number {
    const severity = options.severity ?? 'info';
    if (this.preventDuplicates) {
      const duplicate = this.items().find(
        (item) =>
          item.summary === options.summary &&
          item.detail === options.detail &&
          item.severity === severity &&
          item.key === options.key,
      );
      if (duplicate) return duplicate.id;
    }
    const message: StarToastMessage = {
      id: this.nextId++,
      severity,
      summary: options.summary,
      detail: options.detail,
      life: options.life ?? 5000,
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

  remove(id: number): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer.handle);
    this.timers.delete(id);
    this.items.update((items) => items.filter((item) => item.id !== id));
  }

  /** Removes all messages, or only those of one `key`. */
  clear(key?: string): void {
    for (const item of this.items()) {
      if (key === undefined || item.key === key) this.remove(item.id);
    }
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
      handle: setTimeout(() => this.remove(id), ms),
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
 */
@Component({
  selector: 'star-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-toast-stack',
    popover: 'manual',
    '[class]': "'star-toast-stack star-toast-stack--' + position()",
    '[attr.aria-label]': 'text.notifications',
    role: 'region',
  },
  template: `
    @for (message of visible(); track message.id) {
      <div
        class="star-toast"
        [class]="'star-toast star-toast--' + message.severity"
        [attr.role]="message.severity === 'error' ? 'alert' : 'status'"
        (mouseenter)="toasts.pause(message.id)"
        (mouseleave)="toasts.resume(message.id)"
        (focusin)="toasts.pause(message.id)"
        (focusout)="toasts.resume(message.id)"
      >
        <i class="star-toast__icon" [class]="icon(message.severity)" aria-hidden="true"></i>
        <div class="star-toast__copy">
          <p class="star-toast__summary">{{ message.summary }}</p>
          @if (message.detail) {
            <p class="star-toast__detail">{{ message.detail }}</p>
          }
        </div>
        <button
          type="button"
          class="star-toast__close"
          [attr.aria-label]="text.close"
          (click)="toasts.remove(message.id)"
        >
          <i class="ph-bold ph-x" aria-hidden="true"></i>
        </button>
      </div>
    }
  `,
})
export class StarToast {
  protected readonly toasts = inject(StarToastService);
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Corner of the screen. `-left` and `-right` are physical; `-start` and `-end` follow the
   * writing direction (the start corner is on the right in right-to-left).
   */
  readonly position = input<
    | 'top-right'
    | 'top-left'
    | 'top-start'
    | 'top-end'
    | 'top-center'
    | 'bottom-right'
    | 'bottom-left'
    | 'bottom-start'
    | 'bottom-end'
    | 'bottom-center'
  >('top-right');
  readonly key = input<string | undefined>(undefined);
  /** Newest messages beyond this count wait until older ones close. */
  readonly stackLimit = input(5);

  protected readonly visible = computed(() =>
    this.toasts
      .messages()
      .filter((message) => message.key === this.key())
      .slice(0, this.stackLimit()),
  );

  constructor() {
    afterRenderEffect({
      write: () => {
        const element = this.host.nativeElement;
        const count = this.visible().length;
        if (typeof element.showPopover !== 'function') return;
        // Re-open to move the stack above any dialog opened after it.
        if (element.matches(':popover-open')) element.hidePopover();
        if (count > 0) element.showPopover();
      },
    });
  }

  protected icon(severity: StarToastSeverity): string {
    return ICONS[severity];
  }
}
