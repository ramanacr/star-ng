import { DOCUMENT } from '@angular/common';
import {
  effect,
  EnvironmentProviders,
  inject,
  Injectable,
  InjectionToken,
  isDevMode,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
  Provider,
  signal,
  untracked,
} from '@angular/core';
import { STAR_THEME_STORAGE_KEY } from '@star-ng/ui/theme';
import { provideStarDirection } from './direction';
import { StarFilterMatchMode } from './filter-match';
import type { StarGlobalPassThrough } from './pass-through';
import { provideStarUiText, StarUiText } from './ui-text';

/** Look of the text inputs: a border on every side (`outlined`) or a filled surface (`filled`). */
export type StarInputVariant = 'outlined' | 'filled';

/** Size of the controls in the whole application. Each control maps it to its own sizes. */
export type StarConfigSize = 'small' | 'medium' | 'large';

/** Defaults of the controls that open an overlay (panel, popup). */
export interface StarOverlayConfig {
  /**
   * Where a panel goes in the DOM: `self` (next to the control) or `body` (the overlay container).
   * The select family reads it as the default of its `appendTo` input.
   */
  readonly appendTo?: 'body' | 'self';
  /**
   * Base `z-index` of the overlay container (default 1000). Non-modal dialogs, drawers and bottom
   * sheets stay one below it. Set as the CSS variable `--star-z-index-base` on `<html>`.
   */
  readonly zIndexBase?: number;
}

/**
 * Global configuration of StarNG (PrimeNG `providePrimeNG`; Material has no global object, only
 * per-control tokens such as `MAT_FORM_FIELD_DEFAULT_OPTIONS`). Every entry is optional.
 * Precedence, highest first:
 *
 * 1. An input that the template sets on a control.
 * 2. The per-control default token, for example `provideStarSelectDefaults(...)`.
 * 3. `provideStarNg(...)` (this object, or a later `StarConfigService.update`).
 * 4. The built-in default of the control.
 *
 * The control defaults come from the root injector only: provide `provideStarNg` once, in the
 * providers of the application. A `provideStarNg` in a lazy route or a component does not change
 * the controls (in dev mode it logs a warning); use a per-control token there.
 */
export interface StarConfig {
  /** Default look of `starInput` and `star-input-number`. PrimeNG `inputVariant`; Material `appearance` of `MAT_FORM_FIELD_DEFAULT_OPTIONS`. */
  readonly inputVariant?: StarInputVariant;
  /**
   * Default size of `starInput`, the select family, cascade select, date and time pickers and the
   * table. A control maps `small` / `medium` / `large` to `sm` / `md` / `lg`; a size that it does
   * not have keeps its own default. PrimeNG: none (per-control `size`).
   */
  readonly size?: StarConfigSize;
  /** Defaults of the overlay controls. PrimeNG `zIndex` and `overlayOptions.appendTo`. */
  readonly overlay?: StarOverlayConfig;
  /**
   * Default text match mode of the select family, the listbox and the table global filter
   * (`globalFilterMatchMode`). PrimeNG `filterMatchModeOptions`. Custom modes of the table filter
   * menu register with `StarFilterService` (`@star-ng/ui/core`).
   */
  readonly filterMatchMode?: StarFilterMatchMode;
  /**
   * `system` (default) follows the `prefers-reduced-motion` setting of the operating system.
   * `always` applies the reduced-motion rules of the system setting for everyone
   * (`data-star-motion="reduced"` on `<html>`): the same transitions stop, the motion durations are
   * 0, and the ripple, the carousel autoplay and smooth scrolling stop (`starPrefersReducedMotion`).
   * `.star-spinner` keeps turning, while the loading icons of the tree and tree-table rows stop, as
   * they do under the system setting. PrimeNG: none (its `ripple: false` only turns the ripple off).
   */
  readonly reducedMotion?: 'system' | 'always';
  /**
   * Default BCP 47 locale of the controls that format with `Intl` (date pickers, calendar, input
   * number, chart, file upload, the filters of the select family, listbox, tree and table) and of
   * the StarNG pipes. Unset: the browser locale. PrimeNG `translation` is the nearest option;
   * Material `MAT_DATE_LOCALE`.

   */
  readonly locale?: string;
  /** Overrides of the built-in control texts. Same as `provideStarUiText(...)`. */
  readonly uiText?: Partial<StarUiText>;
  /** `true` starts `StarDirectionService` with the application. Same as `provideStarDirection()`. */
  readonly direction?: boolean;
  /** `localStorage` key of the theme choice. Same as providing `STAR_THEME_STORAGE_KEY`. */
  readonly themeStorageKey?: string;
  /**
   * Classes, styles and safe attributes per part of each control (PrimeNG `pt`), keyed by the tag
   * name of the control: `{ 'star-select': { panel: { class: 'shadow-lg' } } }`. The `pt` input
   * of an instance merges over it. See the guide "Styling hooks".
   */
  readonly pt?: StarGlobalPassThrough;
  /**
   * `true` removes the visual styles (colors, borders, spacing, shapes) of the controls that have
   * styling hooks and keeps the layout that they need to work (PrimeNG `unstyled`). The
   * `unstyled` input of a control wins.
   */
  readonly unstyled?: boolean;
}

/**
 * The configuration given to `provideStarNg` at the root. Read it through `StarConfigService`,
 * which follows `update()`.
 */
export const STAR_CONFIG = new InjectionToken<StarConfig>('STAR_CONFIG', {
  providedIn: 'root',
  factory: () => ({}),
});

/**
 * The global configuration as a signal (PrimeNG `PrimeNG` service). `update()` changes it at run
 * time: the motion switch and the z-index base follow at once; a control reads its defaults when
 * it is created, so a change applies to controls created after it.
 */
@Injectable({ providedIn: 'root' })
export class StarConfigService {
  private readonly document = inject(DOCUMENT);
  private readonly state = signal<StarConfig>(inject(STAR_CONFIG));

  /** The configuration now. */
  readonly config = this.state.asReadonly();

  constructor() {
    effect(() => {
      const config = this.state();
      const root = this.document.documentElement;
      if (config.reducedMotion === 'always') root.setAttribute('data-star-motion', 'reduced');
      else root.removeAttribute('data-star-motion');
      const base = config.overlay?.zIndexBase;
      const style = (root as HTMLElement).style;
      if (!style?.setProperty) return;
      if (typeof base === 'number') style.setProperty('--star-z-index-base', String(base));
      else style.removeProperty('--star-z-index-base');
    });
  }

  /** Merges `partial` into the configuration. `overlay` merges one level deeper. */
  update(partial: Partial<StarConfig>): void {
    this.state.update((config) => ({
      ...config,
      ...partial,
      ...(partial.overlay ? { overlay: { ...config.overlay, ...partial.overlay } } : {}),
    }));
  }
}

/**
 * The configuration at this moment, without tracking. Controls call it in a field initializer to
 * build their input defaults.
 */
export function injectStarConfig(): StarConfig {
  return untracked(inject(StarConfigService).config);
}

/**
 * Input defaults of one control, already mapped to the names of the control. An entry that is
 * `undefined` means "not configured": the control then uses its built-in default.
 */
export interface StarControlDefaults<TSize extends 'sm' | 'md' | 'lg' = 'sm' | 'md'> {
  readonly size?: TSize;
  readonly inputVariant?: StarInputVariant;
  readonly appendTo?: 'body' | 'self';
  readonly filterMatchMode?: StarFilterMatchMode;
  readonly locale?: string;
}

/**
 * The defaults of a control from the global configuration, merged with a per-control default token
 * (`overrides`, for example `inject(STAR_SELECT_DEFAULTS)`). The token wins; an entry that the token
 * leaves `undefined` keeps the global value. Call it in a field initializer:
 *
 * ```ts
 * private readonly defaults = injectStarControlDefaults(['sm', 'md']);
 * readonly size = input<'sm' | 'md'>(this.defaults.size ?? 'md');
 * ```
 */
export function injectStarControlDefaults<
  TSize extends 'sm' | 'md' | 'lg',
  TOverrides extends object = object,
>(
  sizes: readonly TSize[],
  overrides?: TOverrides | null,
): StarControlDefaults<TSize> & Partial<TOverrides> {
  const config = injectStarConfig();
  const size = config.size ? starConfigSize<TSize | 'md'>(config.size, 'md', sizes) : undefined;
  const merged: Record<string, unknown> = {
    size: size && (sizes as readonly string[]).includes(size) ? size : undefined,
    inputVariant: config.inputVariant,
    appendTo: config.overlay?.appendTo,
    filterMatchMode: config.filterMatchMode,
    locale: config.locale,
  };
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value !== undefined) merged[key] = value;
  }
  return merged as StarControlDefaults<TSize> & Partial<TOverrides>;
}

/**
 * Maps the configured size to the size names of a control. A size that the control does not have
 * (for example `large` on a control with only `sm` and `md`) gives `fallback`.
 */
export function starConfigSize<T extends 'sm' | 'md' | 'lg'>(
  size: StarConfigSize | undefined,
  fallback: T,
  allowed: readonly T[],
): T {
  const name = size === 'small' ? 'sm' : size === 'large' ? 'lg' : size === 'medium' ? 'md' : null;
  return name && (allowed as readonly string[]).includes(name) ? (name as T) : fallback;
}

/**
 * Sets up StarNG once, at application level. It composes the existing providers (UI texts,
 * direction, theme storage key) and provides `STAR_CONFIG`; those providers stay public and keep
 * working on their own.
 *
 * ```ts
 * bootstrapApplication(App, {
 *   providers: [
 *     provideStarNg({
 *       inputVariant: 'filled',
 *       size: 'small',
 *       overlay: { appendTo: 'body' },
 *       locale: 'de-DE',
 *       uiText: STAR_UI_TEXT_DE,
 *     }),
 *   ],
 * });
 * ```
 */
export function provideStarNg(config: StarConfig = {}): EnvironmentProviders {
  const providers: (Provider | EnvironmentProviders)[] = [
    { provide: STAR_CONFIG, useValue: config },
    provideEnvironmentInitializer(() => {
      const service = inject(StarConfigService);
      // The service lives in the root injector: a config in a child injector is not used.
      if (isDevMode() && inject(STAR_CONFIG) !== untracked(service.config)) {
        console.warn(
          'StarNG: provideStarNg() is provided below the root injector. The controls read the ' +
            'root configuration only; use a per-control default token here.',
        );
      }
    }),
  ];
  if (config.uiText) providers.push(provideStarUiText(config.uiText));
  if (config.themeStorageKey) {
    providers.push({ provide: STAR_THEME_STORAGE_KEY, useValue: config.themeStorageKey });
  }
  if (config.direction) providers.push(provideStarDirection());
  return makeEnvironmentProviders(providers);
}
