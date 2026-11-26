// Color math of the theme factory: OKLCH to sRGB, alpha compositing and the WCAG 2 contrast
// ratio. Pure functions, no DOM, so the factory runs the same in the browser, in Node (the theme
// generator in `tools/`) and in the unit tests.

/** An sRGB color with 8-bit channels (0-255) and an alpha (0-1). */
export interface StarRgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export const BLACK: StarRgb = { r: 0, g: 0, b: 0, a: 1 };
export const WHITE: StarRgb = { r: 255, g: 255, b: 255, a: 1 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function toGamma(linear: number): number {
  return linear <= 0.0031308 ? 12.92 * linear : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
}

function oklchToLinear(l: number, c: number, h: number): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const inGamut = (rgb: readonly number[]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/**
 * An OKLCH color as 8-bit sRGB. Out-of-gamut colors keep their lightness and hue: the chroma
 * goes down until the color fits (binary search), as the CSS gamut mapping does.
 */
export function oklch(l: number, c: number, h: number, a = 1): StarRgb {
  const lightness = clamp(l, 0, 1);
  let chroma = Math.max(0, c);
  if (!inGamut(oklchToLinear(lightness, chroma, h))) {
    let low = 0;
    let high = chroma;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (inGamut(oklchToLinear(lightness, mid, h))) low = mid;
      else high = mid;
    }
    chroma = low;
  }
  const [r, g, b] = oklchToLinear(lightness, chroma, h).map(
    (v) => Math.round(clamp(toGamma(clamp(v, 0, 1)), 0, 1) * 255) as number,
  );
  return { r, g, b, a: clamp(a, 0, 1) };
}

/** The same color with another alpha. */
export const withAlpha = (color: StarRgb, a: number): StarRgb => ({ ...color, a: clamp(a, 0, 1) });

/** Opaque colors as `#rrggbb`; translucent ones as `rgba(r, g, b, a)` (alpha with 3 decimals). */
export function cssColor(color: StarRgb): string {
  const [r, g, b] = [color.r, color.g, color.b].map((v) => Math.round(clamp(v, 0, 255)));
  if (color.a >= 1) {
    const hex = (v: number) => v.toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }
  const alpha = Number(color.a.toFixed(3));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * `top` painted over `bottom` (source-over, in gamma-encoded sRGB as browsers blend). The result
 * is opaque when `bottom` is.
 */
export function composite(top: StarRgb, bottom: StarRgb): StarRgb {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (t: number, b: number) => (t * top.a + b * bottom.a * (1 - top.a)) / a;
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a };
}

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** WCAG 2 relative luminance of an opaque color. */
export function luminance(color: StarRgb): number {
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

/** WCAG 2 contrast ratio of two relative luminances (1 to 21). */
export function luminanceRatio(la: number, lb: number): number {
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** WCAG 2 contrast ratio of two opaque colors (1 to 21). */
export function contrastRatio(a: StarRgb, b: StarRgb): number {
  return luminanceRatio(luminance(a), luminance(b));
}

/** Settings of the CSS `backdrop-filter` functions the factory models (blur aside). */
export interface StarBackdropFilter {
  /** `contrast()` factor. */
  readonly contrast: number;
  /** `saturate()` factor. */
  readonly saturate: number;
  /** `brightness()` factor. */
  readonly brightness: number;
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));

/**
 * A backdrop color (channels 0-1) after `contrast() saturate() brightness()`, with the matrices
 * of the Filter Effects specification and a clamp after each function. `linear` runs them on
 * linear-light values (the SVG default) instead of gamma-encoded ones (what browsers do for the
 * CSS functions); the factory checks both, so the result holds in either case.
 */
function filtered(rgb: readonly number[], f: StarBackdropFilter, linear: boolean): number[] {
  const unit = (v: number) => clamp(v, 0, 1);
  let [r, g, b] = linear ? rgb.map(toLinear) : [...rgb];
  [r, g, b] = [r, g, b].map((v) => unit((v - 0.5) * f.contrast + 0.5));
  const s = f.saturate;
  [r, g, b] = [
    unit((0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b),
    unit((0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b),
    unit((0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b),
  ];
  [r, g, b] = [r, g, b].map((v) => unit(v * f.brightness));
  return linear ? [r, g, b].map(toGamma) : [r, g, b];
}

const LEVELS = [0, 0.25, 0.5, 0.75, 1];

/**
 * Every backdrop the factory checks: a grid of 125 sRGB colors (5 levels per channel, so black,
 * white, the grays and the saturated corners are in it) after the backdrop filter, in both the
 * gamma-encoded and the linear reading of the filter. The blur only averages backdrop colors, so
 * it adds no new extremes. The grid is a sampled worst case, not a proof: the factory checks it
 * with a small safety margin on the contrast minimum.
 */
export function backdropSamples(f: StarBackdropFilter): StarRgb[] {
  const out: StarRgb[] = [];
  for (const r of LEVELS) {
    for (const g of LEVELS) {
      for (const b of LEVELS) {
        for (const linear of [false, true]) {
          const [fr, fg, fb] = filtered([r, g, b], f, linear);
          out.push({ r: fr * 255, g: fg * 255, b: fb * 255, a: 1 });
        }
      }
    }
  }
  return out;
}
