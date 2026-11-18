import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { StarDialogBase } from '@star-ng/ui/dialog';

/**
 * Drawer (PrimeNG `p-drawer`): side sheet on the native `<dialog>` element. Same API as
 * `star-dialog` (`[(visible)]`, `header`, `modal`, `dismissableMask`, `closeOnEscape`, footer slot)
 * plus `position` and a CSS `size`. `left` and `right` are the physical edges of the screen, as in
 * CSS; `start` and `end` follow the writing direction (`end` is the right edge in LTR and the left
 * edge in RTL). Use `start` / `end` for a drawer that must switch sides in right-to-left.
 *
 * `<star-drawer [(visible)]="detailsOpen" header="ORD-1042" position="right" size="32rem">…</star-drawer>`
 */
@Component({
  selector: 'star-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Backdrop click only; keyboard users close with Escape (native cancel event). -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
    <dialog
      #dialog
      class="star-drawer"
      [class]="'star-drawer star-drawer--' + position()"
      [class.star-dialog--modal]="modal()"
      [class.star-dialog--block-scroll]="scrollBlocked()"
      [attr.tabindex]="focusOnShow() ? null : -1"
      [style.--star-drawer-size]="drawerSize()"
      [attr.aria-labelledby]="labelledBy()"
      [attr.aria-label]="label()"
      (cancel)="onCancel($event)"
      (close)="onNativeClose()"
      (click)="onDialogClick($event)"
    >
      <div class="star-dialog__surface">
        @if (showHeader()) {
          <header class="star-dialog__header">
            <div class="star-dialog__heading">
              @if (header()) {
                <h2 class="star-dialog__title" [id]="headerId">{{ header() }}</h2>
              }
              <ng-content select="[starDialogHeader]" />
            </div>
            @if (closable()) {
              <button
                type="button"
                class="star-btn star-btn--ghost star-btn--icon star-dialog__close"
                [attr.aria-label]="text.close"
                (click)="close()"
              >
                <i class="ph-bold ph-x" aria-hidden="true"></i>
              </button>
            }
          </header>
        }
        <div class="star-dialog__body"><ng-content /></div>
        <ng-content select="[starDialogFooter]" />
      </div>
    </dialog>
  `,
})
export class StarDrawer extends StarDialogBase {
  readonly position = input<'left' | 'right' | 'start' | 'end' | 'top' | 'bottom'>('right');
  /** Width (left / right / start / end) or height (top / bottom). */
  readonly drawerSize = input('28rem');
}
