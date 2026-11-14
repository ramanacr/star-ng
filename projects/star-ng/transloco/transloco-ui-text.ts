import { inject, Provider } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { map, merge } from 'rxjs';
import { STAR_UI_TEXT, STAR_UI_TEXT_DEFAULTS, STAR_UI_TEXT_PARAMS, StarUiText } from 'star-ng/core';

/**
 * Reads the control texts from Transloco: key `<prefix>.<name>` (default `ui.close`, `ui.page`…),
 * with `{{ param }}` placeholders for function entries (names in `STAR_UI_TEXT_PARAMS`).
 * A missing key falls back to the English default.
 *
 * Every entry is a getter that reads a signal which changes on language switch and on
 * translation load, so OnPush controls re-render with the new language.
 *
 * ```ts
 * providers: [provideStarUiTextFromTransloco()]
 * ```
 */
export function provideStarUiTextFromTransloco(prefix = 'ui'): Provider {
  return {
    provide: STAR_UI_TEXT,
    useFactory: (): StarUiText => {
      const transloco = inject(TranslocoService);
      let version = 0;
      const changed = toSignal(
        merge(transloco.langChanges$, transloco.events$).pipe(map(() => ++version)),
        { initialValue: version },
      );

      const translate = (name: string, fallback: string, params?: Record<string, unknown>) => {
        changed();
        const key = `${prefix}.${name}`;
        const value = transloco.translate(key, params);
        return value && value !== key ? value : fallback;
      };

      const text = {} as Record<string, unknown>;
      for (const name of Object.keys(STAR_UI_TEXT_DEFAULTS) as (keyof StarUiText)[]) {
        const fallback = STAR_UI_TEXT_DEFAULTS[name];
        if (typeof fallback === 'function') {
          const names = STAR_UI_TEXT_PARAMS[name] ?? [];
          text[name] = (...args: unknown[]) => {
            const params = Object.fromEntries(names.map((param, i) => [param, args[i]]));
            const english = (fallback as (...a: unknown[]) => string)(...args);
            return translate(name, english, params);
          };
        } else {
          Object.defineProperty(text, name, {
            enumerable: true,
            get: () => translate(name, fallback),
          });
        }
      }
      return text as unknown as StarUiText;
    },
  };
}
