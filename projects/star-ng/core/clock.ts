import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  inject,
  Injectable,
  InjectionToken,
  NgZone,
  PLATFORM_ID,
  Provider,
  signal,
} from '@angular/core';

/** Milliseconds between two ticks of `StarClock` (default one minute). */
export const STAR_CLOCK_TICK = new InjectionToken<number>('STAR_CLOCK_TICK', {
  providedIn: 'root',
  factory: () => 60_000,
});

/** Sets the tick of `StarClock`, for example `provideStarClock(10_000)` for ten seconds. */
export function provideStarClock(tick: number): Provider {
  return { provide: STAR_CLOCK_TICK, useValue: tick };
}

/**
 * The current time as a signal that moves on every tick (`STAR_CLOCK_TICK`, default one minute).
 * Pass it to the pure `starRelativeTime` pipe, so "5 minutes ago" follows the time:
 *
 * ```html
 * {{ order.created | starRelativeTime: clock.now() }}
 * ```
 *
 * On the server the clock does not tick: `now()` stays the time of the render.
 */
@Injectable({ providedIn: 'root' })
export class StarClock {
  private readonly current = signal(Date.now());
  /** The time in milliseconds at the last tick. */
  readonly now = this.current.asReadonly();

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const tick = Math.max(1000, inject(STAR_CLOCK_TICK));
    // Outside the zone: a zone-based application does not run change detection on every tick;
    // the signal update schedules the views that read `now()`.
    const timer = inject(NgZone).runOutsideAngular(() =>
      setInterval(() => this.current.set(Date.now()), tick),
    );
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
