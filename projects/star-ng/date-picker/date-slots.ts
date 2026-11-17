import { Directive } from '@angular/core';
import { StarSlot } from '@star-ng/ui/core';

/** Context of the date slot. */
export interface StarDateContext {
  /** The day. */
  readonly $implicit: Date;
  /** The day is today. */
  readonly today: boolean;
  /**
   * The day is chosen. In range mode it is `true` only for the two ends of the range (start and
   * end); the days between them are `false`, and the context has no in-range flag.
   */
  readonly selected: boolean;
  /** The day cannot be chosen. */
  readonly disabled: boolean;
  /** The day is in the month before or after the shown month. */
  readonly outside: boolean;
}

/**
 * Replaces the content of a day in `star-calendar`, `star-date-picker`,
 * `star-date-range-picker` and `star-multi-date-picker`. PrimeNG `#date` template.
 *
 * The content goes inside the day button. The button keeps its accessible name (the full date),
 * `aria-current`, `aria-disabled`, the selected and today styles and the click and keyboard
 * behaviour. The calendar owns the keyboard model (one focusable day, arrow keys move it): do not
 * add focusable elements (buttons, links, inputs) in this template. Content you add to mark a day,
 * for example a dot, is not part of the accessible name; give the information in another way too.
 *
 * With `numberOfMonths` above 1 the template applies to the days of every month.
 */
@Directive({
  selector: 'ng-template[starDate]',
  providers: [{ provide: StarSlot, useExisting: StarDateTemplate }],
})
export class StarDateTemplate extends StarSlot<StarDateContext> {
  readonly name = 'date';

  static ngTemplateContextGuard(_dir: StarDateTemplate, _ctx: unknown): _ctx is StarDateContext {
    return true;
  }
}
