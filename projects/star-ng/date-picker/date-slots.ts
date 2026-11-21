import { Directive } from '@angular/core';
import { StarSlot } from '@star-ng/ui/core';
import type { StarSpecialDate } from './date-utils';

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
  /**
   * The entry of `specialDates` for the day, or `null`. Optional, so a context object written
   * for the earlier fields (for example in a test) still fits.
   */
  readonly special?: StarSpecialDate | null;
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

/** Context of the decade slot. */
export interface StarDecadeContext {
  /** The years of the year view. */
  readonly $implicit: readonly number[];
  /** The first year. */
  readonly first: number;
  /** The last year. */
  readonly last: number;
}

/**
 * Replaces the title of the year view ("2016 – 2027") in `star-calendar` and the date pickers.
 * PrimeNG `#decade` template. The title stays a live region, so keep the years in the text.
 */
@Directive({
  selector: 'ng-template[starDecade]',
  providers: [{ provide: StarSlot, useExisting: StarDecadeTemplate }],
})
export class StarDecadeTemplate extends StarSlot<StarDecadeContext> {
  readonly name = 'decade';

  static ngTemplateContextGuard(
    _dir: StarDecadeTemplate,
    _ctx: unknown,
  ): _ctx is StarDecadeContext {
    return true;
  }
}

/** Context of the button bar slot. */
export interface StarButtonBarContext {
  /** Chooses today (or the current month or year in the month and year views). */
  readonly today: () => void;
  /** Clears the value. */
  readonly clear: () => void;
}

/**
 * Replaces the buttons of the button bar (`showButtonBar`) in the date pickers. PrimeNG
 * `#buttonbar` template. Use buttons with a visible text; they are in the tab order of the panel.
 */
@Directive({
  selector: 'ng-template[starButtonBar]',
  providers: [{ provide: StarSlot, useExisting: StarButtonBarTemplate }],
})
export class StarButtonBarTemplate extends StarSlot<StarButtonBarContext> {
  readonly name = 'buttonBar';

  static ngTemplateContextGuard(
    _dir: StarButtonBarTemplate,
    _ctx: unknown,
  ): _ctx is StarButtonBarContext {
    return true;
  }
}

/** Context of the time cell slot. */
export interface StarTimeCellContext {
  /** The text of the cell, for example `09` or `PM`. */
  readonly $implicit: string;
  /** The value of the cell in its column (hours 0–23, minutes, seconds, or 0 / 12 for the period). */
  readonly value: number;
  /** The column: `hour`, `minute`, `second` or `period`. */
  readonly part: 'hour' | 'minute' | 'second' | 'period';
  /** The cell is the chosen one. */
  readonly selected: boolean;
  /** The cell cannot be chosen (outside `min` … `max`). */
  readonly disabled: boolean;
}

/**
 * Replaces the content of an hour, minute, second or period cell in `star-time-picker` (and in
 * `star-time-columns`). PrimeNG time templates. The cell keeps its `option` role, its name and the
 * keyboard; keep the text of the cell in the template.
 */
@Directive({
  selector: 'ng-template[starTimeCell]',
  providers: [{ provide: StarSlot, useExisting: StarTimeCellTemplate }],
})
export class StarTimeCellTemplate extends StarSlot<StarTimeCellContext> {
  readonly name = 'timeCell';

  static ngTemplateContextGuard(
    _dir: StarTimeCellTemplate,
    _ctx: unknown,
  ): _ctx is StarTimeCellContext {
    return true;
  }
}
