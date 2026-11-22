import { _IdGenerator } from '@angular/cdk/a11y';
import { Directionality } from '@angular/cdk/bidi';
import {
  ConnectedPosition,
  createFlexibleConnectedPositionStrategy,
  createOverlayRef,
  createRepositionScrollStrategy,
  OverlayRef,
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  contentChildren,
  DestroyRef,
  forwardRef,
  inject,
  Injector,
  input,
  output,
  signal,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import {
  STAR_SLOT_HOST,
  StarDirectionService,
  StarPart,
  StarSlot,
  starSlot,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { Subscription } from 'rxjs';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

// `start` and `end` are turned around by the CDK in right-to-left: the popover aligns with the
// start edge of its anchor in both directions.
const POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -8 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 },
];

/**
 * Popover (PrimeNG `p-popover`, formerly OverlayPanel): rich floating content anchored to an
 * element. Native popover (top layer, works in dialogs), closes on outside click and Escape,
 * moves focus in and back to the anchor. Put `data-autofocus` on the element that should get the
 * first focus; without it the first focusable element gets it.
 *
 * ```html
 * <star-button #anchor (pressed)="info.toggle($event)">Details</star-button>
 * <star-popover #info ariaLabel="Order details">…</star-popover>
 * ```
 *
 * Slots (content children): `starHeader` adds a header above the content (PrimeNG has no header
 * template; this matches the `header` of the other overlays).
 *
 * PrimeNG names that star-ng covers in another way: `onShow` / `onHide` = `shown` / `hidden`, the
 * `content` template = the projected content, `ariaCloseLabel` = put your own close button in the
 * content. Not applicable: `appendTo`, `autoZIndex`, `baseZIndex` (top layer), `motionOptions`
 * (theme motion, off with reduced motion).
 */
@Component({
  selector: 'star-popover',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarPopover) }],
  // The host draws nothing in place: the panel opens in the top layer. Without a box it is never
  // a flex or grid item, so it takes no gap. Inline, so it holds without the stylesheet and in
  // the unstyled mode; `pt.root.style` can still override it. A consumer who set the display of
  // the host with a CSS class must now use `pt.root.style`, `[style]` or `!important`.
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #panel>
      <div
        starPart="surface"
        class="star-popover"
        tabindex="-1"
        [id]="panelId"
        [attr.role]="role()"
        [attr.aria-modal]="role() === 'alertdialog' ? 'false' : null"
        [attr.aria-label]="ariaLabelledby() ? null : ariaLabel()"
        [attr.aria-labelledby]="ariaLabelledby()"
        (keydown.escape)="closeOnEscape() && hide()"
      >
        @if (headerSlot(); as header) {
          <div data-star-part="headerPanel" class="star-popover__header star-panel__header">
            <ng-container *ngTemplateOutlet="header" />
          </div>
        }
        <ng-content />
      </div>
    </ng-template>
  `,
})
export class StarPopover {
  private readonly injector = inject(Injector);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly directionality = inject(Directionality);
  readonly panelId = inject(_IdGenerator).getId('star-popover-');

  readonly ariaLabel = input<string | null>(null);
  /** Id of the element that names the popover. Wins over `ariaLabel`. */
  readonly ariaLabelledby = input<string | null>(null);
  /** `alertdialog` for a question that needs an answer (the confirm popup). */
  readonly role = input<'dialog' | 'alertdialog'>('dialog');
  /** Moves focus into the popover when it opens. */
  readonly focusOnShow = input(true, { transform: booleanAttribute });
  /** A click outside closes the popover (default `true`). PrimeNG `dismissable`. */
  readonly dismissable = input(true, { transform: booleanAttribute });
  /**
   * Escape closes the popover (default `true`). PrimeNG `closeOnEscape`. With `false`, put a close
   * button in the content, so keyboard users can close it.
   */
  readonly closeOnEscape = input(true, { transform: booleanAttribute });

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly headerSlot = starSlot<object>(this.slots, this, 'header');

  readonly shown = output<void>();
  readonly hidden = output<void>();

  readonly visible = signal(false);
  private readonly panel = viewChild.required<TemplateRef<unknown>>('panel');
  private overlayRef: OverlayRef | null = null;
  private anchor: HTMLElement | null = null;
  private outside: Subscription | null = null;

  constructor() {
    // Keeps the CDK direction in step with the page, so a popover opened after a switch is flipped.
    inject(StarDirectionService);
    inject(DestroyRef).onDestroy(() => {
      this.outside?.unsubscribe();
      this.overlayRef?.dispose();
    });
  }

  /** Opens on the event's current target (or a given element), or closes when open. */
  toggle(target: Event | HTMLElement): void {
    if (this.visible()) this.hide();
    else this.show(target);
  }

  show(target: Event | HTMLElement): void {
    const anchor =
      target instanceof Event ? ((target.currentTarget ?? target.target) as HTMLElement) : target;
    if (!anchor) return;
    if (this.visible()) this.hide(false);
    this.anchor = anchor;
    const strategy = createFlexibleConnectedPositionStrategy(this.injector, anchor)
      .withPositions(POSITIONS)
      .withPush(true)
      .withViewportMargin(8);
    this.overlayRef ??= createOverlayRef(this.injector, {
      positionStrategy: strategy,
      scrollStrategy: createRepositionScrollStrategy(this.injector),
      direction: this.directionality,
      usePopover: true,
    });
    this.overlayRef.updatePositionStrategy(strategy);
    this.overlayRef.attach(new TemplatePortal(this.panel(), this.viewContainer));
    this.outside = this.overlayRef.outsidePointerEvents().subscribe((event) => {
      if (this.dismissable() && !anchor.contains(event.target as Node)) this.hide(false);
    });
    anchor.setAttribute('aria-expanded', 'true');
    anchor.setAttribute('aria-controls', this.panelId);
    this.visible.set(true);
    this.shown.emit();
    if (this.focusOnShow()) {
      afterNextRender(
        () => {
          const root = this.overlayRef?.overlayElement.querySelector<HTMLElement>('.star-popover');
          // `data-autofocus` marks the element (or a component around it) that gets the focus.
          const marked = root?.querySelector<HTMLElement>('[data-autofocus]');
          const first = marked?.matches(FOCUSABLE)
            ? marked
            : (marked ?? root)?.querySelector<HTMLElement>(FOCUSABLE);
          (first ?? root)?.focus();
        },
        { injector: this.injector },
      );
    }
  }

  /** Closes; returns focus to the anchor when focus was inside the popover. */
  hide(restoreFocus = true): void {
    if (!this.visible() || !this.overlayRef) return;
    const hadFocus = this.overlayRef.overlayElement.contains(document.activeElement);
    this.overlayRef.detach();
    this.anchor?.setAttribute('aria-expanded', 'false');
    this.outside?.unsubscribe();
    if (restoreFocus && hadFocus && this.anchor) {
      const focusable = this.anchor.matches('button, a, input, [tabindex]')
        ? this.anchor
        : (this.anchor.querySelector<HTMLElement>('button, a, input') ?? this.anchor);
      focusable.focus();
    }
    this.visible.set(false);
    this.hidden.emit();
  }

  /** Re-positions after content size changes. */
  align(): void {
    this.overlayRef?.updatePosition();
  }
}
