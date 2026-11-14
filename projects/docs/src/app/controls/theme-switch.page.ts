import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { StarThemeService } from 'star-ng/theme';
import { StarThemeSwitch } from 'star-ng/theme-switch';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-theme-switch-page',
  imports: [DOCS, StarThemeSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Theme switch"
      lead="A small speed dial with System, Light and Dark. The button shows the icon of the current choice and is named, for example, Theme: Dark. It uses StarThemeService, which applies and saves the choice."
      importFrom="import { StarThemeSwitch } from 'star-ng/theme-switch';"
    >
      <docs-example
        heading="Theme switch"
        source="theme-switch/basic"
        note="The control has no position of its own: the page that uses it places it. The texts come from STAR_UI_TEXT (theme, themeSystem, themeLight, themeDark). This example changes the theme of this whole page."
      >
        <div class="docs-row docs-theme-area">
          <star-theme-switch />
          <p class="docs-output" role="status">
            Choice: {{ theme.mode() }}. Theme in use: {{ theme.theme() }}.
          </p>
        </div>
      </docs-example>

      <h2>Place it in a fixed corner</h2>
      <p>
        <code>star-theme-switch</code> is not <code>position: fixed</code>. Put it in a header, or
        give the element a position in the stylesheet of the application:
      </p>
      <docs-code [code]="css" label="Fixed corner" />

      <docs-api [of]="['StarThemeSwitch']" [cssVars]="cssVars" [keyboard]="keyboard" />
      <p>
        The control is a <code>star-speed-dial</code>. See the speed dial page for its CSS variables
        and keys. The package entry point <code>star-ng/theme-switch</code> imports
        <code>star-ng/theme</code> and <code>star-ng/utility</code>; the entry point
        <code>star-ng/theme</code> stays free of them.
      </p>
    </docs-page>
  `,
  styles: `
    .docs-theme-area {
      min-height: 11rem;
      align-items: flex-start;
    }
  `,
})
export class ThemeSwitchPage {
  protected readonly theme = inject(StarThemeService);

  protected readonly css = `star-theme-switch {
  position: fixed;
  top: var(--star-space-3);
  inset-inline-end: var(--star-space-4);
  z-index: 40;
}`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-primary-fill', description: 'Background of the button.' },
    { name: '--star-primary', description: 'Color of the current choice in the list.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Enter / Space',
      description: 'On the button: opens the list. The focus moves to System.',
    },
    { name: 'Arrow down / Arrow up', description: 'Moves between System, Light and Dark.' },
    {
      name: 'Enter / Space',
      description: 'On a choice: applies it, closes the list and returns the focus to the button.',
    },
    { name: 'Escape', description: 'Closes the list.' },
  ];
}
