import { _IdGenerator } from '@angular/cdk/a11y';
import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { STAR_UI_TEXT } from '@star-ng/ui/core';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export type StarDialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * Dialog (PrimeNG `p-dialog`) built on the native `<dialog>` element: top-layer rendering,
 * focus trap, focus restore and Escape handling come from the browser. Entry / exit animate
 * with `@starting-style`; page scroll locks with `:has(dialog[open])`.
 *
 * ```html
 * <star-dialog [(visible)]="editOpen" header="Edit order" size="lg">
 *   ...body...
 *   <div starDialogFooter>
 *     <star-button variant="ghost" (pressed)="editOpen.set(false)">Cancel</star-button>
 *     <star-button (pressed)="save()">Save</star-button>
 *   </div>
 * </star-dialog>
 * ```
 * Put `autofocus` (native elements) or `data-autofocus` (components) on the element that
 * should receive focus first.
 */
@Component({
  selector: 'star-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Backdrop click only; keyboard users close with Escape (native cancel event). -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
    <dialog
      #dialog
      class="star-dialog"
      [class]="'star-dialog--' + size()"
      [class.star-dialog--modal]="modal()"
      [style.width]="width()"
      [attr.aria-labelledby]="header() ? headerId : null"
      [attr.aria-label]="header() ? null : ariaLabel()"
      [attr.role]="role()"
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
export class StarDialog {
  protected readonly text = inject(STAR_UI_TEXT);

  readonly visible = model(false);
  readonly header = input('');
  readonly size = input<StarDialogSize>('md');
  /** Fixed CSS width; overrides `size`. */
  readonly width = input<string | null>(null);
  /** Modal blocks the page behind (backdrop). Non-modal dialogs float above it. */
  readonly modal = input(true, { transform: booleanAttribute });
  readonly closable = input(true, { transform: booleanAttribute });
  readonly closeOnEscape = input(true, { transform: booleanAttribute });
  /** Clicking the backdrop closes the dialog. */
  readonly dismissableMask = input(false, { transform: booleanAttribute });
  readonly showHeader = input(true, { transform: booleanAttribute });
  readonly role = input<'dialog' | 'alertdialog'>('dialog');
  readonly ariaLabel = input<string | null>(null);

  readonly shown = output<void>();
  readonly hidden = output<void>();

  protected readonly headerId = inject(_IdGenerator).getId('star-dialog-title-');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private isOpen = false;

  constructor() {
    afterRenderEffect({
      write: () => {
        const element = this.dialog().nativeElement;
        const visible = this.visible();
        if (visible && !element.open) {
          if (this.modal()) element.showModal?.();
          else element.show?.();
          this.isOpen = true;
          this.focusInitial(element);
          this.shown.emit();
        } else if (!visible && element.open) {
          element.close();
          // Do not wait for the native 'close' event: some hosts (background or embedded
          // browsers) deliver it late or not at all.
          this.markHidden();
        }
      },
    });
  }

  close(): void {
    this.visible.set(false);
  }

  /**
   * Native `autofocus` only works on focusable elements. `data-autofocus` also works on a
   * wrapper component such as `<star-button data-autofocus>`: its first focusable child gets focus.
   */
  private focusInitial(element: HTMLDialogElement): void {
    const marked = element.querySelector<HTMLElement>('[data-autofocus]');
    if (!marked) return;
    const target = marked.matches(FOCUSABLE)
      ? marked
      : marked.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
  }

  protected onCancel(event: Event): void {
    // We own the state: never let the browser close without updating `visible`.
    event.preventDefault();
    if (this.closeOnEscape() && this.closable()) this.close();
  }

  /** Browser-initiated close (for example a form with method="dialog"). */
  protected onNativeClose(): void {
    if (this.visible()) this.visible.set(false);
    this.markHidden();
  }

  /** Emits `hidden` once per open. */
  private markHidden(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.hidden.emit();
  }

  protected onDialogClick(event: MouseEvent): void {
    // A click whose target is the <dialog> itself landed on the ::backdrop.
    if (event.target === this.dialog().nativeElement && this.dismissableMask() && this.modal()) {
      this.close();
    }
  }
}
