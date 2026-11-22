import { _IdGenerator } from '@angular/cdk/a11y';
import { Directionality } from '@angular/cdk/bidi';
import {
  ConnectedPosition,
  createFlexibleConnectedPositionStrategy,
  createOverlayRef,
  createRepositionScrollStrategy,
  OverlayRef,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { StarDirectionService, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';

/**
 * Side of the host. `left` and `right` are the physical sides of the screen, as in CSS;
 * `start` and `end` follow the writing direction (`start` is the right side in right-to-left).
 */
export type StarTooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'start' | 'end';

const VERTICAL: Record<'top' | 'bottom', ConnectedPosition[]> = {
  top: [
    { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
    { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
  ],
  bottom: [
    { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
    { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
  ],
};

/**
 * Candidate places of the tooltip, the preferred one first. The CDK turns `start` and `end` around
 * in right-to-left but adds `offsetX` as it is, so a physical side needs the matching origin:
 * the left edge of the host is its `end` in right-to-left.
 */
function positionsFor(position: StarTooltipPosition, rtl: boolean): ConnectedPosition[] {
  if (position === 'top' || position === 'bottom') return VERTICAL[position];
  const physical =
    position === 'start'
      ? rtl
        ? 'right'
        : 'left'
      : position === 'end'
        ? rtl
          ? 'left'
          : 'right'
        : position;
  const left: ConnectedPosition = {
    originX: rtl ? 'end' : 'start',
    originY: 'center',
    overlayX: rtl ? 'start' : 'end',
    overlayY: 'center',
    offsetX: -8,
  };
  const right: ConnectedPosition = {
    originX: rtl ? 'start' : 'end',
    originY: 'center',
    overlayX: rtl ? 'end' : 'start',
    overlayY: 'center',
    offsetX: 8,
  };
  return physical === 'left' ? [left, right] : [right, left];
}

@Component({
  selector: 'star-tooltip-panel',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-tooltip',
    role: 'tooltip',
    '[id]': 'id()',
    'animate.leave': 'star-tooltip--leaving',
  },
  template: `{{ text() }}`,
})
export class StarTooltipPanel {
  readonly text = signal('');
  readonly id = signal('');
}

/**
 * Tooltip (PrimeNG `pTooltip`): shows on hover and keyboard focus, hides on Escape, links the
 * host with `aria-describedby`. Rendered as a native popover so it appears above dialogs.
 *
 * `<button starTooltip="Export to CSV" starTooltipPosition="bottom">…</button>`
 */
@Directive({
  selector: '[starTooltip]',
  host: {
    '(mouseenter)': 'scheduleShow()',
    '(mouseleave)': 'scheduleHide()',
    '(focusin)': 'scheduleShow()',
    '(focusout)': 'scheduleHide()',
    '(keydown.escape)': 'hide()',
    '[attr.aria-describedby]': 'describedBy()',
  },
})
export class StarTooltip {
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly panelId = inject(_IdGenerator).getId('star-tooltip-');
  private readonly directionality = inject(Directionality);

  readonly starTooltip = input('');
  readonly starTooltipPosition = input<StarTooltipPosition>('top');
  readonly starTooltipShowDelay = input(300, { transform: numberAttribute });
  readonly starTooltipHideDelay = input(0, { transform: numberAttribute });
  readonly starTooltipDisabled = input(false, { transform: booleanAttribute });

  protected readonly describedBy = signal<string | null>(null);

  private overlayRef: OverlayRef | null = null;
  private panelRef: ComponentRef<StarTooltipPanel> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Keeps the CDK direction in step with the page, so a tooltip opened after a switch is flipped.
    inject(StarDirectionService);
    effect(() => {
      const text = this.starTooltip();
      if (this.panelRef) this.panelRef.instance.text.set(text);
      if ((!text || this.starTooltipDisabled()) && this.panelRef) this.hide();
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      this.overlayRef?.dispose();
    });
  }

  protected scheduleShow(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.show(), this.starTooltipShowDelay());
  }

  protected scheduleHide(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.hide(), this.starTooltipHideDelay());
  }

  show(): void {
    if (!this.starTooltip() || this.starTooltipDisabled() || this.panelRef) return;
    const strategy = createFlexibleConnectedPositionStrategy(this.injector, this.host)
      .withPositions(positionsFor(this.starTooltipPosition(), this.directionality.value === 'rtl'))
      .withPush(true)
      .withViewportMargin(8);
    this.overlayRef ??= createOverlayRef(this.injector, {
      positionStrategy: strategy,
      scrollStrategy: createRepositionScrollStrategy(this.injector),
      direction: this.directionality,
      usePopover: true,
      panelClass: 'star-tooltip-pane',
    });
    this.overlayRef.updatePositionStrategy(strategy);
    this.panelRef = this.overlayRef.attach(new ComponentPortal(StarTooltipPanel));
    this.panelRef.instance.text.set(this.starTooltip());
    this.panelRef.instance.id.set(this.panelId);
    this.describedBy.set(this.panelId);
  }

  hide(): void {
    clearTimeout(this.timer);
    if (!this.panelRef) return;
    this.overlayRef?.detach();
    this.panelRef = null;
    this.describedBy.set(null);
  }
}
