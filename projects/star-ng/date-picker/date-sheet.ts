import { DOCUMENT, inject, signal } from '@angular/core';

/**
 * The touch mode of the date pickers (`touchUI`, `breakpoint`): the popup in a modal native
 * `<dialog>` in the middle of the window. Internal; the picker owns the `<dialog>` element and
 * passes it in. Create it in an injection context (a field initializer).
 */
export class StarDateSheet {
  private readonly document = inject(DOCUMENT);

  /** The open popup is a sheet. Set when the popup opens. */
  readonly active = signal(false);

  /**
   * Decides the mode when the popup opens: always with `touchUI`, or when the window is not
   * wider than `breakpoint` (a CSS length, for example `'640px'`).
   */
  decide(touchUI: boolean, breakpoint: string | null): boolean {
    const view = this.document.defaultView;
    let sheet = touchUI;
    if (!sheet && breakpoint && typeof view?.matchMedia === 'function') {
      sheet = view.matchMedia(`(max-width: ${breakpoint})`).matches;
    }
    this.active.set(sheet);
    return sheet;
  }

  /** Shows the dialog as a modal (after it is rendered). */
  show(dialog: HTMLDialogElement | undefined): void {
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  /**
   * Closes the dialog before the picker moves the focus: closing a modal dialog gives the focus
   * back to the element that had it before, which would undo the focus on the input.
   */
  close(dialog: HTMLDialogElement | undefined): void {
    dialog?.close?.();
  }

  /** A click on the backdrop: the panel fills the dialog, so the dialog itself is the target. */
  isBackdropClick(event: MouseEvent): boolean {
    return event.target === event.currentTarget;
  }
}
