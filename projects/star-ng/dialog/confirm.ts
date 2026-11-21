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
  input,
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
  starSlotMap,
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

/** Context of the `starConfirmTemplate` slots. */
export interface StarConfirmTemplateContext {
  /** The options of `ask()`. */
  readonly $implicit: StarConfirmOptions;
  /** Answers the question with yes (for the `footer` slot). */
  readonly accept: () => void;
  /** Answers the question with no (for the `footer` slot). */
  readonly reject: () => void;
}

/**
 * Slot names of `starConfirmTemplate`: `header` (the title of the dialog; PrimeNG `#header`),
 * `icon` (the icon next to the message; `#icon`), `acceptIcon` and `rejectIcon` (an icon in the
 * buttons; `#accepticon`, `#rejecticon`), `footer` (replaces the buttons; `#footer`). The popup
 * has no title, so `header` is for the dialog only.
 */
export type StarConfirmSlotName = 'header' | 'icon' | 'acceptIcon' | 'rejectIcon' | 'footer';

/**
 * Template slot of `star-confirm-host`:
 * `<ng-template starConfirmTemplate="footer" let-options let-accept="accept">…</ng-template>`.
 * The icons are decorative (`aria-hidden`). Buttons in `footer` must call `accept` or `reject`;
 * put `data-autofocus` on the one that gets the first focus.
 */
@Directive({
  selector: 'ng-template[starConfirmTemplate]',
  providers: [{ provide: StarSlot, useExisting: StarConfirmTemplate }],
})
export class StarConfirmTemplate extends StarSlot<StarConfirmTemplateContext> {
  readonly name = 'confirmTemplate';
  readonly starConfirmTemplate = input.required<StarConfirmSlotName>();

  override slotKey(): string {
    return this.starConfirmTemplate();
  }

  static ngTemplateContextGuard(
    _dir: StarConfirmTemplate,
    _ctx: unknown,
  ): _ctx is StarConfirmTemplateContext {
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
 *
 * Slots (content children): `starConfirmMessage` (the message), `starConfirmTemplate` with
 * `header`, `icon`, `acceptIcon`, `rejectIcon` and `footer`.
 *
 * PrimeNG names that star-ng covers in another way: the options of `ask()` (`header`, `message`,
 * `icon`, `acceptLabel`, `rejectLabel`, `rejectVisible`, `defaultFocus`, `target`), `acceptIcon`
 * and `rejectIcon` = the slots, `style` and `styleClass` = `pt`. Not applicable: `appendTo`,
 * `autoZIndex`, `baseZIndex` (top layer), `key` (one host shows the queue), `blockScroll`,
 * `modal`, `focusTrap` (the native modal dialog does it), `rtl` (the direction of the page).
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
    <ng-template #icon let-options>
      @if (parts().get('icon'); as custom) {
        <span data-star-part="icon" class="star-confirm__icon" aria-hidden="true">
          <ng-container *ngTemplateOutlet="custom; context: context(options)" />
        </span>
      } @else if (options.icon) {
        <span data-star-part="icon" class="star-confirm__icon" aria-hidden="true"
          ><i data-star-part="severityIcon" [class]="options.icon"></i
        ></span>
      }
    </ng-template>
    <ng-template #buttonIcon let-options let-kind="kind">
      @if (parts().get(kind); as custom) {
        <span data-star-part="buttonIcon" class="star-confirm__button-icon" aria-hidden="true">
          <ng-container *ngTemplateOutlet="custom; context: context(options)" />
        </span>
      }
    </ng-template>
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
          data-star-part="popupPanel"
          class="star-confirm-popup"
          (keydown.tab)="cycleTab($event)"
          (keydown.shift.tab)="cycleTab($event)"
        >
          <div data-star-part="dialogPanel" class="star-confirm star-confirm--popup">
            <ng-container *ngTemplateOutlet="icon; context: { $implicit: popup }" />
            <div data-star-part="messageText" class="star-confirm__message" [id]="popupMessageId">
              <ng-container *ngTemplateOutlet="message; context: { $implicit: popup }" />
            </div>
          </div>
          <div data-star-part="actionList" class="star-confirm__actions">
            @if (parts().get('footer'); as custom) {
              <ng-container *ngTemplateOutlet="custom; context: context(popup)" />
            } @else {
              @if (popup.rejectVisible !== false) {
                <star-button
                  size="sm"
                  variant="ghost"
                  [attr.data-autofocus]="focusAccept(popup) ? null : ''"
                  (pressed)="answer(false)"
                >
                  <ng-container
                    *ngTemplateOutlet="
                      buttonIcon;
                      context: { $implicit: popup, kind: 'rejectIcon' }
                    "
                  />
                  {{ popup.rejectLabel ?? text.reject }}
                </star-button>
              }
              <star-button
                size="sm"
                [variant]="acceptVariant(popup)"
                [attr.data-autofocus]="focusAccept(popup) ? '' : null"
                (pressed)="answer(true)"
              >
                <ng-container
                  *ngTemplateOutlet="buttonIcon; context: { $implicit: popup, kind: 'acceptIcon' }"
                />
                {{ popup.acceptLabel ?? text.accept }}
              </star-button>
            }
          </div>
        </div>
      }
    </star-popover>
    <star-dialog
      [role]="'alertdialog'"
      size="sm"
      [visible]="!!request"
      [header]="parts().get('header') ? '' : (request?.header ?? '')"
      [ariaLabel]="
        request?.header && !parts().get('header')
          ? null
          : request?.header || request?.message || null
      "
      (visibleChange)="!$event && confirm.settle(false)"
    >
      @if (request) {
        @if (parts().get('header'); as custom) {
          <div data-star-part="headerPanel" starDialogHeader class="star-confirm__header">
            <ng-container *ngTemplateOutlet="custom; context: context(request)" />
          </div>
        }
      }
      @if (request) {
        <div data-star-part="dialogPanel" class="star-confirm">
          <ng-container *ngTemplateOutlet="icon; context: { $implicit: request }" />
          <div data-star-part="messageText" class="star-confirm__message">
            <ng-container *ngTemplateOutlet="message; context: { $implicit: request }" />
          </div>
        </div>
      }
      @if (request) {
        <div data-star-part="footer" starDialogFooter class="star-dialog__footer">
          @if (parts().get('footer'); as custom) {
            <ng-container *ngTemplateOutlet="custom; context: context(request)" />
          } @else {
            @if (request.rejectVisible !== false) {
              <star-button
                variant="ghost"
                [attr.data-autofocus]="focusAccept(request) ? null : ''"
                (pressed)="confirm.settle(false)"
              >
                <ng-container
                  *ngTemplateOutlet="
                    buttonIcon;
                    context: { $implicit: request, kind: 'rejectIcon' }
                  "
                />
                {{ request.rejectLabel ?? text.reject }}
              </star-button>
            }
            <star-button
              [variant]="acceptVariant(request)"
              [attr.data-autofocus]="focusAccept(request) ? '' : null"
              (pressed)="confirm.settle(true)"
            >
              <ng-container
                *ngTemplateOutlet="buttonIcon; context: { $implicit: request, kind: 'acceptIcon' }"
              />
              {{ request.acceptLabel ?? text.accept }}
            </star-button>
          }
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
  protected readonly parts = starSlotMap<StarConfirmTemplateContext>(
    this.slots,
    this,
    'confirmTemplate',
  );

  /** Context of the `starConfirmTemplate` slots for one request. */
  protected context(options: StarConfirmOptions): StarConfirmTemplateContext {
    return {
      $implicit: options,
      accept: () => this.answer(true),
      reject: () => this.answer(false),
    };
  }

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
