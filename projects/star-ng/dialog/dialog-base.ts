import { _IdGenerator } from '@angular/cdk/a11y';
import {
  afterRenderEffect,
  booleanAttribute,
  computed,
  Directive,
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

/** `undefined` stays `undefined` (use the default); anything else is a boolean attribute. */
function optionalBoolean(value: unknown): boolean | undefined {
  return value === undefined || value === null ? undefined : booleanAttribute(value);
}

/**
 * Shared behaviour of `star-dialog` and `star-drawer`: the `visible` model, the native
 * `<dialog>` element (top layer, focus trap, focus return, Escape), the close rules and the
 * `shown` / `hidden` outputs. The component template must have a `<dialog #dialog>` element.
 */
@Directive()
export abstract class StarDialogBase {
  protected readonly text = inject(STAR_UI_TEXT);

  readonly visible = model(false);
  readonly header = input('');
  /** Width step of a dialog (no effect on a drawer). */
  readonly size = input<StarDialogSize>('md');
  /** Fixed CSS width of a dialog; overrides `size` (no effect on a drawer). */
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
  /**
   * Stops the page behind from scrolling while open, and gives the scroll back after the close
   * (PrimeNG `blockScroll`). Default: on for a modal, off for a non-modal.
   */
  readonly blockScroll = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBoolean,
  });
  /**
   * Moves the focus into the content on open (PrimeNG `focusOnShow`): the first focusable element,
   * or the one marked with `autofocus` / `data-autofocus`. When false, the dialog box itself takes
   * the focus, so the first press of Tab reaches the first control.
   */
  readonly focusOnShow = input(true, { transform: booleanAttribute });

  readonly shown = output<void>();
  readonly hidden = output<void>();

  protected readonly headerId = inject(_IdGenerator).getId('star-dialog-title-');
  protected readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private isOpen = false;

  /** Page scroll is blocked while this dialog is open. */
  protected readonly scrollBlocked = computed(() => this.blockScroll() ?? this.modal());

  constructor() {
    afterRenderEffect({
      write: () => {
        const element = this.dialog().nativeElement;
        const visible = this.visible();
        if (visible && !element.open) {
          if (this.modal()) element.showModal?.();
          else element.show?.();
          this.isOpen = true;
          if (this.focusOnShow()) this.focusInitial(element);
          else element.focus({ preventScroll: true });
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

  /** Runs once after each close, before `hidden` is emitted. */
  protected afterClose(): void {
    // Overridden by subclasses.
  }

  /** A click on the backdrop closes the dialog. */
  protected closesOnBackdrop(): boolean {
    return this.dismissableMask();
  }

  /**
   * Native `autofocus` only works on focusable elements. `data-autofocus` also works on a
   * wrapper component such as `<star-button data-autofocus>`: its first focusable child gets focus.
   */
  protected focusInitial(element: HTMLDialogElement): void {
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
    this.afterClose();
    this.hidden.emit();
  }

  protected onDialogClick(event: MouseEvent): void {
    // A click whose target is the <dialog> itself landed on the ::backdrop.
    if (event.target === this.dialog().nativeElement && this.closesOnBackdrop() && this.modal()) {
      this.close();
    }
  }
}
