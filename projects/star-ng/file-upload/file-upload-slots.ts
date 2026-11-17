import { Directive } from '@angular/core';
import { StarSlot } from '@star-ng/ui/core';
import type { StarFileStatus } from './file-upload';

/** Context of the file slot. */
export interface StarFileContext {
  /** The file of this row. */
  readonly $implicit: File;
  /**
   * Upload state of this file, from the `fileStatus` input. `null` when the page gives no state
   * for the file.
   */
  readonly status: StarFileStatus | null;
  /**
   * Takes this file out of the list. It is the same action as the built-in remove button. It does
   * nothing when `interactive` is `false`.
   */
  readonly remove: () => void;
  /** Position of the file in the list, from `0`. Use it with `move()` of the control. */
  readonly index: number;
  /**
   * `true` when the control is neither disabled nor read-only. Show a remove button only then,
   * like the built-in row.
   */
  readonly interactive: boolean;
}

/**
 * Replaces one row of the file list in `star-file-upload`. PrimeNG `#file` template.
 *
 * The `li` element stays: it keeps the list semantics, the error style and the drag handlers of
 * `reorderable`. The template replaces everything inside the `li`: the state icon or thumbnail,
 * the name, the progress bar, the size, the move buttons and the remove button. Your template must
 * show the file name, the upload state and a way to remove the file (`remove()`).
 *
 * Buttons are allowed. The list is a plain list, not a composite widget, so its buttons are in the
 * normal tab order. Each button must have an accessible name that includes the file name, for
 * example `aria-label="Remove invoice.pdf"`. If you use `reorderable`, the built-in move buttons
 * are gone: drag and drop with the pointer still works, and you can add your own buttons that call
 * `move(index, index - 1)` on the control.
 */
@Directive({
  selector: 'ng-template[starFile]',
  providers: [{ provide: StarSlot, useExisting: StarFileTemplate }],
})
export class StarFileTemplate extends StarSlot<StarFileContext> {
  readonly name = 'file';

  static ngTemplateContextGuard(_dir: StarFileTemplate, _ctx: unknown): _ctx is StarFileContext {
    return true;
  }
}
