import {
  backdropSamples,
  composite,
  contrastRatio,
  cssColor,
  luminance,
  oklch,
  StarRgb,
  WHITE,
} from './color';
import {
  STAR_THEME_SCHEMES,
  STAR_THEME_VARIANTS,
  starCreateTheme,
  starThemeCss,
} from './theme-factory';

/** Parses `#rrggbb` and `rgba(r, g, b, a)` from the generated tokens. */
function parse(value: string): StarRgb {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(value);
  if (hex)
    return { r: parseInt(hex[1], 16), g: parseInt(hex[2], 16), b: parseInt(hex[3], 16), a: 1 };
  const rgba = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(value);
  if (!rgba) throw new Error(`not a color: ${value}`);
  return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: +rgba[4] };
}

describe('theme factory color math', () => {
  it('converts OKLCH to sRGB', () => {
    expect(cssColor(oklch(1, 0, 0))).toBe('#ffffff');
    expect(cssColor(oklch(0, 0, 0))).toBe('#000000');
    // Out of gamut: the chroma goes down, the color stays valid.
    const vivid = oklch(0.9, 0.4, 265);
    expect([vivid.r, vivid.g, vivid.b].every((v) => v >= 0 && v <= 255)).toBe(true);
  });

  it('computes the WCAG contrast ratio', () => {
    expect(contrastRatio(WHITE, oklch(0, 0, 0))).toBeCloseTo(21, 5);
    expect(contrastRatio(WHITE, WHITE)).toBe(1);
    // #767676 on white is the classic 4.54:1.
    expect(contrastRatio({ r: 118, g: 118, b: 118, a: 1 }, WHITE)).toBeCloseTo(4.54, 2);
  });

  it('composites a translucent color over an opaque one', () => {
    const mixed = composite({ ...WHITE, a: 0.5 }, { r: 0, g: 0, b: 0, a: 1 });
    expect(mixed.a).toBe(1);
    expect(mixed.r).toBeCloseTo(127.5, 5);
  });

  it('narrows the backdrop range with the contrast and brightness filters', () => {
    const range = (samples: StarRgb[]) => {
      const lums = samples.map(luminance);
      return [Math.min(...lums), Math.max(...lums)];
    };
    const [rawMin, rawMax] = range(backdropSamples({ contrast: 1, saturate: 1, brightness: 1 }));
    expect(rawMin).toBe(0);
    expect(rawMax).toBe(1);
    const [min, max] = range(backdropSamples({ contrast: 0.6, saturate: 1.8, brightness: 1.2 }));
    expect(min).toBeGreaterThan(0.02);
    expect(max).toBeGreaterThan(0.85);
  });
});

describe('starCreateTheme', () => {
  const glass = starCreateTheme({ name: 'glass', hue: 265, opacity: 0.55, blur: 20, tint: 0.3 });

  it('fills the defaults and clamps the inputs', () => {
    const theme = starCreateTheme({ name: 'x', hue: -30, opacity: 0, blur: 999, tint: 2 });
    expect(theme.options).toEqual({
      name: 'x',
      hue: 330,
      opacity: 0.2,
      blur: 64,
      tint: 1,
      radius: 1,
      angle: 135,
      minContrast: 4.5,
      refraction: false,
    });
    expect(starCreateTheme({ name: 'x', minContrast: 3 }).options.minContrast).toBe(4.5);
  });

  it('rejects a name that is not a safe attribute value and a non-finite input', () => {
    expect(() => starCreateTheme({ name: "x'] { color: red } [x='" })).toThrow(/name/);
    expect(() => starCreateTheme({ name: 'Glass' })).toThrow(/name/);
    expect(() => starCreateTheme({ name: 'x', hue: Number.NaN })).toThrow(/hue/);
  });

  it('is deterministic', () => {
    const again = starCreateTheme({ name: 'glass', hue: 265, opacity: 0.55, blur: 20, tint: 0.3 });
    expect(starThemeCss(again)).toBe(starThemeCss(glass));
  });

  it('has a light and a dark token set for each variant', () => {
    for (const variant of STAR_THEME_VARIANTS) {
      for (const scheme of STAR_THEME_SCHEMES) {
        const tokens = glass.tokens[variant][scheme];
        for (const name of [
          '--star-primary',
          '--star-surface',
          '--star-text',
          '--star-glass-bg',
          '--star-glass-bg-solid',
          '--star-glass-text',
          '--star-glass-text-muted',
          '--star-glass-blur',
        ]) {
          expect(tokens[name], `${variant} ${scheme} ${name}`).toBeTruthy();
        }
      }
    }
  });

  it('keeps the clear surface translucent and the solid one opaque', () => {
    expect(glass.alpha.clear.light).toBeLessThan(0.7);
    expect(glass.alpha.clear.dark).toBeLessThan(0.7);
    expect(glass.alpha.clear.light).toBeLessThan(glass.alpha.tinted.light);
    expect(glass.alpha.solid).toEqual({ light: 1, dark: 1 });
    expect(glass.tokens.solid.light['--star-glass-blur']).toBe('0px');
    expect(parse(glass.tokens.clear.light['--star-glass-bg-solid']).a).toBe(1);
  });

  it('passes every contrast check, for any hue, tint, opacity and minimum', () => {
    for (let hue = 0; hue < 360; hue += 45) {
      for (const tint of [0, 1]) {
        for (const opacity of [0.2, 1]) {
          for (const minContrast of [4.5, 7]) {
            const theme = starCreateTheme({ name: 'x', hue, tint, opacity, minContrast });
            const failed = theme.contrast.filter((check) => !check.pass);
            expect(failed, JSON.stringify(theme.options)).toEqual([]);
            expect(theme.contrast).toHaveLength(3 * 2 * 3 * 2);
          }
        }
      }
    }
  });

  it('meets the minimum on the solid fallback and keeps the strong text strongest', () => {
    for (const variant of STAR_THEME_VARIANTS) {
      for (const scheme of STAR_THEME_SCHEMES) {
        const tokens = glass.tokens[variant][scheme];
        const solid = parse(tokens['--star-glass-bg-solid']);
        for (const name of ['--star-glass-text', '--star-glass-text-muted']) {
          expect(contrastRatio(parse(tokens[name]), solid)).toBeGreaterThanOrEqual(4.5);
        }
        const strong = luminance(parse(tokens['--star-glass-text-strong']));
        const text = luminance(parse(tokens['--star-glass-text']));
        if (scheme === 'light') expect(strong).toBeLessThanOrEqual(text);
        else expect(strong).toBeGreaterThanOrEqual(text);
      }
    }
  });

  it('gives the primary color AA contrast for its text and as text', () => {
    const light = glass.tokens.tinted.light;
    const dark = glass.tokens.tinted.dark;
    expect(contrastRatio(WHITE, parse(light['--star-primary']))).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(parse(light['--star-primary']), parse(light['--star-surface-muted'])),
    ).toBeGreaterThanOrEqual(4.5);
    // The dark theme puts the surface color on the primary fill.
    expect(
      contrastRatio(parse(dark['--star-surface']), parse(dark['--star-primary'])),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('scales the radius', () => {
    expect(starCreateTheme({ name: 'x', radius: 0 }).shared['--star-radius-lg']).toBe('0px');
    expect(starCreateTheme({ name: 'x', radius: 2 }).shared['--star-radius-lg']).toBe('24px');
  });
});

describe('starThemeCss', () => {
  const css = starThemeCss(starCreateTheme({ name: 'ocean', hue: 220, angle: 120 }));

  it('scopes the tokens to the theme, the variants and the dark scheme', () => {
    expect(css).toContain("[data-star-theme='ocean'] {");
    expect(css).toContain("[data-star-theme='ocean'][data-star-theme-variant='clear'] {");
    expect(css).toContain("[data-theme='dark'][data-star-theme='ocean'],");
    expect(css).toContain(
      "[data-theme='dark'] [data-star-theme='ocean'][data-star-theme-variant='solid']",
    );
  });

  it('mirrors the highlight angle in right-to-left', () => {
    expect(css).toContain('--star-glass-angle: 120deg;');
    expect(css).toMatch(
      /\[dir='rtl'\]\[data-star-theme='ocean'\][^{]*\{\s*--star-glass-angle: 240deg;/,
    );
  });

  it('turns only the floating layers into glass, never the solid variant or an unstyled part', () => {
    expect(css).toContain(
      ":where([data-star-theme='ocean']:not([data-star-theme-variant='solid']))",
    );
    expect(css).toContain('.star-popover');
    expect(css).toContain('.star-dialog');
    expect(css).not.toContain('.star-table');
    expect(css).not.toContain('.star-card');
    expect(css).toContain(':not([data-star-unstyled])');
    expect(css).toContain('backdrop-filter: blur(var(--star-glass-blur))');
    expect(css).toContain('-webkit-backdrop-filter:');
  });

  it('has the fallbacks for old browsers, more contrast, forced colors and reduced motion', () => {
    expect(css).toContain(
      '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))',
    );
    expect(css).toContain(
      '@media (prefers-contrast: more), (prefers-reduced-transparency: reduce)',
    );
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\[data-star-theme='ocean'\] \{\s*--star-glass-duration: 0s;/,
    );
  });

  it('applies to a document: the tokens resolve under the theme attribute', () => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    const host = document.createElement('div');
    host.setAttribute('data-star-theme', 'ocean');
    document.body.append(host);
    try {
      const value = getComputedStyle(host).getPropertyValue('--star-glass-angle').trim();
      expect(value).toBe('120deg');
    } finally {
      host.remove();
      style.remove();
    }
  });
});

describe('starThemeCss with refraction', () => {
  const plain = starThemeCss(starCreateTheme({ name: 'ocean' }));
  const theme = starCreateTheme({ name: 'ocean', refraction: true });
  const css = starThemeCss(theme);

  it('is off by default and keeps the token none', () => {
    expect(starCreateTheme({ name: 'ocean' }).options.refraction).toBe(false);
    expect(theme.options.refraction).toBe(true);
    expect(theme.shared['--star-glass-refraction-filter']).toBe('none');
    expect(plain).not.toContain('url(');
    expect(plain).not.toContain('@container');
    expect(() => starCreateTheme({ name: 'x', refraction: 'yes' as never })).toThrowError(
      /refraction/,
    );
  });

  it('sets the url only under data-star-refraction, outside every preference', () => {
    expect(css).toContain(
      '@media (prefers-reduced-motion: no-preference) and (prefers-reduced-transparency: no-preference) and (prefers-contrast: no-preference) and (forced-colors: none)',
    );
    const on = ":root[data-star-refraction]:not([data-star-motion='reduced'])";
    expect(css).toContain(`:is(${on}, ${on} *):is([data-star-theme='ocean']) {`);
    expect(css).toMatch(
      /:is\(\[data-star-theme='ocean'\]\) \{\s*--star-glass-refraction-filter: url\('#star-glass-refraction'\);/,
    );
    expect(css).toMatch(
      /\[data-star-theme='ocean'\] \[dir='rtl'\]\) \{\s*--star-glass-refraction-filter: url\('#star-glass-refraction-rtl'\);/,
    );
    expect(css).toMatch(
      /\[data-star-theme='ocean'\]\[data-star-theme-variant='solid'\] \*\) \{\s*--star-glass-refraction-filter: none;/,
    );
  });

  it('puts the url first in the chain of the dock and the toast, only where it is not none', () => {
    const rule =
      /@container not style\(--star-glass-refraction-filter: none\) \{\s*([^{]*)\{([^}]*)\}/.exec(
        css,
      );
    expect(rule).not.toBeNull();
    const [, selector, body] = rule!;
    expect(selector).toContain(
      ":where([data-star-theme='ocean']:not([data-star-theme-variant='solid']))",
    );
    expect(selector).toContain(':where(.star-dock__list):not([data-star-unstyled])');
    expect(selector).toContain("solid'])) .star-toast:not([data-star-unstyled])");
    expect(selector).not.toContain('.star-popover');
    expect(body).toContain(
      'backdrop-filter: var(--star-glass-refraction-filter) blur(var(--star-glass-blur))',
    );
    expect(body).toContain('-webkit-backdrop-filter: var(--star-glass-refraction-filter) blur(');
    // The plain chain comes first, so a layer keeps its blur wherever the rule does not apply.
    expect(css.indexOf('backdrop-filter: blur(var(--star-glass-blur))')).toBeLessThan(
      css.indexOf('@container'),
    );
  });

  it('does not change the contrast check', () => {
    const plainTheme = starCreateTheme({ name: 'ocean' });
    expect(theme.contrast).toEqual(plainTheme.contrast);
    expect(theme.tokens).toEqual(plainTheme.tokens);
  });

  it('keeps refraction off in a document without the attribute', () => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    const host = document.createElement('div');
    host.setAttribute('data-star-theme', 'ocean');
    document.body.append(host);
    try {
      const value = getComputedStyle(host).getPropertyValue('--star-glass-refraction-filter');
      expect(value.trim()).toBe('none');
    } finally {
      host.remove();
      style.remove();
    }
  });
});
