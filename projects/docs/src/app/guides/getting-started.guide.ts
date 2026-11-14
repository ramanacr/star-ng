import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarButton } from 'star-ng/button';
import { DOCS } from '../shared/docs';

@Component({
  selector: 'docs-getting-started-guide',
  imports: [DOCS, StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Getting started"
      lead="Install the package, include the styles and the icon font, then import a control."
    >
      <h2>Requirements</h2>
      <ul>
        <li>
          Angular 22 or later (<code>&#64;angular/core</code>, <code>common</code>,
          <code>forms</code>).
        </li>
        <li><code>&#64;angular/cdk</code> 22 or later (overlays, menus, focus management).</li>
        <li>
          <code>&#64;phosphor-icons/web</code> 2.1 or later (the icons that the controls draw).
        </li>
      </ul>

      <h2>1. Install</h2>
      <docs-code [code]="install" label="Install command" />

      <h2>2. Include the styles</h2>
      <p>
        The controls use global styles on the <code>--star-*</code> tokens. Add the compiled CSS and
        the two Phosphor icon weights that the controls use to the <code>styles</code> of your build
        target in <code>angular.json</code>:
      </p>
      <docs-code [code]="angularJson" label="angular.json styles" />
      <p>
        If your application uses Sass, you can use the SCSS entry instead. You then compile the
        styles with your own build and can include only the tokens:
      </p>
      <docs-code [code]="scss" label="Sass entry" />

      <h2>3. Use a control</h2>
      <p>
        Every control group is an entry point of the package. Import from the entry point, not from
        the package root, to keep your bundle small.
      </p>
      <docs-code [code]="usage" label="Component code" />
      <docs-example heading="Result" source="getting-started/result">
        <star-button leadingIcon="ph-bold ph-plus">New order</star-button>
      </docs-example>

      <h2>Next steps</h2>
      <ul>
        <li><strong>Theming and tokens</strong>: set your own colors, radius and fonts.</li>
        <li><strong>Dark mode</strong>: the theme service and the first-paint script.</li>
        <li><strong>Forms</strong>: Signal Forms and Reactive Forms.</li>
        <li><strong>Internationalisation</strong>: translate the built-in control text.</li>
      </ul>
    </docs-page>
  `,
})
export class GettingStartedGuide {
  protected readonly install = `pnpm add star-ng @angular/cdk @phosphor-icons/web
# or
npm install star-ng @angular/cdk @phosphor-icons/web`;

  protected readonly angularJson = `"styles": [
  "@phosphor-icons/web/bold/style.css",
  "@phosphor-icons/web/fill/style.css",
  "star-ng/styles/star-ng.css",
  "src/styles.scss"
]`;

  protected readonly scss = `// src/styles.scss
@use 'star-ng/styles/star-ng'; // tokens, base rules and every control

// Or only the tokens, for example in a micro frontend that gets the control styles from its host:
// @use 'star-ng/styles/tokens';`;

  protected readonly usage = `import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarButton } from 'star-ng/button';

@Component({
  selector: 'app-orders',
  imports: [StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<star-button leadingIcon="ph-bold ph-plus" (pressed)="create()">New order</star-button>\`,
})
export class Orders {
  create(): void {}
}`;
}
