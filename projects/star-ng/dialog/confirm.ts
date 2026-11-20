import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  Directive,
  ElementRef,
  forwardRef,
  inject,
  Service,
  signal,
  viewChild,
} from '@angular/core';
import { StarButton, StarButtonVariant } from '@star-ng/ui/button';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarSlot,
  starSlot,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { StarPopover } from '@star-ng/ui/popover';
import { StarDialog } from './dialog';

export interface StarConfirmOptions {
  /**
   * Title and accessible name of the dialog. The popup (with `target`) does not show it: there
   * the message is the accessible name.
   */
  readonly header?: string;
  readonly message: string;
  /** Phosphor icon class, for example `ph-bold ph-warning`. */
  readonly icon?: string;
  readonly acceptLabel?: string;
  readonly rejectLabel?: string;
  /** Default `primary`, or `danger` when `severity` is `danger`. */
  readonly acceptVariant?: StarButtonVariant;
  /** `danger` marks a destructive question: the accept button gets the danger variant. */
  readonly severity?: 'default' | 'danger';
  /** Hide the reject button (acknowledge-only dialog). */
  readonly rejectVisible?: boolean;
  /** `reject` (default) puts first focus on the safe choice. */
  readonly defaultFocus?: 'accept' | 'reject';
  /**
   * Anchor element: shows a small popup next to it (PrimeNG `p-confirmpopup`) instead of a
   * modal dialog. Use for low-risk confirmations on a row or button.
   */
  readonly target?: HTMLElement | ElementRef<HTMLElement>;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

interface PendingConfirm extends StarConfirmOptions {
  /** `target` as an element, or `null` for a dialog. */
  readonly anchor: HTMLElement | null;
  readonly resolve: (accepted: boolean) => void;
}

/** Context of the confirm message slot: `let-options` gives the options of `ask()`. */
export interface StarConfirmMessageContext {
  readonly $implicit: StarConfirmOptions;
}

/**
 * Replaces the message text of the confirm dialog and popup (PrimeNG `#message` template).
 * Write it inside `star-confirm-host`:
 *
 * ```html
 * <star-confirm-host>
 *   <ng-template starConfirmMessage let-options><strong>{{ options.message }}</strong></ng-template>
 * </star-confirm-host>
 * ```
 */
@Directive({
  selector: 'ng-template[starConfirmMessage]',
  providers: [{ provide: StarSlot, useExisting: StarConfirmMessageTemplate }],
})
export class StarConfirmMessageTemplate extends StarSlot<StarConfirmMessageContext> {
  readonly name = 'confirmMessage';

  static ngTemplateContextGuard(
    _dir: StarConfirmMessageTemplate,
    _ctx: unknown,
  ): _ctx is StarConfirmMessageContext {
    return true;
  }
}

/**
 * Promise-based confirmation (PrimeNG `ConfirmationService` + `p-confirmdialog` /
 * `p-confirmpopup`). Requests queue; place one `<star-confirm-host />` in the app shell.
 * Pass `target` (an element or an `ElementRef`) to anchor a popup to an element instead of
 * opening a dialog.
 *
 * ```ts
 * if (await this.confirm.ask({ header: 'Delete order', message: 'This cannot be undone.',
 *   severity: 'danger', icon: 'ph-bold ph-trash' })) { ... }
 * ```
 */
@Service()
export class StarConfirmService {
  private readonly queue = signal<readonly PendingConfirm[]>([]);
  readonly current = computed(() => this.queue()[0] ?? null);

  ask(options: StarConfirmOptions): Promise<boolean> {
    const target = options.target;
    const anchor = target instanceof ElementRef ? target.nativeElement : (target ?? null);
    return new Promise<boolean>((resolve) =>
      this.queue.update((queue) => [...queue, { ...options, anchor, resolve }]),
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

/**
 * Shows the questions of `StarConfirmService`: a modal `alertdialog`, or a popup next to
 * `target` (PrimeNG `p-confirmdialog` / `p-confirmpopup`). Place one in the app shell.
 */
@Component({
  selector: 'star-confirm-host',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarDialog, StarButton, StarPopover, NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarConfirmHost) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let request = dialogRequest();
    @let popup = popupRequest();
    <ng-template #message let-options>
      @if (messageTemplate(); as template) {
        <ng-container *ngTemplateOutlet="template; context: { $implicit: options }" />
      } @else {
        {{ options.message }}
      }
    </ng-template>
    <star-popover
      #popover
      [role]="'alertdialog'"
      [ariaLabelledby]="popup ? popupMessageId : null"
      (hidden)="onPopupHidden()"
    >
      @if (popup) {
        <!-- Catches Tab from the buttons inside; it is not a control itself. -->
        <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
        <div
          data-star-part="confirmPopup"
          class="star-confirm-popup"
          (keydown.tab)="cycleTab($event)"
          (keydown.shift.tab)="cycleTab($event)"
        >
          <div data-star-part="confirm" class="star-confirm star-confirm--popup">
            @if (popup.icon) {
              <span data-star-part="icon" class="star-confirm__icon" aria-hidden="true"
                ><i data-star-part="severityIcon" [class]="popup.icon"></i
              ></span>
            }
            <div data-star-part="message" class="star-confirm__message" [id]="popupMessageId">
              <ng-container *ngTemplateOutlet="message; context: { $implicit: popup }" />
            </div>
          </div>
          <div data-star-part="actions" class="star-confirm__actions">
            @if (popup.rejectVisible !== false) {
              <star-button
                size="sm"
                variant="ghost"
                [attr.data-autofocus]="focusAccept(popup) ? null : ''"
                (pressed)="answer(false)"
              >
                {{ popup.rejectLabel ?? text.reject }}
              </star-button>
            }
            <star-button
              size="sm"
              [variant]="acceptVariant(popup)"
              [attr.data-autofocus]="focusAccept(popup) ? '' : null"
              (pressed)="answer(true)"
            >
              {{ popup.acceptLabel ?? text.accept }}
            </star-button>
          </div>
        </div>
      }
    </star-popover>
    <star-dialog
      [role]="'alertdialog'"
      size="sm"
      [visible]="!!request"
      [header]="request?.header ?? ''"
      [ariaLabel]="request?.header ? null : (request?.message ?? null)"
      (visibleChange)="!$event && confirm.settle(false)"
    >
      @if (request) {
        <div data-star-part="confirm" class="star-confirm">
          @if (request.icon) {
            <span data-star-part="icon" class="star-confirm__icon" aria-hidden="true"
              ><i data-star-part="severityIcon" [class]="request.icon"></i
            ></span>
          }
          <div data-star-part="message" class="star-confirm__message">
            <ng-container *ngTemplateOutlet="message; context: { $implicit: request }" />
          </div>
        </div>
      }
      @if (request) {
        <div data-star-part="footer" starDialogFooter class="star-dialog__footer">
          @if (request.rejectVisible !== false) {
            <star-button
              variant="ghost"
              [attr.data-autofocus]="focusAccept(request) ? null : ''"
              (pressed)="confirm.settle(false)"
            >
              {{ request.rejectLabel ?? text.reject }}
            </star-button>
          }
          <star-button
            [variant]="acceptVariant(request)"
            [attr.data-autofocus]="focusAccept(request) ? '' : null"
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
  protected readonly popupMessageId = inject(_IdGenerator).getId('star-confirm-message-');
  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly messageTemplate = starSlot<StarConfirmMessageContext>(
    this.slots,
    this,
    'confirmMessage',
  );

  protected readonly dialogRequest = computed(() => {
    const current = this.confirm.current();
    return current && !current.anchor ? current : null;
  });
  protected readonly popupRequest = computed(() => {
    const current = this.confirm.current();
    return current?.anchor ? current : null;
  });
  private shownPopup: PendingConfirm | null = null;

  constructor() {
    afterRenderEffect({
      write: () => {
        const request = this.popupRequest();
        const popover = this.popover();
        if (request?.anchor && request !== this.shownPopup) {
          this.shownPopup = request;
          popover.show(request.anchor);
        } else if (!request && this.shownPopup) {
          this.shownPopup = null;
          popover.hide();
        }
      },
    });
  }

  /** The reject button gets the first focus, unless `defaultFocus` is `accept` or it is hidden. */
  protected focusAccept(options: StarConfirmOptions): boolean {
    return options.defaultFocus === 'accept' || options.rejectVisible === false;
  }

  protected acceptVariant(options: StarConfirmOptions): StarButtonVariant {
    return options.acceptVariant ?? (options.severity === 'danger' ? 'danger' : 'primary');
  }

  /**
   * Tab and Shift+Tab cycle inside the popup. A key handler, not the CDK focus trap: its
   * focusable `aria-hidden` sentinels fail the axe rule `aria-hidden-focus`.
   */
  protected cycleTab(event: Event): void {
    const root = event.currentTarget as HTMLElement;
    const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const backward = (event as KeyboardEvent).shiftKey;
    const edge = backward ? items[0] : items[items.length - 1];
    const active = root.ownerDocument.activeElement;
    if (active === edge || !root.contains(active)) {
      event.preventDefault();
      (backward ? items[items.length - 1] : items[0]).focus();
    }
  }

  /** A popup button: close the popup first, so the focus returns to the target. */
  protected answer(accepted: boolean): void {
    if (this.shownPopup && this.shownPopup === this.confirm.current()) {
      this.shownPopup = null;
      this.popover().hide();
    }
    this.confirm.settle(accepted);
  }

  /** Outside click or Escape closes the popup: treat as reject. */
  protected onPopupHidden(): void {
    if (this.shownPopup && this.confirm.current() === this.shownPopup) {
      this.shownPopup = null;
      this.confirm.settle(false);
    }
  }
}
