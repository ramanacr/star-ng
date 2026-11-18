import { inject, Pipe, PipeTransform } from '@angular/core';
import {
  StarConfigService,
  StarDateInput,
  starEscapeHtml,
  StarFilterMatchMode,
  starFormatFileSize,
  starFormatRelativeTime,
  starInitials,
  starTextParts,
} from '@star-ng/ui/core';

/*
 * Pure pipes of StarNG. They live in `@star-ng/ui/utility` (no own entry point), take the locale
 * from their argument, else from `locale` of `provideStarNg`, else the browser locale, and use no
 * browser globals, so they render on the server too.
 */

/** Default locale of the pipes: `locale` of `provideStarNg`. */
function configLocale(): () => string | undefined {
  const config = inject(StarConfigService);
  return () => config.config().locale;
}

/**
 * A byte count as text: `{{ 1258291 | starFileSize }}` gives "1.2 MB". Steps of 1024, units of
 * `Intl.NumberFormat`. Arguments: locale, maximum fraction digits (default 1). PrimeNG formats
 * sizes inside `p-fileupload` only.
 */
@Pipe({ name: 'starFileSize' })
export class StarFileSizePipe implements PipeTransform {
  private readonly locale = configLocale();

  transform(bytes: number | null | undefined, locale?: string | null, digits = 1): string {
    return starFormatFileSize(bytes, locale ?? this.locale(), digits);
  }
}

/**
 * The time from `now` to a date as text with `Intl.RelativeTimeFormat`: "5 minutes ago",
 * "in 2 days", "yesterday". The pipe is pure: pass the current time, for example the `now()` signal
 * of `StarClock`, so the text follows the time.
 *
 * `{{ order.created | starRelativeTime: clock.now() }}`
 *
 * Arguments: `now` (required), locale, `Intl.RelativeTimeFormatOptions` (default `numeric: 'auto'`).
 */
@Pipe({ name: 'starRelativeTime' })
export class StarRelativeTimePipe implements PipeTransform {
  private readonly locale = configLocale();

  transform(
    value: StarDateInput | null | undefined,
    now: StarDateInput,
    locale?: string | null,
    options?: Intl.RelativeTimeFormatOptions,
  ): string {
    return starFormatRelativeTime(value, now, locale ?? this.locale(), options);
  }
}

/**
 * Wraps the parts of a text that match a query in `<mark>`, for `[innerHTML]`. The text is
 * escaped first, so only the `<mark>` elements are markup; Angular sanitizes the result again.
 * The match is the one of the list filters (`starFilterMatch`): case and accents do not count.
 *
 * `<span [innerHTML]="city.name | starHighlight: query()"></span>`
 *
 * Arguments: query, match mode (default `contains`), locale.
 */
@Pipe({ name: 'starHighlight' })
export class StarHighlightPipe implements PipeTransform {
  private readonly locale = configLocale();

  transform(
    text: string | null | undefined,
    query: string | null | undefined,
    mode: StarFilterMatchMode = 'contains',
    locale?: string | null,
  ): string {
    return starTextParts(text, query, mode, locale ?? this.locale())
      .map((part) =>
        part.match
          ? `<mark class="star-highlight">${starEscapeHtml(part.text)}</mark>`
          : starEscapeHtml(part.text),
      )
      .join('');
  }
}

/**
 * Initials of a name, upper case: `{{ 'Ada Lovelace' | starInitials }}` gives "AL". The argument
 * is the maximum count (default 2). The same rule as `star-avatar`.
 */
@Pipe({ name: 'starInitials' })
export class StarInitialsPipe implements PipeTransform {
  transform(name: string | null | undefined, max = 2): string {
    return starInitials(name, max);
  }
}

/** The four StarNG pipes, for `imports`. */
export const STAR_PIPES = [
  StarFileSizePipe,
  StarRelativeTimePipe,
  StarHighlightPipe,
  StarInitialsPipe,
] as const;
