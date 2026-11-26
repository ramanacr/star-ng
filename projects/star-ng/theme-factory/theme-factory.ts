// Theme factory: a complete StarNG theme (color roles, radius scale and glass tokens, light and
// dark, three variants) from a few inputs, with a contrast check of the text against the worst
// backdrop behind the translucent surfaces.
import {
  backdropSamples,
  BLACK,
  composite,
  contrastRatio,
  cssColor,
  luminance,
  luminanceRatio,
  oklch,
  StarRgb,
  WHITE,
  withAlpha,
} from './color';

/**
 * How much of the backdrop shows through the floating layers. `clear` is the most translucent,
 * `tinted` (the default) has more of the hue and less of the backdrop, `solid` has no
 * translucency and no blur (a user choice for people who find translucency hard to read).
 */
export type StarThemeVariant = 'clear' | 'tinted' | 'solid';

/** The two color schemes of every theme (`data-theme` on `<html>`). */
export type StarThemeScheme = 'light' | 'dark';

/** Inputs of `starCreateTheme`. Every input except `name` has a default. */
export interface StarThemeFactoryOptions {
  /**
   * Theme name: lowercase letters, digits and hyphens, starting with a letter. The theme applies
   * under `[data-star-theme='<name>']`.
   */
  name: string;
  /** Base hue in degrees (OKLCH hue, 0 to 360). Default 265 (indigo). */
  hue?: number;
  /**
   * Opacity of the `clear` surface, 0.2 to 1 (`tinted` adds a third of the rest). The factory
   * raises it only when no text color meets the contrast minimum over the worst backdrop.
   * Default 0.6.
   */
  opacity?: number;
  /** Backdrop blur of the `clear` variant in pixels, 0 to 64. Default 16. */
  blur?: number;
  /** How strongly the hue tints the surfaces, 0 to 1. Default 0.3. */
  tint?: number;
  /** Factor for the radius scale (`--star-radius-*`), 0 (square) to 3. Default 1. */
  radius?: number;
  /** Angle of the edge highlight in degrees (CSS gradient angle). Mirrored in RTL. Default 135. */
  angle?: number;
  /** Least contrast ratio of the text, 4.5 (WCAG AA, the floor) to 21. Default 4.5. */
  minContrast?: number;
}

/** The options of a generated theme after defaults and clamping. */
export type StarThemeFactoryResolvedOptions = Readonly<Required<StarThemeFactoryOptions>>;

/** Background of one contrast check. */
/**
 * Background of one contrast check: the worst of the filtered backdrops under the surface, or the
 * solid surface of the fallbacks (no `backdrop-filter` support, more contrast, less transparency).
 */
export type StarThemeContrastBackground = 'worst backdrop' | 'solid fallback';

/** One text color checked against one background of one variant and scheme. */
export interface StarThemeContrastCheck {
  readonly variant: StarThemeVariant;
  readonly scheme: StarThemeScheme;
  /** The token of the text color, for example `--star-glass-text-muted`. */
  readonly token: string;
  readonly background: StarThemeContrastBackground;
  /** The contrast ratio, rounded down to two decimals. */
  readonly ratio: number;
  readonly minimum: number;
  readonly pass: boolean;
}

/** Token name to CSS value. */
export type StarThemeTokens = Readonly<Record<string, string>>;

/** Result of `starCreateTheme`. Turn it into CSS with `starThemeCss`. */
export interface StarGeneratedTheme {
  readonly name: string;
  /** The selector the theme applies under: `[data-star-theme='<name>']`. */
  readonly selector: string;
  readonly options: StarThemeFactoryResolvedOptions;
  /** Tokens that do not change with the variant or the scheme (radius scale, angle, motion). */
  readonly shared: StarThemeTokens;
  /** Every scheme-dependent token, per variant and scheme. */
  readonly tokens: Readonly<
    Record<StarThemeVariant, Readonly<Record<StarThemeScheme, StarThemeTokens>>>
  >;
  /** Surface opacity in use per variant and scheme, after the contrast check. */
  readonly alpha: Readonly<Record<StarThemeVariant, Readonly<Record<StarThemeScheme, number>>>>;
  /** Every contrast check of the glass text colors. All of them pass. */
  readonly contrast: readonly StarThemeContrastCheck[];
}

export const STAR_THEME_VARIANTS: readonly StarThemeVariant[] = ['clear', 'tinted', 'solid'];
export const STAR_THEME_SCHEMES: readonly StarThemeScheme[] = ['light', 'dark'];

const DEFAULTS = {
  hue: 265,
  opacity: 0.6,
  blur: 16,
  tint: 0.3,
  radius: 1,
  angle: 135,
  minContrast: 4.5,
} as const;

const RADIUS_SCALE: readonly [string, number][] = [
  ['xs', 4],
  ['sm', 6],
  ['md', 8],
  ['lg', 12],
  ['xl', 16],
  ['2xl', 20],
  ['3xl', 24],
  ['4xl', 28],
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits: number) => Number(value.toFixed(digits));
const wrapDegrees = (value: number) => ((value % 360) + 360) % 360;

function finite(name: string, value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`starCreateTheme: "${name}" must be a finite number.`);
  }
  return value;
}

function resolve(options: StarThemeFactoryOptions): StarThemeFactoryResolvedOptions {
  if (!/^[a-z][a-z0-9-]*$/.test(options.name ?? '')) {
    throw new Error(
      'starCreateTheme: "name" must start with a lowercase letter and have only lowercase ' +
        'letters, digits and hyphens.',
    );
  }
  return {
    name: options.name,
    hue: round(wrapDegrees(finite('hue', options.hue, DEFAULTS.hue)), 2),
    opacity: round(clamp(finite('opacity', options.opacity, DEFAULTS.opacity), 0.2, 1), 3),
    blur: round(clamp(finite('blur', options.blur, DEFAULTS.blur), 0, 64), 1),
    tint: round(clamp(finite('tint', options.tint, DEFAULTS.tint), 0, 1), 3),
    radius: round(clamp(finite('radius', options.radius, DEFAULTS.radius), 0, 3), 3),
    angle: round(wrapDegrees(finite('angle', options.angle, DEFAULTS.angle)), 2),
    minContrast: round(
      clamp(finite('minContrast', options.minContrast, DEFAULTS.minContrast), 4.5, 21),
      2,
    ),
  };
}

/** Steps the lightness until `ok` holds (or the lightness runs out). */
function searchLightness(
  start: number,
  step: number,
  make: (l: number) => StarRgb,
  ok: (color: StarRgb) => boolean,
): { color: StarRgb; l: number } {
  let l = start;
  let color = make(l);
  for (let i = 0; i < 100 && !ok(color) && l > 0 && l < 1; i++) {
    l = round(clamp(l + step, 0, 1), 3);
    color = make(l);
  }
  return { color, l };
}

interface Palette {
  primary: StarRgb;
  primaryHover: StarRgb;
  primarySoft: StarRgb;
  surface: StarRgb;
  surfaceMuted: StarRgb;
  border: StarRgb;
  borderStrong: StarRgb;
  textStrong: StarRgb;
  text: StarRgb;
  textMuted: StarRgb;
  textSoft: StarRgb;
  /** OKLCH lightness of the text colors, where the glass text search starts. */
  textL: { strong: number; text: number; muted: number };
}

function palette(scheme: StarThemeScheme, o: StarThemeFactoryResolvedOptions): Palette {
  const h = o.hue;
  const t = o.tint;
  const pass = (a: StarRgb, b: StarRgb) => contrastRatio(a, b) >= o.minContrast;
  if (scheme === 'light') {
    const surfaceMuted = oklch(0.975, 0.008 + 0.012 * t, h);
    const chroma = 0.2;
    // White text on the primary fill, and the primary as text on the muted surface.
    const primary = searchLightness(
      0.56,
      -0.01,
      (l) => oklch(l, chroma, h),
      (c) => pass(WHITE, c) && pass(c, surfaceMuted),
    );
    const muted = searchLightness(
      0.52,
      -0.01,
      (l) => oklch(l, 0.03, h),
      (c) => pass(c, surfaceMuted),
    );
    return {
      primary: primary.color,
      primaryHover: oklch(primary.l - 0.06, chroma, h),
      primarySoft: oklch(0.94, 0.045, h),
      surface: oklch(0.995, 0.006 * t, h),
      surfaceMuted,
      border: oklch(0.925, 0.012 + 0.012 * t, h),
      borderStrong: oklch(0.86, 0.018 + 0.014 * t, h),
      textStrong: oklch(0.2, TEXT_CHROMA, h),
      text: oklch(0.27, TEXT_CHROMA, h),
      textMuted: muted.color,
      textSoft: oklch(0.71, 0.025, h),
      textL: { strong: 0.2, text: 0.27, muted: muted.l },
    };
  }
  const surface = oklch(0.185, 0.01 + 0.012 * t, h);
  const surfaceMuted = oklch(0.225, 0.012 + 0.014 * t, h);
  const chroma = 0.15;
  // The dark theme puts dark text (the surface color) on the primary fill.
  const primary = searchLightness(
    0.74,
    0.01,
    (l) => oklch(l, chroma, h),
    (c) => pass(c, surfaceMuted) && pass(surface, c),
  );
  const muted = searchLightness(
    0.74,
    0.01,
    (l) => oklch(l, 0.025, h),
    (c) => pass(c, surfaceMuted),
  );
  return {
    primary: primary.color,
    primaryHover: oklch(primary.l + 0.06, chroma, h),
    primarySoft: oklch(0.3, 0.06, h),
    surface,
    surfaceMuted,
    border: oklch(0.32, 0.016 + 0.012 * t, h),
    borderStrong: oklch(0.4, 0.02 + 0.012 * t, h),
    textStrong: oklch(0.985, 0.004, h),
    text: oklch(0.93, 0.012, h),
    textMuted: muted.color,
    textSoft: oklch(0.56, 0.02, h),
    textL: { strong: 0.985, text: 0.93, muted: muted.l },
  };
}

const TEXT_CHROMA = 0.035;

/** Variant settings: the inputs scaled per variant, before the contrast check. */
function variantSettings(
  variant: StarThemeVariant,
  scheme: StarThemeScheme,
  o: StarThemeFactoryResolvedOptions,
) {
  const light = scheme === 'light';
  switch (variant) {
    case 'clear':
      return {
        tint: o.tint * 0.5,
        alpha: o.opacity,
        blur: o.blur,
        filter: light
          ? { contrast: 0.6, saturate: 1.8, brightness: 1.2 }
          : { contrast: 0.6, saturate: 1.6, brightness: 0.75 },
        specular: light ? 0.5 : 0.1,
        rim: light ? 0.75 : 0.14,
      };
    case 'tinted':
      return {
        tint: o.tint,
        alpha: o.opacity + (1 - o.opacity) * 0.35,
        blur: Math.round(o.blur * 7.5) / 10,
        filter: light
          ? { contrast: 0.7, saturate: 1.5, brightness: 1.12 }
          : { contrast: 0.7, saturate: 1.4, brightness: 0.82 },
        specular: light ? 0.4 : 0.08,
        rim: light ? 0.6 : 0.1,
      };
    case 'solid':
      return {
        tint: o.tint * 0.5,
        alpha: 1,
        blur: 0,
        filter: { contrast: 1, saturate: 1, brightness: 1 },
        specular: light ? 0.2 : 0.04,
        rim: light ? 0.5 : 0.06,
      };
  }
}

/** Safety margin on the contrast minimum while searching (the backdrop check is sampled). */
const MARGIN = 0.1;

/**
 * The luminance range of everything that can sit behind text on a glass layer: each filtered
 * backdrop sample under the surface, with and without the edge highlight (specular) on top.
 */
function backdropRange(samples: readonly StarRgb[], glass: StarRgb, specular: StarRgb) {
  let min = 1;
  let max = 0;
  for (const sample of samples) {
    const base = composite(glass, sample);
    for (const color of [base, composite(specular, base)]) {
      const l = luminance(color);
      if (l < min) min = l;
      if (l > max) max = l;
    }
  }
  return { min, max };
}

/** The worst contrast of a text luminance over a luminance range (1 when the text is inside). */
function worstRatio(text: number, range: { min: number; max: number }): number {
  if (text >= range.min && text <= range.max) return 1;
  return Math.min(luminanceRatio(text, range.min), luminanceRatio(text, range.max));
}

type GlassText = Record<'strong' | 'text' | 'muted', StarRgb>;

/**
 * The text colors of a glass layer: each starts at the palette color and moves away from the
 * surface (darker in the light scheme, lighter in the dark one) until it passes over the whole
 * backdrop range and over the solid fallback. `null` when one cannot pass at this opacity.
 */
function glassText(
  p: Palette,
  scheme: StarThemeScheme,
  hue: number,
  range: { min: number; max: number },
  solid: number,
  min: number,
): GlassText | null {
  const step = scheme === 'light' ? -0.01 : 0.01;
  const chroma = scheme === 'light' ? TEXT_CHROMA : 0.012;
  const passes = (c: StarRgb) => {
    const l = luminance(c);
    return worstRatio(l, range) >= min + MARGIN && luminanceRatio(l, solid) >= min + MARGIN;
  };
  const search = (start: number) => {
    const found = searchLightness(start, step, (l) => oklch(l, chroma, hue), passes);
    return passes(found.color) ? found : null;
  };
  const text = search(p.textL.text);
  const muted = search(p.textL.muted);
  // Strong text stays at least as far from the surface as the body text.
  const strongStart =
    scheme === 'light'
      ? Math.min(p.textL.strong, text?.l ?? 0)
      : Math.max(p.textL.strong, text?.l ?? 1);
  const strong = search(strongStart);
  if (!text || !muted || !strong) return null;
  return { text: text.color, muted: muted.color, strong: strong.color };
}

const GLASS_TEXT_TOKENS: readonly (readonly [string, keyof GlassText])[] = [
  ['--star-glass-text', 'text'],
  ['--star-glass-text-strong', 'strong'],
  ['--star-glass-text-muted', 'muted'],
];

const rgba = (color: StarRgb, a: number) => cssColor(withAlpha(color, a));

/**
 * Creates a complete theme from a few inputs: the color roles (primary, surfaces, borders, text)
 * from the hue, the radius scale, and the glass tokens of the floating layers in three variants,
 * each for the light and the dark scheme.
 *
 * Contrast: the backdrop behind a glass layer can be anything. The factory runs a grid of backdrop
 * colors through the backdrop filter of each variant (the `contrast()`, `saturate()` and
 * `brightness()` functions narrow the range of the backdrop), puts the surface over each one, and
 * picks the text colors of the layer (`--star-glass-text*`) so that they meet `minContrast` over
 * the whole range and over the solid fallback. Only when no text color can pass does it raise the
 * surface opacity. Every check of the result passes.
 *
 * ```ts
 * const theme = starCreateTheme({ name: 'ocean', hue: 220, tint: 0.4 });
 * const css = starThemeCss(theme);
 * ```
 */
export function starCreateTheme(options: StarThemeFactoryOptions): StarGeneratedTheme {
  const o = resolve(options);
  const h = o.hue;

  const shared: Record<string, string> = {};
  for (const [size, px] of RADIUS_SCALE) {
    shared[`--star-radius-${size}`] = `${Math.round(px * o.radius)}px`;
  }
  // These read the radius scale on `:root`; set them again so they follow the scaled values.
  shared['--star-button-radius'] = 'var(--star-radius-md)';
  shared['--star-input-radius'] = 'var(--star-radius-md)';
  shared['--star-glass-radius'] = `${Math.round(12 * o.radius)}px`;
  shared['--star-glass-angle'] = `${o.angle}deg`;
  shared['--star-glass-refraction-filter'] = 'none';
  shared['--star-glass-duration'] = '0.35s';
  shared['--star-glass-easing'] = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

  const palettes = { light: palette('light', o), dark: palette('dark', o) };
  const tokens = {} as Record<StarThemeVariant, Record<StarThemeScheme, StarThemeTokens>>;
  const alpha = {} as Record<StarThemeVariant, Record<StarThemeScheme, number>>;
  const contrast: StarThemeContrastCheck[] = [];

  for (const variant of STAR_THEME_VARIANTS) {
    tokens[variant] = {} as Record<StarThemeScheme, StarThemeTokens>;
    alpha[variant] = {} as Record<StarThemeScheme, number>;
    for (const scheme of STAR_THEME_SCHEMES) {
      const p = palettes[scheme];
      const light = scheme === 'light';
      const s = variantSettings(variant, scheme, o);
      const glassColor = light
        ? oklch(0.985 - 0.04 * s.tint, 0.012 + 0.07 * s.tint, h)
        : oklch(0.2 + 0.04 * s.tint, 0.012 + 0.05 * s.tint, h);
      const specular = withAlpha(WHITE, s.specular);
      const samples = backdropSamples(s.filter);

      // Raise the opacity only while no text color can pass.
      let a = round(s.alpha, 2);
      let glass = withAlpha(glassColor, a);
      let solid = composite(glass, p.surface);
      let range = backdropRange(samples, glass, specular);
      let text = glassText(p, scheme, h, range, luminance(solid), o.minContrast);
      while (!text && a < 1) {
        a = round(Math.min(1, a + 0.01), 2);
        glass = withAlpha(glassColor, a);
        solid = composite(glass, p.surface);
        range = backdropRange(samples, glass, specular);
        text = glassText(p, scheme, h, range, luminance(solid), o.minContrast);
      }
      if (!text) {
        throw new Error(
          `starCreateTheme: no text color meets ${o.minContrast}:1 on the ${variant} ${scheme} surface.`,
        );
      }
      alpha[variant][scheme] = a;

      for (const [token, role] of GLASS_TEXT_TOKENS) {
        const l = luminance(text[role]);
        contrast.push(
          check(variant, scheme, token, 'worst backdrop', worstRatio(l, range), o.minContrast),
          check(
            variant,
            scheme,
            token,
            'solid fallback',
            luminanceRatio(l, luminance(solid)),
            o.minContrast,
          ),
        );
      }

      const shadowColor = oklch(0.25, 0.06, h);
      const borderColor = light ? rgba(oklch(0.5, 0.04, h), 0.16) : rgba(WHITE, 0.12);
      tokens[variant][scheme] = {
        '--star-primary': cssColor(p.primary),
        '--star-primary-hover': cssColor(p.primaryHover),
        '--star-primary-soft': cssColor(p.primarySoft),
        '--star-surface': cssColor(p.surface),
        '--star-surface-muted': cssColor(p.surfaceMuted),
        '--star-border': cssColor(p.border),
        '--star-border-strong': cssColor(p.borderStrong),
        '--star-text-strong': cssColor(p.textStrong),
        '--star-text': cssColor(p.text),
        '--star-text-muted': cssColor(p.textMuted),
        '--star-text-soft': cssColor(p.textSoft),
        '--star-focus-ring-primary': `0 0 0 4px ${rgba(p.primary, light ? 0.2 : 0.3)}`,
        '--star-glass-bg': cssColor(glass),
        '--star-glass-bg-solid': cssColor(solid),
        '--star-glass-tint': cssColor(oklch(light ? 0.6 : 0.7, 0.16, h)),
        '--star-glass-blur': `${s.blur}px`,
        '--star-glass-contrast': `${s.filter.contrast}`,
        '--star-glass-saturate': `${Math.round(s.filter.saturate * 100)}%`,
        '--star-glass-brightness': `${s.filter.brightness}`,
        '--star-glass-border-color': borderColor,
        '--star-glass-rim-highlight': rgba(WHITE, s.rim),
        '--star-glass-specular': cssColor(specular),
        '--star-glass-shadow': light
          ? `0 1px 2px ${rgba(shadowColor, 0.06)}, 0 16px 40px -12px ${rgba(shadowColor, 0.28)}`
          : `0 1px 2px ${rgba(BLACK, 0.3)}, 0 20px 48px -12px ${rgba(BLACK, 0.6)}`,
        '--star-glass-text': cssColor(text.text),
        '--star-glass-text-strong': cssColor(text.strong),
        '--star-glass-text-muted': cssColor(text.muted),
        // The glass tokens of the base theme (toast, dock), kept in line with the new surface.
        '--star-glass-surface': cssColor(glass),
        '--star-glass-surface-strong': cssColor(solid),
        '--star-glass-border': borderColor,
      };
    }
  }

  return {
    name: o.name,
    selector: `[data-star-theme='${o.name}']`,
    options: o,
    shared,
    tokens,
    alpha,
    contrast,
  };
}

function check(
  variant: StarThemeVariant,
  scheme: StarThemeScheme,
  token: string,
  background: StarThemeContrastBackground,
  ratio: number,
  minimum: number,
): StarThemeContrastCheck {
  const floored = Math.floor(ratio * 100) / 100;
  return { variant, scheme, token, background, ratio: floored, minimum, pass: ratio >= minimum };
}

/**
 * The floating layers that turn into glass: overlays (select, autocomplete, date picker panels),
 * popovers, menus, dialogs, drawers, bottom sheets, sticky and fixed app bars and the dock.
 * Inputs, tables and cards stay opaque. A menu inline in the page and the list inside a framed
 * menu are not floating, so they keep their look.
 */
const GLASS_LAYERS = [
  '.star-panel',
  '.star-popover',
  '.star-menu:not(.star-menu-host .star-menu, .star-menu-frame--framed > .star-menu)',
  '.star-menu-frame--framed:not(.star-menu-host .star-menu-frame--framed)',
  '.star-dialog',
  '.star-drawer',
  '.star-bottom-sheet',
  '.star-app-bar--sticky',
  '.star-app-bar--fixed',
  '.star-dock__list',
];

const block = (selector: string, declarations: Readonly<Record<string, string>>) =>
  `${selector} {\n${Object.entries(declarations)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')}\n}\n`;

const diff = (values: StarThemeTokens, base: StarThemeTokens) =>
  Object.fromEntries(Object.entries(values).filter(([name, value]) => base[name] !== value));

/**
 * The CSS of a generated theme: the tokens under the theme selector (the `tinted` variant by
 * default; `data-star-theme-variant="clear"` or `"solid"` on the same element picks another), the
 * dark values under `[data-theme='dark']`, the glass rules of the floating layers, and the
 * fallbacks:
 *
 * - no `backdrop-filter` support: the layers use the solid surface;
 * - `prefers-contrast: more` and `prefers-reduced-transparency: reduce`: solid surface, no blur;
 * - `forced-colors: active`: system colors, no blur;
 * - `prefers-reduced-motion: reduce` or `data-star-motion="reduced"` on `<html>`
 *   (`provideStarNg({ reducedMotion: 'always' })`): `--star-glass-duration` is `0s`;
 * - right to left: the highlight angle is mirrored.
 *
 * Load the CSS after the StarNG styles. The layer rules have the specificity of one class, so a
 * class of the application (pass-through `pt`) on a layer wins over them, and a part in unstyled
 * mode (`data-star-unstyled`) is left alone.
 */
export function starThemeCss(theme: StarGeneratedTheme): string {
  const s = theme.selector;
  const dark = (extra = '') => `[data-theme='dark']${s}${extra},\n[data-theme='dark'] ${s}${extra}`;
  const variantAttr = (variant: StarThemeVariant) => `[data-star-theme-variant='${variant}']`;
  const base = theme.tokens.tinted;
  const angle = Number.parseFloat(theme.shared['--star-glass-angle']);
  const rtlAngle = `${round(wrapDegrees(360 - angle), 2)}deg`;

  const layers = `:where(${s}:not(${variantAttr('solid')})) :where(\n  ${GLASS_LAYERS.join(',\n  ')}\n):not([data-star-unstyled])`;
  const toast = `:where(${s}:not(${variantAttr('solid')})) .star-toast:not([data-star-unstyled])`;
  const filter =
    'blur(var(--star-glass-blur)) contrast(var(--star-glass-contrast)) ' +
    'saturate(var(--star-glass-saturate)) brightness(var(--star-glass-brightness))';
  const background =
    'linear-gradient(var(--star-glass-angle), var(--star-glass-specular), transparent 45%), var(--star-glass-bg)';

  const out: string[] = [
    `/* Theme "${theme.name}", generated by starCreateTheme (@star-ng/ui/theme-factory). */\n`,
    block(s, { ...theme.shared, ...base.light }),
  ];
  for (const variant of STAR_THEME_VARIANTS) {
    if (variant === 'tinted') continue;
    out.push(block(`${s}${variantAttr(variant)}`, diff(theme.tokens[variant].light, base.light)));
  }
  out.push(block(dark(), base.dark));
  for (const variant of STAR_THEME_VARIANTS) {
    if (variant === 'tinted') continue;
    out.push(block(dark(variantAttr(variant)), diff(theme.tokens[variant].dark, base.dark)));
  }
  out.push(
    block(`[dir='rtl']${s},\n[dir='rtl'] ${s},\n${s} [dir='rtl']`, {
      '--star-glass-angle': rtlAngle,
    }),
    block(layers, {
      // The text of a layer uses the glass text colors, which pass over every backdrop.
      '--star-text': 'var(--star-glass-text)',
      '--star-text-strong': 'var(--star-glass-text-strong)',
      '--star-text-muted': 'var(--star-glass-text-muted)',
      'border-color': 'var(--star-glass-border-color)',
      background,
      color: 'var(--star-glass-text)',
      'box-shadow': 'inset 0 1px 0 0 var(--star-glass-rim-highlight), var(--star-glass-shadow)',
      '-webkit-backdrop-filter': filter,
      'backdrop-filter': filter,
    }),
    block(toast, {
      '--star-text': 'var(--star-glass-text)',
      '--star-text-strong': 'var(--star-glass-text-strong)',
      '--star-text-muted': 'var(--star-glass-text-muted)',
      background,
      '-webkit-backdrop-filter': filter,
      'backdrop-filter': filter,
    }),
    `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {\n${indent(
      block(`${layers},\n${toast}`, { background: 'var(--star-glass-bg-solid)' }),
    )}}\n`,
    `@media (prefers-contrast: more), (prefers-reduced-transparency: reduce) {\n${indent(
      block(`${layers},\n${toast}`, {
        background: 'var(--star-glass-bg-solid)',
        '-webkit-backdrop-filter': 'none',
        'backdrop-filter': 'none',
      }),
    )}}\n`,
    `@media (forced-colors: active) {\n${indent(
      block(`${layers},\n${toast}`, {
        background: 'Canvas',
        color: 'CanvasText',
        '-webkit-backdrop-filter': 'none',
        'backdrop-filter': 'none',
      }),
    )}}\n`,
    `@media (prefers-reduced-motion: reduce) {\n${indent(
      block(s, { '--star-glass-duration': '0s' }),
    )}}\n`,
    // `provideStarNg({ reducedMotion: 'always' })` sets this attribute on `<html>`.
    block(`:root[data-star-motion='reduced']${s},\n:root[data-star-motion='reduced'] ${s}`, {
      '--star-glass-duration': '0s',
    }),
  );
  return out.join('\n');
}

const indent = (text: string) =>
  text
    .split('\n')
    .map((line) => (line ? `  ${line}` : line))
    .join('\n');
