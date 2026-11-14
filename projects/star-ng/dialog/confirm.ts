import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Service,
  signal,
  viewChild,
} from '@angular/core';
import { StarButton, StarButtonVariant } from 'star-ng/button';
import { STAR_UI_TEXT } from 'star-ng/core';
import { StarPopover } from 'star-ng/popover';
import { StarDialog } from './dialog';

export interface StarConfirmOptions {
  readonly header: string;
  readonly message: string;
  /** Phosphor icon class, for example `ph-bold ph-warning`. */
  readonly icon?: string;
  readonly acceptLabel?: string;
  readonly rejectLabel?: string;
  readonly acceptVariant?: StarButtonVariant;
  /** Hide the reject button (acknowledge-only dialog). */
  readonly rejectVisible?: boolean;
  /** `reject` (default) puts first focus on the safe choice. */
  readonly defaultFocus?: 'accept' | 'reject';
  /**
   * Anchor element: shows a small popup next to it (PrimeNG `p-confirmpopup`) instead of a
   * modal dialog. Use for low-risk confirmations on a row or button.
   */
  readonly target?: HTMLElement;
}

interface PendingConfirm extends StarConfirmOptions {
  readonly resolve: (accepted: boolean) => void;
}

/**
 * Promise-based confirmation (PrimeNG `ConfirmationService` + `p-confirmdialog` /
 * `p-confirmpopup`). Requests queue; place one `<star-confirm-host />` in the app shell.
 * Pass `target` to anchor a popup to an element instead of opening a dialog.
 *
 * ```ts
 * if (await this.confirm.ask({ header: 'Delete order', message: 'This cannot be undone.',
 *   acceptVariant: 'danger', icon: 'ph-bold ph-trash' })) { ... }
 * ```
 */
@Service()
export class StarConfirmService {
  private readonly queue = signal<readonly PendingConfirm[]>([]);
  readonly current = computed(() => this.queue()[0] ?? null);

  ask(options: StarConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) =>
      this.queue.update((queue) => [...queue, { ...options, resolve }]),
    );
  }

  /** Resolves the visible request. */
  settle(accepted: boolean): void {
    const current = this.current();
    if (!current) return;
    this.queue.update((queue) => queue.slice(1));
    current.resolve(accepted);
  }
}

@Component({
  selector: 'star-confirm-host',
  imports: [StarDialog, StarButton, StarPopover],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let request = dialogRequest();
    @let popup = popupRequest();
    <star-popover #popover [ariaLabel]="popup?.header ?? null" (hidden)="onPopupHidden()">
      @if (popup) {
        <div
          class="star-confirm star-confirm--popup"
          role="alertdialog"
          [attr.aria-label]="popup.header"
        >
          @if (popup.icon) {
            <span class="star-confirm__icon" aria-hidden="true"><i [class]="popup.icon"></i></span>
          }
          <p class="star-confirm__message">{{ popup.message }}</p>
        </div>
        <div class="star-confirm__actions">
          @if (popup.rejectVisible !== false) {
            <star-button size="sm" variant="ghost" (pressed)="confirm.settle(false)">
              {{ popup.rejectLabel ?? text.reject }}
            </star-button>
          }
          <star-button
            size="sm"
            [variant]="popup.acceptVariant ?? 'primary'"
            (pressed)="confirm.settle(true)"
          >
            {{ popup.acceptLabel ?? text.accept }}
          </star-button>
        </div>
      }
    </star-popover>
    <star-dialog
      [role]="'alertdialog'"
      size="sm"
      [visible]="!!request"
      [header]="request ? request.header : ''"
      (visibleChange)="!$event && confirm.settle(false)"
    >
      @if (request) {
        <div class="star-confirm">
          @if (request.icon) {
            <span class="star-confirm__icon" aria-hidden="true"
              ><i [class]="request.icon"></i
            ></span>
          }
          <p class="star-confirm__message">{{ request.message }}</p>
        </div>
      }
      @if (request) {
        <div starDialogFooter class="star-dialog__footer">
          @if (request.rejectVisible !== false) {
            <star-button
              variant="ghost"
              [attr.data-autofocus]="request.defaultFocus !== 'accept' ? '' : null"
              (pressed)="confirm.settle(false)"
            >
              {{ request.rejectLabel ?? text.reject }}
            </star-button>
          }
          <star-button
            [variant]="request.acceptVariant ?? 'primary'"
            [attr.data-autofocus]="request.defaultFocus === 'accept' ? '' : null"
            (pressed)="confirm.settle(true)"
          >
            {{ request.acceptLabel ?? text.accept }}
          </star-button>
        </div>
      }
    </star-dialog>
  `,
})
export class StarConfirmHost {
  protected readonly confirm = inject(StarConfirmService);
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly popover = viewChild.required(StarPopover);

  protected readonly dialogRequest = computed(() => {
    const current = this.confirm.current();
    return current && !current.target ? current : null;
  });
  protected readonly popupRequest = computed(() => {
    const current = this.confirm.current();
    return current?.target ? current : null;
  });
  private shownPopup: StarConfirmOptions | null = null;

  constructor() {
    afterRenderEffect({
      write: () => {
        const request = this.popupRequest();
        const popover = this.popover();
        if (request?.target && request !== this.shownPopup) {
          this.shownPopup = request;
          popover.show(request.target);
        } else if (!request && this.shownPopup) {
          this.shownPopup = null;
          popover.hide();
        }
      },
    });
  }

  /** Outside click or Escape closes the popup: treat as reject. */
  protected onPopupHidden(): void {
    if (this.shownPopup && this.confirm.current() === this.shownPopup) {
      this.shownPopup = null;
      this.confirm.settle(false);
    }
  }
}
