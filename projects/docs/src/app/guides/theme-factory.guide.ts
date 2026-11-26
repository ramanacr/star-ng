import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { StarSelectButton } from '@star-ng/ui/select-button';
import { StarSlider } from '@star-ng/ui/slider';
import { StarThemeService } from '@star-ng/ui/theme';
import { starCreateTheme, starThemeCss, StarThemeVariant } from '@star-ng/ui/theme-factory';
import { DOCS, DocsRow } from '../shared/docs';

/**
 * Floating layers drawn in place (no overlay), so the preview shows them over its fixed backdrop.
 * The classes are the ones the controls render; the glass rules of the theme style them.
 */
@Component({
  selector: 'docs-glass-layers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'docs-glass-layers' },
  template: `
    <div class="star-popover docs-glass-layers__popover">
      <p class="docs-glass-layers__title">Invoice INV-2041</p>
      <p class="docs-glass-layers__muted">Due on 12 March. Sent to billing&#64;example.com.</p>
    </div>
    <div class="star-menu docs-glass-layers__menu">
      <span class="star-menu__item">Open order</span>
      <span class="star-menu__item">Duplicate</span>
      <span class="star-menu__item">Archive</span>
    </div>
    <div class="star-toast docs-glass-layers__toast">
      <div>
        <p class="star-toast__summary">Saved</p>
        <p class="star-toast__detail">Project Harbor was updated.</p>
      </div>
    </div>
  `,
})
export class DocsGlassLayers {}

const VARIANTS: readonly StarThemeVariant[] = ['clear', 'tinted', 'solid'];

@Component({
  selector: 'docs-theme-factory-guide-content',
  imports: [DOCS, StarSelectButton, StarSlider, DocsGlassLayers],
  encapsulation: ViewEncapsulation.None,
  styleUrl: './theme-factory.guide-content.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Theme factory and glass theme"
      lead="The theme factory makes a complete theme from a few inputs: color roles, radius scale and translucent floating layers, light and dark, in three variants. It checks the text contrast against the worst backdrop. The glass theme is the first theme it makes."
      importFrom="import { starCreateTheme, starThemeCss } from '@star-ng/ui/theme-factory';"
    >
      <h2>Use the glass theme</h2>
      <p>
        Load the theme after the StarNG styles, then set <code>data-star-theme="glass"</code> on
        <code>&lt;html&gt;</code>. The theme follows the light and dark theme
        (<code>data-theme</code>). The compiled file is
        <code>&#64;star-ng/ui/styles/themes/glass.css</code>.
      </p>
      <docs-code [code]="useScss" label="Load the glass theme" />
      <docs-code [code]="useHtml" label="Turn it on" />
      <p>
        <code>data-star-theme-variant</code> picks how much of the backdrop shows through:
        <code>clear</code>, <code>tinted</code> (the default) or <code>solid</code>. Offer the solid
        variant as a user setting: some people find translucent surfaces hard to read.
      </p>

      <docs-example
        heading="Glass layers"
        source="theme-factory/glass"
        [script]="glassScript"
        note="The preview has a fixed backdrop. Switch the light and dark theme and the direction in the header to see both schemes and the mirrored highlight."
      >
        <star-select-button
          [options]="variants"
          [(value)]="variant"
          [allowEmpty]="false"
          ariaLabel="Variant"
        />
        <div
          class="docs-glass-stage"
          data-star-theme="glass"
          [attr.data-star-theme-variant]="variant()"
        >
          <docs-glass-layers />
        </div>
      </docs-example>

      <h2>What turns into glass</h2>
      <p>
        Only the floating layers: overlay panels (select, autocomplete, date picker), popovers,
        menus, dialogs, drawers, bottom sheets, toasts, sticky and fixed app bars and the dock.
        Inputs, tables and cards stay opaque. Each glass layer costs GPU time, so few layers are on
        the screen at once.
      </p>
      <p>
        The rules have the weight of one class. A class of your own on a layer (pass-through
        <code>pt</code>) wins, and a part in unstyled mode keeps no glass.
      </p>

      <h2>Make your own theme</h2>
      <p>
        <code>starCreateTheme</code> takes a name and the inputs below; every input except the name
        has a default. <code>starThemeCss</code> turns the result into CSS. Run it in a build script
        and save the CSS, or run it in the browser.
      </p>
      <docs-code [code]="createCode" label="Create a theme" />

      <docs-example
        heading="Factory playground"
        source="theme-factory/playground"
        [script]="playgroundScript"
        note="The preview applies the generated tokens of the current scheme. The table lists the surface opacity in use and the lowest text contrast of each variant."
      >
        <div class="docs-glass-controls">
          <div class="docs-glass-controls__row">
            <span id="tf-hue">Hue: {{ hue() }}</span>
            <star-slider [(value)]="hue" [min]="0" [max]="359" ariaLabelledBy="tf-hue" />
          </div>
          <div class="docs-glass-controls__row">
            <span id="tf-opacity">Opacity: {{ opacity() }}%</span>
            <star-slider [(value)]="opacity" [min]="20" [max]="100" ariaLabelledBy="tf-opacity" />
          </div>
          <div class="docs-glass-controls__row">
            <span id="tf-blur">Blur: {{ blur() }}px</span>
            <star-slider [(value)]="blur" [min]="0" [max]="40" ariaLabelledBy="tf-blur" />
          </div>
          <div class="docs-glass-controls__row">
            <span id="tf-tint">Tint: {{ tint() }}%</span>
            <star-slider [(value)]="tint" [min]="0" [max]="100" ariaLabelledBy="tf-tint" />
          </div>
          <div class="docs-glass-controls__row">
            <span id="tf-radius">Radius: {{ radius() }}%</span>
            <star-slider [(value)]="radius" [min]="0" [max]="200" ariaLabelledBy="tf-radius" />
          </div>
        </div>
        <star-select-button
          [options]="variants"
          [(value)]="playVariant"
          [allowEmpty]="false"
          ariaLabel="Playground variant"
        />
        <div
          class="docs-glass-stage"
          data-star-theme="glass"
          [attr.data-star-theme-variant]="playVariant()"
          [style]="previewStyle()"
        >
          <docs-glass-layers />
        </div>
        <div class="docs-table-wrap">
          <table class="docs-table">
            <caption>
              Contrast check
            </caption>
            <thead>
              <tr>
                <th scope="col">Variant</th>
                <th scope="col">Scheme</th>
                <th scope="col">Opacity</th>
                <th scope="col">Lowest ratio</th>
              </tr>
            </thead>
            <tbody>
              @for (row of report(); track row.variant + row.scheme) {
                <tr>
                  <th scope="row">{{ row.variant }}</th>
                  <td>{{ row.scheme }}</td>
                  <td>{{ row.alpha }}</td>
                  <td>{{ row.ratio }}:1</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </docs-example>
      <p>The CSS of the playground theme:</p>
      <docs-code [code]="css()" label="Generated CSS" />

      <h2>How the contrast check works</h2>
      <ul>
        <li>
          The backdrop behind a glass layer can be anything, so the factory checks a grid of
          backdrop colors from black to white, saturated colors included.
        </li>
        <li>
          Each grid color goes through the backdrop filter of the variant. The
          <code>contrast()</code>, <code>saturate()</code> and <code>brightness()</code> functions
          narrow the range of the backdrop: a more uniform surface, not a stronger blur.
        </li>
        <li>
          The surface goes over each filtered color, with and without the edge highlight. The text
          colors of the layer (<code>--star-glass-text</code>, <code>-strong</code>,
          <code>-muted</code>) move away from the surface until they reach
          <code>minContrast</code> (4.5:1 at least) over the whole range and over the solid
          fallback.
        </li>
        <li>
          Only when no text color can pass does the factory raise the surface opacity. At a low
          opacity the muted text gets close to the body text: the contrast comes first.
        </li>
      </ul>

      <h2>Accessibility and fallbacks</h2>
      <ul>
        <li>
          <code>prefers-contrast: more</code> and <code>prefers-reduced-transparency: reduce</code>:
          the layers use the solid surface and no blur.
        </li>
        <li><code>forced-colors: active</code>: system colors, no blur.</li>
        <li>
          A browser without <code>backdrop-filter</code>: the solid surface
          (<code>--star-glass-bg-solid</code>).
        </li>
        <li>
          <code>prefers-reduced-motion</code> and
          <code>provideStarNg(&#123; reducedMotion: 'always' &#125;)</code>:
          <code>--star-glass-duration</code> is <code>0s</code>.
        </li>
        <li>Right to left: the angle of the edge highlight is mirrored.</li>
      </ul>

      <h2>Factory inputs</h2>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            starCreateTheme options
          </caption>
          <thead>
            <tr>
              <th scope="col">Option</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            @for (row of inputs; track row.name) {
              <tr>
                <th scope="row">
                  <code>{{ row.name }}</code>
                </th>
                <td>{{ row.description }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <h2>Glass tokens</h2>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Glass tokens
          </caption>
          <thead>
            <tr>
              <th scope="col">Tokens</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            @for (row of tokens; track row.name) {
              <tr>
                <th scope="row">
                  <code>{{ row.name }}</code>
                </th>
                <td>{{ row.description }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </docs-page>
  `,
})
export class ThemeFactoryGuideContent {
  private readonly scheme = inject(StarThemeService).theme;

  protected readonly variants = VARIANTS;
  protected readonly variant = signal<StarThemeVariant>('tinted');
  protected readonly playVariant = signal<StarThemeVariant>('tinted');

  protected readonly hue = signal(265);
  protected readonly opacity = signal(55);
  protected readonly blur = signal(20);
  protected readonly tint = signal(30);
  protected readonly radius = signal(125);

  protected readonly theme = computed(() =>
    starCreateTheme({
      name: 'glass',
      hue: this.hue(),
      opacity: this.opacity() / 100,
      blur: this.blur(),
      tint: this.tint() / 100,
      radius: this.radius() / 100,
    }),
  );

  protected readonly css = computed(() => starThemeCss(this.theme()));

  /** The tokens of the current scheme and variant, as custom properties on the preview. */
  protected readonly previewStyle = computed(() => {
    const theme = this.theme();
    // The angle stays with the theme CSS, which mirrors it in right to left.
    const shared = Object.fromEntries(
      Object.entries(theme.shared).filter(([name]) => name !== '--star-glass-angle'),
    );
    return { ...shared, ...theme.tokens[this.playVariant()][this.scheme()] };
  });

  protected readonly report = computed(() => {
    const theme = this.theme();
    return VARIANTS.flatMap((variant) =>
      (['light', 'dark'] as const).map((scheme) => ({
        variant,
        scheme,
        alpha: theme.alpha[variant][scheme],
        ratio: Math.min(
          ...theme.contrast
            .filter((check) => check.variant === variant && check.scheme === scheme)
            .map((check) => check.ratio),
        ),
      })),
    );
  });

  protected readonly useScss = `// src/styles.scss
@use '@star-ng/ui/styles/star-ng';
@use '@star-ng/ui/styles/themes/glass';`;

  protected readonly useHtml = `<html data-star-theme="glass" data-star-theme-variant="tinted">`;

  protected readonly glassScript = `variants = ['clear', 'tinted', 'solid'];
variant = signal<StarThemeVariant>('tinted');`;

  protected readonly playgroundScript = `theme = computed(() =>
  starCreateTheme({
    name: 'glass',
    hue: this.hue(),
    opacity: this.opacity() / 100,
    blur: this.blur(),
    tint: this.tint() / 100,
    radius: this.radius() / 100,
  }),
);
css = computed(() => starThemeCss(this.theme()));`;

  protected readonly createCode = `import { starCreateTheme, starThemeCss } from '@star-ng/ui/theme-factory';

const theme = starCreateTheme({
  name: 'ocean', // [data-star-theme='ocean']
  hue: 220,
  opacity: 0.6,
  blur: 16,
  tint: 0.4,
  radius: 1.25,
});

theme.contrast.every((check) => check.pass); // true
writeFileSync('src/ocean-theme.css', starThemeCss(theme));`;

  protected readonly inputs: readonly DocsRow[] = [
    { name: 'name', description: 'Lowercase letters, digits and hyphens. Required.' },
    { name: 'hue', description: 'Base hue, OKLCH degrees 0 to 360. Default 265.' },
    {
      name: 'opacity',
      description:
        'Surface opacity of the clear variant, 0.2 to 1; tinted adds a third of the rest. Raised only when no text color passes. Default 0.6.',
    },
    { name: 'blur', description: 'Backdrop blur of the clear variant in px, 0 to 64. Default 16.' },
    { name: 'tint', description: 'How strongly the hue tints the surfaces, 0 to 1. Default 0.3.' },
    { name: 'radius', description: 'Factor of the radius scale, 0 to 3. Default 1.' },
    { name: 'angle', description: 'Angle of the edge highlight in degrees. Default 135.' },
    { name: 'minContrast', description: 'Least text contrast, 4.5 to 21. Default 4.5.' },
  ];

  protected readonly tokens: readonly DocsRow[] = [
    {
      name: '--star-glass-bg, --star-glass-bg-solid',
      description: 'Translucent surface of a layer, and the opaque surface of the fallbacks.',
    },
    { name: '--star-glass-tint', description: 'The hue the surfaces are tinted with.' },
    {
      name: '--star-glass-blur, -contrast, -saturate, -brightness',
      description: 'The backdrop filter of the layers.',
    },
    {
      name: '--star-glass-border-color, -rim-highlight, -specular, -shadow',
      description: 'Border, the inner top edge, the corner highlight and the shadow.',
    },
    {
      name: '--star-glass-text, -text-strong, -text-muted',
      description: 'Text colors inside a layer; they meet the contrast minimum over any backdrop.',
    },
    {
      name: '--star-glass-radius, --star-glass-angle',
      description: 'Layer radius and the highlight angle (mirrored in right to left).',
    },
    {
      name: '--star-glass-duration, --star-glass-easing',
      description: 'Motion for your own glass transitions; 0s with reduced motion.',
    },
    {
      name: '--star-glass-refraction-filter',
      description: 'Reserved for edge refraction (Chromium only, planned). none for now.',
    },
  ];
}

@Component({
  selector: 'docs-theme-factory-guide',
  imports: [ThemeFactoryGuideContent],
  encapsulation: ViewEncapsulation.None,
  styleUrl: './theme-factory.guide.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<docs-theme-factory-guide-content />`,
})
export class ThemeFactoryGuide {}
