import { Directive } from '@angular/core';
import { StarSlot } from '@star-ng/ui/core';
import type { StarToastMessage } from './toast';

/** Context of the toast message slot. */
export interface StarToastMessageContext {
  /** The message that the service holds: id, severity, summary, detail, life, sticky and key. */
  readonly $implicit: StarToastMessage;
  /** Closes this toast. It is the same action as the built-in close button. */
  readonly close: () => void;
}

/**
 * Replaces the text of one toast in `star-toast`: the summary and the detail. PrimeNG `#message`
 * template. The template runs once for each visible toast of the outlet.
 *
 * The toast box stays. The severity icon, the `status` or `alert` role (the live region), the
 * built-in close button and the pause on hover and focus stay too. The summary and the detail
 * paragraphs are the only parts that the template replaces, so the template must show the text
 * that a screen reader user needs.
 *
 * Interactive content is allowed. A button in the template must have an accessible name. A toast
 * that closes by itself must not hold the only way to do an action (WCAG 2.2.1 Timing Adjustable):
 * the toast pauses while the pointer or the focus is on it, but a user may not reach it in time.
 * Offer the same action somewhere else on the page, or use `sticky` for the message.
 */
@Directive({
  selector: 'ng-template[starToastMessage]',
  providers: [{ provide: StarSlot, useExisting: StarToastMessageTemplate }],
})
export class StarToastMessageTemplate extends StarSlot<StarToastMessageContext> {
  readonly name = 'message';

  static ngTemplateContextGuard(
    _dir: StarToastMessageTemplate,
    _ctx: unknown,
  ): _ctx is StarToastMessageContext {
    return true;
  }
}
