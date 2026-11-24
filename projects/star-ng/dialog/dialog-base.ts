import { _IdGenerator } from '@angular/cdk/a11y';
import {
  afterRenderEffect,
  booleanAttribute,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { STAR_UI_TEXT, ɵstarCloseDialog, ɵStarDialogClose } from '@star-ng/ui/core';
import { STAR_DIALOG_DEFAULTS } from './dialog-defaults';

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
  /** Defaults from `provideStarDialogDefaults`. */
  protected readonly defaults = inject(STAR_DIALOG_DEFAULTS);

  readonly visible = model(false);
  readonly header = input('');
  /** Width step of a dialog (no effect on a drawer). */
  readonly size = input<StarDialogSize>(this.defaults.size ?? 'md');
  /** Fixed CSS width of a dialog; overrides `size` (no effect on a drawer). */
  readonly width = input<string | null>(null);
  /** Modal blocks the page behind (backdrop). Non-modal dialogs float above it. */
  readonly modal = input(true, { transform: booleanAttribute });
  readonly closable = input(this.defaults.closable ?? true, { transform: booleanAttribute });
  readonly closeOnEscape = input(this.defaults.closeOnEscape ?? true, {
    transform: booleanAttribute,
  });
  /** Clicking the backdrop closes the dialog. */
  readonly dismissableMask = input(this.defaults.dismissableMask ?? false, {
    transform: booleanAttribute,
  });
  readonly showHeader = input(true, { transform: booleanAttribute });
  readonly role = input<'dialog' | 'alertdialog'>('dialog');
  /** Accessible name when there is no visible header title. */
  readonly ariaLabel = input<string | null>(null);
  /** Id of the element that names the dialog, for example your own heading in a headless dialog. */
  readonly ariaLabelledby = input<string | null>(null);
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
  /** A close that waits for the exit motion (browsers without CSS `overlay`). */
  private closing: ɵStarDialogClose | null = null;

  /** `aria-labelledby`: the given id, or the header title when it is shown. */
  protected readonly labelledBy = computed(
    () => this.ariaLabelledby() ?? (this.header() && this.titleShown() ? this.titleIds() : null),
  );
  /** `aria-label` when nothing labels the dialog by id: `ariaLabel`, or the hidden `header`. */
  protected readonly label = computed(() =>
    this.labelledBy() ? null : (this.ariaLabel() ?? (this.header() || null)),
  );

  /** Page scroll is blocked while this dialog is open. */
  protected readonly scrollBlocked = computed(() => this.blockScroll() ?? this.modal());

  constructor() {
    // Destroyed during the exit motion: no close and no `hidden` from a destroyed dialog.
    inject(DestroyRef).onDestroy(() => this.closing?.cancel());
    afterRenderEffect({
      write: () => {
        const element = this.dialog().nativeElement;
        const visible = this.visible();
        // Opened again during the exit motion: end it now (close, `hidden`), then open.
        if (visible && this.closing) this.closing.finish();
        if (visible && !element.open) {
          if (this.modal()) element.showModal?.();
          else element.show?.();
          this.isOpen = true;
          this.afterOpen();
          if (this.focusOnShow()) this.focusInitial(element);
          else element.focus({ preventScroll: true });
          this.shown.emit();
        } else if (!visible && element.open && !this.closing) {
          // Do not wait for the native 'close' event: some hosts (background or embedded
          // browsers) deliver it late or not at all. Where the browser cannot show the exit
          // after close() (no CSS `overlay`), the exit motion runs first.
          this.closing = ɵstarCloseDialog(element, () => {
            this.closing = null;
            this.markHidden();
          });
        }
      },
    });
  }

  close(): void {
    this.visible.set(false);
  }

  /** The header with its title is rendered. */
  protected titleShown(): boolean {
    return this.showHeader();
  }

  /** Ids of the header elements that name the dialog when its title is shown. */
  protected titleIds(): string {
    return this.headerId;
  }

  /** Runs once after each open, before the focus moves and `shown` is emitted. */
  protected afterOpen(): void {
    // Overridden by subclasses.
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
    // The close event of an earlier close, after the dialog opened again (a re-open during the
    // exit motion closes and opens in one task; the event comes later): not a close.
    // Our own close at the end of the exit motion handles the state itself.
    if (this.closing || this.dialog().nativeElement.open) return;
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
