import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  Directive,
  forwardRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarIconContext,
  StarSlot,
  starSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';

export type StarMessageSeverity = 'success' | 'info' | 'warn' | 'error';

const ICONS: Record<StarMessageSeverity, string> = {
  success: 'ph-fill ph-check-circle',
  info: 'ph-fill ph-info',
  warn: 'ph-fill ph-warning',
  error: 'ph-fill ph-warning-circle',
};

/** Context of the `starMessageContainer` slot. */
export interface StarMessageContainerContext {
  /** Closes the message (and emits `closed`). */
  readonly $implicit: () => void;
  /** The same function, by name: `let-close="close"`. */
  readonly close: () => void;
}

/**
 * Replaces the whole content of `star-message` (icon, text and close button). `let-close` closes
 * the message. PrimeNG `#container`. The host keeps its `status` or `alert` role.
 */
@Directive({
  selector: 'ng-template[starMessageContainer]',
  providers: [{ provide: StarSlot, useExisting: StarMessageContainer }],
})
export class StarMessageContainer extends StarSlot<StarMessageContainerContext> {
  readonly name = 'messageContainer';

  static ngTemplateContextGuard(
    _dir: StarMessageContainer,
    _ctx: unknown,
  ): _ctx is StarMessageContainerContext {
    return true;
  }
}

/**
 * Inline message (PrimeNG `p-message`): severity, icon, optional close and auto-hide `life`.
 * `<star-message severity="warn" closable>Draft not saved.</star-message>`
 *
 * Slots (content children): `starMessageContainer` (the whole content), `starIcon` with `icon`
 * (the severity icon) and `close` (the icon of the close button). PrimeNG `#container`, `#icon`,
 * `#closeicon`.
 *
 * PrimeNG names that star-ng covers in another way: `onClose` = `closed`, `closeIcon` = the
 * `close` icon slot, the default content = the text. Not applicable: `motionOptions` (theme
 * motion).
 */
@Component({
  selector: 'star-message',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarMessage) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]':
      "'star-message star-message--' + severity() + ' star-message--' + variant() + (size() === 'md' ? '' : ' star-message--' + size())",
    '[attr.role]': "severity() === 'error' ? 'alert' : 'status'",
    '[hidden]': '!visible()',
  },
  template: `
    @if (container(); as custom) {
      <ng-container *ngTemplateOutlet="custom; context: closeContext" />
    } @else {
      @if (icons().get('icon'); as custom) {
        <span data-star-part="icon" class="star-message__icon" aria-hidden="true">
          <ng-container *ngTemplateOutlet="custom; context: iconContext" />
        </span>
      } @else {
        <i
          data-star-part="icon"
          class="star-message__icon"
          [class]="iconClass()"
          aria-hidden="true"
        ></i>
      }
      <div data-star-part="text" class="star-message__text"><ng-content /></div>
      @if (closable()) {
        <button
          data-star-part="closeButton"
          type="button"
          class="star-message__close"
          [attr.aria-label]="text.close"
          (click)="close()"
        >
          @if (icons().get('close'); as custom) {
            <span data-star-part="closeIcon" aria-hidden="true">
              <ng-container *ngTemplateOutlet="custom; context: iconContext" />
            </span>
          } @else {
            <i data-star-part="closeIcon" class="ph-bold ph-x" aria-hidden="true"></i>
          }
        </button>
      }
    }
  `,
})
export class StarMessage implements OnInit {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly destroyRef = inject(DestroyRef);

  readonly severity = input<StarMessageSeverity>('info');
  readonly variant = input<'soft' | 'outlined'>('soft');
  /** `'sm'`, `'md'` (default) or `'lg'`: text size and padding. PrimeNG `size`. */
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly icon = input<string | null>(null);
  readonly closable = input(false, { transform: booleanAttribute });
  /** Milliseconds before the message hides itself (0 = stays). */
  readonly life = input(0);
  readonly closed = output<void>();

  protected readonly visible = signal(true);
  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly container = starSlot<StarMessageContainerContext>(
    this.slots,
    this,
    'messageContainer',
  );
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly iconContext: StarIconContext = {};
  protected readonly closeContext: StarMessageContainerContext = {
    $implicit: () => this.close(),
    close: () => this.close(),
  };
  protected readonly iconClass = computed(() => this.icon() ?? ICONS[this.severity()]);

  ngOnInit(): void {
    const life = this.life();
    if (life > 0) {
      const timer = setTimeout(() => this.close(), life);
      this.destroyRef.onDestroy(() => clearTimeout(timer));
    }
  }

  close(): void {
    this.visible.set(false);
    this.closed.emit();
  }
}
