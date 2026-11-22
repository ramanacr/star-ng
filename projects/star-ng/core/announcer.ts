import { AriaLivePoliteness, LiveAnnouncer } from '@angular/cdk/a11y';
import { inject, Service } from '@angular/core';

/** Options of `StarAnnouncer.announce`. */
export interface StarAnnounceOptions {
  /**
   * Name of the part of the page that announces, for example `starCopy`. Only a message with a
   * source is de-duplicated, and only against the same source.
   */
  readonly source?: string;
}

/** Milliseconds in which `StarAnnouncer` drops a repeat of the same message from the same source. */
export const STAR_ANNOUNCER_DEDUPE_MS = 1000;

/**
 * Screen-reader announcements of the whole application, through one live region (CDK
 * `LiveAnnouncer`; PrimeNG has no service). It adds de-duplication per source: when a message
 * names a `source`, the same text with the same politeness from the same source is announced once
 * within `STAR_ANNOUNCER_DEDUPE_MS` (for example a double click on a copy button). A message
 * without a source is always announced, so a repeated user action (two undos) is read each time.
 *
 * ```ts
 * inject(StarAnnouncer).announce('Order ORD-1042 saved');
 * inject(StarAnnouncer).announce('Copied', 'polite', { source: 'starCopy' });
 * ```
 *
 * Controls with their own `aria-live` region keep it: use this service for messages that have no
 * visible place on the page.
 */
@Service()
export class StarAnnouncer {
  private readonly live = inject(LiveAnnouncer);
  /** The time of the last announcement per source, politeness and text. */
  private readonly recent = new Map<string, number>();

  /**
   * Announces `message`. `polite` (default) waits until the screen reader is idle; `assertive`
   * interrupts. Resolves when the message is in the live region. Empty text is ignored.
   */
  announce(
    message: string,
    politeness: AriaLivePoliteness = 'polite',
    options: StarAnnounceOptions = {},
  ): Promise<void> {
    const text = message.trim();
    if (!text) return Promise.resolve();
    if (options.source !== undefined) {
      const key = JSON.stringify([options.source, politeness, text]);
      const now = Date.now();
      const last = this.recent.get(key);
      if (last !== undefined && now - last < STAR_ANNOUNCER_DEDUPE_MS) return Promise.resolve();
      for (const [old, time] of this.recent) {
        if (now - time >= STAR_ANNOUNCER_DEDUPE_MS) this.recent.delete(old);
      }
      this.recent.set(key, now);
    }
    return this.live.announce(text, politeness);
  }

  /** Empties the live region, so the last message is not read again. */
  clear(): void {
    this.recent.clear();
    this.live.clear();
  }
}
