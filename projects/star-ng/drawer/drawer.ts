import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { StarDialogBase } from '@star-ng/ui/dialog';

/**
 * Drawer (PrimeNG `p-drawer`): side sheet on the native `<dialog>` element. Same API as
 * `star-dialog` (`[(visible)]`, `header`, `modal`, `dismissableMask`, `closeOnEscape`, footer slot)
 * plus `position` and a CSS `size`. `left` and `right` are the physical edges of the screen, as in
 * CSS; `start` and `end` follow the writing direction (`end` is the right edge in LTR and the left
 * edge in RTL). Use `start` / `end` for a drawer that must switch sides in right-to-left.
 *
 * `<star-drawer [(visible)]="detailsOpen" header="ORD-1042" position="right" size="32rem">…</star-drawer>`
 *
 * Modes: a modal drawer (default) has a backdrop, traps the focus and blocks the page scroll.
 * `modal=false` opens it with `show()`: no backdrop, the page stays usable. `fullScreen` covers the
 * whole window. `dismissible` or `dismissableMask` close it on a backdrop click.
 */
@Component({
  selector: 'star-drawer',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Backdrop click only; keyboard users close with Escape (native cancel event). -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
    <dialog
      data-star-part="frame"
      #dialog
      class="star-drawer"
      [class]="'star-drawer star-drawer--' + position()"
      [class.star-dialog--modal]="modal()"
      [class.star-drawer--full]="fullScreen()"
      [class.star-dialog--block-scroll]="scrollBlocked()"
      [attr.tabindex]="focusOnShow() ? null : -1"
      [style.--star-drawer-size]="drawerSize()"
      [attr.aria-labelledby]="labelledBy()"
      [attr.aria-label]="label()"
      (cancel)="onCancel($event)"
      (close)="onNativeClose()"
      (click)="onDialogClick($event)"
    >
      <div data-star-part="surface" class="star-dialog__surface">
        @if (showHeader()) {
          <header data-star-part="header" class="star-dialog__header">
            <div data-star-part="headingPanel" class="star-dialog__heading">
              @if (header()) {
                <h2 data-star-part="titleText" class="star-dialog__title" [id]="headerId">
                  {{ header() }}
                </h2>
              }
              <ng-content select="[starDialogHeader]" />
            </div>
            @if (closable()) {
              <button
                data-star-part="closeButton"
                type="button"
                class="star-btn star-btn--ghost star-btn--icon star-dialog__close"
                [attr.aria-label]="text.close"
                (click)="close()"
              >
                <i data-star-part="closeIcon" class="ph-bold ph-x" aria-hidden="true"></i>
              </button>
            }
          </header>
        }
        <div data-star-part="body" class="star-dialog__body"><ng-content /></div>
        <ng-content select="[starDialogFooter]" />
      </div>
    </dialog>
  `,
})
export class StarDrawer extends StarDialogBase {
  /**
   * Edge of the window (PrimeNG `position`). `start` and `end` follow the writing direction;
   * `left` and `right` are physical. Default `'right'`.
   */
  readonly position = input<'left' | 'right' | 'start' | 'end' | 'top' | 'bottom'>('right');
  /** Width (left / right / start / end) or height (top / bottom). */
  readonly drawerSize = input('28rem');
  /** Covers the whole window (PrimeNG `fullScreen`). The drawer still slides in from its edge. */
  readonly fullScreen = input(false, { transform: booleanAttribute });
  /**
   * A click on the backdrop closes the drawer (PrimeNG `dismissible`). Same effect as
   * `dismissableMask`. The default is false, which differs from PrimeNG (default true): a drawer
   * without `dismissible` or `dismissableMask` stays open on a backdrop click.
   */
  readonly dismissible = input(false, { transform: booleanAttribute });

  protected override closesOnBackdrop(): boolean {
    return this.dismissible() || this.dismissableMask();
  }
}
