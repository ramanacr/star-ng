import { AriaLivePoliteness, LiveAnnouncer } from '@angular/cdk/a11y';
import { inject, Injectable } from '@angular/core';

/** Milliseconds in which `StarAnnouncer` drops a repeat of the same message. */
export const STAR_ANNOUNCER_DEDUPE_MS = 1000;

/**
 * Screen-reader announcements of the whole application, through one live region (CDK
 * `LiveAnnouncer`; PrimeNG has no service). It adds de-duplication: the same message with the same
 * politeness is announced once, also when several controls (or one control and the page) report
 * it within `STAR_ANNOUNCER_DEDUPE_MS`. A screen reader then does not read "Copied" twice.
 *
 * ```ts
 * inject(StarAnnouncer).announce('Order ORD-1042 saved');
 * ```
 *
 * Controls with their own `aria-live` region keep it: use this service for messages that have no
 * visible place on the page.
 */
@Injectable({ providedIn: 'root' })
export class StarAnnouncer {
  private readonly live = inject(LiveAnnouncer);
  private last: { readonly key: string; readonly time: number } | null = null;

  /**
   * Announces `message`. `polite` (default) waits until the screen reader is idle; `assertive`
   * interrupts. Resolves when the message is in the live region. Empty text is ignored.
   */
  announce(message: string, politeness: AriaLivePoliteness = 'polite'): Promise<void> {
    const text = message.trim();
    if (!text) return Promise.resolve();
    const key = `${politeness}\u0000${text}`;
    const now = Date.now();
    if (this.last && this.last.key === key && now - this.last.time < STAR_ANNOUNCER_DEDUPE_MS) {
      return Promise.resolve();
    }
    this.last = { key, time: now };
    return this.live.announce(text, politeness);
  }

  /** Empties the live region, so the last message is not read again. */
  clear(): void {
    this.last = null;
    this.live.clear();
  }
}
