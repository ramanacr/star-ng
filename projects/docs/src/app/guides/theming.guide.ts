import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DOCS, DocsRow } from '../shared/docs';

const names = (prefix: string, items: readonly string[]) => items.map((item) => `${prefix}${item}`);

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './theming.guide.scss',
  selector: 'docs-theming-guide',
  imports: [DOCS, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Theming and tokens"
      lead="Every color, radius, shadow and font of the controls is a CSS custom property with the --star- prefix. Redefine the tokens to give the controls the look of your product."
    >
      <h2>How to override</h2>
      <p>
        Set the tokens after the StarNG styles. Light values go on <code>:root</code>, dark values
        on <code>[data-theme='dark']</code>. You only set the tokens that you change.
      </p>
      <docs-code [code]="override" label="Token override" />
      <p>
        Tokens are plain CSS, so you can also set them on one element. The controls inside that
        element then use the local values:
      </p>
      <docs-code [code]="scoped" label="Scoped override" />

      <h2>Contrast rules</h2>
      <ul>
        <li>
          Text on a filled control must reach 4.5:1 (WCAG AA). The fill of primary controls is
          <code>--star-primary-fill</code> and its text is <code>--star-on-tone</code>. If white
          text on your primary color is under 4.5:1, set a darker <code>--star-primary-fill</code>.
        </li>
        <li>
          Primary text and icons on a surface or a soft tint (active tab, selected option, links on
          hover) use <code>--star-primary-text</code>. It defaults to <code>--star-primary</code>.
          If your primary color is too light for text on surfaces, set a darker
          <code>--star-primary-text</code>. A theme with a light primary color can set both
          <code>--star-primary-text</code> and <code>--star-primary-fill</code>.
        </li>
        <li>
          Success and warning are bright fills. Their text is <code>--star-on-bright</code>
          (dark in both themes).
        </li>
        <li>
          The StarNG test suite measures these ratios in both themes. Run the same check after you
          change the palette.
        </li>
      </ul>

      <h2>Color roles</h2>
      <ul class="docs-swatches">
        @for (name of colors; track name) {
          <li>
            <span class="docs-swatch" [style.background]="'var(' + name + ')'"></span>{{ name }}
          </li>
        }
      </ul>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Color roles
          </caption>
          <thead>
            <tr>
              <th scope="col">Token</th>
              <th scope="col">Use</th>
            </tr>
          </thead>
          <tbody>
            @for (row of colorRoles; track row.name) {
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

      <h2>Chart palette</h2>
      <p>
        Eight series colors in a fixed order. Charts use them from slot 1 and never cycle. Each slot
        has a light and a dark value.
      </p>
      <ul class="docs-swatches">
        @for (name of chart; track name) {
          <li>
            <span class="docs-swatch" [style.background]="'var(' + name + ')'"></span>{{ name }}
          </li>
        }
      </ul>

      <h2>Other token groups</h2>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Token groups
          </caption>
          <thead>
            <tr>
              <th scope="col">Tokens</th>
              <th scope="col">Use</th>
            </tr>
          </thead>
          <tbody>
            @for (row of groups; track row.name) {
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
      <p>
        The full list with the default values is in
        <code>@star-ng/ui/styles/_tokens.scss</code>.
      </p>
      <p>
        To make a whole theme from a hue, with translucent floating layers, see
        <a routerLink="/guides/theme-factory">Theme factory and glass</a>.
      </p>
    </docs-page>
  `,
})
export class ThemingGuide {
  protected readonly colors = names('--star-', [
    'primary',
    'primary-hover',
    'primary-soft',
    'accent',
    'accent-soft',
    'success',
    'success-soft',
    'warning',
    'warning-soft',
    'danger',
    'danger-soft',
    'surface',
    'surface-muted',
    'border',
    'border-strong',
    'text-strong',
    'text',
    'text-muted',
    'text-soft',
  ]);
  protected readonly chart = names('--star-chart-', ['1', '2', '3', '4', '5', '6', '7', '8']);

  protected readonly colorRoles: readonly DocsRow[] = [
    {
      name: '--star-primary, -hover, -soft',
      description: 'Main action color: primary button, checked boxes, selected items.',
    },
    {
      name: '--star-primary-fill, --star-primary-text',
      description:
        'Primary color as a fill under white text (default: --star-primary) and as the color of text and icons on a surface (default: --star-primary).',
    },
    {
      name: '--star-accent, -soft',
      description: 'Focus border of text controls, links, the info severity.',
    },
    {
      name: '--star-success, --star-warning, --star-danger (+ -soft)',
      description: 'Status colors and their soft fills (tags, messages).',
    },
    {
      name: '--star-help',
      description: 'Fill of the help button variant (white or dark text at 4.5:1 or more).',
    },
    {
      name: '--star-surface, --star-surface-muted',
      description: 'Control and panel ground; page ground and filled inputs.',
    },
    { name: '--star-border, --star-border-strong', description: 'Dividers and control borders.' },
    {
      name: '--star-text-strong, --star-text, --star-text-muted, --star-text-soft',
      description:
        'Headings and values; body text; labels, hints and placeholders; icons and decoration only (soft is under 4.5:1 on the surface, so never use it for text to read).',
    },
  ];

  protected readonly groups: readonly DocsRow[] = [
    { name: '--star-space-1 … --star-space-12', description: 'Spacing scale (0.25rem steps).' },
    { name: '--star-radius-xs … --star-radius-4xl, --star-radius-pill', description: 'Radius.' },
    { name: '--star-shadow-xs … --star-shadow-xl, -card, -modal, -float', description: 'Shadows.' },
    {
      name: '--star-focus-ring, --star-focus-ring-primary',
      description: 'Focus rings (box-shadow values).',
    },
    {
      name: '--star-font-sans, --star-font-mono',
      description: 'Font stacks. The defaults are system fonts: no font files load.',
    },
    {
      name: '--star-type-eyebrow … --star-type-display, --star-type-code',
      description: 'Font shorthands (weight size/line-height family) of the type scale.',
    },
    {
      name: '--star-button-*, --star-label-*, --star-input-*',
      description: 'Radius, weight, letter spacing and text transform of buttons, labels, inputs.',
    },
    { name: '--star-duration-fast, -base, -slow', description: 'Motion durations.' },
    { name: '--star-blur-xs … --star-blur-3xl', description: 'Backdrop blur radii.' },
    {
      name: '--star-glass-*, --star-scrim, --star-scrim-modal, --star-tooltip-surface',
      description: 'Translucent surfaces, overlay backdrops and the tooltip ground.',
    },
    {
      name: '--star-media-*, --star-scrim-media, --star-scrim-media-soft, --star-scrim-media-strong, --star-on-scrim',
      description:
        'Media: the dark stage of the galleria, the scrims on a photo (count, hover hint, caption), the text on them and the round arrow buttons. They stay dark in both themes.',
    },
  ];

  protected readonly override = `/* src/styles.css, after the StarNG styles */
:root {
  --star-primary: #0f766e;
  --star-primary-hover: #115e59;
  --star-primary-soft: #ccfbf1;
  --star-focus-ring-primary: 0 0 0 4px rgba(15, 118, 110, 0.2);

  --star-font-sans: 'Inter', system-ui, sans-serif;
  --star-button-radius: 9999px;
  --star-button-text-transform: uppercase;
  --star-button-letter-spacing: 0.08em;
}

[data-theme='dark'] {
  --star-primary: #2dd4bf;
  --star-primary-hover: #5eead4;
  --star-primary-soft: #0f2f2c;
}`;

  protected readonly scoped = `.billing-area {
  --star-primary: #b45309;
  --star-primary-hover: #92400e;
}`;
}
